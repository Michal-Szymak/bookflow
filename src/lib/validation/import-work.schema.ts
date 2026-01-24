import { z } from "zod";

/**
 * Validation schema for POST /api/openlibrary/import/work request body.
 * Validates the openlibrary_id and author_id required for importing a work from OpenLibrary.
 * Only accepts short format (e.g., "OL123W"), not long format (e.g., "/works/OL123W").
 */
export const ImportWorkSchema = z.object({
  openlibrary_id: z
    .string()
    .min(1, "openlibrary_id is required")
    .max(25, "openlibrary_id cannot exceed 25 characters")
    .trim()
    .refine((val) => val.length > 0, "openlibrary_id cannot be empty after trimming")
    .refine(
      (val) => !val.startsWith("/works/"),
      "openlibrary_id must be in short format (e.g., 'OL123W'), not long format (e.g., '/works/OL123W')"
    )
    .refine(
      (val) => !val.startsWith("/"),
      "openlibrary_id must be in short format (e.g., 'OL123W'), not long format with leading slash"
    ),
  author_id: z.string().uuid("author_id must be a valid UUID"),
});

/**
 * Type inference from the Zod schema.
 * Represents validated request body for work import from OpenLibrary.
 */
export type ImportWorkCommandValidated = z.infer<typeof ImportWorkSchema>;
