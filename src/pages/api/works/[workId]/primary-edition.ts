import type { APIRoute } from "astro";
import { WorkIdParamSchema } from "@/lib/validation/work-id.schema";
import { SetPrimaryEditionSchema } from "@/lib/validation/set-primary-edition.schema";
import { WorksService } from "@/lib/services/works.service";
import type { WorkResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * POST /api/works/{workId}/primary-edition
 *
 * Sets or updates the primary edition for a work.
 * Validates input, verifies work and edition visibility, and uses SECURITY DEFINER RPC to update.
 *
 * Path Parameters:
 * - workId (required): UUID of the work
 *
 * Request Body:
 * - edition_id (required): UUID of the edition to set as primary
 *
 * Response: WorkResponseDto with updated work and primary edition (200 OK)
 *
 * Errors:
 * - 400: Validation error (invalid UUID format, invalid JSON, edition not matching work)
 * - 401: Unauthorized (no session)
 * - 404: Work or edition not found or not accessible (RLS filtered)
 * - 500: Internal server error
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
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
      logger.warn("POST /api/works/{workId}/primary-edition: Path validation failed", {
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

    // Step 2: Validate authentication
    const supabase = locals.supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("POST /api/works/{workId}/primary-edition: Authentication failed", {
        workId,
        error: authError,
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

    // Step 3: Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn("POST /api/works/{workId}/primary-edition: Invalid JSON body", {
        workId,
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

    const bodyValidation = SetPrimaryEditionSchema.safeParse(body);

    if (!bodyValidation.success) {
      logger.warn("POST /api/works/{workId}/primary-edition: Body validation failed", {
        workId,
        userId: user.id,
        errors: bodyValidation.error.errors,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: bodyValidation.error.errors[0]?.message || "Invalid input",
          details: bodyValidation.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { edition_id } = bodyValidation.data;

    // Step 4: Verify work and edition visibility before SECURITY DEFINER RPC
    const worksService = new WorksService(supabase);

    let work;
    try {
      work = await worksService.findById(workId);
    } catch (error) {
      logger.error("POST /api/works/{workId}/primary-edition: Database error while fetching work", {
        workId,
        userId: user.id,
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
      logger.warn("POST /api/works/{workId}/primary-edition: Work not found", {
        workId,
        userId: user.id,
      });
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

    let edition;
    try {
      edition = await worksService.findEditionById(edition_id);
    } catch (error) {
      logger.error("POST /api/works/{workId}/primary-edition: Database error while fetching edition", {
        workId,
        edition_id,
        userId: user.id,
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

    if (!edition) {
      logger.warn("POST /api/works/{workId}/primary-edition: Edition not found", {
        workId,
        edition_id,
        userId: user.id,
      });
      return new Response(
        JSON.stringify({
          error: "Not found",
          message: "Edition not found or not accessible",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (edition.work_id !== workId) {
      logger.warn("POST /api/works/{workId}/primary-edition: Edition does not belong to work", {
        workId,
        edition_id,
        edition_work_id: edition.work_id,
        userId: user.id,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: "edition_id does not belong to workId",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 5: Update primary edition via RPC
    try {
      await worksService.setPrimaryEdition(workId, edition_id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("POST /api/works/{workId}/primary-edition: Failed to set primary edition", {
        workId,
        edition_id,
        userId: user.id,
        error: errorMessage,
      });

      if (errorMessage.includes("does not belong to work")) {
        return new Response(
          JSON.stringify({
            error: "Validation error",
            message: "edition_id does not belong to workId",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (errorMessage.includes("not found")) {
        return new Response(
          JSON.stringify({
            error: "Not found",
            message: "Work or edition not found or not accessible",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

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

    // Step 6: Fetch updated work with primary edition
    let updatedWork;
    try {
      updatedWork = await worksService.findByIdWithPrimaryEdition(workId);
    } catch (error) {
      logger.error("POST /api/works/{workId}/primary-edition: Database error while fetching updated work", {
        workId,
        edition_id,
        userId: user.id,
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

    if (!updatedWork) {
      logger.warn("POST /api/works/{workId}/primary-edition: Work not found after update", {
        workId,
        edition_id,
        userId: user.id,
      });
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
      work: updatedWork,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("POST /api/works/{workId}/primary-edition: Unexpected error", {
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
