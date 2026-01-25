import type { APIRoute } from "astro";
import { UserAuthorsListQuerySchema } from "@/lib/validation/user-authors-list.schema";
import { AuthorsService } from "@/lib/services/authors.service";
import type { UserAuthorsListResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * GET /api/user/authors
 *
 * Retrieves a list of authors attached to the authenticated user's profile.
 * Supports search by author name, pagination, and sorting.
 *
 * Query Parameters:
 * - page (optional): Page number (default: 1, minimum: 1)
 * - search (optional): Search query for author name (case-insensitive, contains, max 200 characters)
 * - sort (optional): Sort order - "name_asc" (alphabetical) or "created_desc" (newest first, default: "name_asc")
 *
 * Response: UserAuthorsListResponseDto with items array and total count
 *
 * Errors:
 * - 400: Validation error (invalid query parameters)
 * - 401: Unauthorized (authentication required)
 * - 500: Internal server error
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // Step 1: Validate authentication
    const supabase = locals.supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("GET /api/user/authors: Authentication failed", {
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

    // Step 2: Extract and validate query parameters
    const url = new URL(request.url);
    const queryParams = {
      page: url.searchParams.get("page") ? url.searchParams.get("page") : undefined,
      search: url.searchParams.get("search") || undefined,
      sort: url.searchParams.get("sort") || undefined,
    };

    const validation = UserAuthorsListQuerySchema.safeParse(queryParams);

    if (!validation.success) {
      logger.warn("GET /api/user/authors: Validation failed", {
        userId: user.id,
        queryParams,
        errorCount: validation.error.errors.length,
        firstError: validation.error.errors[0]?.message,
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

    // Step 3: Set default values
    const page = validation.data.page ?? 1;
    const search = validation.data.search;
    const sort = validation.data.sort ?? "name_asc";

    // Step 4: Initialize service and fetch user authors
    const authorsService = new AuthorsService(supabase);

    let result;
    try {
      result = await authorsService.findUserAuthors(user.id, page, search, sort);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("GET /api/user/authors: Database error", {
        userId: user.id,
        page,
        search: search ? `${search.substring(0, 50)}...` : undefined,
        sort,
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

    // Step 5: Build response
    const response: UserAuthorsListResponseDto = {
      items: result.items,
      total: result.total,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("GET /api/user/authors: Unexpected error", {
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

