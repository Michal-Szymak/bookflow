import type { APIRoute } from "astro";
import { CreateEditionSchema } from "@/lib/validation/create-edition.schema";
import { WorksService } from "@/lib/services/works.service";
import { EditionsService } from "@/lib/services/editions.service";
import type { CreateEditionCommand, EditionResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * POST /api/editions
 *
 * Creates a manual edition owned by the authenticated user and linked to a work.
 * Validates input, verifies work access, and enforces database constraints.
 *
 * Request Body:
 * - work_id (required): UUID of the work
 * - title (required): Edition title (1-500 characters, trimmed)
 * - manual (required): Must be true
 * - publish_year (optional): Year of publication (1500-2100)
 * - publish_date (optional): Date in YYYY-MM-DD format
 * - publish_date_raw (optional): Raw publication date string
 * - isbn13 (optional): 13-digit ISBN
 * - cover_url (optional): URL to cover image
 * - language (optional): Language code
 *
 * Response: EditionResponseDto with created edition (201 Created)
 *
 * Errors:
 * - 400: Validation error (invalid input)
 * - 401: Unauthorized (no session)
 * - 403: Forbidden (RLS violation)
 * - 404: Work not found or not accessible
 * - 409: Conflict (ISBN uniqueness or constraint violation)
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
      logger.warn("POST /api/editions: Authentication failed", { error: authError });
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
      logger.warn("POST /api/editions: Invalid JSON body", {
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

    const validation = CreateEditionSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("POST /api/editions: Validation failed", {
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

    const { work_id, title, publish_year, publish_date, publish_date_raw, isbn13, cover_url, language } =
      validation.data;

    // Step 3: Verify work exists and is accessible (RLS-aware)
    const worksService = new WorksService(supabase);
    let work;
    try {
      work = await worksService.findById(work_id);
    } catch (error) {
      logger.error("POST /api/editions: Failed to verify work", {
        userId: user.id,
        workId: work_id,
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

    if (!work) {
      logger.warn("POST /api/editions: Work not found or not accessible", {
        userId: user.id,
        workId: work_id,
      });
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: "Work not found or not accessible",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 4: Optional ISBN pre-check to provide clear conflict error
    if (isbn13) {
      const { data: existingEdition, error: isbnError } = await supabase
        .from("editions")
        .select("id")
        .eq("isbn13", isbn13)
        .maybeSingle();

      if (isbnError) {
        logger.error("POST /api/editions: Failed to pre-check ISBN", {
          userId: user.id,
          isbn13,
          error: isbnError,
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

      if (existingEdition) {
        logger.warn("POST /api/editions: ISBN conflict", {
          userId: user.id,
          isbn13,
          editionId: existingEdition.id,
        });
        return new Response(
          JSON.stringify({
            error: "Conflict",
            message: "Edition with this ISBN already exists",
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Step 5: Create edition
    const editionsService = new EditionsService(supabase);
    const createEditionData: CreateEditionCommand = {
      work_id,
      title,
      manual: true,
      publish_year: publish_year ?? null,
      publish_date: publish_date ?? null,
      publish_date_raw: publish_date_raw ?? null,
      isbn13: isbn13 ?? null,
      cover_url: cover_url ?? null,
      language: language ?? null,
    };

    let edition;
    try {
      edition = await editionsService.createManualEdition(user.id, createEditionData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("Database constraint violation")) {
        logger.warn("POST /api/editions: Constraint violation", {
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

      if (errorMessage.includes("Cannot create manual edition without ownership")) {
        logger.warn("POST /api/editions: RLS violation", {
          userId: user.id,
          error: errorMessage,
        });
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Cannot create manual edition without ownership",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      logger.error("POST /api/editions: Failed to create edition", {
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
    const response: EditionResponseDto = {
      edition,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        Location: `/api/editions/${edition.id}`,
      },
    });
  } catch (error) {
    logger.error("POST /api/editions: Unexpected error", { error });
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
