import { SearchInput } from "./SearchInput";
import { SortSelect } from "./SortSelect";
import { AddAuthorButton } from "./AddAuthorButton";
import { cn } from "@/lib/utils";

export interface AuthorsToolbarProps {
  search: string;
  sort: "name_asc" | "created_desc";
  isAtLimit: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: "name_asc" | "created_desc") => void;
  onAddAuthor: () => void;
  className?: string;
}

/**
 * Toolbar with search, sort controls and add author button.
 * Provides filtering and action controls for the authors list.
 */
export function AuthorsToolbar({
  search,
  sort,
  isAtLimit,
  onSearchChange,
  onSortChange,
  onAddAuthor,
  className,
}: AuthorsToolbarProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4", className)}>
      {/* Search input - takes available space */}
      <div className="flex-1 min-w-0">
        <SearchInput value={search} onChange={onSearchChange} />
      </div>

      {/* Sort select */}
      <div className="w-full sm:w-56">
        <SortSelect value={sort} onChange={onSortChange} />
      </div>

      {/* Add author button */}
      <div className="w-full sm:w-auto">
        <AddAuthorButton onClick={onAddAuthor} isDisabled={isAtLimit} className="w-full sm:w-auto" />
      </div>
    </div>
  );
}
