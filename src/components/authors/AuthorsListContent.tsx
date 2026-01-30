import { AuthorsTable } from "./AuthorsTable";
import { AuthorsListSkeleton } from "./AuthorsListSkeleton";
import { ErrorDisplay } from "./ErrorDisplay";
import { EmptyState } from "./EmptyState";
import { NoResultsState } from "./NoResultsState";
import type { UserAuthorDto } from "@/types";

export interface AuthorsListContentProps {
  isLoading: boolean;
  error: string | null;
  authors: UserAuthorDto[];
  hasFilters: boolean;
  onDeleteAuthor: (authorId: string) => void;
  onRetry?: () => void;
  onClearFilters?: () => void;
  onAddAuthor: () => void;
  className?: string;
}

/**
 * Conditional rendering component for authors list content.
 * Shows appropriate state: loading, error, empty, no results, or table.
 */
export function AuthorsListContent({
  isLoading,
  error,
  authors,
  hasFilters,
  onDeleteAuthor,
  onRetry,
  onClearFilters,
  onAddAuthor,
  className,
}: AuthorsListContentProps) {
  // Loading state
  if (isLoading) {
    return <AuthorsListSkeleton count={10} className={className} />;
  }

  // Error state
  if (error) {
    return <ErrorDisplay message={error} onRetry={onRetry} className={className} />;
  }

  // Empty state (no authors and no filters)
  if (authors.length === 0 && !hasFilters) {
    return <EmptyState onAddAuthor={onAddAuthor} className={className} />;
  }

  // No results state (no authors but filters are applied)
  if (authors.length === 0 && hasFilters) {
    const handleClearFilters =
      onClearFilters ||
      (() => {
        // No-op fallback if onClearFilters is not provided
      });
    return <NoResultsState onClearFilters={handleClearFilters} className={className} />;
  }

  // Table state (has authors)
  return <AuthorsTable authors={authors} onDeleteAuthor={onDeleteAuthor} className={className} />;
}
