import type { APIRoute } from "astro";
import { UserAuthorsListQuerySchema } from "@/lib/validation/user-authors-list.schema";
import { AttachUserAuthorCommandSchema } from "@/lib/validation/user-authors-attach.schema";
import { AuthorsService } from "@/lib/services/authors.service";
import { rateLimitService } from "@/lib/services/rate-limit.service";
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

/**
 * POST /api/user/authors
 *
 * Attaches an author to the authenticated user's profile.
 * Creates a relationship in the user_authors table and automatically increments
 * the author_count in the user's profile via database trigger.
 *
 * Request Body:
 * - author_id (required): UUID of the author to attach
 *
 * Response: Object with author_id and created_at (201 Created)
 *
 * Errors:
 * - 400: Validation error (invalid request body)
 * - 401: Unauthorized (authentication required)
 * - 404: Author not found or not accessible
 * - 409: Conflict (author limit reached or author already attached)
 * - 429: Too Many Requests (rate limit exceeded: 10 requests per minute)
 * - 500: Internal server error
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Step 1: Validate authentication
    const supabase = locals.supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("POST /api/user/authors: Authentication failed", {
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

    // Step 2: Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn("POST /api/user/authors: Invalid JSON body", {
        userId: user.id,
        error,
      });
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

    const validation = AttachUserAuthorCommandSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("POST /api/user/authors: Validation failed", {
        userId: user.id,
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

    const { author_id } = validation.data;

    // Step 3: Check rate limit (10 requests per minute)
    const RATE_LIMIT = 10;
    const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

    if (rateLimitService.checkRateLimit(user.id, RATE_LIMIT, RATE_LIMIT_WINDOW_MS)) {
      logger.warn("POST /api/user/authors: Rate limit exceeded", {
        userId: user.id,
        authorId: author_id,
      });
      return new Response(
        JSON.stringify({
          error: "Too Many Requests",
          message: "Rate limit exceeded: maximum 10 author additions per minute",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        }
      );
    }

    // Step 4: Check user author limit
    const authorsService = new AuthorsService(supabase);
    let userLimit;
    try {
      userLimit = await authorsService.checkUserAuthorLimit(user.id);
    } catch (error) {
      logger.error("POST /api/user/authors: Failed to check user limit", {
        userId: user.id,
        authorId: author_id,
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

    if (userLimit.authorCount >= userLimit.maxAuthors) {
      logger.warn("POST /api/user/authors: Author limit exceeded", {
        userId: user.id,
        authorId: author_id,
        authorCount: userLimit.authorCount,
        maxAuthors: userLimit.maxAuthors,
      });
      return new Response(
        JSON.stringify({
          error: "Conflict",
          message: `Author limit reached (${userLimit.maxAuthors} authors per user)`,
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 5: Verify author exists and is accessible
    let author;
    try {
      author = await authorsService.findById(author_id);
    } catch (error) {
      logger.error("POST /api/user/authors: Failed to verify author", {
        userId: user.id,
        authorId: author_id,
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

    if (!author) {
      logger.warn("POST /api/user/authors: Author not found or not accessible", {
        userId: user.id,
        authorId: author_id,
      });
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: "Author not found or not accessible",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 6: Check for duplicate
    let isAttached;
    try {
      isAttached = await authorsService.isAuthorAttached(user.id, author_id);
    } catch (error) {
      logger.error("POST /api/user/authors: Failed to check duplicate", {
        userId: user.id,
        authorId: author_id,
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

    if (isAttached) {
      logger.warn("POST /api/user/authors: Author already attached", {
        userId: user.id,
        authorId: author_id,
      });
      return new Response(
        JSON.stringify({
          error: "Conflict",
          message: "Author is already attached to your profile",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 7: Insert relationship
    const { data: userAuthor, error: insertError } = await supabase
      .from("user_authors")
      .insert({
        user_id: user.id,
        author_id: author_id,
      })
      .select("author_id, created_at")
      .single();

    if (insertError) {
      const errorMessage = insertError.message;
      const errorCode = insertError.code;

      // Handle unique constraint violation (duplicate - race condition)
      if (errorCode === "23505") {
        logger.warn("POST /api/user/authors: Duplicate detected during insert", {
          userId: user.id,
          authorId: author_id,
        });
        return new Response(
          JSON.stringify({
            error: "Conflict",
            message: "Author is already attached to your profile",
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle trigger error (limit exceeded in database)
      if (errorMessage.includes("author limit") || errorMessage.includes("max_authors")) {
        logger.warn("POST /api/user/authors: Author limit exceeded (trigger)", {
          userId: user.id,
          authorId: author_id,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Conflict",
            message: `Author limit reached (${userLimit.maxAuthors} authors per user)`,
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle RLS violations
      if (errorCode === "42501") {
        logger.warn("POST /api/user/authors: RLS violation", {
          userId: user.id,
          authorId: author_id,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Cannot attach author: insufficient permissions",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle other database errors
      logger.error("POST /api/user/authors: Failed to insert user_author", {
        userId: user.id,
        authorId: author_id,
        error: errorMessage,
        errorCode,
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

    if (!userAuthor) {
      logger.error("POST /api/user/authors: No data returned from insert", {
        userId: user.id,
        authorId: author_id,
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

    // Step 8: Record request for rate limiting
    rateLimitService.recordRequest(user.id);

    // Step 9: Return success response
    return new Response(
      JSON.stringify({
        author_id: userAuthor.author_id,
        created_at: userAuthor.created_at,
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          Location: `/api/user/authors/${userAuthor.author_id}`,
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("POST /api/user/authors: Unexpected error", {
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
