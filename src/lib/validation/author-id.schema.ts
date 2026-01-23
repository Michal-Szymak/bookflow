import { z } from "zod";

/**
 * Validation schema for authorId path parameter.
 * Validates that authorId is a valid UUID v4 format.
 */
export const AuthorIdParamSchema = z.object({
  authorId: z.string().uuid("authorId must be a valid UUID"),
});

/**
 * Type inference from the Zod schema.
 * Represents validated path parameter for authorId.
 */
export type AuthorIdParamValidated = z.infer<typeof AuthorIdParamSchema>;
