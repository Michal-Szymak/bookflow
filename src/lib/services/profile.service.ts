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
}

