import { z } from "zod";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISBN13_REGEX = /^\d{13}$/;

/**
 * Validation schema for POST /api/editions request body.
 * Validates manual edition creation with required work and title fields.
 */
export const CreateEditionSchema = z.object({
  work_id: z.string().uuid("work_id must be a valid UUID"),
  title: z
    .string({ required_error: "Title is required" })
    .min(1, "Title cannot be empty")
    .max(500, "Title cannot exceed 500 characters")
    .trim()
    .refine((val) => val.length > 0, "Title cannot be empty after trimming"),
  manual: z.literal(true, {
    errorMap: () => ({ message: "Manual must be true for manual editions" }),
  }),
  publish_year: z
    .number({
      invalid_type_error: "publish_year must be a number",
    })
    .int("publish_year must be an integer")
    .min(1500, "publish_year must be at least 1500")
    .max(2100, "publish_year must be at most 2100")
    .optional(),
  publish_date: z
    .string({
      invalid_type_error: "publish_date must be a string",
    })
    .regex(ISO_DATE_REGEX, "publish_date must be in YYYY-MM-DD format")
    .refine((val) => !Number.isNaN(Date.parse(val)), "publish_date must be a valid date")
    .optional(),
  publish_date_raw: z
    .string({ invalid_type_error: "publish_date_raw must be a string" })
    .trim()
    .refine((val) => val.length > 0, "publish_date_raw cannot be empty after trimming")
    .optional(),
  isbn13: z.string().regex(ISBN13_REGEX, "isbn13 must be 13 digits").optional(),
  cover_url: z.string().url("cover_url must be a valid URL").optional(),
  language: z
    .string({ invalid_type_error: "language must be a string" })
    .trim()
    .refine((val) => val.length > 0, "language cannot be empty after trimming")
    .optional(),
});

/**
 * Type inference from the Zod schema.
 * Represents validated request body for creating a manual edition.
 */
export type CreateEditionValidated = z.infer<typeof CreateEditionSchema>;
