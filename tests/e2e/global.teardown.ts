import { test as teardown } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/db/database.types.ts";
import { logger } from "../../src/lib/logger.ts";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.test file to get Supabase credentials
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

// Create a logger with context for database cleanup
const cleanupLogger = logger.fork("Database Cleanup");

teardown("cleanup database", async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_KEY must be set in .env.test");
  }

  cleanupLogger.info("Cleaning up test database...");

  // Create Supabase client for database operations
  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Delete data from tables in order to respect foreign key constraints
    // Tables to clean (excluding 'users' and 'profiles'):
    // 1. author_works (junction table)
    // 2. user_works (has FK to works)
    // 3. user_authors (has FK to authors)
    // 4. editions (has FK to works)
    // 5. works (referenced by editions and user_works)
    // 6. authors (referenced by author_works and user_authors)

    // Delete author_works (junction table)
    // Use gte on created_at to match all rows (all timestamps are after 1970)
    const { error: authorWorksError } = await supabase.from("author_works").delete().gte("created_at", "1970-01-01");
    if (authorWorksError) {
      cleanupLogger.error("Error deleting author_works", authorWorksError);
      throw authorWorksError;
    }
    cleanupLogger.info("Cleaned author_works");

    // Delete user_works
    const { error: userWorksError } = await supabase.from("user_works").delete().gte("created_at", "1970-01-01");
    if (userWorksError) {
      cleanupLogger.error("Error deleting user_works", userWorksError);
      throw userWorksError;
    }
    cleanupLogger.info("Cleaned user_works");

    // Delete user_authors
    const { error: userAuthorsError } = await supabase.from("user_authors").delete().gte("created_at", "1970-01-01");
    if (userAuthorsError) {
      cleanupLogger.error("Error deleting user_authors", userAuthorsError);
      throw userAuthorsError;
    }
    cleanupLogger.info("Cleaned user_authors");

    // Delete editions
    const { error: editionsError } = await supabase.from("editions").delete().gte("created_at", "1970-01-01");
    if (editionsError) {
      cleanupLogger.error("Error deleting editions", editionsError);
      throw editionsError;
    }
    cleanupLogger.info("Cleaned editions");

    // Delete works
    const { error: worksError } = await supabase.from("works").delete().gte("created_at", "1970-01-01");
    if (worksError) {
      cleanupLogger.error("Error deleting works", worksError);
      throw worksError;
    }
    cleanupLogger.info("Cleaned works");

    // Delete authors
    const { error: authorsError } = await supabase.from("authors").delete().gte("created_at", "1970-01-01");
    if (authorsError) {
      cleanupLogger.error("Error deleting authors", authorsError);
      throw authorsError;
    }
    cleanupLogger.info("Cleaned authors");

    cleanupLogger.info("Database cleanup completed successfully");
  } catch (error) {
    cleanupLogger.error("Database cleanup failed", error);
    throw error;
  }
});
