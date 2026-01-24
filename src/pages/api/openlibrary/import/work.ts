import type { APIRoute } from "astro";
import { ImportWorkSchema } from "@/lib/validation/import-work.schema";
import { OpenLibraryService } from "@/lib/services/openlibrary.service";
import type { OpenLibraryEdition, OpenLibraryWork } from "@/lib/services/openlibrary.service";
import { WorksService } from "@/lib/services/works.service";
import { AuthorsService } from "@/lib/services/authors.service";
import type { WorkResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * POST /api/openlibrary/import/work
 *
 * Imports or refreshes a work from OpenLibrary and links it to an existing author.
 * Updates the shared catalog (manual=false, owner_user_id=null) via RPC SECURITY DEFINER.
 *
 * Request Body:
 * - openlibrary_id (required): OpenLibrary work ID in short format (e.g., "OL123W")
 * - author_id (required): UUID of the author to link to this work
 *
 * Response: WorkResponseDto with imported work and primary edition summary (200 OK)
 *
 * Errors:
 * - 400: Validation error (invalid JSON or invalid input)
 * - 401: Unauthorized (no session)
 * - 404: Author not found or not accessible, work not found in OpenLibrary
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
      logger.warn("POST /api/openlibrary/import/work: Authentication failed", { error: authError });
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
      logger.warn("POST /api/openlibrary/import/work: Invalid JSON body", {
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

    const validation = ImportWorkSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("POST /api/openlibrary/import/work: Validation failed", {
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

    const { openlibrary_id, author_id } = validation.data;

    // Step 2: Verify author exists and is accessible (RLS)
    const authorsService = new AuthorsService(supabase);
    let author;
    try {
      author = await authorsService.findById(author_id);
    } catch (error) {
      logger.error("POST /api/openlibrary/import/work: Database error while fetching author", {
        userId: user.id,
        authorId: author_id,
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

    if (!author) {
      logger.warn("POST /api/openlibrary/import/work: Author not found or not accessible", {
        userId: user.id,
        authorId: author_id,
      });
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: "Author not found or not accessible",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const worksService = new WorksService(supabase);
    const olService = new OpenLibraryService();

    // Step 3: Fetch work data from OpenLibrary
    let olWork: OpenLibraryWork;
    try {
      olWork = await olService.fetchWorkByOpenLibraryId(openlibrary_id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("not found")) {
        logger.warn("POST /api/openlibrary/import/work: Work not found in OpenLibrary", {
          openlibrary_id,
        });
        return new Response(
          JSON.stringify({
            error: "Work not found",
            message: `Work with openlibrary_id '${openlibrary_id}' not found in OpenLibrary`,
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      logger.error("POST /api/openlibrary/import/work: OpenLibrary API error", {
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

    // Step 4: Upsert work in the shared catalog
    let work;
    try {
      work = await worksService.upsertWorkFromOpenLibrary({
        openlibrary_id: olWork.openlibrary_id,
        title: olWork.title,
        first_publish_year: olWork.first_publish_year,
      });
    } catch (error) {
      logger.error("POST /api/openlibrary/import/work: Work upsert failed", {
        openlibrary_id: olWork.openlibrary_id,
        authorId: author_id,
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

    // Step 5: Resolve primary edition from OpenLibrary
    let editions: OpenLibraryEdition[] = [];
    try {
      editions = await olService.fetchWorkEditionsByOpenLibraryId(olWork.openlibrary_id);
    } catch (error) {
      logger.error("POST /api/openlibrary/import/work: Failed to fetch editions from OpenLibrary", {
        openlibrary_id: olWork.openlibrary_id,
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

    const selectedEdition = selectPrimaryEdition(olWork, editions);
    if (selectedEdition) {
      try {
        const edition = await worksService.upsertEditionFromOpenLibrary({
          work_id: work.id,
          openlibrary_id: selectedEdition.openlibrary_id,
          title: selectedEdition.title,
          publish_year: selectedEdition.publish_year,
          publish_date: selectedEdition.publish_date,
          publish_date_raw: selectedEdition.publish_date_raw,
          isbn13: selectedEdition.isbn13,
          cover_url: selectedEdition.cover_url,
          language: selectedEdition.language,
        });

        await worksService.setPrimaryEdition(work.id, edition.id);
      } catch (error) {
        logger.error("POST /api/openlibrary/import/work: Failed to upsert primary edition", {
          openlibrary_id: olWork.openlibrary_id,
          authorId: author_id,
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
    }

    // Step 6: Link author with work
    try {
      await worksService.linkAuthorWork(author.id, work.id);
    } catch (error) {
      logger.error("POST /api/openlibrary/import/work: Failed to link author and work", {
        openlibrary_id: olWork.openlibrary_id,
        authorId: author_id,
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

    // Step 7: Fetch the full work with primary edition for response
    let fullWork;
    try {
      fullWork = await worksService.findByIdWithPrimaryEdition(work.id);
    } catch (error) {
      logger.error("POST /api/openlibrary/import/work: Failed to fetch work for response", {
        openlibrary_id: olWork.openlibrary_id,
        authorId: author_id,
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

    if (!fullWork) {
      logger.warn("POST /api/openlibrary/import/work: Work not found after import", {
        openlibrary_id: olWork.openlibrary_id,
        authorId: author_id,
        workId: work.id,
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

    const response: WorkResponseDto = {
      work: fullWork,
    };

    logger.debug("POST /api/openlibrary/import/work: Successfully imported work", {
      openlibrary_id: olWork.openlibrary_id,
      authorId: author_id,
      workId: work.id,
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("POST /api/openlibrary/import/work: Unexpected error", { error });
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

const selectPrimaryEdition = (work: OpenLibraryWork, editions: OpenLibraryEdition[]): OpenLibraryEdition | null => {
  if (editions.length === 0) {
    return null;
  }

  if (work.primary_edition_openlibrary_id) {
    const directMatch = editions.find((edition) => edition.openlibrary_id === work.primary_edition_openlibrary_id);
    if (directMatch) {
      return directMatch;
    }
  }

  return editions.reduce((latest, current) => {
    return getEditionSortValue(current) > getEditionSortValue(latest) ? current : latest;
  });
};

const getEditionSortValue = (edition: OpenLibraryEdition): number => {
  if (edition.publish_date) {
    const timestamp = Date.parse(edition.publish_date);
    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  if (typeof edition.publish_year === "number") {
    return new Date(edition.publish_year, 11, 31).getTime();
  }

  return 0;
};
