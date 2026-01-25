import { z } from "zod";

/**
 * Validation schema for GET /api/user/works query parameters.
 * Validates pagination, filtering, sorting, and search for user's works list.
 */
const PageSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return undefined;
      }
      return Number(trimmed);
    }
    return value;
  },
  z
    .number()
    .int("Page must be an integer")
    .min(1, "Page must be at least 1")
    .refine((val) => Number.isFinite(val), "Page must be a valid number")
);

/**
 * Schema for status array - handles both single value and array from URL params.
 * Status can be passed multiple times in URL as ?status=to_read&status=in_progress
 */
const StatusSchema = z.preprocess(
  (value) => {
    // If it's already an array, return as is
    if (Array.isArray(value)) {
      return value;
    }
    // If it's a string, wrap in array
    if (typeof value === "string") {
      return [value];
    }
    // If undefined, return undefined
    return value;
  },
  z
    .array(z.enum(["to_read", "in_progress", "read", "hidden"]), {
      invalid_type_error: "status must be an array of valid status values",
    })
    .min(1, "status array must contain at least 1 element")
    .optional()
);

/**
 * Schema for available filter - handles boolean or null.
 * In URL, can be "true", "false", or "null" (as string).
 */
const AvailableSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
      if (normalized === "null") {
        return null;
      }
    }
    // If it's already boolean or null, return as is
    if (typeof value === "boolean" || value === null) {
      return value;
    }
    return undefined;
  },
  z
    .union([z.boolean(), z.null()], {
      invalid_type_error: "available must be true, false, or null",
    })
    .optional()
);

const SearchSchema = z
  .string()
  .max(200, "Search query cannot exceed 200 characters")
  .trim()
  .refine((val) => val.length > 0, "Search query cannot be empty after trimming")
  .optional();

const AuthorIdSchema = z.string().uuid("author_id must be a valid UUID").optional();

export const UserWorksListQuerySchema = z.object({
  page: PageSchema.optional(),
  status: StatusSchema,
  available: AvailableSchema,
  sort: z.enum(["published_desc", "title_asc"]).optional(),
  author_id: AuthorIdSchema,
  search: SearchSchema,
});

/**
 * Type inference from the Zod schema.
 * Represents validated query parameters for user works list.
 */
export type UserWorksListQueryValidated = z.infer<typeof UserWorksListQuerySchema>;
