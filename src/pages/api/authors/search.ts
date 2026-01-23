import type { APIRoute } from "astro";
import { AuthorSearchQuerySchema } from "@/lib/validation/author-search.schema";
import { OpenLibraryService } from "@/lib/services/openlibrary.service";
import { AuthorsService } from "@/lib/services/authors.service";
import type { AuthorSearchResponseDto, AuthorSearchResultDto, AuthorRow } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * GET /api/authors/search
 *
 * Searches for authors in OpenLibrary catalog with intelligent 7-day caching.
 * Returns a list of authors from the database (if cached) or fetches fresh data from OpenLibrary.
 *
 * Query Parameters:
 * - q (required): Author name to search for (1-200 characters)
 * - limit (optional): Maximum number of results (1-50, default: 10)
 *
 * Response: AuthorSearchResponseDto with list of authors
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = {
      q: url.searchParams.get("q"),
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    };

    const validation = AuthorSearchQuerySchema.safeParse(queryParams);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: validation.error.errors[0].message,
          details: validation.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { q, limit } = validation.data;

    // 2. Initialize services
    const supabase = locals.supabase;
    const olService = new OpenLibraryService();
    const authorsService = new AuthorsService(supabase);

    // 3. Search OpenLibrary
    let olResults;
    try {
      olResults = await olService.searchAuthors(q, limit ?? 10);
    } catch (error) {
      logger.error("OpenLibrary API error:", error);
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

    // 4. Check cache in database
    let cachedAuthors: Map<string, AuthorRow>;
    try {
      const olIds = olResults.map((r) => r.openlibrary_id);
      cachedAuthors = await authorsService.findByOpenLibraryIds(olIds);
    } catch (error) {
      logger.error("Cache lookup failed, proceeding without cache:", error);
      cachedAuthors = new Map();
    }

    // 5. Merge results and check cache expiry
    const now = new Date();
    const results: AuthorSearchResultDto[] = [];
    const toCache: {
      openlibrary_id: string;
      name: string;
      ol_fetched_at: string;
      ol_expires_at: string;
    }[] = [];

    for (const olAuthor of olResults) {
      const cached = cachedAuthors.get(olAuthor.openlibrary_id);

      if (cached?.ol_expires_at && new Date(cached.ol_expires_at) > now) {
        // Cache valid - use DB data
        results.push({
          id: cached.id,
          openlibrary_id: cached.openlibrary_id as string,
          name: cached.name,
          ol_fetched_at: cached.ol_fetched_at,
          ol_expires_at: cached.ol_expires_at,
        });
      } else {
        // Cache expired or missing - prepare new data
        const fetchedAt = new Date();
        const expiresAt = new Date(fetchedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

        results.push({
          id: cached?.id, // Include existing id if found
          openlibrary_id: olAuthor.openlibrary_id,
          name: olAuthor.name,
          ol_fetched_at: fetchedAt.toISOString(),
          ol_expires_at: expiresAt.toISOString(),
        });

        toCache.push({
          openlibrary_id: olAuthor.openlibrary_id,
          name: olAuthor.name,
          ol_fetched_at: fetchedAt.toISOString(),
          ol_expires_at: expiresAt.toISOString(),
        });
      }
    }

    // 6. Update cache (don't await - background operation)
    if (toCache.length > 0) {
      authorsService.upsertAuthorsCache(toCache).catch((error) => {
        logger.error("Failed to update authors cache:", error);
      });
    }

    // 7. Return response
    const response: AuthorSearchResponseDto = {
      authors: results,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Unexpected error in /api/authors/search:", error);
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
