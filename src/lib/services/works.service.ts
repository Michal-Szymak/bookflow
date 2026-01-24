import type { SupabaseClient } from "@/db/supabase.client";
import type { WorkRow, WorkWithPrimaryEditionDto, PrimaryEditionSummaryDto, WorkListItemDto } from "@/types";
import type { CreateWorkCommand } from "@/types";

/**
 * Works Service
 *
 * Handles database operations for works, including manual work creation,
 * author-work relationships, and primary edition management.
 */
export class WorksService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Checks user's work limit and returns current count and max limit.
   * Expects user profile to exist (should be created during user registration).
   *
   * @param userId - User ID to check limits for
   * @returns Object with workCount and maxWorks
   * @throws Error if database operation fails or profile is not found
   */
  async checkUserWorkLimit(userId: string): Promise<{ workCount: number; maxWorks: number }> {
    const { data: profile, error: fetchError } = await this.supabase
      .from("profiles")
      .select("work_count, max_works")
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      // Profile not found - this should not happen if profile is created during registration
      if (fetchError.code === "PGRST116") {
        throw new Error(`User profile not found for user ${userId}. Profile should be created during registration.`);
      }

      throw new Error(`Failed to fetch user profile: ${fetchError.message}`);
    }

    if (!profile) {
      throw new Error(`User profile not found for user ${userId}. Profile should be created during registration.`);
    }

    return {
      workCount: profile.work_count,
      maxWorks: profile.max_works,
    };
  }

  /**
   * Verifies that all provided author IDs exist and are accessible to the user.
   * Uses batch lookup with IN clause for efficiency.
   * Respects RLS policies - only returns authors accessible to the user.
   *
   * @param authorIds - Array of author UUIDs to verify
   * @param userId - User ID for RLS context (not used directly, but affects RLS filtering)
   * @returns Array of invalid author IDs (empty if all are valid)
   * @throws Error if database query fails
   */
  async verifyAuthorsExist(authorIds: string[], userId: string): Promise<string[]> {
    if (authorIds.length === 0) {
      return [];
    }

    // Batch lookup all authors at once
    const { data: authors, error } = await this.supabase.from("authors").select("id").in("id", authorIds);

    if (error) {
      throw new Error(`Failed to verify authors: ${error.message}`);
    }

    // Find which author IDs were not found or not accessible (RLS filtered)
    const foundAuthorIds = new Set(authors?.map((a) => a.id) || []);
    const invalidAuthorIds = authorIds.filter((id) => !foundAuthorIds.has(id));

    return invalidAuthorIds;
  }

  /**
   * Creates a manual work owned by the specified user and links it to authors.
   * Uses transaction-like approach: creates work first, then creates author-work links.
   * Validates constraints and handles database errors appropriately.
   *
   * @param userId - User ID who will own the work
   * @param data - Work creation data (title, author_ids, optional first_publish_year, optional primary_edition_id)
   * @returns Created work row
   * @throws Error with appropriate message for constraint violations or other DB errors
   */
  async createManualWork(userId: string, data: CreateWorkCommand): Promise<WorkRow> {
    const trimmedTitle = data.title.trim();

    // Step 1: Create the work (without primary_edition_id initially)
    const { data: work, error: workError } = await this.supabase
      .from("works")
      .insert({
        title: trimmedTitle,
        manual: true,
        owner_user_id: userId,
        openlibrary_id: null,
        first_publish_year: data.first_publish_year ?? null,
        primary_edition_id: null, // Will be set later if provided
      })
      .select()
      .single();

    if (workError) {
      // Handle PostgreSQL constraint violations
      if (workError.code === "23514") {
        // Check constraint violation (works_manual_owner or works_manual_or_ol)
        const constraintName = workError.message.includes("works_manual_owner")
          ? "works_manual_owner"
          : "works_manual_or_ol";
        throw new Error(`Database constraint violation: ${constraintName}`);
      }

      if (workError.code === "42501") {
        // RLS policy violation
        throw new Error("Cannot create manual work without ownership");
      }

      // Generic database error
      throw new Error(`Failed to create work: ${workError.message}`);
    }

    if (!work) {
      throw new Error("Failed to create work: no data returned");
    }

    // Step 2: Create author-work links (batch insert)
    if (data.author_ids.length > 0) {
      const authorWorkLinks = data.author_ids.map((authorId) => ({
        author_id: authorId,
        work_id: work.id,
      }));

      const { error: linksError } = await this.supabase.from("author_works").insert(authorWorkLinks);

      if (linksError) {
        // If links fail, we should ideally rollback the work creation
        // However, Supabase doesn't support transactions in the client
        // In production, this could be handled with a database function or trigger
        // For now, we'll throw an error and let the caller handle cleanup if needed
        throw new Error(`Failed to create author-work links: ${linksError.message}`);
      }
    }

    // Step 3: Validate and set primary_edition_id if provided
    if (data.primary_edition_id) {
      // Verify that the edition exists and belongs to this work
      const { data: edition, error: editionError } = await this.supabase
        .from("editions")
        .select("id, work_id")
        .eq("id", data.primary_edition_id)
        .single();

      if (editionError || !edition) {
        throw new Error(`Primary edition not found: ${data.primary_edition_id}`);
      }

      if (edition.work_id !== work.id) {
        throw new Error(`Primary edition does not belong to this work`);
      }

      // Update work with primary_edition_id
      const { error: updateError } = await this.supabase
        .from("works")
        .update({ primary_edition_id: data.primary_edition_id })
        .eq("id", work.id);

      if (updateError) {
        throw new Error(`Failed to set primary edition: ${updateError.message}`);
      }

      // Update the work object to reflect the change
      work.primary_edition_id = data.primary_edition_id;
    }

    return work;
  }

  /**
   * Finds a single work by ID with its primary edition details.
   * Fetches work first, then fetches primary edition if it exists.
   * Respects RLS policies - returns null if work is not accessible to the user.
   *
   * @param workId - Work UUID to look up
   * @returns WorkWithPrimaryEditionDto if found and accessible, null otherwise
   * @throws Error if database query fails
   */
  async findByIdWithPrimaryEdition(workId: string): Promise<WorkWithPrimaryEditionDto | null> {
    // Step 1: Fetch work
    const { data: work, error: workError } = await this.supabase
      .from("works")
      .select(
        "id, title, openlibrary_id, first_publish_year, primary_edition_id, manual, owner_user_id, created_at, updated_at"
      )
      .eq("id", workId)
      .maybeSingle();

    if (workError) {
      throw new Error(`Failed to fetch work from database: ${workError.message}`);
    }

    if (!work) {
      return null;
    }

    // Step 2: Fetch primary edition if it exists
    let primaryEdition: PrimaryEditionSummaryDto | null = null;
    if (work.primary_edition_id) {
      const { data: edition, error: editionError } = await this.supabase
        .from("editions")
        .select("id, title, openlibrary_id, publish_year, publish_date, publish_date_raw, isbn13, cover_url, language")
        .eq("id", work.primary_edition_id)
        .maybeSingle();

      if (editionError) {
        // Log error but don't fail - primary edition might have been deleted
        // This is acceptable since the FK constraint is ON DELETE SET NULL
        throw new Error(`Failed to fetch primary edition: ${editionError.message}`);
      }

      if (edition) {
        primaryEdition = {
          id: edition.id,
          title: edition.title,
          openlibrary_id: edition.openlibrary_id,
          publish_year: edition.publish_year,
          publish_date: edition.publish_date,
          publish_date_raw: edition.publish_date_raw,
          isbn13: edition.isbn13,
          cover_url: edition.cover_url,
          language: edition.language,
        };
      }
    }

    return {
      id: work.id,
      title: work.title,
      openlibrary_id: work.openlibrary_id,
      first_publish_year: work.first_publish_year,
      primary_edition_id: work.primary_edition_id,
      manual: work.manual,
      owner_user_id: work.owner_user_id,
      created_at: work.created_at,
      updated_at: work.updated_at,
      primary_edition: primaryEdition,
    };
  }

  /**
   * Finds works by author ID with pagination and sorting.
   * Returns works with their primary edition information and computed publish year.
   * Used by GET /api/authors/{authorId}/works endpoint.
   *
   * @param authorId - Author UUID to find works for
   * @param page - Page number (1-based)
   * @param sort - Sort order: "published_desc" or "title_asc"
   * @returns Object with items (WorkListItemDto[]) and total count
   * @throws Error if database query fails
   */
  async findWorksByAuthorId(
    authorId: string,
    page: number,
    sort: "published_desc" | "title_asc"
  ): Promise<{ items: WorkListItemDto[]; total: number }> {
    const pageSize = 20;
    const offset = (page - 1) * pageSize;

    // Build query for works with primary edition
    let query = this.supabase
      .from("author_works")
      .select(
        `
        work:works!author_works_work_id_fkey(
          id,
          title,
          openlibrary_id,
          first_publish_year,
          primary_edition_id,
          manual,
          owner_user_id,
          created_at,
          updated_at,
          primary_edition:editions!works_primary_edition_fk(
            id,
            title,
            openlibrary_id,
            publish_year,
            publish_date,
            publish_date_raw,
            isbn13,
            cover_url,
            language
          )
        )
      `,
        { count: "exact" }
      )
      .eq("author_id", authorId);

    // Apply sorting
    if (sort === "published_desc") {
      query = query.order("created_at", { ascending: false, referencedTable: "works" });
    } else if (sort === "title_asc") {
      query = query.order("title", { ascending: true, referencedTable: "works" });
    }

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch works: ${error.message}`);
    }

    // Transform the data to WorkListItemDto format
    const items: WorkListItemDto[] =
      data?.map((item: any) => {
        const work = item.work as any;
        const primaryEdition: PrimaryEditionSummaryDto | null =
          work.primary_edition && Array.isArray(work.primary_edition) && work.primary_edition.length > 0
            ? (work.primary_edition[0] as PrimaryEditionSummaryDto)
            : work.primary_edition && !Array.isArray(work.primary_edition)
              ? (work.primary_edition as PrimaryEditionSummaryDto)
              : null;

        // Compute publish_year: COALESCE(work.first_publish_year, edition.publish_year)
        const publishYear = work.first_publish_year ?? primaryEdition?.publish_year ?? null;

        return {
          id: work.id,
          title: work.title,
          openlibrary_id: work.openlibrary_id,
          first_publish_year: work.first_publish_year,
          primary_edition_id: work.primary_edition_id,
          manual: work.manual,
          owner_user_id: work.owner_user_id,
          created_at: work.created_at,
          updated_at: work.updated_at,
          primary_edition: primaryEdition,
          publish_year: publishYear,
        };
      }) || [];

    return {
      items,
      total: count || 0,
    };
  }
}
