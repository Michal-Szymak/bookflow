import { z } from "zod";

/**
 * Maximum number of work IDs allowed in a single bulk update request.
 * Limits batch size to prevent system overload.
 */
const MAX_BATCH_SIZE = 100;

/**
 * Validation schema for POST /api/user/works/status-bulk request body.
 * Validates bulk work status update command with required work_ids array
 * and at least one of status or available_in_legimi.
 * Automatically deduplicates work_ids before validation.
 */
export const UpdateUserWorksBulkCommandSchema = z
  .object({
    work_ids: z
      .array(z.string().uuid("Each work_id must be a valid UUID"), {
        required_error: "work_ids is required",
        invalid_type_error: "work_ids must be an array",
      })
      .min(1, "work_ids must contain at least 1 element")
      .max(MAX_BATCH_SIZE, `work_ids array exceeds maximum size of ${MAX_BATCH_SIZE}`)
      .transform((arr) => {
        // Remove duplicates while preserving order
        const seen = new Set<string>();
        return arr.filter((id) => {
          if (seen.has(id)) {
            return false;
          }
          seen.add(id);
          return true;
        });
      }),
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
 * Represents validated request body for bulk updating user works.
 */
export type UpdateUserWorksBulkCommandValidated = z.infer<typeof UpdateUserWorksBulkCommandSchema>;
