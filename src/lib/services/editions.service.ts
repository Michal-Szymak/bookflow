import type { SupabaseClient } from "@/db/supabase.client";
import type { CreateEditionCommand, EditionRow } from "@/types";

/**
 * Editions Service
 *
 * Handles database operations for manual editions.
 */
export class EditionsService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Finds a single edition by OpenLibrary ID.
   * Uses indexed openlibrary_id field for efficient lookup.
   *
   * @param openlibrary_id - OpenLibrary ID to look up
   * @returns EditionRow if found, null otherwise
   * @throws Error if database query fails
   */
  async findByOpenLibraryId(openlibrary_id: string): Promise<EditionRow | null> {
    const { data, error } = await this.supabase
      .from("editions")
      .select(
        "id, work_id, title, openlibrary_id, publish_year, publish_date, publish_date_raw, isbn13, cover_url, language, ol_fetched_at, ol_expires_at, manual, owner_user_id, created_at, updated_at"
      )
      .eq("openlibrary_id", openlibrary_id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch edition from database: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return {
      ...data,
      owner_user_id: data.owner_user_id ?? null,
    };
  }

  /**
   * Lists editions for a specific work, sorted by publish year (desc, nulls last).
   * Respects RLS policies - returns empty array if no editions are accessible.
   *
   * @param workId - Work UUID to list editions for
   * @returns Array of editions for the work
   * @throws Error if database query fails
   */
  async listByWorkId(workId: string): Promise<EditionRow[]> {
    const { data, error } = await this.supabase
      .from("editions")
      .select(
        "id, work_id, title, openlibrary_id, publish_year, publish_date, publish_date_raw, isbn13, cover_url, language, ol_fetched_at, ol_expires_at, manual, owner_user_id, created_at, updated_at"
      )
      .eq("work_id", workId)
      .order("publish_year", { ascending: false, nullsFirst: false });

    if (error) {
      throw new Error(`Failed to fetch editions from database: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map((edition) => ({
      ...edition,
      owner_user_id: edition.owner_user_id ?? null,
    }));
  }

  /**
   * Creates a manual edition owned by the specified user.
   * Validates constraints and handles database errors appropriately.
   *
   * @param userId - User ID who will own the edition
   * @param data - Edition creation data
   * @returns Created edition row
   * @throws Error with appropriate message for constraint violations or other DB errors
   */
  async createManualEdition(userId: string, data: CreateEditionCommand): Promise<EditionRow> {
    const trimmedTitle = data.title.trim();

    const { data: edition, error } = await this.supabase
      .from("editions")
      .insert({
        work_id: data.work_id,
        title: trimmedTitle,
        manual: true,
        owner_user_id: userId,
        openlibrary_id: null,
        publish_year: data.publish_year ?? null,
        publish_date: data.publish_date ?? null,
        publish_date_raw: data.publish_date_raw ?? null,
        isbn13: data.isbn13 ?? null,
        cover_url: data.cover_url ?? null,
        language: data.language ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        const constraintName = error.message.includes("editions_isbn13_key")
          ? "editions_isbn13_key"
          : "unique_constraint";
        throw new Error(`Database constraint violation: ${constraintName}`);
      }

      if (error.code === "23514") {
        const constraintName = error.message.includes("editions_manual_owner")
          ? "editions_manual_owner"
          : "editions_manual_or_ol";
        throw new Error(`Database constraint violation: ${constraintName}`);
      }

      if (error.code === "42501") {
        throw new Error("Cannot create manual edition without ownership");
      }

      throw new Error(`Failed to create edition: ${error.message}`);
    }

    if (!edition) {
      throw new Error("Failed to create edition: no data returned");
    }

    return edition;
  }
}
