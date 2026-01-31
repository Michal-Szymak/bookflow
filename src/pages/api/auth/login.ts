import type { APIRoute } from "astro";
import { createSupabaseServerInstance } from "src/db/supabase.client.ts";
import { LoginSchema } from "@/lib/validation/auth/login.schema";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email and password.
 * Sets session cookies automatically via @supabase/ssr.
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
 *   }
 * }
 *
 * Errors:
 * - 400: Validation error or invalid credentials
 * - 401: Invalid email or password
 * - 500: Internal server error
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Step 1: Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn("POST /api/auth/login: Invalid JSON in request body", { error });
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
    const validation = LoginSchema.safeParse(body);
    if (!validation.success) {
      logger.warn("POST /api/auth/login: Validation failed", {
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

    // Step 4: Attempt login with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Step 5: Handle authentication errors
    if (error) {
      // Map Supabase auth errors to appropriate HTTP status codes
      const errorCode = error.status || 400;
      const isInvalidCredentials =
        error.message.includes("Invalid login credentials") ||
        error.message.includes("invalid_credentials") ||
        error.message.includes("Email not confirmed");

      logger.warn("POST /api/auth/login: Authentication failed", {
        email,
        error: error.message,
        errorCode,
        isInvalidCredentials,
      });

      // Return 401 for invalid credentials, 400 for other errors
      return new Response(
        JSON.stringify({
          error: isInvalidCredentials ? "Unauthorized" : "Bad Request",
          message: isInvalidCredentials ? "Nieprawidłowy e-mail lub hasło" : error.message,
        }),
        {
          status: isInvalidCredentials ? 401 : errorCode,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 6: Verify session was created
    if (!data.user || !data.session) {
      logger.error("POST /api/auth/login: Session creation failed", {
        email,
        hasUser: !!data.user,
        hasSession: !!data.session,
      });
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: "Failed to create session",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 7: Success - cookies are automatically set by @supabase/ssr
    logger.info("POST /api/auth/login: Login successful", {
      userId: data.user.id,
      email: data.user.email,
    });

    return new Response(
      JSON.stringify({
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Step 8: Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("POST /api/auth/login: Unexpected error", {
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
