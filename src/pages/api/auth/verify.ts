import type { APIRoute } from "astro";
import { createSupabaseServerInstance } from "src/db/supabase.client.ts";
import { logger } from "@/lib/logger";

export const prerender = false;

/**
 * GET /api/auth/verify
 *
 * Verifies a recovery token from email link and redirects to reset-password page.
 * This endpoint handles the verification flow when Supabase API is not directly accessible.
 *
 * Query Parameters:
 * - token: string (recovery token from email link)
 * - type: string (should be "recovery")
 * - redirect_to: string (URL to redirect to after verification)
 *
 * Response:
 * - Redirects to /reset-password?token=...&type=recovery on success
 * - Redirects to /forgot-password?error=... on failure
 */
export const GET: APIRoute = async ({ request, cookies, url, redirect }) => {
  try {
    const token = url.searchParams.get("token");
    const type = url.searchParams.get("type");

    // Validate required parameters
    if (!token || type !== "recovery") {
      logger.warn("GET /api/auth/verify: Missing or invalid parameters", {
        hasToken: !!token,
        type,
      });
      return redirect("/forgot-password?error=invalid_link", 302);
    }

    // Create Supabase server instance
    const supabase = createSupabaseServerInstance({
      cookies,
      headers: request.headers,
    });

    logger.info("GET /api/auth/verify: Attempting to verify token", {
      tokenPrefix: token.substring(0, 10),
      type,
      supabaseUrl: import.meta.env.SUPABASE_URL,
    });

    // For PKCE tokens (starting with "pkce_"), we need to use exchangeCodeForSession
    // For regular OTP tokens, we use verifyOtp
    let data, error;
    if (token.startsWith("pkce_")) {
      // PKCE token - use exchangeCodeForSession
      logger.info("GET /api/auth/verify: Using exchangeCodeForSession for PKCE token");
      const result = await supabase.auth.exchangeCodeForSession(token);
      data = result.data;
      error = result.error;
    } else {
      // Regular OTP token - use verifyOtp
      logger.info("GET /api/auth/verify: Using verifyOtp for OTP token");
      const result = await supabase.auth.verifyOtp({
        token_hash: token,
        type: "recovery",
      });
      data = result.data;
      error = result.error;
    }

    if (error) {
      logger.warn("GET /api/auth/verify: Token verification failed", {
        error: error.message,
        errorCode: error.status,
        errorName: error.name,
        tokenPrefix: token.substring(0, 10),
      });

      // Check if error is related to connection issues
      const isConnectionError =
        error.message.includes("fetch failed") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("Connection refused") ||
        error.message.includes("network");

      if (isConnectionError) {
        logger.error("GET /api/auth/verify: Connection error to Supabase API", {
          supabaseUrl: import.meta.env.SUPABASE_URL,
          error: error.message,
        });
        return redirect("/forgot-password?error=connection", 302);
      }

      const isExpiredOrInvalid =
        error.message.includes("expired") ||
        error.message.includes("invalid") ||
        error.message.includes("Token has expired") ||
        error.message.includes("Invalid token");

      // Redirect to forgot-password with error message
      const errorParam = isExpiredOrInvalid ? "expired" : "invalid";
      return redirect(`/forgot-password?error=${errorParam}`, 302);
    }

    // Verify session was created
    if (!data.user || !data.session) {
      logger.error("GET /api/auth/verify: Session creation failed", {
        hasUser: !!data.user,
        hasSession: !!data.session,
      });
      return redirect("/forgot-password?error=session_failed", 302);
    }

    // Success - redirect to reset-password page with token
    // The token will be used by ResetPasswordForm to update the password
    logger.info("GET /api/auth/verify: Token verified successfully", {
      userId: data.user.id,
      email: data.user.email,
    });

    // Redirect to reset-password page with token
    // The form will use this token to update the password
    return redirect(`/reset-password?token=${encodeURIComponent(token)}&type=recovery`, 302);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("GET /api/auth/verify: Unexpected error", {
      error: errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    return redirect("/forgot-password?error=unexpected", 302);
  }
};
