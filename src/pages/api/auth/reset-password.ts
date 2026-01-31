import type { APIRoute } from "astro";
import { createSupabaseServerInstance } from "src/db/supabase.client.ts";
import { ResetPasswordSchema } from "@/lib/validation/auth/reset-password.schema";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * POST /api/auth/reset-password
 *
 * Resets user password using a recovery token.
 * Verifies the token, creates a session, and updates the password.
 *
 * Request Body:
 * - token: string (recovery token from email link)
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
 * - 400: Validation error or invalid token
 * - 401: Token expired or invalid
 * - 500: Internal server error
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Step 1: Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn("POST /api/auth/reset-password: Invalid JSON in request body", { error });
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
    const validation = ResetPasswordSchema.safeParse(body);
    if (!validation.success) {
      logger.warn("POST /api/auth/reset-password: Validation failed", {
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

    const { token, password } = validation.data;

    // Step 3: Create Supabase server instance with cookie management
    const supabase = createSupabaseServerInstance({
      cookies,
      headers: request.headers,
    });

    // Step 4: Verify the recovery token/code and create a session
    // For PKCE codes (starting with "pkce_" or regular codes), we use exchangeCodeForSession
    // For regular OTP tokens, we use verifyOtp with token_hash
    let verifyData, verifyError;
    if (token.startsWith("pkce_") || token.length > 20) {
      // PKCE code or regular code - use exchangeCodeForSession
      logger.info("POST /api/auth/reset-password: Using exchangeCodeForSession for code");
      const result = await supabase.auth.exchangeCodeForSession(token);
      verifyData = result.data;
      verifyError = result.error;
    } else {
      // Regular OTP token - use verifyOtp
      logger.info("POST /api/auth/reset-password: Using verifyOtp for token");
      const result = await supabase.auth.verifyOtp({
        token_hash: token,
        type: "recovery",
      });
      verifyData = result.data;
      verifyError = result.error;
    }

    // Step 5: Handle token verification errors
    if (verifyError) {
      const isExpiredOrInvalid =
        verifyError.message.includes("expired") ||
        verifyError.message.includes("invalid") ||
        verifyError.message.includes("Token has expired") ||
        verifyError.message.includes("Invalid token");

      logger.warn("POST /api/auth/reset-password: Token verification failed", {
        error: verifyError.message,
        errorCode: verifyError.status,
        isExpiredOrInvalid,
      });

      // Return 401 for expired/invalid tokens, 400 for other errors
      return new Response(
        JSON.stringify({
          error: isExpiredOrInvalid ? "Unauthorized" : "Bad Request",
          message: isExpiredOrInvalid
            ? "Token wygasł lub jest nieprawidłowy. Wyślij nowy link do resetu hasła."
            : verifyError.message,
        }),
        {
          status: isExpiredOrInvalid ? 401 : verifyError.status || 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 6: Verify session was created after token verification
    if (!verifyData.user || !verifyData.session) {
      logger.error("POST /api/auth/reset-password: Session creation failed after token verification", {
        hasUser: !!verifyData.user,
        hasSession: !!verifyData.session,
      });
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: "Failed to create session from token",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 7: Update user password
    // At this point, we have a valid session from the verified token
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    // Step 8: Handle password update errors
    if (updateError) {
      logger.error("POST /api/auth/reset-password: Password update failed", {
        userId: verifyData.user.id,
        error: updateError.message,
        errorCode: updateError.status,
      });

      return new Response(
        JSON.stringify({
          error: "Bad Request",
          message: updateError.message || "Failed to update password",
        }),
        {
          status: updateError.status || 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 9: Verify password was updated successfully
    if (!updateData.user) {
      logger.error("POST /api/auth/reset-password: Password update returned no user", {
        userId: verifyData.user.id,
      });
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: "Failed to update password",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 10: Success - cookies are automatically set by @supabase/ssr
    logger.info("POST /api/auth/reset-password: Password reset successful", {
      userId: updateData.user.id,
      email: updateData.user.email,
    });

    return new Response(
      JSON.stringify({
        user: {
          id: updateData.user.id,
          email: updateData.user.email,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Step 11: Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("POST /api/auth/reset-password: Unexpected error", {
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
