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
 * Represents a work result from OpenLibrary API.
 * openlibrary_id is always in short format (e.g., "OL123W").
 */
export interface OpenLibraryWork {
  openlibrary_id: string; // e.g., "OL123W" (short format only)
  title: string;
  first_publish_year: number | null;
  primary_edition_openlibrary_id: string | null;
}

/**
 * Represents an edition result from OpenLibrary API.
 * openlibrary_id is always in short format (e.g., "OL123M").
 */
export interface OpenLibraryEdition {
  openlibrary_id: string; // e.g., "OL123M" (short format only)
  title: string;
  publish_year: number | null;
  publish_date: string | null;
  publish_date_raw: string | null;
  isbn13: string | null;
  cover_url: string | null;
  language: string | null;
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
 * Raw response structure from OpenLibrary work detail API.
 */
interface OpenLibraryWorkResponse {
  key?: string; // e.g., "/works/OL123W"
  title?: string;
  first_publish_year?: number;
  first_publish_date?: string;
  primary_edition?: string;
  cover_edition?: string;
  cover_edition_key?: string;
}

/**
 * Raw response structure for a work entry in author works list API.
 */
interface OpenLibraryWorkEntry {
  key?: string; // e.g., "/works/OL123W"
  title?: string;
  first_publish_year?: number;
  first_publish_date?: string;
  primary_edition?: string;
  cover_edition?: string;
  cover_edition_key?: string;
}

/**
 * Raw response structure from OpenLibrary edition detail API.
 */
interface OpenLibraryEditionResponse {
  key?: string; // e.g., "/books/OL123M"
  title?: string;
  publish_date?: string;
  isbn_13?: string[];
  covers?: number[];
  languages?: { key?: string }[];
}

/**
 * Raw response structure from OpenLibrary editions list API.
 */
interface OpenLibraryEditionsResponse {
  entries?: OpenLibraryEditionEntry[];
}

interface OpenLibraryEditionEntry {
  key?: string; // e.g., "/books/OL123M"
  title?: string;
  publish_date?: string;
  isbn_13?: string[];
  covers?: number[];
  languages?: { key?: string }[];
}

/**
 * Service for interacting with OpenLibrary API.
 */
export class OpenLibraryService {
  private readonly baseUrl = "https://openlibrary.org";
  private readonly coversBaseUrl = "https://covers.openlibrary.org";
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
   * Fetches all works for an author from OpenLibrary.
   * Accepts only short format (e.g., "OL23919A"), not long format (e.g., "/authors/OL23919A").
   * The API returns full key format, which is normalized to short format in the response.
   *
   * @param openlibrary_id - OpenLibrary author ID in short format (e.g., "OL23919A")
   * @param limit - Maximum number of works to fetch (default: 1000, OpenLibrary may return fewer)
   * @returns Array of works with OpenLibrary IDs in short format
   * @throws Error if author not found (404), API unavailable, or invalid response
   */
  async fetchAuthorWorks(openlibrary_id: string, limit = 1000): Promise<OpenLibraryWork[]> {
    const worksUrl = new URL(`${this.baseUrl}/authors/${openlibrary_id}/works.json`);
    worksUrl.searchParams.set("limit", limit.toString());

    this.logger.debug("Fetching author works by OpenLibrary ID", {
      openlibrary_id,
      url: worksUrl.toString(),
      limit,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(worksUrl.toString(), {
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
      return this.parseAuthorWorksResponse(data);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("OpenLibrary API request timed out");
        }
        if (error.message.includes("not found")) {
          throw error;
        }
        throw new Error(`Failed to fetch from OpenLibrary: ${error.message}`);
      }
      throw new Error("Unknown error occurred while fetching from OpenLibrary");
    }
  }

  /**
   * Fetches a single work from OpenLibrary by OpenLibrary ID.
   * Accepts only short format (e.g., "OL123W"), not long format (e.g., "/works/OL123W").
   * The API returns full key format, which is normalized to short format in the response.
   *
   * @param openlibrary_id - OpenLibrary ID in short format (e.g., "OL123W")
   * @returns Work with OpenLibrary ID in short format and minimal metadata
   * @throws Error if work not found (404), API unavailable, or invalid response
   */
  async fetchWorkByOpenLibraryId(openlibrary_id: string): Promise<OpenLibraryWork> {
    const workUrl = `${this.baseUrl}/works/${openlibrary_id}.json`;

    this.logger.debug("Fetching work by OpenLibrary ID", {
      openlibrary_id,
      url: workUrl,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(workUrl, {
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
        throw new Error(`Work with openlibrary_id '${openlibrary_id}' not found in OpenLibrary`);
      }

      if (!response.ok) {
        throw new Error(`OpenLibrary API returned status ${response.status}`);
      }

      const data: unknown = await response.json();
      this.logger.debug("Raw response data", JSON.stringify(data, null, 2));
      return this.parseWorkDetailResponse(data);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("OpenLibrary API request timed out");
        }
        if (error.message.includes("not found")) {
          throw error;
        }
        throw new Error(`Failed to fetch from OpenLibrary: ${error.message}`);
      }
      throw new Error("Unknown error occurred while fetching from OpenLibrary");
    }
  }

  /**
   * Fetches a single edition from OpenLibrary by OpenLibrary ID.
   * Accepts only short format (e.g., "OL123M"), not long format (e.g., "/books/OL123M").
   * The API returns full key format, which is normalized to short format in the response.
   *
   * @param openlibrary_id - OpenLibrary ID in short format (e.g., "OL123M")
   * @returns Edition with OpenLibrary ID in short format and minimal metadata
   * @throws Error if edition not found (404), API unavailable, or invalid response
   */
  async fetchEditionByOpenLibraryId(openlibrary_id: string): Promise<OpenLibraryEdition> {
    const editionUrl = `${this.baseUrl}/books/${openlibrary_id}.json`;

    this.logger.debug("Fetching edition by OpenLibrary ID", {
      openlibrary_id,
      url: editionUrl,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(editionUrl, {
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
        throw new Error(`Edition with openlibrary_id '${openlibrary_id}' not found in OpenLibrary`);
      }

      if (!response.ok) {
        throw new Error(`OpenLibrary API returned status ${response.status}`);
      }

      const data: unknown = await response.json();
      this.logger.debug("Raw response data", JSON.stringify(data, null, 2));
      return this.parseEditionDetailResponse(data);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("OpenLibrary API request timed out");
        }
        if (error.message.includes("not found")) {
          throw error;
        }
        throw new Error(`Failed to fetch from OpenLibrary: ${error.message}`);
      }
      throw new Error("Unknown error occurred while fetching from OpenLibrary");
    }
  }

  /**
   * Fetches editions for a work from OpenLibrary.
   * Used to select a primary edition when the work response does not provide one.
   *
   * @param openlibrary_id - OpenLibrary work ID in short format (e.g., "OL123W")
   * @param limit - Maximum number of editions to fetch (default 50)
   * @returns Array of editions with normalized OpenLibrary IDs
   * @throws Error if API unavailable or response invalid
   */
  async fetchWorkEditionsByOpenLibraryId(openlibrary_id: string, limit = 50): Promise<OpenLibraryEdition[]> {
    const editionsUrl = new URL(`${this.baseUrl}/works/${openlibrary_id}/editions.json`);
    editionsUrl.searchParams.set("limit", limit.toString());

    this.logger.debug("Fetching work editions by OpenLibrary ID", {
      openlibrary_id,
      url: editionsUrl.toString(),
      limit,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(editionsUrl.toString(), {
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
      return this.parseEditionsResponse(data);
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
   * Validates and transforms OpenLibrary author works API response to internal format.
   * OpenLibrary API returns works in an entries array with keys like "/works/OL123W".
   *
   * @param data - Raw response data from OpenLibrary
   * @returns Array of validated work objects with short format openlibrary_id
   * @throws Error if response structure is invalid
   */
  private parseAuthorWorksResponse(data: unknown): OpenLibraryWork[] {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format from OpenLibrary");
    }

    const response = data as { entries?: OpenLibraryWorkEntry[] };

    if (!Array.isArray(response.entries)) {
      // Empty array is valid (author has no works)
      return [];
    }

    const works: OpenLibraryWork[] = [];

    for (const entry of response.entries) {
      const key = entry.key;
      const title = entry.title;

      if (!key || !title) {
        continue;
      }

      const shortId = this.extractShortIdFromKey(key);
      const firstPublishYear =
        entry.first_publish_year ?? this.parseYearFromDateString(entry.first_publish_date ?? null) ?? null;
      const primaryEditionKey = entry.primary_edition ?? entry.cover_edition_key ?? entry.cover_edition ?? null;

      works.push({
        openlibrary_id: shortId,
        title: title.trim(),
        first_publish_year: firstPublishYear,
        primary_edition_openlibrary_id: primaryEditionKey ? this.extractShortIdFromKey(primaryEditionKey) : null,
      });
    }

    return works;
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
    const prefixes = ["/authors/", "/works/", "/books/", "/languages/"];

    for (const prefix of prefixes) {
      if (key.startsWith(prefix)) {
        return key.slice(prefix.length);
      }
    }

    if (key.startsWith("/")) {
      return key.slice(1);
    }

    return key;
  }

  /**
   * Validates and transforms OpenLibrary work detail API response to internal format.
   *
   * @param data - Raw response data from OpenLibrary
   * @returns Validated work object with short format openlibrary_id
   * @throws Error if response structure is invalid or missing required fields
   */
  private parseWorkDetailResponse(data: unknown): OpenLibraryWork {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format from OpenLibrary");
    }

    const response = data as OpenLibraryWorkResponse;

    if (!response.key) {
      throw new Error("OpenLibrary response missing required field 'key'");
    }

    if (!response.title) {
      throw new Error("OpenLibrary response missing required field 'title'");
    }

    const shortId = this.extractShortIdFromKey(response.key);
    const firstPublishYear =
      response.first_publish_year ?? this.parseYearFromDateString(response.first_publish_date ?? null) ?? null;

    const primaryEditionKey = response.primary_edition ?? response.cover_edition_key ?? response.cover_edition ?? null;

    return {
      openlibrary_id: shortId,
      title: response.title.trim(),
      first_publish_year: firstPublishYear,
      primary_edition_openlibrary_id: primaryEditionKey ? this.extractShortIdFromKey(primaryEditionKey) : null,
    };
  }

  /**
   * Validates and transforms OpenLibrary editions list response to internal format.
   *
   * @param data - Raw response data from OpenLibrary
   * @returns Array of validated edition objects
   * @throws Error if response structure is invalid
   */
  private parseEditionsResponse(data: unknown): OpenLibraryEdition[] {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format from OpenLibrary");
    }

    const response = data as OpenLibraryEditionsResponse;

    if (!Array.isArray(response.entries)) {
      throw new Error("OpenLibrary response missing entries array");
    }

    const editions: OpenLibraryEdition[] = [];

    for (const entry of response.entries) {
      const key = entry.key;
      const title = entry.title;

      if (!key || !title) {
        continue;
      }

      const publishDateRaw = entry.publish_date?.trim() ?? null;
      const publishYear = this.parseYearFromDateString(publishDateRaw) ?? null;
      const publishDate = this.parseDateFromPublishDate(publishDateRaw);
      const isbn13 = Array.isArray(entry.isbn_13) && entry.isbn_13.length > 0 ? entry.isbn_13[0] : null;
      const coverUrl =
        Array.isArray(entry.covers) && entry.covers.length > 0 ? this.buildCoverUrl(entry.covers[0]) : null;
      const languageKey = Array.isArray(entry.languages) && entry.languages.length > 0 ? entry.languages[0]?.key : null;
      const language = languageKey ? this.extractShortIdFromKey(languageKey) : null;

      editions.push({
        openlibrary_id: this.extractShortIdFromKey(key),
        title: title.trim(),
        publish_year: publishYear,
        publish_date: publishDate,
        publish_date_raw: publishDateRaw,
        isbn13,
        cover_url: coverUrl,
        language,
      });
    }

    return editions;
  }

  /**
   * Validates and transforms OpenLibrary edition detail API response to internal format.
   *
   * @param data - Raw response data from OpenLibrary
   * @returns Validated edition object with short format openlibrary_id
   * @throws Error if response structure is invalid or missing required fields
   */
  private parseEditionDetailResponse(data: unknown): OpenLibraryEdition {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format from OpenLibrary");
    }

    const response = data as OpenLibraryEditionResponse;

    if (!response.key) {
      throw new Error("OpenLibrary response missing required field 'key'");
    }

    if (!response.title) {
      throw new Error("OpenLibrary response missing required field 'title'");
    }

    const shortId = this.extractShortIdFromKey(response.key);
    const publishDateRaw = response.publish_date?.trim() ?? null;
    const publishYear = this.parseYearFromDateString(publishDateRaw) ?? null;
    const publishDate = this.parseDateFromPublishDate(publishDateRaw);
    const isbn13 = Array.isArray(response.isbn_13) && response.isbn_13.length > 0 ? response.isbn_13[0] : null;
    const coverUrl =
      Array.isArray(response.covers) && response.covers.length > 0 ? this.buildCoverUrl(response.covers[0]) : null;
    const languageKey =
      Array.isArray(response.languages) && response.languages.length > 0 ? response.languages[0]?.key : null;
    const language = languageKey ? this.extractShortIdFromKey(languageKey) : null;

    return {
      openlibrary_id: shortId,
      title: response.title.trim(),
      publish_year: publishYear,
      publish_date: publishDate,
      publish_date_raw: publishDateRaw,
      isbn13,
      cover_url: coverUrl,
      language,
    };
  }

  private parseYearFromDateString(value: string | null): number | null {
    if (!value) {
      return null;
    }

    const match = value.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    if (!match) {
      return null;
    }

    return Number(match[1]);
  }

  private parseDateFromPublishDate(value: string | null): string | null {
    if (!value) {
      return null;
    }

    if (/^\d{4}$/.test(value)) {
      return null;
    }

    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return new Date(parsed).toISOString().slice(0, 10);
  }

  private buildCoverUrl(coverId: number): string {
    return `${this.coversBaseUrl}/b/id/${coverId}-M.jpg`;
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
