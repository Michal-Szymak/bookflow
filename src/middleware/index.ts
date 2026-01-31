import { defineMiddleware } from "astro:middleware";
import { createSupabaseServerInstance } from "../db/supabase.client.ts";

// Public paths - Auth API endpoints & Server-Rendered Astro Pages
const PUBLIC_PATHS = [
  // Server-Rendered Astro Pages
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  // Auth API endpoints
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify",
];

export const onRequest = defineMiddleware(async ({ locals, cookies, url, request, redirect }, next) => {
  // Create Supabase server instance with cookie-based session management
  const supabase = createSupabaseServerInstance({
    cookies,
    headers: request.headers,
  });

  // Store supabase client in locals for use in API routes and pages
  locals.supabase = supabase;

  // IMPORTANT: Always get user session first before any other operations
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow access to reset-password page if code or token is present (password reset flow)
  const hasResetCode = url.searchParams.has("code") || url.searchParams.has("token");
  const isResetPasswordPage = url.pathname === "/reset-password";

  // Redirect logged-in users away from auth pages (except reset-password with code/token)
  if (user && ["/login", "/register", "/forgot-password"].includes(url.pathname)) {
    return redirect("/app/authors", 302);
  }

  // Allow reset-password page even if user is logged in (for password reset flow)
  // But redirect if no code/token is present and user is already logged in
  if (user && isResetPasswordPage && !hasResetCode) {
    return redirect("/app/authors", 302);
  }

  // Store user in locals if authenticated
  if (user) {
    locals.user = {
      email: user.email,
      id: user.id,
    };
  } else if (!PUBLIC_PATHS.includes(url.pathname)) {
    // Redirect to login for protected routes
    const redirectUrl = `/login?redirect_to=${encodeURIComponent(url.pathname)}`;
    return redirect(redirectUrl, 302);
  }

  return next();
});
