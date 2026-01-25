import { z } from "zod";

/**
 * Maximum number of work IDs allowed in a single bulk attach request.
 * Limits batch size to prevent system overload.
 */
const MAX_BATCH_SIZE = 100;

/**
 * Validation schema for POST /api/user/works/bulk request body.
 * Validates bulk work attachment command with required work_ids array and optional status.
 * Automatically deduplicates work_ids before validation.
 */
export const BulkAttachUserWorksCommandSchema = z
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
  })
  .strict();

/**
 * Type inference from the Zod schema.
 * Represents validated request body for bulk attaching works to user's profile.
 */
export type BulkAttachUserWorksCommandValidated = z.infer<typeof BulkAttachUserWorksCommandSchema>;
