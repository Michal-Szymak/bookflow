import { z } from "zod";

/**
 * Validation schema for POST /api/openlibrary/import/author request body.
 * Validates the openlibrary_id required for importing an author from OpenLibrary.
 * Only accepts short format (e.g., "OL23919A"), not long format (e.g., "/authors/OL23919A").
 */
export const ImportAuthorSchema = z.object({
  openlibrary_id: z
    .string()
    .min(1, "openlibrary_id is required")
    .max(25, "openlibrary_id cannot exceed 25 characters")
    .trim()
    .refine((val) => val.length > 0, "openlibrary_id cannot be empty after trimming")
    .refine(
      (val) => !val.startsWith("/authors/"),
      "openlibrary_id must be in short format (e.g., 'OL23919A'), not long format (e.g., '/authors/OL23919A')"
    )
    .refine(
      (val) => !val.startsWith("/"),
      "openlibrary_id must be in short format (e.g., 'OL23919A'), not long format with leading slash"
    ),
});

/**
 * Type inference from the Zod schema.
 * Represents validated request body for author import from OpenLibrary.
 */
export type ImportAuthorCommandValidated = z.infer<typeof ImportAuthorSchema>;
