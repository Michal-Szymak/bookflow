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
