import { BooksTableHeader } from "./BooksTableHeader";
import { BooksTableRow } from "./BooksTableRow";
import type { UserWorkItemDto, UserWorkStatus } from "@/types";
import { cn } from "@/lib/utils";

export interface BooksTableProps {
  items: UserWorkItemDto[];
  selectedWorkIds: Set<string>;
  updatingWorkIds: Set<string>;
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
 * Table with list of user's books.
 * Responsive implementation with stacked rows on mobile.
 */
export function BooksTable({
  items,
  selectedWorkIds,
  updatingWorkIds,
  onWorkToggle,
  onSelectAll,
  onDeselectAll,
  isAllSelected,
  isIndeterminate,
  onStatusChange,
  onAvailableChange,
  onDelete,
  className,
}: BooksTableProps) {
  const handleToggleAll = () => {
    if (isAllSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  };

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse">
        <BooksTableHeader
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
          onToggleAll={handleToggleAll}
        />
        <tbody>
          {items.map((item) => (
            <BooksTableRow
              key={item.work.id}
              item={item}
              isSelected={selectedWorkIds.has(item.work.id)}
              isUpdating={updatingWorkIds.has(item.work.id)}
              onToggle={() => onWorkToggle(item.work.id)}
              onStatusChange={(status) => onStatusChange(item.work.id, status)}
              onAvailableChange={(available) => onAvailableChange(item.work.id, available)}
              onDelete={() => onDelete(item.work.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
