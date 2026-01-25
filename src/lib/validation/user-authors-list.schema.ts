import { z } from "zod";

/**
 * Validation schema for GET /api/user/authors query parameters.
 * Validates pagination, search, and sort order for user's authors list.
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

const SearchSchema = z
  .string()
  .max(200, "Search query cannot exceed 200 characters")
  .trim()
  .refine((val) => val.length > 0, "Search query cannot be empty after trimming")
  .optional();

export const UserAuthorsListQuerySchema = z.object({
  page: PageSchema.optional(),
  search: SearchSchema,
  sort: z.enum(["name_asc", "created_desc"]).optional(),
});

/**
 * Type inference from the Zod schema.
 * Represents validated query parameters for user authors list.
 */
export type UserAuthorsListQueryValidated = z.infer<typeof UserAuthorsListQuerySchema>;

