import type { APIRoute } from "astro";
import { AuthorIdParamSchema } from "@/lib/validation/author-id.schema";
import { AuthorWorksListQuerySchema } from "@/lib/validation/author-works-list.schema";
import { AuthorsService } from "@/lib/services/authors.service";
import { WorksService } from "@/lib/services/works.service";
import { OpenLibraryService } from "@/lib/services/openlibrary.service";
import type { AuthorWorksListResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * GET /api/authors/{authorId}/works
 *
 * Retrieves a paginated list of works for a specific author.
 * Returns works with their primary edition information and computed publish year.
 * Works are sorted by publication date (descending) or title (ascending).
 *
 * Path Parameters:
 * - authorId (required): UUID of the author in standard format (e.g., "550e8400-e29b-41d4-a716-446655440000")
 *
 * Query Parameters:
 * - page (optional): Page number (default: 1, minimum: 1)
 * - sort (optional): Sort order - "published_desc" (default) or "title_asc"
 * - forceRefresh (optional): Force refresh author data from OpenLibrary (default: false, only works for OpenLibrary authors)
 *
 * Response: AuthorWorksListResponseDto with paginated list of works (200 OK)
 *
 * Errors:
 * - 400: Validation error (invalid UUID format, invalid query parameters)
 * - 404: Author not found or not accessible (RLS filtered)
 * - 500: Internal server error
 */
export const GET: APIRoute = async ({ params, url, locals }) => {
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

    const pathValidation = AuthorIdParamSchema.safeParse({
      authorId: params.authorId,
    });

    if (!pathValidation.success) {
      logger.warn("GET /api/authors/{authorId}/works: Path validation failed", {
        authorId: params.authorId,
        errors: pathValidation.error.errors,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: pathValidation.error.errors[0]?.message || "Invalid authorId format",
          details: pathValidation.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { authorId } = pathValidation.data;

    // Step 2: Extract and validate query parameters
    const queryParams = {
      page: url.searchParams.get("page") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      forceRefresh: url.searchParams.get("forceRefresh") ?? undefined,
    };

    const queryValidation = AuthorWorksListQuerySchema.safeParse(queryParams);

    if (!queryValidation.success) {
      logger.warn("GET /api/authors/{authorId}/works: Query validation failed", {
        authorId,
        errors: queryValidation.error.errors,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: queryValidation.error.errors[0]?.message || "Invalid query parameters",
          details: queryValidation.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { page = 1, sort = "published_desc", forceRefresh = false } = queryValidation.data;

    // Step 3: Initialize services
    const supabase = locals.supabase;
    const authorsService = new AuthorsService(supabase);

    // Step 4: Verify author exists and is accessible
    let author;
    try {
      author = await authorsService.findById(authorId);
    } catch (error) {
      logger.error("GET /api/authors/{authorId}/works: Database error while fetching author", {
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

    if (!author) {
      logger.warn("GET /api/authors/{authorId}/works: Author not found", {
        authorId,
      });
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

    // Step 5: Handle forceRefresh (optional)
    if (forceRefresh === true && author.openlibrary_id) {
      // Only refresh if author has openlibrary_id (OpenLibrary authors only)
      const openlibraryId = author.openlibrary_id; // Store before potential re-fetch
      logger.info("GET /api/authors/{authorId}/works: forceRefresh requested", {
        authorId,
        openlibrary_id: openlibraryId,
      });

      try {
        const olService = new OpenLibraryService();
        const olAuthor = await olService.fetchAuthorByOpenLibraryId(openlibraryId);

        // Update cache with fresh data (7-day TTL)
        const fetchedAt = new Date();
        const expiresAt = new Date(fetchedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

        await authorsService.upsertAuthorFromOpenLibrary(olAuthor, fetchedAt, expiresAt);

        logger.debug("GET /api/authors/{authorId}/works: Author data refreshed", {
          authorId,
          openlibrary_id: openlibraryId,
        });

        // Re-fetch author to get updated data
        const refreshedAuthor = await authorsService.findById(authorId);
        if (!refreshedAuthor) {
          // This should not happen, but handle gracefully
          logger.warn("GET /api/authors/{authorId}/works: Author not found after refresh", {
            authorId,
          });
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
        author = refreshedAuthor;
      } catch (error) {
        // Log error but don't fail the request - continue with cached data
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.warn("GET /api/authors/{authorId}/works: forceRefresh failed, using cached data", {
          authorId,
          openlibrary_id: openlibraryId,
          error: errorMessage,
        });
        // Continue with existing author data
      }
    } else if (forceRefresh === true && !author.openlibrary_id) {
      // forceRefresh requested but author doesn't have openlibrary_id
      // Silently ignore (as per plan - no error, just ignore)
      logger.debug("GET /api/authors/{authorId}/works: forceRefresh ignored (author has no openlibrary_id)", {
        authorId,
        manual: author.manual,
      });
    }

    // Step 6: Fetch works for the author
    const worksService = new WorksService(supabase);
    let worksResult;
    try {
      worksResult = await worksService.findWorksByAuthorId(authorId, page, sort);
    } catch (error) {
      logger.error("GET /api/authors/{authorId}/works: Database error while fetching works", {
        authorId,
        page,
        sort,
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

    // Step 7: Build and return response
    const response: AuthorWorksListResponseDto = {
      items: worksResult.items,
      page,
      total: worksResult.total,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("GET /api/authors/{authorId}/works: Unexpected error", {
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
