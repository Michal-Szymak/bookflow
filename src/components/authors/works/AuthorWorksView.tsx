import { useState } from "react";
import { useAuthorWorks } from "./hooks/useAuthorWorks";
import { AuthorWorksHeader } from "./AuthorWorksHeader";
import { AuthorWorksToolbar } from "./AuthorWorksToolbar";
import { AuthorWorksContent } from "./AuthorWorksContent";
import { AuthorWorksPagination } from "./AuthorWorksPagination";
import { AuthorWorksBulkToolbar } from "./AuthorWorksBulkToolbar";
import { toast } from "sonner";

interface AuthorWorksViewProps {
  authorId: string;
  initialPage?: number;
  initialSort?: "published_desc" | "title_asc";
}

export function AuthorWorksView({ authorId, initialPage, initialSort }: AuthorWorksViewProps) {
  const {
    author,
    works,
    total,
    limitStatus,
    isLoading,
    isLoadingAuthor,
    error,
    selectedWorkIds,
    isAllSelected,
    isIndeterminate,
    userWorkIds,
    filters,
    setPage,
    setSort,
    toggleWork,
    selectAll,
    deselectAll,
    fetchWorks,
    bulkAddWorks,
  } = useAuthorWorks(authorId, initialPage, initialSort);

  const [isAdding, setIsAdding] = useState(false);

  const handleSortChange = (sort: "published_desc" | "title_asc") => {
    setSort(sort);
  };

  const handlePageChange = (page: number) => {
    setPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleWorkToggle = (workId: string) => {
    toggleWork(workId);
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  };

  const handleBulkAdd = async () => {
    if (selectedWorkIds.size === 0) return;

    setIsAdding(true);
    try {
      const workIds = Array.from(selectedWorkIds);
      const result = await bulkAddWorks(workIds, "to_read");

      toast.success(
        `Dodano ${result.added.length} książek${
          result.skipped.length > 0 ? `, pominięto ${result.skipped.length}` : ""
        }`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się dodać książek");
    } finally {
      setIsAdding(false);
    }
  };

  const handleForceRefresh = async () => {
    try {
      await fetchWorks(true);
      toast.success("Dane zostały odświeżone");
    } catch {
      toast.error("Nie udało się odświeżyć danych");
    }
  };

  const handleRetry = () => {
    if (isLoadingAuthor) {
      // Retry author fetch
      window.location.reload();
    } else {
      // Retry works fetch
      fetchWorks();
    }
  };

  const totalPages = Math.ceil(total / 30);

  return (
    <div className="flex flex-col gap-6" data-testid="author-works-view">
      {author && <AuthorWorksHeader authorName={author.name} />}

      <AuthorWorksToolbar
        sort={filters.sort}
        hasOpenLibraryId={!!author?.openlibrary_id}
        onSortChange={handleSortChange}
        onForceRefresh={author?.openlibrary_id ? handleForceRefresh : undefined}
      />

      <AuthorWorksContent
        isLoading={isLoading}
        error={error}
        works={works}
        selectedWorkIds={selectedWorkIds}
        userWorkIds={userWorkIds}
        onWorkToggle={handleWorkToggle}
        onSelectAll={handleSelectAll}
        onDeselectAll={deselectAll}
        isAllSelected={isAllSelected}
        isIndeterminate={isIndeterminate}
        onRetry={handleRetry}
      />

      {totalPages > 1 && (
        <AuthorWorksPagination currentPage={filters.page} totalPages={totalPages} onPageChange={handlePageChange} />
      )}

      {selectedWorkIds.size > 0 && (
        <AuthorWorksBulkToolbar
          selectedCount={selectedWorkIds.size}
          selectedWorkIds={Array.from(selectedWorkIds)}
          onBulkAdd={handleBulkAdd}
          isAdding={isAdding}
          limitStatus={limitStatus || undefined}
        />
      )}
    </div>
  );
}
