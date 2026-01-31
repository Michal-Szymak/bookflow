import type { APIRoute } from "astro";
import { createSupabaseServerInstance } from "src/db/supabase.client.ts";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * POST /api/auth/logout
 *
 * Logs out the current user by invalidating their session.
 * Clears session cookies automatically via @supabase/ssr.
 *
 * Response (200):
 * {
 *   success: true
 * }
 *
 * Errors:
 * - 400: Logout error
 * - 500: Internal server error
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Create Supabase server instance with cookie management
    const supabase = createSupabaseServerInstance({
      cookies,
      headers: request.headers,
    });

    // Get user before logout for logging
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Sign out the user
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.warn("POST /api/auth/logout: Logout failed", {
        userId: user?.id,
        error: error.message,
      });

      return new Response(
        JSON.stringify({
          error: "Bad Request",
          message: error.message,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Success - cookies are automatically cleared by @supabase/ssr
    logger.info("POST /api/auth/logout: Logout successful", {
      userId: user?.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("POST /api/auth/logout: Unexpected error", {
      error: errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "Wystąpił błąd. Spróbuj ponownie później.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
