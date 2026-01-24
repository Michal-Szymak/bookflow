import type { APIRoute } from "astro";
import { WorkIdParamSchema } from "@/lib/validation/work-id.schema";
import { WorksService } from "@/lib/services/works.service";
import type { WorkResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * GET /api/works/{workId}
 *
 * Retrieves a single work with its primary edition summary.
 *
 * Path Parameters:
 * - workId (required): UUID of the work
 *
 * Response: WorkResponseDto with work and primary edition (200 OK)
 *
 * Errors:
 * - 400: Validation error (invalid UUID format)
 * - 404: Work not found or not accessible (RLS filtered)
 * - 500: Internal server error
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // Step 1: Extract and validate path parameter
    if (!params.workId) {
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: "workId parameter is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const pathValidation = WorkIdParamSchema.safeParse({
      workId: params.workId,
    });

    if (!pathValidation.success) {
      logger.warn("GET /api/works/{workId}: Path validation failed", {
        workId: params.workId,
        errors: pathValidation.error.errors,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: pathValidation.error.errors[0]?.message || "Invalid workId format",
          details: pathValidation.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { workId } = pathValidation.data;

    // Step 2: Initialize services
    const supabase = locals.supabase;
    const worksService = new WorksService(supabase);

    // Step 3: Fetch work with primary edition
    let work;
    try {
      work = await worksService.findByIdWithPrimaryEdition(workId);
    } catch (error) {
      logger.error("GET /api/works/{workId}: Database error while fetching work", {
        workId,
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

    if (!work) {
      logger.warn("GET /api/works/{workId}: Work not found", { workId });
      return new Response(
        JSON.stringify({
          error: "Not found",
          message: "Work not found or not accessible",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const response: WorkResponseDto = {
      work,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("GET /api/works/{workId}: Unexpected error", {
      workId: params?.workId,
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
