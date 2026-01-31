import { AuthorWorksSkeleton } from "./AuthorWorksSkeleton";
import { AuthorWorksError } from "./AuthorWorksError";
import { AuthorWorksEmpty } from "./AuthorWorksEmpty";
import { AuthorWorksTable } from "./AuthorWorksTable";
import type { WorkListItemDto } from "@/types";

interface AuthorWorksContentProps {
  isLoading: boolean;
  error: string | null;
  works: WorkListItemDto[];
  selectedWorkIds: Set<string>;
  userWorkIds: Set<string>;
  onWorkToggle: (workId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onRetry?: () => void;
}

export function AuthorWorksContent({
  isLoading,
  error,
  works,
  selectedWorkIds,
  userWorkIds,
  onWorkToggle,
  onSelectAll,
  onDeselectAll,
  isAllSelected,
  isIndeterminate,
  onRetry,
}: AuthorWorksContentProps) {
  if (isLoading) {
    return <AuthorWorksSkeleton />;
  }

  if (error) {
    return <AuthorWorksError message={error} onRetry={onRetry} />;
  }

  if (works.length === 0) {
    return <AuthorWorksEmpty />;
  }

  return (
    <AuthorWorksTable
      works={works}
      selectedWorkIds={selectedWorkIds}
      userWorkIds={userWorkIds}
      onWorkToggle={onWorkToggle}
      onSelectAll={onSelectAll}
      onDeselectAll={onDeselectAll}
      isAllSelected={isAllSelected}
      isIndeterminate={isIndeterminate}
    />
  );
}
