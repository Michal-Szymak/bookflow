import { z } from "zod";

/**
 * Validation schema for POST /api/works/{workId}/primary-edition request body.
 * Validates edition_id for setting a work's primary edition.
 */
export const SetPrimaryEditionSchema = z.object({
  edition_id: z.string().uuid("edition_id must be a valid UUID"),
});

/**
 * Type inference from the Zod schema.
 * Represents validated request body for setting a primary edition.
 */
export type SetPrimaryEditionValidated = z.infer<typeof SetPrimaryEditionSchema>;
