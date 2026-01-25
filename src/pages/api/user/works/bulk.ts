import type { APIRoute } from "astro";
import { BulkAttachUserWorksCommandSchema } from "@/lib/validation/user-works-bulk-attach.schema";
import { WorksService } from "@/lib/services/works.service";
import type { BulkAttachUserWorksResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * POST /api/user/works/bulk
 *
 * Bulk attaches works to the authenticated user's profile.
 * Creates relationships in the user_works table and automatically increments
 * the work_count in the user's profile via database trigger.
 *
 * Request Body:
 * - work_ids (required): Array of work UUIDs to attach (min 1, max 100, deduplicated automatically)
 * - status (optional): Initial status for newly attached works ("to_read" | "in_progress" | "read" | "hidden", default: "to_read")
 *
 * Response: BulkAttachUserWorksResponseDto with added and skipped arrays (201 Created)
 *
 * Errors:
 * - 400: Validation error (invalid request body)
 * - 401: Unauthorized (authentication required)
 * - 403: Forbidden (RLS violation)
 * - 409: Conflict (work limit reached: 5000 works per user)
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
      logger.warn("POST /api/user/works/bulk: Authentication failed", {
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
      logger.warn("POST /api/user/works/bulk: Invalid JSON body", {
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

    const validation = BulkAttachUserWorksCommandSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("POST /api/user/works/bulk: Validation failed", {
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

    const { work_ids, status } = validation.data;

    // Step 3: Initialize service and perform bulk attach
    const worksService = new WorksService(supabase);

    let result;
    try {
      result = await worksService.bulkAttachUserWorks(user.id, work_ids, status || "to_read");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle work limit errors
      if (errorMessage.includes("Work limit reached")) {
        logger.warn("POST /api/user/works/bulk: Work limit exceeded", {
          userId: user.id,
          workIdsCount: work_ids.length,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Conflict",
            message: "Work limit reached (5000 works per user)",
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle RLS violations
      if (errorMessage.includes("insufficient permissions")) {
        logger.warn("POST /api/user/works/bulk: RLS violation", {
          userId: user.id,
          workIdsCount: work_ids.length,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Cannot attach works: insufficient permissions",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle other errors
      logger.error("POST /api/user/works/bulk: Database error", {
        userId: user.id,
        workIdsCount: work_ids.length,
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

    // Step 4: Build and return response
    const response: BulkAttachUserWorksResponseDto = {
      added: result.added,
      skipped: result.skipped,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("POST /api/user/works/bulk: Unexpected error", {
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
