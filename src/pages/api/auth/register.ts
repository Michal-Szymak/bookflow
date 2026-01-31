import type { APIRoute } from "astro";
import { createSupabaseServerInstance } from "src/db/supabase.client.ts";
import { RegisterSchema } from "@/lib/validation/auth/register.schema";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * POST /api/auth/register
 *
 * Registers a new user with email and password.
 * Supabase will send a confirmation email to the user.
 * Session cookies are set automatically via @supabase/ssr if email confirmation is disabled.
 *
 * Request Body:
 * - email: string (valid email format)
 * - password: string (minimum 6 characters)
 *
 * Response (200):
 * {
 *   user: {
 *     id: string;
 *     email: string;
 *   },
 *   requiresEmailConfirmation: boolean
 * }
 *
 * Errors:
 * - 400: Validation error or invalid input
 * - 409: User already exists
 * - 500: Internal server error
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Step 1: Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn("POST /api/auth/register: Invalid JSON in request body", { error });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: "Invalid request body format",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: Validate input with Zod schema
    const validation = RegisterSchema.safeParse(body);
    if (!validation.success) {
      logger.warn("POST /api/auth/register: Validation failed", {
        errorCount: validation.error.errors.length,
        firstError: validation.error.errors[0]?.message,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: validation.error.errors[0]?.message || "Invalid input",
          details: validation.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { email, password } = validation.data;

    // Step 3: Create Supabase server instance with cookie management
    const supabase = createSupabaseServerInstance({
      cookies,
      headers: request.headers,
    });

    // Step 4: Attempt registration with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    // Step 5: Handle registration errors
    if (error) {
      // Map Supabase auth errors to appropriate HTTP status codes
      const errorCode = error.status || 400;
      const isUserExists =
        error.message.includes("User already registered") ||
        error.message.includes("already registered") ||
        error.message.includes("already exists");

      logger.warn("POST /api/auth/register: Registration failed", {
        email,
        error: error.message,
        errorCode,
        isUserExists,
      });

      // Return 409 for user already exists, 400 for other errors
      return new Response(
        JSON.stringify({
          error: isUserExists ? "Conflict" : "Bad Request",
          message: isUserExists ? "Konto z tym e-mailem już istnieje" : error.message,
        }),
        {
          status: isUserExists ? 409 : errorCode,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 6: Verify user was created
    if (!data.user) {
      logger.error("POST /api/auth/register: User creation failed", {
        email,
        hasUser: !!data.user,
      });
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: "Failed to create user",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 7: Check if email confirmation is required
    // Supabase returns session only if email confirmation is disabled
    // If session is null, user needs to confirm email
    const requiresEmailConfirmation = !data.session;

    // Step 8: Success - log registration
    logger.info("POST /api/auth/register: Registration successful", {
      userId: data.user.id,
      email: data.user.email,
      requiresEmailConfirmation,
    });

    return new Response(
      JSON.stringify({
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        requiresEmailConfirmation,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Step 9: Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("POST /api/auth/register: Unexpected error", {
      error: errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "Wystąpił błąd. Spróbuj ponownie później.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
