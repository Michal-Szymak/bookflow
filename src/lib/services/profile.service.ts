import type { SupabaseClient } from "@/db/supabase.client";
import type { ProfileRow } from "@/types";

/**
 * Profile Service
 *
 * Handles database operations for user profiles, including fetching
 * profile data with author and work counts.
 */
export class ProfileService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Finds a single profile by user ID (UUID).
   * Uses indexed user_id field (primary key) for efficient lookup.
   * Respects RLS policies - returns null if profile is not accessible to the user.
   *
   * @param userId - User UUID to look up
   * @returns ProfileRow if found and accessible, null otherwise
   * @throws Error if database query fails
   */
  async getProfile(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("user_id, author_count, work_count, max_authors, max_works, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch profile from database: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return data;
  }

  /**
   * Creates a new profile for a user.
   * Uses default values for counters and limits (author_count: 0, work_count: 0, max_authors: 500, max_works: 5000).
   * Respects RLS policies - requires authenticated user with matching user_id.
   *
   * @param userId - User UUID to create profile for
   * @returns ProfileRow if created successfully
   * @throws Error if database query fails or profile already exists
   */
  async createProfile(userId: string): Promise<ProfileRow> {
    const { data, error } = await this.supabase
      .from("profiles")
      .insert({
        user_id: userId,
        author_count: 0,
        work_count: 0,
        max_authors: 500,
        max_works: 5000,
      })
      .select("user_id, author_count, work_count, max_authors, max_works, created_at, updated_at")
      .single();

    if (error) {
      // Check if profile already exists (unique constraint violation)
      if (error.code === "23505" || error.message.includes("duplicate key")) {
        throw new Error(`Profile already exists for user ${userId}`);
      }
      throw new Error(`Failed to create profile: ${error.message}`);
    }

    if (!data) {
      throw new Error("Failed to create profile: no data returned");
    }

    return data;
  }
}
