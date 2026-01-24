import { z } from "zod";

/**
 * Validation schema for POST /api/openlibrary/import/edition request body.
 * Validates the openlibrary_id and work_id required for importing an edition from OpenLibrary.
 * Only accepts short format (e.g., "OL123M"), not long format (e.g., "/books/OL123M").
 */
export const ImportEditionSchema = z.object({
  openlibrary_id: z
    .string()
    .min(1, "openlibrary_id is required")
    .max(25, "openlibrary_id cannot exceed 25 characters")
    .trim()
    .refine((val) => val.length > 0, "openlibrary_id cannot be empty after trimming")
    .refine(
      (val) => !val.startsWith("/books/"),
      "openlibrary_id must be in short format (e.g., 'OL123M'), not long format (e.g., '/books/OL123M')"
    )
    .refine(
      (val) => !val.startsWith("/"),
      "openlibrary_id must be in short format (e.g., 'OL123M'), not long format with leading slash"
    ),
  work_id: z.string().uuid("work_id must be a valid UUID"),
});

/**
 * Type inference from the Zod schema.
 * Represents validated request body for edition import from OpenLibrary.
 */
export type ImportEditionCommandValidated = z.infer<typeof ImportEditionSchema>;
