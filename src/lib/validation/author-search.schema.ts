import { z } from "zod";

/**
 * Validation schema for GET /api/authors/search query parameters.
 * Validates the search query and optional limit for OpenLibrary author search.
 */
export const AuthorSearchQuerySchema = z.object({
  q: z
    .string()
    .min(1, "Search query is required")
    .max(200, "Search query cannot exceed 200 characters")
    .trim()
    .refine((val) => val.length > 0, "Search query cannot be empty after trimming"),
  limit: z
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(50, "Limit cannot exceed 50")
    .default(10)
    .optional(),
});

/**
 * Type inference from the Zod schema.
 * Represents validated query parameters for author search.
 */
export type AuthorSearchQueryValidated = z.infer<typeof AuthorSearchQuerySchema>;
