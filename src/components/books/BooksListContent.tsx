import { BooksTable } from "./BooksTable";
import { BooksListSkeleton } from "./BooksListSkeleton";
import { BooksEmptyState } from "./BooksEmptyState";
import { BooksNoResultsState } from "./BooksNoResultsState";
import { ErrorDisplay } from "../authors/ErrorDisplay";
import type { UserWorkItemDto, UserWorkStatus } from "@/types";

export interface BooksListContentProps {
  isLoading: boolean;
  error: string | null;
  items: UserWorkItemDto[];
  hasFilters: boolean;
  selectedWorkIds: Set<string>;
  updatingWorkIds: Set<string>;
  onRetry: () => void;
  onClearFilters: () => void;
  onAddAuthor: () => void;
  onWorkToggle: (workId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onStatusChange: (workId: string, status: UserWorkStatus) => Promise<void>;
  onAvailableChange: (workId: string, available: boolean | null) => Promise<void>;
  onDelete: (workId: string) => Promise<void>;
  className?: string;
}

/**
 * Main content area with conditional rendering of states (loading, error, empty, list).
 */
export function BooksListContent({
  isLoading,
  error,
  items,
  hasFilters,
  selectedWorkIds,
  updatingWorkIds,
  onRetry,
  onClearFilters,
  onAddAuthor,
  onWorkToggle,
  onSelectAll,
  onDeselectAll,
  isAllSelected,
  isIndeterminate,
  onStatusChange,
  onAvailableChange,
  onDelete,
  className,
}: BooksListContentProps) {
  if (isLoading) {
    return <BooksListSkeleton className={className} />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={onRetry} className={className} />;
  }

  if (items.length === 0 && !hasFilters) {
    return <BooksEmptyState onAddAuthor={onAddAuthor} className={className} />;
  }

  if (items.length === 0 && hasFilters) {
    return <BooksNoResultsState onClearFilters={onClearFilters} className={className} />;
  }

  return (
    <BooksTable
      items={items}
      selectedWorkIds={selectedWorkIds}
      updatingWorkIds={updatingWorkIds}
      onWorkToggle={onWorkToggle}
      onSelectAll={onSelectAll}
      onDeselectAll={onDeselectAll}
      isAllSelected={isAllSelected}
      isIndeterminate={isIndeterminate}
      onStatusChange={onStatusChange}
      onAvailableChange={onAvailableChange}
      onDelete={onDelete}
      className={className}
    />
  );
}
