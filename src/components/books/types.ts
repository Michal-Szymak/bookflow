import type { ProfileResponseDto, UserWorkItemDto, UserWorkStatus } from "@/types";

// ============================================================================
// VIEW MODEL TYPES
// ============================================================================
// These types represent the state and data structures used specifically
// in the Books List view components.

/**
 * Filters state for the books list.
 * These values are synchronized with URL search params as the single source of truth.
 */
export interface BooksListFilters {
  page: number; // min 1, default 1
  status?: UserWorkStatus[]; // min 1 element if provided
  available?: boolean | null; // tri-state
  search?: string; // max 200 characters, trim
  author_id?: string; // UUID
  sort: "published_desc" | "title_asc"; // default "published_desc"
}

/**
 * Computed limit status for displaying work count vs max limit.
 * Used by LimitIndicator to show current capacity.
 */
export interface LimitStatus {
  current: number; // work_count
  max: number; // max_works (5000)
  isAtLimit: boolean; // current >= max
  remaining: number; // max - current
  percentage: number; // (current / max) * 100
}

/**
 * Complete state for the BooksListView component.
 * Combines data from API, filters, UI states, and selection.
 */
export interface BooksListState {
  // Data from API
  items: UserWorkItemDto[];
  total: number;
  profile: ProfileResponseDto | null;

  // UI
  isLoading: boolean;
  error: string | null;

  // Selection
  selectedWorkIds: Set<string>;

  // Optimistic updates tracking
  updatingWorkIds: Set<string>; // work IDs in progress
  optimisticUpdates: Map<string, Partial<UserWorkItemDto>>; // temporary changes
}
