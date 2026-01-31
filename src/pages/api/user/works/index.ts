import type { APIRoute } from "astro";
import { UserWorksListQuerySchema } from "@/lib/validation/user-works-list.schema";
import { WorksService } from "@/lib/services/works.service";
import type { UserWorksListResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * GET /api/user/works
 *
 * Retrieves a paginated list of works attached to the authenticated user's profile.
 * Supports filtering by status, availability, author, search, and sorting.
 *
 * Query Parameters:
 * - page (optional): Page number (default: 1, minimum: 1)
 * - status (optional): Array of statuses to filter by (can be passed multiple times: ?status=to_read&status=in_progress)
 * - available (optional): Availability filter - "true", "false", or "null" (as string)
 * - sort (optional): Sort order - "published_desc" (default) or "title_asc"
 * - author_id (optional): UUID of author to filter by
 * - search (optional): Search query for work title (case-insensitive, contains, max 200 characters)
 *
 * Response: UserWorksListResponseDto with items array, page, and total count
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
      logger.warn("GET /api/user/works: Authentication failed", {
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
    const statusParams = url.searchParams.getAll("status");
    const queryParams = {
      page: url.searchParams.get("page") ? url.searchParams.get("page") : undefined,
      status: statusParams.length > 0 ? statusParams : undefined,
      available: url.searchParams.get("available") || undefined,
      sort: url.searchParams.get("sort") || undefined,
      author_id: url.searchParams.get("author_id") || undefined,
      search: url.searchParams.get("search") || undefined,
    };

    const validation = UserWorksListQuerySchema.safeParse(queryParams);

    if (!validation.success) {
      logger.warn("GET /api/user/works: Validation failed", {
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
    const status = validation.data.status;
    const available = validation.data.available;
    const sort = validation.data.sort ?? "published_desc";
    const authorId = validation.data.author_id;
    const search = validation.data.search;

    // Step 4: Initialize service and fetch user works
    const worksService = new WorksService(supabase);

    let result;
    try {
      result = await worksService.findUserWorks(user.id, page, status, available, sort, authorId, search);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("GET /api/user/works: Database error", {
        userId: user.id,
        page,
        status,
        available,
        sort,
        authorId,
        search: search ? `${search.substring(0, 50)}...` : undefined,
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
    const response: UserWorksListResponseDto = {
      items: result.items,
      page,
      total: result.total,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("GET /api/user/works: Unexpected error", {
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
