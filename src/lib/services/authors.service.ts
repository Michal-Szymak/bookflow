import type { SupabaseClient } from "@/db/supabase.client";
import type { AuthorRow } from "@/types";

/**
 * Authors Service
 *
 * Handles database operations for authors, including cache management
 * for OpenLibrary author data with 7-day expiry mechanism.
 */
export class AuthorsService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Finds authors by their OpenLibrary IDs in batch.
   * Uses efficient batch lookup with indexed openlibrary_id field.
   *
   * @param openlibraryIds - Array of OpenLibrary IDs to look up
   * @returns Map of openlibrary_id -> AuthorRow for quick lookup
   * @throws Error if database query fails
   */
  async findByOpenLibraryIds(openlibraryIds: string[]): Promise<Map<string, AuthorRow>> {
    if (openlibraryIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase
      .from("authors")
      .select("id, name, openlibrary_id, ol_fetched_at, ol_expires_at, manual, created_at, updated_at")
      .in("openlibrary_id", openlibraryIds)
      .not("openlibrary_id", "is", null);

    if (error) {
      throw new Error(`Failed to fetch authors from database: ${error.message}`);
    }

    // Convert to Map for O(1) lookup by openlibrary_id
    const authorsMap = new Map<string, AuthorRow>();

    if (data) {
      for (const author of data) {
        if (author.openlibrary_id) {
          authorsMap.set(author.openlibrary_id, {
            ...author,
            owner_user_id: null,
          });
        }
      }
    }

    return authorsMap;
  }

  /**
   * Upserts authors to the cache (bulk operation).
   * Uses RPC function with SECURITY DEFINER to bypass RLS policies.
   * Sets manual=false for all cache entries from OpenLibrary.
   *
   * @param authors - Array of authors to upsert to cache
   * @throws Error if database operation fails
   */
  async upsertAuthorsCache(
    authors: {
      openlibrary_id: string;
      name: string;
      ol_fetched_at: string;
      ol_expires_at: string;
    }[]
  ): Promise<void> {
    if (authors.length === 0) {
      return;
    }

    // Prepare data as JSONB array for RPC function
    const authorsData = authors.map((author) => ({
      openlibrary_id: author.openlibrary_id,
      name: author.name,
      ol_fetched_at: author.ol_fetched_at,
      ol_expires_at: author.ol_expires_at,
    }));

    const { error } = await this.supabase.rpc("upsert_authors_cache", {
      authors_data: authorsData,
    });

    if (error) {
      throw new Error(`Failed to upsert authors cache: ${error.message}`);
    }
  }
}
