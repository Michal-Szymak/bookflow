import type { APIRoute } from "astro";
import { ProfileService } from "@/lib/services/profile.service";
import type { ProfileResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * GET /api/user/profile
 *
 * Retrieves the authenticated user's profile data, including author count,
 * work count, and maximum limits.
 *
 * Response: ProfileResponseDto with author_count, work_count, max_authors, max_works
 *
 * Errors:
 * - 401: Unauthorized (authentication required)
 * - 404: Not Found (profile not found)
 * - 500: Internal server error
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    // Step 1: Validate authentication
    const supabase = locals.supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("GET /api/user/profile: Authentication failed", {
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

    // Step 2: Initialize service and fetch profile
    const profileService = new ProfileService(supabase);

    let profile;
    try {
      profile = await profileService.getProfile(user.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("GET /api/user/profile: Database error", {
        userId: user.id,
        error: errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: "An unexpected error occurred",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 3: Check if profile exists
    if (!profile) {
      logger.warn("GET /api/user/profile: Profile not found", {
        userId: user.id,
      });
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: "Profile not found",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 4: Map profile data to response DTO
    const response: ProfileResponseDto = {
      author_count: profile.author_count,
      work_count: profile.work_count,
      max_authors: profile.max_authors,
      max_works: profile.max_works,
    };

    // Step 5: Return success response
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("GET /api/user/profile: Unexpected error", {
      error: errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
