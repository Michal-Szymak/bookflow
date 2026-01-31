import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusFilter } from "./StatusFilter";
import { AvailableFilter } from "./AvailableFilter";
import { SearchInput } from "../authors/SearchInput";
import type { UserWorkStatus } from "@/types";

export interface BooksFiltersBarProps {
  filters: {
    status?: UserWorkStatus[];
    available?: boolean | null;
    search?: string;
    author_id?: string;
    sort: "published_desc" | "title_asc";
    page: number;
  };
  hasFilters: boolean;
  onStatusChange: (statuses: UserWorkStatus[] | undefined) => void;
  onAvailableChange: (available: boolean | null | undefined) => void;
  onSearchChange: (search: string) => void;
  onSortChange: (sort: "published_desc" | "title_asc") => void;
  onClearFilters: () => void;
  className?: string;
}

/**
 * Filters bar for books list with status, availability, search, author, and sort filters.
 * All filters are synchronized with URL as the single source of truth.
 */
export function BooksFiltersBar({
  filters,
  hasFilters,
  onStatusChange,
  onAvailableChange,
  onSearchChange,
  onSortChange,
  onClearFilters,
  className,
}: BooksFiltersBarProps) {
  // Convert sort value for SortSelect (it expects "name_asc" | "created_desc")
  // We'll create a custom sort select for books
  const handleSortChange = (value: string) => {
    onSortChange(value as "published_desc" | "title_asc");
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Status Filter */}
      <div className="flex flex-col gap-2">
        <label htmlFor="status-filter" className="text-sm font-medium">
          Status
        </label>
        <div id="status-filter">
          <StatusFilter
            selectedStatuses={filters.status || []}
            onStatusesChange={(statuses) => onStatusChange(statuses.length > 0 ? statuses : undefined)}
          />
        </div>
      </div>

      {/* Available Filter and Search in a row */}
      <div className="flex flex-col sm:flex-row gap-4">
        <AvailableFilter value={filters.available} onChange={onAvailableChange} />

        <div className="flex-1">
          <SearchInput
            value={filters.search || ""}
            onChange={onSearchChange}
            placeholder="Szukaj po tytule..."
            maxLength={200}
          />
        </div>
      </div>

      {/* Sort and Clear Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 sm:flex-initial sm:w-[200px]">
          <label htmlFor="sort-select" className="text-sm font-medium mb-2 block">
            Sortowanie
          </label>
          <select
            id="sort-select"
            value={filters.sort}
            onChange={(e) => handleSortChange(e.target.value)}
            className={cn(
              "w-full h-9 px-3 rounded-md border bg-background text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "appearance-none cursor-pointer"
            )}
          >
            <option value="published_desc">Data od najnowszych</option>
            <option value="title_asc">Tytuł A-Z</option>
          </select>
        </div>

        {hasFilters && (
          <div className="flex items-end">
            <Button variant="outline" onClick={onClearFilters} className="gap-2">
              <X className="size-4" />
              Wyczyść filtry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
