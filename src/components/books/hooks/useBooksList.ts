import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useUrlSearchParams } from "@/lib/hooks/useUrlSearchParams";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { UserWorksListQuerySchema } from "@/lib/validation/user-works-list.schema";
import { UpdateUserWorksBulkCommandSchema } from "@/lib/validation/update-user-works-bulk.schema";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import type {
  ProfileResponseDto,
  UserWorkItemDto,
  UserWorksListResponseDto,
  UserWorkResponseDto,
  UserWorksBulkUpdateResponseDto,
  UserWorkStatus,
} from "@/types";
import type { BooksListFilters, LimitStatus } from "../types";

/**
 * Default filters preset "Aktywne" (excludes hidden status).
 */
const DEFAULT_FILTERS: BooksListFilters = {
  page: 1,
  status: ["to_read", "in_progress", "read"], // Preset "Aktywne"
  available: undefined,
  search: undefined,
  author_id: undefined,
  sort: "published_desc",
};

/**
 * Main hook for managing the Books List view state and logic.
 * Handles data fetching, URL synchronization, optimistic updates, and user actions.
 *
 * @returns State and action handlers for the Books List view
 */
export function useBooksList() {
  // ============================================================================
  // STATE - Data from API
  // ============================================================================
  const [profile, setProfile] = useState<ProfileResponseDto | null>(null);
  const [items, setItems] = useState<UserWorkItemDto[]>([]);
  const [total, setTotal] = useState(0);

  // ============================================================================
  // STATE - UI
  // ============================================================================
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // STATE - Selection
  // ============================================================================
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set());

  // ============================================================================
  // STATE - Optimistic updates
  // ============================================================================
  const [updatingWorkIds, setUpdatingWorkIds] = useState<Set<string>>(new Set());

  // ============================================================================
  // URL PARAMS - Single source of truth for filters
  // ============================================================================
  const [searchParams, setSearchParams] = useUrlSearchParams();

  // Local state for search input (with debounce)
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 500);
  // Ref to track previous debounced search value to avoid unnecessary updates
  const prevDebouncedSearchRef = useRef<string>("");

  // Parse and validate filters from URL
  const filters: BooksListFilters = useMemo(() => {
    const queryParams = {
      page: searchParams.get("page") || undefined,
      status: searchParams.getAll("status").length > 0 ? searchParams.getAll("status") : undefined,
      available: searchParams.get("available") || undefined,
      sort: searchParams.get("sort") || undefined,
      author_id: searchParams.get("author_id") || undefined,
      search: searchParams.get("search") || undefined,
    };

    const validation = UserWorksListQuerySchema.safeParse(queryParams);
    if (!validation.success) {
      logger.warn("Invalid query params", validation.error);
      // Fallback to default filters
      return DEFAULT_FILTERS;
    }

    const validated = validation.data;
    return {
      page: validated.page ?? 1,
      status: validated.status,
      available: validated.available,
      sort: validated.sort ?? "published_desc",
      author_id: validated.author_id,
      search: validated.search,
    };
  }, [searchParams]);

  // Sync search input with URL
  useEffect(() => {
    if (filters.search) {
      setSearchInput(filters.search);
    } else {
      setSearchInput("");
    }
  }, [filters.search]);

  // Update URL when debounced search changes
  useEffect(() => {
    const newSearch = debouncedSearch && debouncedSearch.trim().length > 0 ? debouncedSearch.trim() : "";

    // Only update if search actually changed
    if (prevDebouncedSearchRef.current === newSearch) {
      return; // No change needed
    }

    prevDebouncedSearchRef.current = newSearch;

    // Get current search params from window to avoid stale closure
    const currentParams = new URLSearchParams(window.location.search);
    if (newSearch) {
      currentParams.set("search", newSearch);
    } else {
      currentParams.delete("search");
    }
    currentParams.delete("page"); // Reset to first page
    setSearchParams(currentParams);
    setSelectedWorkIds(new Set()); // Clear selection
  }, [debouncedSearch, setSearchParams]); // setSearchParams is stable from useCallback

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  /**
   * Computed limit status based on profile data.
   */
  const limitStatus: LimitStatus = useMemo(() => {
    if (!profile) {
      return {
        current: 0,
        max: 5000,
        isAtLimit: false,
        remaining: 5000,
        percentage: 0,
      };
    }

    return {
      current: profile.work_count,
      max: profile.max_works,
      isAtLimit: profile.work_count >= profile.max_works,
      remaining: profile.max_works - profile.work_count,
      percentage: (profile.work_count / profile.max_works) * 100,
    };
  }, [profile]);

  /**
   * Check if any filters are currently applied (beyond defaults).
   */
  const hasFilters = useMemo(() => {
    const defaultStatuses = new Set(DEFAULT_FILTERS.status);
    const statusChanged = filters.status
      ? filters.status.length !== defaultStatuses.size || !filters.status.every((s) => defaultStatuses.has(s))
      : false;

    return (
      statusChanged ||
      filters.available !== undefined ||
      (filters.search !== undefined && filters.search.length > 0) ||
      filters.author_id !== undefined ||
      filters.sort !== DEFAULT_FILTERS.sort
    );
  }, [filters]);

  /**
   * Check if all items on current page are selected.
   */
  const isAllSelected = useMemo(() => {
    return items.length > 0 && items.every((item) => selectedWorkIds.has(item.work.id));
  }, [items, selectedWorkIds]);

  /**
   * Check if some (but not all) items are selected (for indeterminate checkbox).
   */
  const isIndeterminate = useMemo(() => {
    const selectedCount = selectedWorkIds.size;
    return selectedCount > 0 && selectedCount < items.length;
  }, [items.length, selectedWorkIds.size]);

  // ============================================================================
  // API FUNCTIONS
  // ============================================================================

  /**
   * Fetch user profile data (counts and limits).
   * Called once on mount.
   */
  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/user/profile");

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/login?redirect=/app/books";
          return;
        }
        throw new Error("Nie udało się pobrać profilu");
      }

      const data: ProfileResponseDto = await response.json();
      setProfile(data);
    } catch (err) {
      logger.error("Failed to fetch profile", err);
      // Profile error doesn't block the list display
    }
  }, []);

  /**
   * Fetch paginated list of user's works.
   * Called on mount and whenever filters change.
   */
  const fetchBooks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.page > 1) {
        params.set("page", filters.page.toString());
      }
      if (filters.status && filters.status.length > 0) {
        filters.status.forEach((s) => params.append("status", s));
      }
      if (filters.available !== undefined) {
        if (filters.available === true) {
          params.set("available", "true");
        } else if (filters.available === false) {
          params.set("available", "false");
        } else {
          params.set("available", "null");
        }
      }
      if (filters.sort) {
        params.set("sort", filters.sort);
      }
      if (filters.author_id) {
        params.set("author_id", filters.author_id);
      }
      if (filters.search) {
        params.set("search", filters.search);
      }

      const response = await fetch(`/api/user/works?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/login?redirect=/app/books";
          return;
        }
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Błąd walidacji parametrów");
        }
        throw new Error("Nie udało się pobrać listy książek");
      }

      const data: UserWorksListResponseDto = await response.json();
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Wystąpił błąd";
      setError(errorMessage);
      logger.error("Failed to fetch books", err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  /**
   * Update status for a single work (optimistic update).
   */
  const setStatus = useCallback(
    async (workId: string, status: UserWorkStatus) => {
      const originalItem = items.find((item) => item.work.id === workId);
      if (!originalItem) return;

      // Optimistic update
      setUpdatingWorkIds((prev) => new Set(prev).add(workId));
      setItems((prev) => prev.map((item) => (item.work.id === workId ? { ...item, status } : item)));

      try {
        const response = await fetch(`/api/user/works/${workId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          if (response.status === 404) {
            await fetchBooks();
            toast.error("Książka nie jest już przypisana do Twojego profilu");
            return;
          }
          if (response.status === 400) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || "Błąd walidacji");
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data: UserWorkResponseDto = await response.json();
        // Update with API data
        setItems((prev) => prev.map((item) => (item.work.id === workId ? data.work : item)));
        toast.success("Status zaktualizowany");
      } catch (err) {
        // Rollback
        setItems((prev) => prev.map((item) => (item.work.id === workId ? originalItem : item)));
        toast.error(err instanceof Error ? err.message : "Nie udało się zaktualizować statusu");
        logger.error("Failed to update status", err);
      } finally {
        setUpdatingWorkIds((prev) => {
          const next = new Set(prev);
          next.delete(workId);
          return next;
        });
      }
    },
    [items, fetchBooks]
  );

  /**
   * Update availability for a single work (optimistic update).
   */
  const setAvailable = useCallback(
    async (workId: string, available: boolean | null) => {
      const originalItem = items.find((item) => item.work.id === workId);
      if (!originalItem) return;

      // Optimistic update
      setUpdatingWorkIds((prev) => new Set(prev).add(workId));
      setItems((prev) =>
        prev.map((item) => (item.work.id === workId ? { ...item, available_in_legimi: available } : item))
      );

      try {
        const response = await fetch(`/api/user/works/${workId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ available_in_legimi: available }),
        });

        if (!response.ok) {
          if (response.status === 404) {
            await fetchBooks();
            toast.error("Książka nie jest już przypisana do Twojego profilu");
            return;
          }
          if (response.status === 400) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || "Błąd walidacji");
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data: UserWorkResponseDto = await response.json();
        // Update with API data
        setItems((prev) => prev.map((item) => (item.work.id === workId ? data.work : item)));
        toast.success("Dostępność zaktualizowana");
      } catch (err) {
        // Rollback
        setItems((prev) => prev.map((item) => (item.work.id === workId ? originalItem : item)));
        toast.error(err instanceof Error ? err.message : "Nie udało się zaktualizować dostępności");
        logger.error("Failed to update availability", err);
      } finally {
        setUpdatingWorkIds((prev) => {
          const next = new Set(prev);
          next.delete(workId);
          return next;
        });
      }
    },
    [items, fetchBooks]
  );

  /**
   * Bulk update status/availability for multiple works (optimistic update).
   */
  const bulkUpdateStatus = useCallback(
    async (workIds: string[], status?: UserWorkStatus, available?: boolean | null) => {
      if (workIds.length === 0) return;
      if (status === undefined && available === undefined) {
        toast.error("Wybierz status lub dostępność");
        return;
      }

      // Validate command
      const body = {
        work_ids: workIds,
        ...(status !== undefined && { status }),
        ...(available !== undefined && { available_in_legimi: available }),
      };

      const validation = UpdateUserWorksBulkCommandSchema.safeParse(body);
      if (!validation.success) {
        toast.error(validation.error.errors[0]?.message || "Błąd walidacji");
        return;
      }

      // Store original items for rollback
      const originalItems = new Map<string, UserWorkItemDto>();
      workIds.forEach((workId) => {
        const item = items.find((i) => i.work.id === workId);
        if (item) {
          originalItems.set(workId, item);
        }
      });

      // Optimistic update
      setUpdatingWorkIds((prev) => {
        const next = new Set(prev);
        workIds.forEach((id) => next.add(id));
        return next;
      });
      setItems((prev) =>
        prev.map((item) => {
          if (workIds.includes(item.work.id)) {
            return {
              ...item,
              ...(status !== undefined && { status }),
              ...(available !== undefined && { available_in_legimi: available }),
            };
          }
          return item;
        })
      );

      try {
        const response = await fetch("/api/user/works/status-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validation.data),
        });

        if (!response.ok) {
          if (response.status === 400) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || "Błąd walidacji");
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data: UserWorksBulkUpdateResponseDto = await response.json();
        // Update with API data (only updated works)
        const updatedWorkIds = new Set(data.works.map((w) => w.work.id));
        setItems((prev) =>
          prev.map((item) => {
            if (updatedWorkIds.has(item.work.id)) {
              const updated = data.works.find((w) => w.work.id === item.work.id);
              return updated || item;
            }
            return item;
          })
        );

        if (data.works.length < workIds.length) {
          toast.warning(`Zaktualizowano ${data.works.length} z ${workIds.length} książek`);
        } else {
          toast.success(`Zaktualizowano ${data.works.length} książek`);
        }
        setSelectedWorkIds(new Set()); // Clear selection
      } catch (err) {
        // Rollback
        setItems((prev) =>
          prev.map((item) => {
            const original = originalItems.get(item.work.id);
            return original || item;
          })
        );
        toast.error(err instanceof Error ? err.message : "Nie udało się zaktualizować książek");
        logger.error("Failed to bulk update", err);
      } finally {
        setUpdatingWorkIds((prev) => {
          const next = new Set(prev);
          workIds.forEach((id) => next.delete(id));
          return next;
        });
      }
    },
    [items]
  );

  /**
   * Delete (detach) a work from user's profile.
   */
  const deleteWork = useCallback(
    async (workId: string) => {
      try {
        const response = await fetch(`/api/user/works/${workId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          if (response.status === 404) {
            await fetchBooks();
            toast.error("Książka nie jest już przypisana do Twojego profilu");
            return;
          }
          if (response.status === 401) {
            window.location.href = "/login?redirect=/app/books";
            return;
          }
          throw new Error("Nie udało się usunąć książki");
        }

        // Remove from list
        setItems((prev) => prev.filter((item) => item.work.id !== workId));
        setTotal((prev) => prev - 1);
        setSelectedWorkIds((prev) => {
          const next = new Set(prev);
          next.delete(workId);
          return next;
        });

        // Refresh profile (update count)
        await fetchProfile();

        toast.success("Książka usunięta z profilu");
      } catch (err) {
        logger.error("Failed to delete work", err);
        toast.error(err instanceof Error ? err.message : "Nie udało się usunąć książki");
        throw err;
      }
    },
    [fetchBooks, fetchProfile]
  );

  // ============================================================================
  // FILTER HANDLERS - Update URL params
  // ============================================================================

  /**
   * Update status filter and reset to first page.
   */
  const setStatusFilter = useCallback(
    (statuses: UserWorkStatus[] | undefined) => {
      const newParams = new URLSearchParams(searchParams);
      if (statuses && statuses.length > 0) {
        newParams.delete("status");
        statuses.forEach((s) => newParams.append("status", s));
      } else {
        newParams.delete("status");
      }
      newParams.delete("page"); // Reset to first page
      setSearchParams(newParams);
      setSelectedWorkIds(new Set()); // Clear selection
    },
    [searchParams, setSearchParams]
  );

  /**
   * Update available filter and reset to first page.
   */
  const setAvailableFilter = useCallback(
    (available: boolean | null | undefined) => {
      const newParams = new URLSearchParams(searchParams);
      if (available === true) {
        newParams.set("available", "true");
      } else if (available === false) {
        newParams.set("available", "false");
      } else if (available === null) {
        newParams.set("available", "null");
      } else {
        newParams.delete("available");
      }
      newParams.delete("page");
      setSearchParams(newParams);
      setSelectedWorkIds(new Set());
    },
    [searchParams, setSearchParams]
  );

  /**
   * Update search filter (handled via debounce).
   */
  const setSearch = useCallback((search: string) => {
    setSearchInput(search);
  }, []);

  /**
   * Update author filter and reset to first page.
   */
  const setAuthorFilter = useCallback(
    (authorId: string | undefined) => {
      const newParams = new URLSearchParams(searchParams);
      if (authorId) {
        newParams.set("author_id", authorId);
      } else {
        newParams.delete("author_id");
      }
      newParams.delete("page");
      setSearchParams(newParams);
      setSelectedWorkIds(new Set());
    },
    [searchParams, setSearchParams]
  );

  /**
   * Update sort filter and reset to first page.
   */
  const setSort = useCallback(
    (sort: "published_desc" | "title_asc") => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("sort", sort);
      newParams.delete("page");
      setSearchParams(newParams);
      setSelectedWorkIds(new Set());
    },
    [searchParams, setSearchParams]
  );

  /**
   * Update page number.
   */
  const setPage = useCallback(
    (page: number) => {
      const newParams = new URLSearchParams(searchParams);
      if (page > 1) {
        newParams.set("page", page.toString());
      } else {
        newParams.delete("page");
      }
      setSearchParams(newParams);
      setSelectedWorkIds(new Set()); // Clear selection on page change
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [searchParams, setSearchParams]
  );

  /**
   * Clear all filters and return to default state.
   */
  const clearFilters = useCallback(() => {
    // Set default "Aktywne" preset
    const newParams = new URLSearchParams();
    DEFAULT_FILTERS.status?.forEach((s) => newParams.append("status", s));
    newParams.set("sort", DEFAULT_FILTERS.sort);
    setSearchParams(newParams);
    setSelectedWorkIds(new Set());
  }, [setSearchParams]);

  // ============================================================================
  // SELECTION HANDLERS
  // ============================================================================

  /**
   * Toggle selection for a single work.
   */
  const toggleWork = useCallback((workId: string) => {
    setSelectedWorkIds((prev) => {
      const next = new Set(prev);
      if (next.has(workId)) {
        next.delete(workId);
      } else {
        next.add(workId);
      }
      return next;
    });
  }, []);

  /**
   * Select all works on current page.
   */
  const selectAll = useCallback(() => {
    setSelectedWorkIds(new Set(items.map((item) => item.work.id)));
  }, [items]);

  /**
   * Deselect all works.
   */
  const deselectAll = useCallback(() => {
    setSelectedWorkIds(new Set());
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Fetch profile once on mount.
   */
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  /**
   * Set default filters if no status in URL (first visit).
   * Only runs once on mount to avoid conflicts with existing URL params.
   */
  useEffect(() => {
    // Only set defaults if URL is completely empty (first visit)
    // Read directly from window to avoid stale closure
    if (typeof window !== "undefined" && window.location.search === "") {
      const newParams = new URLSearchParams();
      DEFAULT_FILTERS.status?.forEach((s) => newParams.append("status", s));
      newParams.set("sort", DEFAULT_FILTERS.sort);
      setSearchParams(newParams);
    }
  }, [setSearchParams]); // Run only once on mount

  /**
   * Fetch books whenever filters change.
   */
  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // ============================================================================
  // RETURN VALUES
  // ============================================================================

  return {
    // Data
    items,
    total,
    profile,
    filters,
    limitStatus,
    hasFilters,

    // UI states
    isLoading,
    error,

    // Selection
    selectedWorkIds,
    isAllSelected,
    isIndeterminate,

    // Optimistic updates
    updatingWorkIds,

    // Actions
    setStatus,
    setAvailable,
    bulkUpdateStatus,
    deleteWork,
    toggleWork,
    selectAll,
    deselectAll,
    setPage,
    setStatusFilter,
    setAvailableFilter,
    setSearch,
    setAuthorFilter,
    setSort,
    clearFilters,
    refreshList: fetchBooks,
    refreshProfile: fetchProfile,
  };
}
