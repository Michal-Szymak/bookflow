import { useBooksList } from "./hooks/useBooksList";
import { PageHeader } from "./PageHeader";
import { BooksFiltersBar } from "./BooksFiltersBar";
import { BooksListContent } from "./BooksListContent";
import { BooksPagination } from "./BooksPagination";
import { BooksBulkToolbar } from "./BooksBulkToolbar";

// Page size constant (30 books per page as per plan)
const PAGE_SIZE = 30;

/**
 * Main view component for Books List page.
 * Orchestrates all subcomponents and manages the overall state and interactions.
 *
 * This is the React island that will be embedded in the Astro page.
 */
export function BooksListView() {
  const {
    // Data
    items,
    total,
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
    setSort,
    clearFilters,
    refreshList,
  } = useBooksList();

  // Calculate total pages
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Handle add author navigation
  const handleAddAuthor = () => {
    window.location.href = "/app/authors";
  };

  // Handle bulk delete
  const handleBulkDelete = async (workIds: string[]) => {
    // Delete each work sequentially
    for (const workId of workIds) {
      try {
        await deleteWork(workId);
      } catch {
        // Continue with other deletions even if one fails
        // Error toast is shown by deleteWork
      }
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
      {/* Page Header */}
      <PageHeader limitStatus={limitStatus} />

      {/* Filters Bar */}
      <BooksFiltersBar
        filters={filters}
        hasFilters={hasFilters}
        onStatusChange={setStatusFilter}
        onAvailableChange={setAvailableFilter}
        onSearchChange={setSearch}
        onSortChange={setSort}
        onClearFilters={clearFilters}
      />

      {/* Main content area with conditional rendering */}
      <BooksListContent
        isLoading={isLoading}
        error={error}
        items={items}
        hasFilters={hasFilters}
        selectedWorkIds={selectedWorkIds}
        updatingWorkIds={updatingWorkIds}
        onRetry={refreshList}
        onClearFilters={clearFilters}
        onAddAuthor={handleAddAuthor}
        onWorkToggle={toggleWork}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        isAllSelected={isAllSelected}
        isIndeterminate={isIndeterminate}
        onStatusChange={setStatus}
        onAvailableChange={setAvailable}
        onDelete={deleteWork}
      />

      {/* Pagination controls */}
      {!isLoading && !error && items.length > 0 && (
        <BooksPagination currentPage={filters.page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* Bulk Toolbar (sticky, only when items selected) */}
      {selectedWorkIds.size > 0 && (
        <BooksBulkToolbar
          selectedCount={selectedWorkIds.size}
          selectedWorkIds={Array.from(selectedWorkIds)}
          onBulkStatusChange={bulkUpdateStatus}
          onBulkDelete={handleBulkDelete}
          onCancel={deselectAll}
        />
      )}
    </div>
  );
}
