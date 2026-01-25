import { z } from "zod";

/**
 * Validation schema for POST /api/user/authors request body.
 * Validates author attachment command with required author_id (UUID).
 */
export const AttachUserAuthorCommandSchema = z.object({
  author_id: z.string().uuid("author_id must be a valid UUID"),
});

/**
 * Type inference from the Zod schema.
 * Represents validated request body for attaching an author to user's profile.
 */
export type AttachUserAuthorCommandValidated = z.infer<typeof AttachUserAuthorCommandSchema>;
