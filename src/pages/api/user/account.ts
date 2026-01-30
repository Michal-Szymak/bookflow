import type { APIRoute } from "astro";
import { AccountService } from "@/lib/services/account.service";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * DELETE /api/user/account
 *
 * Permanently deletes the authenticated user's account and all associated data.
 * This operation is irreversible and uses Supabase Admin API to delete the user
 * from auth.users, which triggers cascade deletion of all related database records.
 *
 * Response: 204 No Content on success
 *
 * Errors:
 * - 401: Unauthorized (authentication required)
 * - 500: Internal server error (failed to delete account)
 */
export const DELETE: APIRoute = async ({ locals }) => {
  try {
    // Step 1: Validate authentication
    const supabase = locals.supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("DELETE /api/user/account: Authentication failed", {
        error: authError?.message,
        errorCode: authError?.status,
      });
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Authentication required",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: Initialize AccountService and delete account
    let accountService: AccountService;
    try {
      accountService = new AccountService();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("DELETE /api/user/account: Failed to initialize AccountService", {
        userId: user.id,
        error: errorMessage,
      });
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: "Failed to delete user account",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 3: Delete user account (triggers cascade deletion)
    try {
      await accountService.deleteAccount(user.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("DELETE /api/user/account: Failed to delete user account", {
        userId: user.id,
        error: errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: "Failed to delete user account",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 4: Log successful deletion and return 204 No Content
    logger.info("DELETE /api/user/account: Account deleted successfully", {
      userId: user.id,
    });

    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("DELETE /api/user/account: Unexpected error", {
      error: errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "Failed to delete user account",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
