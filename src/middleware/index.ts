// import { defineMiddleware } from "astro:middleware";

// import { supabaseClient } from "../db/supabase.client.ts";

// export const onRequest = defineMiddleware((context, next) => {
//   context.locals.supabase = supabaseClient;
//   return next();
// });

import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types.ts";
import type { SupabaseClient } from "../db/supabase.client.ts";

export const onRequest = defineMiddleware(async (context, next) => {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

  // Extract access token from Authorization header
  const authHeader = context.request.headers.get("Authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

  // Create Supabase client with access token in headers if provided
  const supabase: SupabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    },
  });

  context.locals.supabase = supabase;
  return next();
});
