import { z } from "zod";

/**
 * Validation schema for POST /api/works request body.
 * Validates manual work creation with required title, manual flag, and author IDs.
 */
export const CreateWorkSchema = z.object({
  title: z
    .string({ required_error: "Title is required" })
    .min(1, "Title cannot be empty")
    .max(500, "Title cannot exceed 500 characters")
    .trim()
    .refine((val) => val.length > 0, "Title cannot be empty after trimming"),
  manual: z.literal(true, {
    errorMap: () => ({ message: "Manual must be true for manual works" }),
  }),
  author_ids: z
    .array(z.string().uuid("Each author_id must be a valid UUID"), {
      required_error: "author_ids is required",
    })
    .min(1, "At least one author is required"),
  first_publish_year: z
    .number({
      invalid_type_error: "first_publish_year must be a number",
    })
    .int("first_publish_year must be an integer")
    .min(1500, "first_publish_year must be at least 1500")
    .max(2100, "first_publish_year must be at most 2100")
    .optional(),
  primary_edition_id: z.string().uuid("primary_edition_id must be a valid UUID").optional(),
});

/**
 * Type inference from the Zod schema.
 * Represents validated request body for creating a manual work.
 */
export type CreateWorkValidated = z.infer<typeof CreateWorkSchema>;
