import type { SupabaseClient } from "@/db/supabase.client";
import type {
  EditionRow,
  WorkRow,
  WorkWithPrimaryEditionDto,
  PrimaryEditionSummaryDto,
  WorkListItemDto,
} from "@/types";
import type { CreateWorkCommand } from "@/types";

interface RpcResponse<T> {
  data: T | null;
  error: { message: string } | null;
}

type RpcCaller = <T>(fn: string, args: Record<string, unknown>) => Promise<RpcResponse<T>>;

/**
 * Works Service
 *
 * Handles database operations for works, including manual work creation,
 * author-work relationships, and primary edition management.
 */
export class WorksService {
  constructor(private supabase: SupabaseClient) {}

  private callRpc<T>(fn: string, args: Record<string, unknown>): Promise<RpcResponse<T>> {
    return (this.supabase as unknown as { rpc: RpcCaller }).rpc<T>(fn, args);
  }

  /**
   * Upserts a work from OpenLibrary using SECURITY DEFINER RPC.
   * Ensures global catalog entries (manual=false, owner_user_id=null) are managed in the database.
   *
   * @param data - Work data from OpenLibrary
   * @returns Work row after upsert
   * @throws Error if database operation fails or result cannot be retrieved
   */
  async upsertWorkFromOpenLibrary(data: {
    openlibrary_id: string;
    title: string;
    first_publish_year: number | null;
  }): Promise<WorkRow> {
    const workData = {
      openlibrary_id: data.openlibrary_id,
      title: data.title.trim(),
      first_publish_year: data.first_publish_year ?? null,
    };

    const { data: rpcResult, error } = await this.callRpc<unknown>("upsert_work_from_ol", {
      work_data: workData,
    });

    if (error) {
      throw new Error(`Failed to upsert work from OpenLibrary: ${error.message}`);
    }

    const workId = this.extractIdFromRpcResult(rpcResult, ["id", "work_id"]);
    const { data: work, error: fetchError } = await this.supabase
      .from("works")
      .select("*")
      .eq(workId ? "id" : "openlibrary_id", workId ?? workData.openlibrary_id)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch upserted work: ${fetchError.message}`);
    }

    if (!work) {
      throw new Error("Failed to retrieve upserted work from database");
    }

    return work;
  }

  /**
   * Upserts an edition from OpenLibrary using SECURITY DEFINER RPC.
   * Ensures global catalog entries (manual=false, owner_user_id=null) are managed in the database.
   *
   * @param data - Edition data from OpenLibrary
   * @returns Edition row after upsert
   * @throws Error if database operation fails or result cannot be retrieved
   */
  async upsertEditionFromOpenLibrary(data: {
    work_id: string;
    openlibrary_id: string;
    title: string;
    publish_year: number | null;
    publish_date: string | null;
    publish_date_raw: string | null;
    isbn13: string | null;
    cover_url: string | null;
    language: string | null;
  }): Promise<EditionRow> {
    const editionData = {
      work_id: data.work_id,
      openlibrary_id: data.openlibrary_id,
      title: data.title.trim(),
      publish_year: data.publish_year ?? null,
      publish_date: data.publish_date ?? null,
      publish_date_raw: data.publish_date_raw ?? null,
      isbn13: data.isbn13 ?? null,
      cover_url: data.cover_url ?? null,
      language: data.language ?? null,
    };

    const { data: rpcResult, error } = await this.callRpc<unknown>("upsert_edition_from_ol", {
      edition_data: editionData,
    });

    if (error) {
      throw new Error(`Failed to upsert edition from OpenLibrary: ${error.message}`);
    }

    const editionId = this.extractIdFromRpcResult(rpcResult, ["id", "edition_id"]);
    const { data: edition, error: fetchError } = await this.supabase
      .from("editions")
      .select("*")
      .eq(editionId ? "id" : "openlibrary_id", editionId ?? editionData.openlibrary_id)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch upserted edition: ${fetchError.message}`);
    }

    if (!edition) {
      throw new Error("Failed to retrieve upserted edition from database");
    }

    return edition;
  }

  /**
   * Links an author to a work using SECURITY DEFINER RPC (idempotent).
   *
   * @param authorId - Author UUID to link
   * @param workId - Work UUID to link
   * @throws Error if database operation fails
   */
  async linkAuthorWork(authorId: string, workId: string): Promise<void> {
    const { error } = await this.callRpc<unknown>("link_author_work", {
      author_id: authorId,
      work_id: workId,
    });

    if (error) {
      throw new Error(`Failed to link author and work: ${error.message}`);
    }
  }

  /**
   * Sets a work's primary edition using SECURITY DEFINER RPC.
   *
   * @param workId - Work UUID to update
   * @param editionId - Edition UUID to set as primary
   * @throws Error if database operation fails
   */
  async setPrimaryEdition(workId: string, editionId: string): Promise<void> {
    const { error } = await this.callRpc<unknown>("set_primary_edition", {
      work_id: workId,
      edition_id: editionId,
    });

    if (error) {
      throw new Error(`Failed to set primary edition: ${error.message}`);
    }
  }

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
   * @returns Array of invalid author IDs (empty if all are valid)
   * @throws Error if database query fails
   */
  async verifyAuthorsExist(authorIds: string[]): Promise<string[]> {
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
   * Finds a single work by ID with minimal fields.
   * Respects RLS policies - returns null if work is not accessible to the user.
   *
   * @param workId - Work UUID to look up
   * @returns Work id if found and accessible, null otherwise
   * @throws Error if database query fails
   */
  async findById(workId: string): Promise<Pick<WorkRow, "id"> | null> {
    const { data, error } = await this.supabase.from("works").select("id").eq("id", workId).maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch work from database: ${error.message}`);
    }

    return data ?? null;
  }

  /**
   * Finds a single edition by ID with minimal fields.
   * Respects RLS policies - returns null if edition is not accessible to the user.
   *
   * @param editionId - Edition UUID to look up
   * @returns Edition id and work_id if found and accessible, null otherwise
   * @throws Error if database query fails
   */
  async findEditionById(editionId: string): Promise<Pick<EditionRow, "id" | "work_id"> | null> {
    const { data, error } = await this.supabase
      .from("editions")
      .select("id, work_id")
      .eq("id", editionId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch edition from database: ${error.message}`);
    }

    return data ?? null;
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
    interface AuthorWorksQueryRow {
      work: (WorkRow & { primary_edition?: PrimaryEditionSummaryDto | PrimaryEditionSummaryDto[] | null }) | null;
    }

    const items: WorkListItemDto[] =
      (data as AuthorWorksQueryRow[] | null)
        ?.map((item) => {
          const work = item.work;
          if (!work) {
            return null;
          }

          const primaryEditionData = work.primary_edition ?? null;
          const primaryEdition: PrimaryEditionSummaryDto | null = Array.isArray(primaryEditionData)
            ? (primaryEditionData[0] ?? null)
            : (primaryEditionData ?? null);

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
        })
        .filter((item): item is WorkListItemDto => item !== null) || [];

    return {
      items,
      total: count || 0,
    };
  }

  private extractIdFromRpcResult(result: unknown, keys: string[]): string | null {
    if (typeof result === "string") {
      return result;
    }

    if (Array.isArray(result) && result.length > 0) {
      return this.extractIdFromRpcResult(result[0], keys);
    }

    if (result && typeof result === "object") {
      for (const key of keys) {
        const value = (result as Record<string, unknown>)[key];
        if (typeof value === "string" && value.length > 0) {
          return value;
        }
      }
    }

    return null;
  }
}
