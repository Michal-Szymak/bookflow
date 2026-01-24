import type { APIRoute } from "astro";
import { ImportEditionSchema } from "@/lib/validation/import-edition.schema";
import { OpenLibraryService } from "@/lib/services/openlibrary.service";
import type { OpenLibraryEdition } from "@/lib/services/openlibrary.service";
import { WorksService } from "@/lib/services/works.service";
import { EditionsService } from "@/lib/services/editions.service";
import type { EditionResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * POST /api/openlibrary/import/edition
 *
 * Imports or refreshes an edition from OpenLibrary and links it to an existing work.
 * Updates the shared catalog (manual=false, owner_user_id=null) via RPC SECURITY DEFINER.
 * Implements 7-day cache TTL mechanism - data is refreshed only if cache expired or edition doesn't exist.
 *
 * Request Body:
 * - openlibrary_id (required): OpenLibrary edition ID in short format (e.g., "OL123M", max 25 characters)
 * - work_id (required): UUID of the work to link to this edition
 *
 * Response: EditionResponseDto with imported/refreshed edition (200 OK)
 *
 * Errors:
 * - 400: Validation error (invalid JSON or invalid input)
 * - 401: Unauthorized (no session)
 * - 404: Work not found or not accessible, edition not found in OpenLibrary
 * - 502: OpenLibrary API unavailable or error
 * - 500: Internal server error
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const supabase = locals.supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("POST /api/openlibrary/import/edition: Authentication failed", { error: authError });
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

    // Step 1: Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn("POST /api/openlibrary/import/edition: Invalid JSON body", {
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

    const validation = ImportEditionSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("POST /api/openlibrary/import/edition: Validation failed", {
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

    const { openlibrary_id, work_id } = validation.data;

    // Step 2: Verify work exists and is accessible (RLS)
    const worksService = new WorksService(supabase);
    let work;
    try {
      work = await worksService.findById(work_id);
    } catch (error) {
      logger.error("POST /api/openlibrary/import/edition: Database error while fetching work", {
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
      logger.warn("POST /api/openlibrary/import/edition: Work not found or not accessible", {
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

    const editionsService = new EditionsService(supabase);
    const olService = new OpenLibraryService();

    // Step 3: Check cache in database
    let cachedEdition;
    try {
      cachedEdition = await editionsService.findByOpenLibraryId(openlibrary_id);
    } catch (error) {
      logger.error("POST /api/openlibrary/import/edition: Cache lookup failed", {
        openlibrary_id,
        workId: work_id,
        error,
      });
      cachedEdition = null;
    }

    // Step 4: Check if cache is valid
    const now = new Date();
    if (cachedEdition?.ol_expires_at && new Date(cachedEdition.ol_expires_at) > now) {
      logger.debug("POST /api/openlibrary/import/edition: Cache hit", {
        openlibrary_id,
        editionId: cachedEdition.id,
      });

      const response: EditionResponseDto = {
        edition: cachedEdition,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 5: Cache expired or missing - fetch from OpenLibrary
    logger.debug("POST /api/openlibrary/import/edition: Cache miss or expired, fetching from OpenLibrary", {
      openlibrary_id,
      hasCached: !!cachedEdition,
    });

    let olEdition: OpenLibraryEdition;
    try {
      olEdition = await olService.fetchEditionByOpenLibraryId(openlibrary_id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("not found")) {
        logger.warn("POST /api/openlibrary/import/edition: Edition not found in OpenLibrary", {
          openlibrary_id,
        });
        return new Response(
          JSON.stringify({
            error: "Edition not found",
            message: `Edition with openlibrary_id '${openlibrary_id}' not found in OpenLibrary`,
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      logger.error("POST /api/openlibrary/import/edition: OpenLibrary API error", {
        openlibrary_id,
        error,
      });
      return new Response(
        JSON.stringify({
          error: "External service error",
          message: "Could not connect to OpenLibrary. Please try again later.",
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 6: Upsert edition in the shared catalog with cache TTL
    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

    let edition;
    try {
      edition = await worksService.upsertEditionFromOpenLibrary({
        work_id,
        openlibrary_id: olEdition.openlibrary_id,
        title: olEdition.title,
        publish_year: olEdition.publish_year,
        publish_date: olEdition.publish_date,
        publish_date_raw: olEdition.publish_date_raw,
        isbn13: olEdition.isbn13,
        cover_url: olEdition.cover_url,
        language: olEdition.language,
        ol_fetched_at: fetchedAt.toISOString(),
        ol_expires_at: expiresAt.toISOString(),
      });
    } catch (error) {
      logger.error("POST /api/openlibrary/import/edition: Edition upsert failed", {
        openlibrary_id: olEdition.openlibrary_id,
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

    // Step 7: Return success response
    logger.debug("POST /api/openlibrary/import/edition: Successfully imported/refreshed edition", {
      openlibrary_id: olEdition.openlibrary_id,
      workId: work_id,
      editionId: edition.id,
    });

    const response: EditionResponseDto = {
      edition,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("POST /api/openlibrary/import/edition: Unexpected error", { error });
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
