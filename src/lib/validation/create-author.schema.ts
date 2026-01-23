import { z } from "zod";

/**
 * Validation schema for POST /api/authors request body.
 * Validates manual author creation with required name and manual flag.
 */
export const CreateAuthorSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .min(1, "Name cannot be empty")
    .max(500, "Name cannot exceed 500 characters")
    .trim()
    .refine((val) => val.length > 0, "Name cannot be empty after trimming"),
  manual: z.literal(true, {
    errorMap: () => ({ message: "Manual must be true for manual authors" }),
  }),
  openlibrary_id: z
    .null()
    .optional()
    .refine((val) => val === null || val === undefined, {
      message: "openlibrary_id must be null for manual authors",
    }),
});

/**
 * Type inference from the Zod schema.
 * Represents validated request body for creating a manual author.
 */
export type CreateAuthorValidated = z.infer<typeof CreateAuthorSchema>;
