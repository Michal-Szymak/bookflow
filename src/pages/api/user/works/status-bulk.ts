import type { APIRoute } from "astro";
import { UpdateUserWorksBulkCommandSchema } from "@/lib/validation/update-user-works-bulk.schema";
import { WorksService } from "@/lib/services/works.service";
import type { UserWorksBulkUpdateResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * POST /api/user/works/status-bulk
 *
 * Bulk updates the status and/or availability in Legimi for multiple works
 * attached to the authenticated user's profile.
 * Database trigger automatically updates status_updated_at when status changes.
 * Works that are not attached to the user are silently skipped (no error).
 *
 * Request Body:
 * - work_ids (required): Array of work UUIDs to update (min 1, max 100, deduplicated automatically)
 * - status (optional): New status for all works ("to_read" | "in_progress" | "read" | "hidden")
 * - available_in_legimi (optional): Availability in Legimi for all works (boolean | null)
 * - At least one of status or available_in_legimi must be provided
 *
 * Response: 200 OK with UserWorksBulkUpdateResponseDto containing array of updated works
 *
 * Errors:
 * - 400: Validation error (invalid request body, empty work_ids, exceeded limit, missing required fields)
 * - 401: Unauthorized (authentication required)
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
      logger.warn("POST /api/user/works/status-bulk: Authentication failed", {
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
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn("POST /api/user/works/status-bulk: Invalid JSON body", {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
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

    const validation = UpdateUserWorksBulkCommandSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("POST /api/user/works/status-bulk: Validation failed", {
        userId: user.id,
        errors: validation.error.errors,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: validation.error.errors[0]?.message || "Invalid request body",
          details: validation.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { work_ids, status, available_in_legimi } = validation.data;

    // Step 3: Initialize service and perform bulk update
    const worksService = new WorksService(supabase);

    let updatedWorks;
    try {
      updatedWorks = await worksService.bulkUpdateUserWorks(user.id, work_ids, {
        status,
        available_in_legimi,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle RLS violations
      if (errorMessage.includes("insufficient permissions")) {
        logger.warn("POST /api/user/works/status-bulk: RLS violation", {
          userId: user.id,
          workIdsCount: work_ids.length,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Cannot update works: insufficient permissions",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle other database errors
      logger.error("POST /api/user/works/status-bulk: Database error", {
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
    // Note: updatedWorks contains only works that were successfully updated (attached to user)
    // Works that are not attached are silently skipped (no error)
    const response: UserWorksBulkUpdateResponseDto = {
      works: updatedWorks,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("POST /api/user/works/status-bulk: Unexpected error", {
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
