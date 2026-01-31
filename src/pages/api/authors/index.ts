import type { APIRoute } from "astro";
import { CreateAuthorSchema } from "@/lib/validation/create-author.schema";
import { AuthorsService } from "@/lib/services/authors.service";
import type { AuthorResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * POST /api/authors
 *
 * Creates a manual author owned by the authenticated user.
 * Validates input, checks user limits, and enforces database constraints.
 *
 * Request Body:
 * - name (required): Author name (1-500 characters, trimmed)
 * - manual (required): Must be true
 * - openlibrary_id (optional): Must be null if provided
 *
 * Response: AuthorResponseDto with created author (201 Created)
 *
 * Errors:
 * - 400: Validation error
 * - 401: Unauthorized (no session)
 * - 403: Forbidden (RLS violation)
 * - 409: Conflict (limit exceeded or constraint violation)
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
      logger.warn("POST /api/authors: Authentication failed", { error: authError });
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
      logger.warn("POST /api/authors: Invalid JSON body", { error });
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

    const validation = CreateAuthorSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("POST /api/authors: Validation failed", {
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

    const { name } = validation.data;

    // Step 3: Check user author limit
    const authorsService = new AuthorsService(supabase);
    let userLimit;
    try {
      userLimit = await authorsService.checkUserAuthorLimit(user.id);
    } catch (error) {
      logger.error("POST /api/authors: Failed to check user limit", {
        userId: user.id,
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
      logger.warn("POST /api/authors: Author limit exceeded", {
        userId: user.id,
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

    // Step 4 & 5: Create author
    let author;
    try {
      author = await authorsService.createManualAuthor(user.id, name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle constraint violations
      if (errorMessage.includes("Database constraint violation")) {
        logger.warn("POST /api/authors: Constraint violation", {
          userId: user.id,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Conflict",
            message: "Database constraint violation",
            details: errorMessage,
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle RLS violations
      if (errorMessage.includes("Cannot create manual author without ownership")) {
        logger.warn("POST /api/authors: RLS violation", {
          userId: user.id,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Cannot create manual author without ownership",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle other database errors
      logger.error("POST /api/authors: Failed to create author", {
        userId: user.id,
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

    // Step 6: Return success response
    const response: AuthorResponseDto = {
      author,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        Location: `/api/authors/${author.id}`,
      },
    });
  } catch (error) {
    logger.error("POST /api/authors: Unexpected error", { error });
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
