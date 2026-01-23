/**
 * OpenLibrary Service
 *
 * Handles communication with OpenLibrary API for author search and fetching.
 * Implements timeout handling, error management, and response validation.
 */

import { logger } from "@/lib/logger";

/**
 * Represents an author result from OpenLibrary API.
 * openlibrary_id is always in short format (e.g., "OL23919A").
 */
export interface OpenLibraryAuthor {
  openlibrary_id: string; // e.g., "OL23919A" (short format only)
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
 * Raw response structure from OpenLibrary author detail API.
 */
interface OpenLibraryAuthorResponse {
  key?: string; // e.g., "/authors/OL23919A"
  name?: string;
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
   * Fetches a single author from OpenLibrary by OpenLibrary ID.
   * Accepts only short format (e.g., "OL23919A"), not long format (e.g., "/authors/OL23919A").
   * The API returns full key format, which is normalized to short format in the response.
   *
   * @param openlibrary_id - OpenLibrary ID in short format (e.g., "OL23919A")
   * @returns Author with OpenLibrary ID in short format and name
   * @throws Error if author not found (404), API unavailable, or invalid response
   */
  async fetchAuthorByOpenLibraryId(openlibrary_id: string): Promise<OpenLibraryAuthor> {
    // openlibrary_id should already be in short format (validated by schema)
    // Use it directly in the API URL
    const authorUrl = `${this.baseUrl}/authors/${openlibrary_id}.json`;

    this.logger.debug("Fetching author by OpenLibrary ID", {
      openlibrary_id,
      url: authorUrl,
    });

    try {
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(authorUrl, {
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

      if (response.status === 404) {
        throw new Error(`Author with openlibrary_id '${openlibrary_id}' not found in OpenLibrary`);
      }

      if (!response.ok) {
        throw new Error(`OpenLibrary API returned status ${response.status}`);
      }

      const data: unknown = await response.json();
      this.logger.debug("Raw response data", JSON.stringify(data, null, 2));
      return this.parseAuthorDetailResponse(data);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("OpenLibrary API request timed out");
        }
        // Re-throw "not found" errors as-is
        if (error.message.includes("not found")) {
          throw error;
        }
        throw new Error(`Failed to fetch from OpenLibrary: ${error.message}`);
      }
      throw new Error("Unknown error occurred while fetching from OpenLibrary");
    }
  }

  /**
   * Validates and transforms OpenLibrary author detail API response to internal format.
   * Extracts short format ID from the full key returned by OpenLibrary API.
   * OpenLibrary API returns key in format "/authors/OL23919A", which is normalized to "OL23919A".
   *
   * @param data - Raw response data from OpenLibrary
   * @returns Validated author object with short format openlibrary_id
   * @throws Error if response structure is invalid or missing required fields
   */
  private parseAuthorDetailResponse(data: unknown): OpenLibraryAuthor {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format from OpenLibrary");
    }

    const response = data as OpenLibraryAuthorResponse;

    // Validate required fields
    if (!response.key) {
      throw new Error("OpenLibrary response missing required field 'key'");
    }

    if (!response.name) {
      throw new Error("OpenLibrary response missing required field 'name'");
    }

    // Extract short format ID from full key (e.g., "/authors/OL23919A" -> "OL23919A")
    const shortId = this.extractShortIdFromKey(response.key);

    return {
      openlibrary_id: shortId,
      name: response.name.trim(),
    };
  }

  /**
   * Extracts short format OpenLibrary ID from full key format.
   * Examples:
   * - "/authors/OL23919A" -> "OL23919A"
   * - "OL23919A" -> "OL23919A" (already short format)
   *
   * @param key - Full key from OpenLibrary API (e.g., "/authors/OL23919A") or short format
   * @returns Short format OpenLibrary ID
   */
  private extractShortIdFromKey(key: string): string {
    // Remove /authors/ prefix if present
    if (key.startsWith("/authors/")) {
      return key.slice("/authors/".length);
    }
    // Remove leading slash if present
    if (key.startsWith("/")) {
      return key.slice(1);
    }
    return key;
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
      const key = doc.key;
      const name = doc.name;

      if (!key || !name) {
        // Skip entries without required fields
        continue;
      }

      // Extract short format ID from full key (e.g., "/authors/OL23919A" -> "OL23919A")
      const shortId = this.extractShortIdFromKey(key);

      authors.push({
        openlibrary_id: shortId,
        name: name.trim(),
      });
    }

    return authors;
  }
}
