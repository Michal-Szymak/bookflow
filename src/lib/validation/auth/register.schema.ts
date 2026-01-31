import { z } from "zod";

/**
 * Validation schema for POST /api/auth/register request body.
 * Validates email and password for user registration.
 */
export const RegisterSchema = z.object({
  email: z.string().email("Nieprawidłowy format e-mail"),
  password: z.string().min(6, "Hasło musi mieć minimum 6 znaków"),
});

/**
 * Type inference from the Zod schema.
 * Represents validated request body for user registration.
 */
export type RegisterValidated = z.infer<typeof RegisterSchema>;
