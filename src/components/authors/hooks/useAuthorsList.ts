import { useState, useEffect, useMemo } from "react";
import { useUrlSearchParams } from "@/lib/hooks/useUrlSearchParams";
import type { ProfileResponseDto, UserAuthorDto, UserAuthorsListResponseDto } from "@/types";
import type { AuthorsListFilters, LimitStatus } from "../types";

/**
 * Main hook for managing the Authors List view state and logic.
 * Handles data fetching, URL synchronization, and user actions.
 *
 * @returns State and action handlers for the Authors List view
 */
export function useAuthorsList() {
  // ============================================================================
  // STATE - Data from API
  // ============================================================================
  const [profile, setProfile] = useState<ProfileResponseDto | null>(null);
  const [authors, setAuthors] = useState<UserAuthorDto[]>([]);
  const [total, setTotal] = useState(0);

  // ============================================================================
  // STATE - UI
  // ============================================================================
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // STATE - Modals
  // ============================================================================
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteAuthorId, setDeleteAuthorId] = useState<string | null>(null);

  // ============================================================================
  // URL PARAMS - Single source of truth for filters
  // ============================================================================
  const [searchParams, setSearchParams] = useUrlSearchParams();

  const filters: AuthorsListFilters = useMemo(
    () => ({
      page: parseInt(searchParams.get("page") || "1", 10),
      search: searchParams.get("search") || "",
      sort: (searchParams.get("sort") as "name_asc" | "created_desc") || "name_asc",
    }),
    [searchParams]
  );

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  /**
   * Computed limit status based on profile data.
   * Shows current author count vs maximum allowed.
   */
  const limitStatus: LimitStatus = useMemo(() => {
    if (!profile) {
      return {
        current: 0,
        max: 500,
        isAtLimit: false,
        remaining: 500,
        percentage: 0,
      };
    }

    return {
      current: profile.author_count,
      max: profile.max_authors,
      isAtLimit: profile.author_count >= profile.max_authors,
      remaining: profile.max_authors - profile.author_count,
      percentage: (profile.author_count / profile.max_authors) * 100,
    };
  }, [profile]);

  /**
   * Check if any filters are currently applied.
   * Used to differentiate between EmptyState and NoResultsState.
   */
  const hasFilters = useMemo(() => {
    return filters.search !== "" || filters.sort !== "name_asc";
  }, [filters]);

  // ============================================================================
  // API FUNCTIONS
  // ============================================================================

  /**
   * Fetch user profile data (counts and limits).
   * Called once on mount.
   */
  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/user/profile");

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        throw new Error("Nie udało się pobrać profilu");
      }

      const data: ProfileResponseDto = await response.json();
      setProfile(data);
    } catch {
      // Profile error doesn't block the list display
      // User will still see the authors list, just without limit indicator
    }
  };

  /**
   * Fetch paginated list of user's authors.
   * Called on mount and whenever filters change.
   */
  const fetchAuthors = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (filters.page > 1) queryParams.set("page", filters.page.toString());
      if (filters.search) queryParams.set("search", filters.search);
      if (filters.sort) queryParams.set("sort", filters.sort);

      const response = await fetch(`/api/user/authors?${queryParams}`);

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        throw new Error("Nie udało się pobrać listy autorów");
      }

      const data: UserAuthorsListResponseDto = await response.json();
      setAuthors(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete (detach) an author from user's profile.
   * Shows toast notification and refreshes data on success.
   */
  const deleteAuthor = async (authorId: string) => {
    try {
      const response = await fetch(`/api/user/authors/${authorId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (response.status === 404) {
          throw new Error("Autor nie jest dołączony do Twojego profilu");
        }
        throw new Error("Nie udało się usunąć autora");
      }

      // Refresh data
      await Promise.all([fetchProfile(), fetchAuthors()]);

      // Success - component will show toast via callback
      return { success: true };
    } catch (err) {
      // Error - component will show toast via callback
      throw err;
    }
  };

  // ============================================================================
  // FILTER HANDLERS - Update URL params
  // ============================================================================

  /**
   * Update search filter and reset to first page.
   */
  const setSearch = (search: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (search) {
      newParams.set("search", search);
    } else {
      newParams.delete("search");
    }
    newParams.delete("page"); // Reset to first page
    setSearchParams(newParams);
  };

  /**
   * Update sort filter and reset to first page.
   */
  const setSort = (sort: "name_asc" | "created_desc") => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("sort", sort);
    newParams.delete("page"); // Reset to first page
    setSearchParams(newParams);
  };

  /**
   * Update page number.
   */
  const setPage = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    if (page > 1) {
      newParams.set("page", page.toString());
    } else {
      newParams.delete("page");
    }
    setSearchParams(newParams);
  };

  /**
   * Clear all filters and return to default state.
   */
  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Fetch profile once on mount.
   */
  useEffect(() => {
    fetchProfile();
  }, []);

  /**
   * Fetch authors whenever filters change.
   */
  useEffect(() => {
    fetchAuthors();
  }, [filters.page, filters.search, filters.sort]);

  // ============================================================================
  // RETURN VALUES
  // ============================================================================

  return {
    // Data
    profile,
    authors,
    total,
    filters,
    limitStatus,
    hasFilters,

    // UI states
    isLoading,
    error,

    // Modal states
    isAddModalOpen,
    setIsAddModalOpen,
    deleteAuthorId,
    setDeleteAuthorId,

    // Actions
    setSearch,
    setSort,
    setPage,
    clearFilters,
    refreshList: fetchAuthors,
    refreshProfile: fetchProfile,
    deleteAuthor,
  };
}
