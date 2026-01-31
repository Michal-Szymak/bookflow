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

  // Redirect logged-in users away from auth pages
  if (user && ["/login", "/register", "/forgot-password", "/reset-password"].includes(url.pathname)) {
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
