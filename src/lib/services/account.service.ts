import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";

/**
 * Account Service
 *
 * Handles account deletion operations using Supabase Admin API.
 * This service requires the service role key to delete users from auth.users.
 */
export class AccountService {
  private adminClient;

  constructor() {
    const supabaseUrl = import.meta.env.SUPABASE_URL;
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables");
    }

    // Create Admin API client with service role key
    // This client bypasses RLS and has full access to auth.users
    this.adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Deletes a user account from Supabase Auth.
   * This operation triggers cascade deletion of all related data in the database.
   *
   * @param userId - User UUID to delete
   * @throws Error if deletion fails
   */
  async deleteAccount(userId: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.deleteUser(userId);

    if (error) {
      throw new Error(`Failed to delete user account: ${error.message}`);
    }
  }
}
