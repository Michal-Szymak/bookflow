import { z } from "zod";

/**
 * Validation schema for POST /api/auth/forgot-password request body.
 * Validates email for password recovery.
 */
export const ForgotPasswordSchema = z.object({
  email: z.string().email("Nieprawidłowy format e-mail"),
});

/**
 * Type inference from the Zod schema.
 * Represents validated request body for password recovery.
 */
export type ForgotPasswordValidated = z.infer<typeof ForgotPasswordSchema>;
