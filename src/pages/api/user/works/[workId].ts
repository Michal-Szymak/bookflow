import type { APIRoute } from "astro";
import { WorkIdParamSchema } from "@/lib/validation/work-id.schema";
import { UpdateUserWorkCommandSchema } from "@/lib/validation/update-user-work.schema";
import { WorksService } from "@/lib/services/works.service";
import { logger } from "@/lib/logger";
import type { UserWorkResponseDto } from "@/types";

export const prerender = false;

/**
 * PATCH /api/user/works/{workId}
 *
 * Updates the status and/or availability in Legimi for a single work
 * attached to the authenticated user's profile.
 * Database trigger automatically updates status_updated_at when status changes.
 *
 * Path Parameters:
 * - workId (required): UUID of the work to update in standard format (e.g., "550e8400-e29b-41d4-a716-446655440000")
 *
 * Request Body:
 * - status (optional): New status for the work ("to_read" | "in_progress" | "read" | "hidden")
 * - available_in_legimi (optional): Availability in Legimi (boolean | null)
 * - At least one of the above fields must be provided
 *
 * Response: 200 OK with UserWorkResponseDto
 *
 * Errors:
 * - 400: Validation error (invalid UUID format, missing required fields, invalid enum value)
 * - 401: Unauthorized (authentication required)
 * - 404: Not Found (work is not attached to user profile)
 * - 500: Internal server error
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    // Step 1: Extract and validate path parameter
    if (!params.workId) {
      logger.warn("PATCH /api/user/works/{workId}: Missing workId parameter");
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
      logger.warn("PATCH /api/user/works/{workId}: Path validation failed", {
        workId: params.workId,
        errors: pathValidation.error.errors,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: pathValidation.error.errors[0]?.message || "workId must be a valid UUID",
          details: pathValidation.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { workId } = pathValidation.data;

    // Step 2: Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn("PATCH /api/user/works/{workId}: Invalid JSON in request body", {
        workId,
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

    const bodyValidation = UpdateUserWorkCommandSchema.safeParse(body);

    if (!bodyValidation.success) {
      logger.warn("PATCH /api/user/works/{workId}: Body validation failed", {
        workId,
        errors: bodyValidation.error.errors,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: bodyValidation.error.errors[0]?.message || "Invalid request body",
          details: bodyValidation.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const updateData = bodyValidation.data;

    // Step 3: Verify authentication
    const supabase = locals.supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("PATCH /api/user/works/{workId}: Authentication failed", {
        workId,
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

    // Step 4: Update user work
    const worksService = new WorksService(supabase);
    let updatedWork;
    try {
      updatedWork = await worksService.updateUserWork(user.id, workId, updateData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle RLS policy violations
      if (errorMessage.includes("insufficient permissions")) {
        logger.warn("PATCH /api/user/works/{workId}: RLS policy violation", {
          userId: user.id,
          workId,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Cannot update work: insufficient permissions",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle other database errors
      logger.error("PATCH /api/user/works/{workId}: Failed to update user work", {
        userId: user.id,
        workId,
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

    // Step 5: Handle case when work is not attached
    if (!updatedWork) {
      logger.warn("PATCH /api/user/works/{workId}: Work is not attached to user profile", {
        userId: user.id,
        workId,
      });
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: "Work is not attached to your profile",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 6: Build and return response
    const response: UserWorkResponseDto = {
      work: updatedWork,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("PATCH /api/user/works/{workId}: Unexpected error", {
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
 * DELETE /api/user/works/{workId}
 *
 * Detaches a work from the authenticated user's profile.
 * Removes the user-work relationship from the user_works table.
 * Database trigger automatically updates work_count in profiles.
 * The work itself remains in the global catalog and can be used by other users.
 *
 * Path Parameters:
 * - workId (required): UUID of the work to detach in standard format (e.g., "550e8400-e29b-41d4-a716-446655440000")
 *
 * Response: 204 No Content (success)
 *
 * Errors:
 * - 400: Validation error (invalid UUID format or missing parameter)
 * - 401: Unauthorized (authentication required)
 * - 403: Forbidden (RLS policy violation)
 * - 404: Not Found (work is not attached to user profile)
 * - 500: Internal server error
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    // Step 1: Extract and validate path parameter
    if (!params.workId) {
      logger.warn("DELETE /api/user/works/{workId}: Missing workId parameter");
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

    const validation = WorkIdParamSchema.safeParse({
      workId: params.workId,
    });

    if (!validation.success) {
      logger.warn("DELETE /api/user/works/{workId}: Validation failed", {
        workId: params.workId,
        errors: validation.error.errors,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: validation.error.errors[0]?.message || "workId must be a valid UUID",
          details: validation.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { workId } = validation.data;

    // Step 2: Verify authentication
    const supabase = locals.supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("DELETE /api/user/works/{workId}: Authentication failed", {
        workId,
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

    // Step 3: Verify that work is attached to user
    const worksService = new WorksService(supabase);
    let isAttached;
    try {
      isAttached = await worksService.isWorkAttached(user.id, workId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("DELETE /api/user/works/{workId}: Failed to check if work is attached", {
        userId: user.id,
        workId,
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

    if (!isAttached) {
      logger.warn("DELETE /api/user/works/{workId}: Work is not attached to user profile", {
        userId: user.id,
        workId,
      });
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: "Work is not attached to your profile",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 4: Detach work
    try {
      await worksService.detachUserWork(user.id, workId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle RLS policy violations
      if (errorMessage.includes("insufficient permissions")) {
        logger.warn("DELETE /api/user/works/{workId}: RLS policy violation", {
          userId: user.id,
          workId,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Cannot detach work: insufficient permissions",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle "not attached" error (should not happen after check, but handle gracefully)
      if (errorMessage.includes("not attached")) {
        logger.warn("DELETE /api/user/works/{workId}: Work is not attached (from service)", {
          userId: user.id,
          workId,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Not Found",
            message: "Work is not attached to your profile",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle other database errors
      logger.error("DELETE /api/user/works/{workId}: Failed to detach work", {
        userId: user.id,
        workId,
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

    // Step 5: Return success response (204 No Content)
    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("DELETE /api/user/works/{workId}: Unexpected error", {
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
