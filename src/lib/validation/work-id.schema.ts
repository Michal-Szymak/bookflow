import { z } from "zod";

/**
 * Validation schema for workId path parameter.
 * Validates that workId is a valid UUID v4 format.
 */
export const WorkIdParamSchema = z.object({
  workId: z.string().uuid("workId must be a valid UUID"),
});

/**
 * Type inference from the Zod schema.
 * Represents validated path parameter for workId.
 */
export type WorkIdParamValidated = z.infer<typeof WorkIdParamSchema>;
