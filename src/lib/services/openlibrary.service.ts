/**
 * OpenLibrary Service
 *
 * Handles communication with OpenLibrary API for author search.
 * Implements timeout handling, error management, and response validation.
 */

import { logger } from "@/lib/logger";

/**
 * Represents an author result from OpenLibrary API.
 */
export interface OpenLibraryAuthor {
  openlibrary_id: string; // e.g., "OL23919A"
  name: string;
}

/**
 * Raw response structure from OpenLibrary search API.
 */
interface OpenLibrarySearchResponse {
  docs?: {
    key?: string; // e.g., "/authors/OL23919A"
    name?: string;
  }[];
  numFound?: number;
}

/**
 * Service for interacting with OpenLibrary API.
 */
export class OpenLibraryService {
  private readonly baseUrl = "https://openlibrary.org";
  private readonly timeout = 10000; // 10 seconds
  private readonly logger = logger.fork("OpenLibraryService");

  /**
   * Searches for authors in OpenLibrary by name.
   *
   * @param query - Author name to search for
   * @param limit - Maximum number of results to return (1-50)
   * @returns Array of authors with OpenLibrary IDs and names
   * @throws Error if OpenLibrary API is unavailable or returns invalid data
   */
  async searchAuthors(query: string, limit: number): Promise<OpenLibraryAuthor[]> {
    const searchUrl = new URL(`${this.baseUrl}/search/authors.json`);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("limit", limit.toString());

    this.logger.debug("Searching authors", {
      query,
      limit,
      url: searchUrl.toString(),
    });

    try {
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(searchUrl.toString(), {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      this.logger.debug("Response status", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        throw new Error(`OpenLibrary API returned status ${response.status}`);
      }

      const data: unknown = await response.json();
      this.logger.debug("Raw response data", JSON.stringify(data, null, 2));
      return this.parseAuthorResponse(data);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("OpenLibrary API request timed out");
        }
        throw new Error(`Failed to fetch from OpenLibrary: ${error.message}`);
      }
      throw new Error("Unknown error occurred while fetching from OpenLibrary");
    }
  }

  /**
   * Validates and transforms OpenLibrary API response to internal format.
   *
   * @param data - Raw response data from OpenLibrary
   * @returns Array of validated author objects
   * @throws Error if response structure is invalid
   */
  private parseAuthorResponse(data: unknown): OpenLibraryAuthor[] {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format from OpenLibrary");
    }

    const response = data as OpenLibrarySearchResponse;

    if (!Array.isArray(response.docs)) {
      throw new Error("OpenLibrary response missing docs array");
    }

    const authors: OpenLibraryAuthor[] = [];

    for (const doc of response.docs) {
      // Extract OpenLibrary ID from key (e.g., "/authors/OL23919A" -> "OL23919A")
      const key = doc.key;
      const name = doc.name;

      if (!key || !name) {
        // Skip entries without required fields
        continue;
      }

      authors.push({
        openlibrary_id: key,
        name: name.trim(),
      });
    }

    return authors;
  }
}
