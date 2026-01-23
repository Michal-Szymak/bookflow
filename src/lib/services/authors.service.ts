import type { SupabaseClient } from "@/db/supabase.client";
import type { AuthorRow } from "@/types";
import type { OpenLibraryAuthor } from "./openlibrary.service";

/**
 * Authors Service
 *
 * Handles database operations for authors, including cache management
 * for OpenLibrary author data with 7-day expiry mechanism.
 */
export class AuthorsService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Finds a single author by ID (UUID).
   * Uses indexed id field (primary key) for efficient lookup.
   * Respects RLS policies - returns null if author is not accessible to the user.
   *
   * @param authorId - Author UUID to look up
   * @returns AuthorRow if found and accessible, null otherwise
   * @throws Error if database query fails
   */
  async findById(authorId: string): Promise<AuthorRow | null> {
    const { data, error } = await this.supabase
      .from("authors")
      .select("id, name, openlibrary_id, manual, owner_user_id, ol_fetched_at, ol_expires_at, created_at, updated_at")
      .eq("id", authorId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch author from database: ${error.message}`);
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
   * Finds a single author by OpenLibrary ID.
   * Uses indexed openlibrary_id field for efficient lookup.
   *
   * @param openlibrary_id - OpenLibrary ID to look up
   * @returns AuthorRow if found, null otherwise
   * @throws Error if database query fails
   */
  async findByOpenLibraryId(openlibrary_id: string): Promise<AuthorRow | null> {
    const { data, error } = await this.supabase
      .from("authors")
      .select("id, name, openlibrary_id, ol_fetched_at, ol_expires_at, manual, owner_user_id, created_at, updated_at")
      .eq("openlibrary_id", openlibrary_id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch author from database: ${error.message}`);
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
   * Upserts a single author from OpenLibrary to the cache.
   * Uses RPC function with SECURITY DEFINER to bypass RLS policies.
   * Sets manual=false and owner_user_id=null for cache entries from OpenLibrary.
   * Only updates cache if it has expired or author doesn't exist.
   *
   * @param author - Author data from OpenLibrary
   * @param fetchedAt - Timestamp when data was fetched from OpenLibrary
   * @param expiresAt - Timestamp when cache expires (typically +7 days)
   * @returns Updated or created author row
   * @throws Error if database operation fails
   */
  async upsertAuthorFromOpenLibrary(author: OpenLibraryAuthor, fetchedAt: Date, expiresAt: Date): Promise<AuthorRow> {
    // Prepare data as JSONB array for RPC function (single element)
    const authorsData = [
      {
        openlibrary_id: author.openlibrary_id,
        name: author.name,
        ol_fetched_at: fetchedAt.toISOString(),
        ol_expires_at: expiresAt.toISOString(),
      },
    ];

    const { error } = await this.supabase.rpc("upsert_authors_cache", {
      authors_data: authorsData,
    });

    if (error) {
      throw new Error(`Failed to upsert author cache: ${error.message}`);
    }

    // Fetch the updated/created record to return
    const updated = await this.findByOpenLibraryId(author.openlibrary_id);

    if (!updated) {
      throw new Error("Failed to retrieve upserted author from database");
    }

    return updated;
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

  /**
   * Checks user's author limit and returns current count and max limit.
   * Expects user profile to exist (should be created during user registration).
   *
   * @param userId - User ID to check limits for
   * @returns Object with authorCount and maxAuthors
   * @throws Error if database operation fails or profile is not found
   */
  async checkUserAuthorLimit(userId: string): Promise<{ authorCount: number; maxAuthors: number }> {
    const { data: profile, error: fetchError } = await this.supabase
      .from("profiles")
      .select("author_count, max_authors")
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
      authorCount: profile.author_count,
      maxAuthors: profile.max_authors,
    };
  }

  /**
   * Creates a manual author owned by the specified user.
   * Validates constraints and handles database errors appropriately.
   *
   * @param userId - User ID who will own the author
   * @param name - Author name (will be trimmed)
   * @returns Created author row
   * @throws Error with appropriate message for constraint violations or other DB errors
   */
  async createManualAuthor(userId: string, name: string): Promise<AuthorRow> {
    const trimmedName = name.trim();

    const { data, error } = await this.supabase
      .from("authors")
      .insert({
        name: trimmedName,
        manual: true,
        owner_user_id: userId,
        openlibrary_id: null,
        ol_fetched_at: null,
        ol_expires_at: null,
      })
      .select()
      .single();

    if (error) {
      // Handle PostgreSQL constraint violations
      if (error.code === "23514") {
        // Check constraint violation (authors_manual_owner or authors_manual_or_ol)
        const constraintName = error.message.includes("authors_manual_owner")
          ? "authors_manual_owner"
          : "authors_manual_or_ol";
        throw new Error(`Database constraint violation: ${constraintName}`);
      }

      if (error.code === "42501") {
        // RLS policy violation
        throw new Error("Cannot create manual author without ownership");
      }

      // Generic database error
      throw new Error(`Failed to create author: ${error.message}`);
    }

    if (!data) {
      throw new Error("Failed to create author: no data returned");
    }

    return data;
  }

  /**
   * Deletes a manual author owned by the specified user.
   * Only manual authors (manual=true) owned by the user can be deleted.
   * Cascading deletions are handled by the database:
   * - author_works (author-work relationships) - ON DELETE CASCADE
   * - user_authors (user-author relationships) - ON DELETE CASCADE
   *
   * Note: Works are NOT automatically deleted when an author is deleted.
   * Only the relationships in author_works are removed.
   *
   * @param authorId - Author UUID to delete
   * @param userId - User ID who owns the author
   * @throws Error if author is not found, not manual, not owned by user, or database operation fails
   */
  async deleteManualAuthor(authorId: string, userId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from("authors")
      .delete()
      .eq("id", authorId)
      .eq("manual", true)
      .eq("owner_user_id", userId)
      .select();

    if (error) {
      // Handle RLS policy violations
      if (error.code === "42501") {
        throw new Error("Cannot delete author: insufficient permissions");
      }

      // Generic database error
      throw new Error(`Failed to delete author: ${error.message}`);
    }

    // Check if any row was actually deleted
    if (!data || data.length === 0) {
      throw new Error("Author not found, not manual, or not owned by user");
    }
  }
}
