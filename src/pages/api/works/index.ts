import type { APIRoute } from "astro";
import { CreateWorkSchema } from "@/lib/validation/create-work.schema";
import { WorksService } from "@/lib/services/works.service";
import type { WorkResponseDto, CreateWorkCommand } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * POST /api/works
 *
 * Creates a manual work owned by the authenticated user and links it to authors.
 * Validates input, checks user limits, verifies authors exist, and enforces database constraints.
 *
 * Request Body:
 * - title (required): Work title (1-500 characters, trimmed)
 * - manual (required): Must be true
 * - author_ids (required): Array of author UUIDs (at least one)
 * - first_publish_year (optional): Year of first publication (1500-2100)
 * - primary_edition_id (optional): UUID of edition to set as primary (must belong to created work)
 *
 * Response: WorkResponseDto with created work and primary edition (201 Created)
 *
 * Errors:
 * - 400: Validation error (invalid input, invalid primary_edition_id)
 * - 401: Unauthorized (no session)
 * - 403: Forbidden (RLS violation)
 * - 404: Not Found (one or more authors not found or not accessible)
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
      logger.warn("POST /api/works: Authentication failed", { error: authError });
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
      logger.warn("POST /api/works: Invalid JSON body", {
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

    const validation = CreateWorkSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("POST /api/works: Validation failed", {
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

    const { title, author_ids, first_publish_year, primary_edition_id } = validation.data;

    // Step 3: Check user work limit
    const worksService = new WorksService(supabase);
    let userLimit;
    try {
      userLimit = await worksService.checkUserWorkLimit(user.id);
    } catch (error) {
      logger.error("POST /api/works: Failed to check user limit", {
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

    if (userLimit.workCount >= userLimit.maxWorks) {
      logger.warn("POST /api/works: Work limit exceeded", {
        userId: user.id,
        workCount: userLimit.workCount,
        maxWorks: userLimit.maxWorks,
      });
      return new Response(
        JSON.stringify({
          error: "Conflict",
          message: `Work limit reached (${userLimit.maxWorks} works per user)`,
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 4: Verify authors exist and are accessible
    let invalidAuthorIds;
    try {
      invalidAuthorIds = await worksService.verifyAuthorsExist(author_ids, user.id);
    } catch (error) {
      logger.error("POST /api/works: Failed to verify authors", {
        userId: user.id,
        authorIds: author_ids,
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

    if (invalidAuthorIds.length > 0) {
      logger.warn("POST /api/works: One or more authors not found or not accessible", {
        userId: user.id,
        invalidAuthorIds,
      });
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: "One or more authors not found or not accessible",
          details: invalidAuthorIds,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 5: Create work and author-work links
    const createWorkData: CreateWorkCommand = {
      title,
      manual: true,
      author_ids,
      first_publish_year: first_publish_year ?? null,
      primary_edition_id: primary_edition_id ?? null,
    };

    let work;
    try {
      work = await worksService.createManualWork(user.id, createWorkData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle constraint violations
      if (errorMessage.includes("Database constraint violation")) {
        logger.warn("POST /api/works: Constraint violation", {
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
      if (errorMessage.includes("Cannot create manual work without ownership")) {
        logger.warn("POST /api/works: RLS violation", {
          userId: user.id,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Cannot create manual work without ownership",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle primary edition validation errors
      if (
        errorMessage.includes("Primary edition not found") ||
        errorMessage.includes("Primary edition does not belong to this work")
      ) {
        logger.warn("POST /api/works: Invalid primary_edition_id", {
          userId: user.id,
          primary_edition_id,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Validation error",
            message: errorMessage,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle other database errors
      logger.error("POST /api/works: Failed to create work", {
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

    // Step 6: Fetch work with primary edition details
    let workWithPrimaryEdition;
    try {
      workWithPrimaryEdition = await worksService.findByIdWithPrimaryEdition(work.id);
    } catch (error) {
      logger.error("POST /api/works: Failed to fetch created work", {
        userId: user.id,
        workId: work.id,
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

    if (!workWithPrimaryEdition) {
      logger.error("POST /api/works: Created work not found after creation", {
        userId: user.id,
        workId: work.id,
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
    logger.info("POST /api/works: Work created", {
      userId: user.id,
      workId: work.id,
      authorIds: author_ids,
      primaryEditionId: primary_edition_id ?? null,
    });
    const response: WorkResponseDto = {
      work: workWithPrimaryEdition,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        Location: `/api/works/${work.id}`,
      },
    });
  } catch (error) {
    logger.error("POST /api/works: Unexpected error", { error });
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
