import { z } from "zod";

/**
 * Validation schema for POST /api/auth/reset-password request body.
 * Validates token and new password for password reset.
 */
export const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Token jest wymagany"),
  password: z.string().min(6, "Hasło musi mieć minimum 6 znaków"),
});

/**
 * Type inference from the Zod schema.
 * Represents validated request body for password reset.
 */
export type ResetPasswordValidated = z.infer<typeof ResetPasswordSchema>;
