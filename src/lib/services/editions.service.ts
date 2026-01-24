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
