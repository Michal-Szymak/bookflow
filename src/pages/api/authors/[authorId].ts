import type { APIRoute } from "astro";
import { AuthorIdParamSchema } from "@/lib/validation/author-id.schema";
import { AuthorsService } from "@/lib/services/authors.service";
import type { AuthorResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * GET /api/authors/{authorId}
 *
 * Retrieves metadata for a single author from the global catalog.
 * Returns full author information (both from OpenLibrary global catalog and manual authors),
 * as long as they are visible to the user according to RLS (Row Level Security) policies in Supabase.
 *
 * Path Parameters:
 * - authorId (required): UUID of the author in standard format (e.g., "550e8400-e29b-41d4-a716-446655440000")
 *
 * Response: AuthorResponseDto with author metadata (200 OK)
 *
 * Errors:
 * - 400: Validation error (invalid UUID format)
 * - 404: Author not found or not accessible (RLS filtered)
 * - 500: Internal server error
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // Step 1: Extract and validate path parameter
    if (!params.authorId) {
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
      logger.warn("GET /api/authors/{authorId}: Validation failed", {
        authorId: params.authorId,
        errors: validation.error.errors,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: validation.error.errors[0]?.message || "Invalid authorId format",
          details: validation.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { authorId } = validation.data;

    // Step 2: Initialize services
    const supabase = locals.supabase;
    const authorsService = new AuthorsService(supabase);

    // Step 3: Fetch author from database
    let author;
    try {
      author = await authorsService.findById(authorId);
    } catch (error) {
      logger.error("GET /api/authors/{authorId}: Database error", {
        authorId,
        error: error instanceof Error ? error.message : "Unknown error",
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

    // Step 4: Check if author exists and is accessible
    if (!author) {
      return new Response(
        JSON.stringify({
          error: "Not found",
          message: "Author not found or not accessible",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 5: Return response
    const response: AuthorResponseDto = {
      author,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("GET /api/authors/{authorId}: Unexpected error", {
      authorId: params?.authorId,
      error: error instanceof Error ? error.message : "Unknown error",
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

/**
 * DELETE /api/authors/{authorId}
 *
 * Deletes a manual author owned by the authenticated user.
 * Only manual authors (manual=true) owned by the user can be deleted.
 * Cascading deletions are handled by the database:
 * - author_works (author-work relationships) - ON DELETE CASCADE
 * - user_authors (user-author relationships) - ON DELETE CASCADE
 *
 * Note: Works are NOT automatically deleted when an author is deleted.
 * Only the relationships in author_works are removed.
 *
 * Path Parameters:
 * - authorId (required): UUID of the author in standard format (e.g., "550e8400-e29b-41d4-a716-446655440000")
 *
 * Response: 204 No Content (success)
 *
 * Errors:
 * - 400: Validation error (invalid UUID format)
 * - 401: Unauthorized (no session)
 * - 403: Forbidden (author is not manual or not owned by user)
 * - 404: Author not found or not accessible (RLS filtered)
 * - 500: Internal server error
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    // Step 1: Extract and validate path parameter
    if (!params.authorId) {
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
      logger.warn("DELETE /api/authors/{authorId}: Validation failed", {
        authorId: params.authorId,
        errors: validation.error.errors,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: validation.error.errors[0]?.message || "Invalid authorId format",
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
      logger.warn("DELETE /api/authors/{authorId}: Authentication failed", {
        authorId,
        error: authError,
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

    // Step 3: Fetch author from database
    const authorsService = new AuthorsService(supabase);
    let author;
    try {
      author = await authorsService.findById(authorId);
    } catch (error) {
      logger.error("DELETE /api/authors/{authorId}: Database error", {
        authorId,
        userId: user.id,
        error: error instanceof Error ? error.message : "Unknown error",
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

    // Step 4: Check if author exists and is accessible
    if (!author) {
      return new Response(
        JSON.stringify({
          error: "Not found",
          message: "Author not found or not accessible",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 5: Verify permissions to delete
    if (!author.manual) {
      logger.warn("DELETE /api/authors/{authorId}: Attempt to delete non-manual author", {
        authorId,
        userId: user.id,
        manual: author.manual,
      });
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Only manual authors owned by the current user can be deleted",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (author.owner_user_id !== user.id) {
      logger.warn("DELETE /api/authors/{authorId}: Attempt to delete author owned by another user", {
        authorId,
        userId: user.id,
        ownerUserId: author.owner_user_id,
      });
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Only manual authors owned by the current user can be deleted",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 6: Delete author
    try {
      await authorsService.deleteManualAuthor(authorId, user.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Check if error indicates RLS violation or permission issue
      if (errorMessage.includes("insufficient permissions") || errorMessage.includes("not owned by user")) {
        logger.warn("DELETE /api/authors/{authorId}: Permission denied", {
          authorId,
          userId: user.id,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Only manual authors owned by the current user can be deleted",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if error indicates author not found
      if (errorMessage.includes("not found")) {
        return new Response(
          JSON.stringify({
            error: "Not found",
            message: "Author not found or not accessible",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Generic database error
      logger.error("DELETE /api/authors/{authorId}: Failed to delete author", {
        authorId,
        userId: user.id,
        error: errorMessage,
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

    // Step 7: Return success response (204 No Content)
    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    logger.error("DELETE /api/authors/{authorId}: Unexpected error", {
      authorId: params?.authorId,
      error: error instanceof Error ? error.message : "Unknown error",
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
