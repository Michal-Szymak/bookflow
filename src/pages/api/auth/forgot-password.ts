import type { APIRoute } from "astro";
import { createSupabaseServerInstance } from "src/db/supabase.client.ts";
import { ForgotPasswordSchema } from "@/lib/validation/auth/forgot-password.schema";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * POST /api/auth/forgot-password
 *
 * Initiates password recovery process by sending a reset email.
 * Always returns success for security reasons (doesn't reveal if email exists).
 *
 * Request Body:
 * - email: string (valid email format)
 *
 * Response (200):
 * {
 *   message: "Jeśli konto z tym e-mailem istnieje, otrzymasz link do resetu hasła"
 * }
 *
 * Errors:
 * - 400: Validation error or invalid email format
 * - 500: Internal server error
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Step 1: Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn("POST /api/auth/forgot-password: Invalid JSON in request body", { error });
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
    const validation = ForgotPasswordSchema.safeParse(body);
    if (!validation.success) {
      logger.warn("POST /api/auth/forgot-password: Validation failed", {
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

    const { email } = validation.data;

    // Step 3: Create Supabase server instance with cookie management
    const supabase = createSupabaseServerInstance({
      cookies,
      headers: request.headers,
    });

    // Step 4: Get the origin from request to construct redirect URL
    // Supabase will redirect to this URL with code parameter after verification
    // We redirect directly to reset-password page which will handle the code
    const origin = new URL(request.url).origin;
    const redirectTo = `${origin}/reset-password`;

    logger.info("POST /api/auth/forgot-password: Attempting to send password reset email", {
      email,
      redirectTo,
      origin,
    });

    // Step 5: Attempt to send password reset email
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    // Step 6: Always return success for security reasons
    // This prevents email enumeration attacks by not revealing if the email exists
    if (error) {
      // Log the error but don't expose it to the client
      logger.warn("POST /api/auth/forgot-password: Password reset email failed", {
        email,
        redirectTo,
        error: error.message,
        errorCode: error.status,
        errorName: error.name,
      });
      // Still return success to prevent email enumeration
    } else {
      logger.info("POST /api/auth/forgot-password: Password reset email sent successfully", {
        email,
        redirectTo,
        data: data || "no data returned",
      });
    }

    // Step 7: Always return success message (security best practice)
    return new Response(
      JSON.stringify({
        message: "Jeśli konto z tym e-mailem istnieje, otrzymasz link do resetu hasła",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Step 8: Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("POST /api/auth/forgot-password: Unexpected error", {
      error: errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    // Even on unexpected errors, return success to prevent information leakage
    return new Response(
      JSON.stringify({
        message: "Jeśli konto z tym e-mailem istnieje, otrzymasz link do resetu hasła",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
