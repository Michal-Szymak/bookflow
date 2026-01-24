import type { APIRoute } from "astro";
import { WorkIdParamSchema } from "@/lib/validation/work-id.schema";
import { EditionsService } from "@/lib/services/editions.service";
import { WorksService } from "@/lib/services/works.service";
import type { EditionsListResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * GET /api/works/{workId}/editions
 *
 * Retrieves a list of editions for a specific work, sorted by publish year (desc).
 *
 * Path Parameters:
 * - workId (required): UUID of the work
 *
 * Response: EditionsListResponseDto with editions list (200 OK)
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
      logger.warn("GET /api/works/{workId}/editions: Path validation failed", {
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
    const editionsService = new EditionsService(supabase);

    // Step 3: Verify work exists and is accessible (RLS-aware)
    let work;
    try {
      work = await worksService.findById(workId);
    } catch (error) {
      logger.error("GET /api/works/{workId}/editions: Database error while fetching work", {
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
      logger.warn("GET /api/works/{workId}/editions: Work not found", { workId });
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

    // Step 4: Fetch editions list for work
    let editions;
    try {
      editions = await editionsService.listByWorkId(workId);
    } catch (error) {
      logger.error("GET /api/works/{workId}/editions: Database error while fetching editions", {
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

    const response: EditionsListResponseDto = {
      items: editions,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("GET /api/works/{workId}/editions: Unexpected error", {
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
