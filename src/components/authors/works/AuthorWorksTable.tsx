import { AuthorWorksTableHeader } from "./AuthorWorksTableHeader";
import { AuthorWorksTableRow } from "./AuthorWorksTableRow";
import type { WorkListItemDto } from "@/types";

interface AuthorWorksTableProps {
  works: WorkListItemDto[];
  selectedWorkIds: Set<string>;
  userWorkIds: Set<string>;
  onWorkToggle: (workId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  className?: string;
}

export function AuthorWorksTable({
  works,
  selectedWorkIds,
  userWorkIds,
  onWorkToggle,
  onSelectAll,
  onDeselectAll,
  isAllSelected,
  isIndeterminate,
  className,
}: AuthorWorksTableProps) {
  const handleToggleAll = () => {
    if (isAllSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  };

  return (
    <div className={`overflow-x-auto ${className || ""}`} data-testid="author-works-table">
      <table className="w-full border-collapse">
        <AuthorWorksTableHeader
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
          onToggleAll={handleToggleAll}
        />
        <tbody>
          {works.map((work) => (
            <AuthorWorksTableRow
              key={work.id}
              work={work}
              isSelected={selectedWorkIds.has(work.id)}
              isInProfile={userWorkIds.has(work.id)}
              onToggle={() => onWorkToggle(work.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
