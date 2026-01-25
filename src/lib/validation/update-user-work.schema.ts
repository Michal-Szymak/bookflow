import { z } from "zod";

/**
 * Validation schema for PATCH /api/user/works/{workId} request body.
 * Validates that at least one of status or available_in_legimi is provided.
 * Both fields are optional, but at least one must be present.
 */
export const UpdateUserWorkCommandSchema = z
  .object({
    status: z.enum(["to_read", "in_progress", "read", "hidden"]).optional(),
    available_in_legimi: z.boolean().nullable().optional(),
  })
  .strict()
  .refine((data) => data.status !== undefined || data.available_in_legimi !== undefined, {
    message: "At least one of 'status' or 'available_in_legimi' must be provided",
    path: ["status", "available_in_legimi"],
  });

/**
 * Type inference from the Zod schema.
 * Represents validated request body for updating a user work.
 */
export type UpdateUserWorkCommandValidated = z.infer<typeof UpdateUserWorkCommandSchema>;
