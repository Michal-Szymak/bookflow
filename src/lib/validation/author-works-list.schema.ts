import { z } from "zod";

/**
 * Validation schema for GET /api/authors/{authorId}/works query parameters.
 * Validates pagination, sort order, and optional forceRefresh flag.
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

const ForceRefreshSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
    }
    return value;
  },
  z.boolean({ invalid_type_error: "forceRefresh must be a boolean" })
);

export const AuthorWorksListQuerySchema = z.object({
  page: PageSchema.optional(),
  sort: z.enum(["published_desc", "title_asc"]).optional(),
  forceRefresh: ForceRefreshSchema.optional(),
});

/**
 * Type inference from the Zod schema.
 * Represents validated query parameters for author works list.
 */
export type AuthorWorksListQueryValidated = z.infer<typeof AuthorWorksListQuerySchema>;
