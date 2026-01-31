import { createClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";

import type { Database } from "../db/database.types.ts";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

// Client-side Supabase client (for React components)
export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

export type SupabaseClient = typeof supabaseClient;

// Server-side cookie options with conditional secure flag
export const cookieOptions: CookieOptionsWithName = {
  path: "/",
  secure: import.meta.env.PROD, // true in production, false in dev
  httpOnly: true,
  sameSite: "lax",
};

/**
 * Parses cookie header string into array of cookie objects.
 * Handles cookies in format "name=value; name2=value2"
 */
function parseCookieHeader(cookieHeader: string): { name: string; value: string }[] {
  if (!cookieHeader) return [];
  return cookieHeader.split(";").map((cookie) => {
    const trimmed = cookie.trim();
    const [name, ...rest] = trimmed.split("=");
    return { name, value: rest.join("=") };
  });
}

/**
 * Creates a Supabase server client instance with cookie-based session management.
 * Uses @supabase/ssr for proper SSR support with Astro.
 *
 * @param context - Object containing headers and cookies from Astro context
 * @returns Supabase client instance configured for server-side use
 */
export const createSupabaseServerInstance = (context: { headers: Headers; cookies: AstroCookies }) => {
  const supabase = createServerClient<Database>(import.meta.env.SUPABASE_URL, import.meta.env.SUPABASE_KEY, {
    cookieOptions,
    cookies: {
      getAll() {
        return parseCookieHeader(context.headers.get("Cookie") ?? "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => context.cookies.set(name, value, options));
      },
    },
  });

  return supabase;
};
