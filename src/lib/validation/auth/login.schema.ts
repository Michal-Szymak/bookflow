import { z } from "zod";

/**
 * Validation schema for POST /api/auth/login request body.
 * Validates email and password for user login.
 */
export const LoginSchema = z.object({
  email: z.string().email("Nieprawidłowy format e-mail"),
  password: z.string().min(6, "Hasło musi mieć minimum 6 znaków"),
});

/**
 * Type inference from the Zod schema.
 * Represents validated request body for user login.
 */
export type LoginValidated = z.infer<typeof LoginSchema>;
