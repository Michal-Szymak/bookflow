import { useState } from "react";
import { useAuthorsList } from "./hooks/useAuthorsList";
import { PageHeader } from "./PageHeader";
import { AuthorsToolbar } from "./AuthorsToolbar";
import { AuthorsListContent } from "./AuthorsListContent";
import { AuthorsPagination } from "./AuthorsPagination";
import { AddAuthorModal } from "./AddAuthorModal";
import { DeleteAuthorDialog } from "./DeleteAuthorDialog";
import type { AuthorDto } from "@/types";

// Page size constant (30 authors per page as per PRD)
const PAGE_SIZE = 30;

/**
 * Main view component for Authors List page.
 * Orchestrates all subcomponents and manages the overall state and interactions.
 *
 * This is the React island that will be embedded in the Astro page.
 */
export function AuthorsListView() {
  const {
    // Data
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
    refreshList,
    refreshProfile,
    deleteAuthor,
  } = useAuthorsList();

  // Local state for delete dialog
  const [isDeletingAuthor, setIsDeletingAuthor] = useState(false);

  // Calculate total pages
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Get author for delete dialog
  const authorToDelete: AuthorDto | null = deleteAuthorId
    ? authors.find((a) => a.author.id === deleteAuthorId)?.author || null
    : null;

  /**
   * Handle opening add author modal.
   * Only opens if user hasn't reached the limit.
   */
  const handleOpenAddModal = () => {
    if (!limitStatus.isAtLimit) {
      setIsAddModalOpen(true);
    }
  };

  /**
   * Handle closing add author modal.
   */
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  /**
   * Handle author successfully added.
   * Closes modal and refreshes data.
   */
  const handleAuthorAdded = async () => {
    setIsAddModalOpen(false);
    await Promise.all([refreshProfile(), refreshList()]);
    // Toast will be shown by the modal components
  };

  /**
   * Handle delete author button click.
   * Opens confirmation dialog.
   */
  const handleDeleteClick = (authorId: string) => {
    setDeleteAuthorId(authorId);
  };

  /**
   * Handle delete author confirmation.
   * Calls delete API and closes dialog.
   */
  const handleDeleteConfirm = async () => {
    if (!deleteAuthorId) return;

    setIsDeletingAuthor(true);
    try {
      await deleteAuthor(deleteAuthorId);
      setDeleteAuthorId(null);
      // Success toast will be shown by the hook
    } catch {
      // Error toast will be shown by the hook
    } finally {
      setIsDeletingAuthor(false);
    }
  };

  /**
   * Handle delete author cancellation.
   * Closes dialog without action.
   */
  const handleDeleteCancel = () => {
    if (!isDeletingAuthor) {
      setDeleteAuthorId(null);
    }
  };

  /**
   * Handle retry after error.
   */
  const handleRetry = () => {
    refreshList();
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-5xl">
      {/* Page Header */}
      <PageHeader limitStatus={limitStatus} />

      {/* Toolbar with filters and add button */}
      <AuthorsToolbar
        search={filters.search}
        sort={filters.sort}
        isAtLimit={limitStatus.isAtLimit}
        onSearchChange={setSearch}
        onSortChange={setSort}
        onAddAuthor={handleOpenAddModal}
      />

      {/* Main content area with conditional rendering */}
      <AuthorsListContent
        isLoading={isLoading}
        error={error}
        authors={authors}
        hasFilters={hasFilters}
        onDeleteAuthor={handleDeleteClick}
        onRetry={handleRetry}
        onClearFilters={clearFilters}
        onAddAuthor={handleOpenAddModal}
      />

      {/* Pagination controls */}
      {!isLoading && !error && authors.length > 0 && (
        <AuthorsPagination currentPage={filters.page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* Add Author Modal */}
      <AddAuthorModal isOpen={isAddModalOpen} onClose={handleCloseAddModal} onAuthorAdded={handleAuthorAdded} />

      {/* Delete Author Confirmation Dialog */}
      <DeleteAuthorDialog
        isOpen={deleteAuthorId !== null}
        author={authorToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}
