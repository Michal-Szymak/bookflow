/**
 * OpenLibrary Service
 *
 * Handles communication with OpenLibrary API for author search.
 * Implements timeout handling, error management, and response validation.
 */

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

    console.log("[OpenLibraryService] Searching authors:", {
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

      console.log("[OpenLibraryService] Response status:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        throw new Error(`OpenLibrary API returned status ${response.status}`);
      }

      const data: unknown = await response.json();
      console.log("[OpenLibraryService] Raw response data:", JSON.stringify(data, null, 2));
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
    console.log("[OpenLibraryService] Parsing response, data type:", typeof data);

    if (!data || typeof data !== "object") {
      console.error("[OpenLibraryService] Invalid response format:", data);
      throw new Error("Invalid response format from OpenLibrary");
    }

    const response = data as OpenLibrarySearchResponse;

    console.log("[OpenLibraryService] Response structure:", {
      hasDocs: Array.isArray(response.docs),
      docsLength: Array.isArray(response.docs) ? response.docs.length : 0,
      numFound: response.numFound,
    });

    if (!Array.isArray(response.docs)) {
      console.error("[OpenLibraryService] Missing docs array, response:", JSON.stringify(response, null, 2));
      throw new Error("OpenLibrary response missing docs array");
    }

    const authors: OpenLibraryAuthor[] = [];
    let skippedCount = 0;
    const skippedReasons: { missingFields: number; invalidId: number } = {
      missingFields: 0,
      invalidId: 0,
    };

    console.log("[OpenLibraryService] Processing", response.docs.length, "documents");

    for (let i = 0; i < response.docs.length; i++) {
      const doc = response.docs[i];
      // Extract OpenLibrary ID from key (e.g., "/authors/OL23919A" -> "OL23919A")
      const key = doc.key;
      const name = doc.name;

      console.log(`[OpenLibraryService] Doc ${i + 1}/${response.docs.length}:`, {
        key,
        name,
        fullDoc: JSON.stringify(doc),
      });

      if (!key || !name) {
        // Skip entries without required fields
        skippedCount++;
        skippedReasons.missingFields++;
        console.warn(`[OpenLibraryService] Skipping doc ${i + 1}: missing key or name`, { key, name });
        continue;
      }

      // const openlibraryId = this.extractAuthorId(key);
      // if (!openlibraryId) {
      //   // Skip if we can't extract a valid ID
      //   skippedCount++;
      //   skippedReasons.invalidId++;
      //   console.warn(`[OpenLibraryService] Skipping doc ${i + 1}: invalid ID format`, {
      //     key,
      //     extractedId: openlibraryId,
      //   });
      //   continue;
      // }

      authors.push({
        openlibrary_id: key,
        name: name.trim(),
      });
      console.log(`[OpenLibraryService] Added author ${i + 1}:`, {
        openlibrary_id: key,
        name: name.trim(),
      });
    }

    console.log("[OpenLibraryService] Parsing complete:", {
      totalDocs: response.docs.length,
      validAuthors: authors.length,
      skipped: skippedCount,
      skipReasons: skippedReasons,
    });

    return authors;
  }

  /**
   * Extracts author ID from OpenLibrary key.
   *
   * @param key - OpenLibrary key (e.g., "/authors/OL23919A")
   * @returns Author ID (e.g., "OL23919A") or null if invalid
   */
  private extractAuthorId(key: string): string | null {
    const match = key.match(/\/authors\/(OL\d+[A-Z])/);
    return match ? match[1] : null;
  }
}
