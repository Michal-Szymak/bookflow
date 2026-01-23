import type { APIRoute } from "astro";
import { ImportAuthorSchema } from "@/lib/validation/import-author.schema";
import { OpenLibraryService } from "@/lib/services/openlibrary.service";
import { AuthorsService } from "@/lib/services/authors.service";
import type { AuthorResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * POST /api/openlibrary/import/author
 *
 * Imports or refreshes an author from OpenLibrary catalog into the shared catalog.
 * Implements 7-day cache TTL mechanism - data is refreshed only if cache expired or author doesn't exist.
 * Author is stored in global catalog (owner_user_id = null, manual = false).
 *
 * Request Body:
 * - openlibrary_id (required): OpenLibrary ID in short format (e.g., "OL23919A", max 25 characters)
 *
 * Response: AuthorResponseDto with imported/refreshed author (200 OK)
 *
 * Errors:
 * - 400: Validation error (invalid openlibrary_id format)
 * - 404: Author not found in OpenLibrary
 * - 502: OpenLibrary API unavailable or error
 * - 500: Internal server error
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Step 1: Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn("POST /api/openlibrary/import/author: Invalid JSON body", { error });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: "Invalid JSON in request body",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const validation = ImportAuthorSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("POST /api/openlibrary/import/author: Validation failed", {
        errors: validation.error.errors,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: validation.error.errors[0]?.message || "Invalid input",
          details: validation.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { openlibrary_id } = validation.data;

    // Step 2: Initialize services
    const supabase = locals.supabase;
    const olService = new OpenLibraryService();
    const authorsService = new AuthorsService(supabase);

    // Step 3: Check cache in database
    let cachedAuthor;
    try {
      cachedAuthor = await authorsService.findByOpenLibraryId(openlibrary_id);
    } catch (error) {
      logger.error("POST /api/openlibrary/import/author: Cache lookup failed", {
        openlibrary_id,
        error,
      });
      // Continue with fetch from OpenLibrary if cache lookup fails
      cachedAuthor = null;
    }

    // Step 4: Check if cache is valid
    const now = new Date();
    if (cachedAuthor?.ol_expires_at && new Date(cachedAuthor.ol_expires_at) > now) {
      // Cache valid - return from cache
      logger.debug("POST /api/openlibrary/import/author: Cache hit", {
        openlibrary_id,
        authorId: cachedAuthor.id,
      });

      const response: AuthorResponseDto = {
        author: cachedAuthor,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 5: Cache expired or missing - fetch from OpenLibrary
    logger.debug("POST /api/openlibrary/import/author: Cache miss or expired, fetching from OpenLibrary", {
      openlibrary_id,
      hasCached: !!cachedAuthor,
    });

    let olAuthor;
    try {
      olAuthor = await olService.fetchAuthorByOpenLibraryId(openlibrary_id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle "not found" errors
      if (errorMessage.includes("not found")) {
        logger.warn("POST /api/openlibrary/import/author: Author not found in OpenLibrary", {
          openlibrary_id,
        });
        return new Response(
          JSON.stringify({
            error: "Author not found",
            message: `Author with openlibrary_id '${openlibrary_id}' not found in OpenLibrary`,
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle other OpenLibrary API errors (timeout, network, etc.)
      logger.error("POST /api/openlibrary/import/author: OpenLibrary API error", {
        openlibrary_id,
        error,
      });
      return new Response(
        JSON.stringify({
          error: "External service error",
          message: "Could not connect to OpenLibrary. Please try again later.",
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 6: Upsert to database with cache TTL
    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

    let author;
    try {
      author = await authorsService.upsertAuthorFromOpenLibrary(olAuthor, fetchedAt, expiresAt);
    } catch (error) {
      logger.error("POST /api/openlibrary/import/author: Database upsert failed", {
        openlibrary_id,
        error,
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

    // Step 7: Return success response
    logger.debug("POST /api/openlibrary/import/author: Successfully imported/refreshed author", {
      openlibrary_id,
      authorId: author.id,
    });

    const response: AuthorResponseDto = {
      author,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("POST /api/openlibrary/import/author: Unexpected error", { error });
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
