import { useState, useEffect } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import type {
  AuthorSearchResultDto,
  AuthorSearchResponseDto,
  ImportAuthorCommand,
  AttachUserAuthorCommand,
} from "@/types";

/**
 * Hook for managing OpenLibrary author search in AddAuthorModal.
 * Handles debounced search, results display, and author import/attach flow.
 *
 * @param onAuthorAdded - Callback function called after successfully adding an author
 * @returns Search state and action handlers
 */
export function useAuthorSearch(onAuthorAdded: () => void) {
  // ============================================================================
  // STATE - Search
  // ============================================================================
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AuthorSearchResultDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // ============================================================================
  // STATE - Adding author
  // ============================================================================
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // ============================================================================
  // DEBOUNCED SEARCH QUERY
  // ============================================================================
  const debouncedQuery = useDebounce(query, 500);

  // ============================================================================
  // SEARCH EFFECT
  // ============================================================================

  /**
   * Perform search when debounced query changes.
   * Only searches if query is at least 2 characters.
   */
  useEffect(() => {
    // Clear results if query is too short
    if (debouncedQuery.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const searchAuthors = async () => {
      setIsSearching(true);
      setSearchError(null);

      try {
        const response = await fetch(`/api/authors/search?q=${encodeURIComponent(debouncedQuery)}&limit=10`);

        if (!response.ok) {
          if (response.status === 502) {
            throw new Error("OpenLibrary jest obecnie niedostępne. Spróbuj ponownie później lub dodaj autora ręcznie.");
          }
          throw new Error("Nie udało się wyszukać autorów");
        }

        const data: AuthorSearchResponseDto = await response.json();
        setResults(data.authors);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Wystąpił błąd");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchAuthors();
  }, [debouncedQuery]);

  // ============================================================================
  // ADD AUTHOR FUNCTION
  // ============================================================================

  /**
   * Add an author from search results to user's profile.
   * If author doesn't have an ID yet, imports it first, then attaches.
   *
   * @param author - The author search result to add
   */
  const addAuthor = async (author: AuthorSearchResultDto) => {
    setIsAdding(true);
    setAddError(null);

    try {
      let authorId = author.id;

      // Step 1: Import author from OpenLibrary if not in database yet
      if (!authorId) {
        const importCommand: ImportAuthorCommand = {
          openlibrary_id: author.openlibrary_id,
        };

        const importResponse = await fetch("/api/openlibrary/import/author", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(importCommand),
        });

        if (!importResponse.ok) {
          if (importResponse.status === 502) {
            throw new Error("OpenLibrary jest niedostępne. Spróbuj ponownie później.");
          }
          throw new Error("Nie udało się zaimportować autora");
        }

        const importData = await importResponse.json();
        authorId = importData.author.id;
      }

      // Step 2: Attach author to user's profile
      // Type guard: authorId must be defined at this point
      if (!authorId) {
        throw new Error("Author ID is missing after import");
      }

      const attachCommand: AttachUserAuthorCommand = {
        author_id: authorId,
      };

      const attachResponse = await fetch("/api/user/authors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(attachCommand),
      });

      if (!attachResponse.ok) {
        const errorData = await attachResponse.json();

        if (attachResponse.status === 409) {
          if (errorData.message.includes("limit")) {
            throw new Error("Osiągnięto limit 500 autorów");
          }
          if (errorData.message.includes("already attached")) {
            throw new Error("Autor jest już w Twoim profilu");
          }
        }

        if (attachResponse.status === 429) {
          throw new Error("Dodano zbyt wielu autorów. Odczekaj 60 sekund.");
        }

        throw new Error("Nie udało się dodać autora");
      }

      // Success - call callback to refresh list
      onAuthorAdded();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Wystąpił błąd");
      throw err; // Re-throw so component can handle toast
    } finally {
      setIsAdding(false);
    }
  };

  // ============================================================================
  // RESET FUNCTION
  // ============================================================================

  /**
   * Reset search state (called when modal closes).
   */
  const resetSearch = () => {
    setQuery("");
    setResults([]);
    setSearchError(null);
    setAddError(null);
  };

  // ============================================================================
  // RETURN VALUES
  // ============================================================================

  return {
    // Search state
    query,
    setQuery,
    results,
    isSearching,
    searchError,

    // Add state
    isAdding,
    addError,

    // Actions
    addAuthor,
    resetSearch,
  };
}
