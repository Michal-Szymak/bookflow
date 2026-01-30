import type { ProfileResponseDto, UserAuthorDto, AuthorSearchResultDto } from "@/types";

// ============================================================================
// VIEW MODEL TYPES
// ============================================================================
// These types represent the state and data structures used specifically
// in the Authors List view components.

/**
 * Filters state for the authors list.
 * These values are synchronized with URL search params as the single source of truth.
 */
export interface AuthorsListFilters {
  search: string;
  sort: "name_asc" | "created_desc";
  page: number;
}

/**
 * Complete state for the AuthorsListView component.
 * Combines data from API, filters, UI states, and modal visibility.
 */
export interface AuthorsListState {
  // Data from API
  profile: ProfileResponseDto | null;
  authors: UserAuthorDto[];
  total: number;

  // Filters (synced with URL)
  filters: AuthorsListFilters;

  // UI states
  isLoading: boolean;
  error: string | null;

  // Modal states
  isAddModalOpen: boolean;
  deleteAuthorId: string | null;
}

/**
 * Computed limit status for displaying author count vs max limit.
 * Used by LimitIndicator and AddAuthorButton to show current capacity.
 */
export interface LimitStatus {
  current: number; // author_count
  max: number; // max_authors
  isAtLimit: boolean; // current >= max
  remaining: number; // max - current
  percentage: number; // (current / max) * 100
}

/**
 * State for OpenLibrary author search within AddAuthorModal.
 * Manages search query, results, loading, and error states.
 */
export interface AuthorSearchState {
  query: string;
  results: AuthorSearchResultDto[];
  isSearching: boolean;
  searchError: string | null;
  isAdding: boolean;
  addError: string | null;
}

/**
 * State for manual author creation within AddAuthorModal.
 * Manages form input, creation loading, and error states.
 */
export interface ManualAuthorState {
  name: string;
  isCreating: boolean;
  createError: string | null;
}

/**
 * Generic API error response structure.
 * Used for parsing and displaying error messages from backend.
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: unknown[];
}
