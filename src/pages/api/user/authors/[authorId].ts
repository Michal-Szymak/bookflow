import type { APIRoute } from "astro";
import { AuthorIdParamSchema } from "@/lib/validation/author-id.schema";
import { AuthorsService } from "@/lib/services/authors.service";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * DELETE /api/user/authors/{authorId}
 *
 * Detaches an author from the authenticated user's profile.
 * Cascades deletion of all user_works records for works by this author.
 * Database triggers automatically update author_count and work_count in profiles.
 *
 * Path Parameters:
 * - authorId (required): UUID of the author to detach in standard format (e.g., "550e8400-e29b-41d4-a716-446655440000")
 *
 * Response: 204 No Content (success)
 *
 * Errors:
 * - 400: Validation error (invalid UUID format or missing parameter)
 * - 401: Unauthorized (authentication required)
 * - 403: Forbidden (RLS policy violation)
 * - 404: Not Found (author is not attached to user profile)
 * - 500: Internal server error
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    // Step 1: Extract and validate path parameter
    if (!params.authorId) {
      logger.warn("DELETE /api/user/authors/{authorId}: Missing authorId parameter");
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: "authorId parameter is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const validation = AuthorIdParamSchema.safeParse({
      authorId: params.authorId,
    });

    if (!validation.success) {
      logger.warn("DELETE /api/user/authors/{authorId}: Validation failed", {
        authorId: params.authorId,
        errors: validation.error.errors,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: validation.error.errors[0]?.message || "authorId must be a valid UUID",
          details: validation.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { authorId } = validation.data;

    // Step 2: Verify authentication
    const supabase = locals.supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("DELETE /api/user/authors/{authorId}: Authentication failed", {
        authorId,
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

    // Step 3: Verify that author is attached to user
    const authorsService = new AuthorsService(supabase);
    let isAttached;
    try {
      isAttached = await authorsService.isAuthorAttached(user.id, authorId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("DELETE /api/user/authors/{authorId}: Failed to check if author is attached", {
        userId: user.id,
        authorId,
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

    if (!isAttached) {
      logger.warn("DELETE /api/user/authors/{authorId}: Author is not attached to user profile", {
        userId: user.id,
        authorId,
      });
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: "Author is not attached to your profile",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 4: Detach author and cascade delete user_works
    try {
      await authorsService.detachUserAuthor(user.id, authorId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle RLS policy violations
      if (errorMessage.includes("insufficient permissions")) {
        logger.warn("DELETE /api/user/authors/{authorId}: RLS policy violation", {
          userId: user.id,
          authorId,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Cannot detach author: insufficient permissions",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle "not attached" error (should not happen after check, but handle gracefully)
      if (errorMessage.includes("not attached")) {
        logger.warn("DELETE /api/user/authors/{authorId}: Author is not attached (from service)", {
          userId: user.id,
          authorId,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Not Found",
            message: "Author is not attached to your profile",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle other database errors
      logger.error("DELETE /api/user/authors/{authorId}: Failed to detach author", {
        userId: user.id,
        authorId,
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

    // Step 5: Return success response (204 No Content)
    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("DELETE /api/user/authors/{authorId}: Unexpected error", {
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
