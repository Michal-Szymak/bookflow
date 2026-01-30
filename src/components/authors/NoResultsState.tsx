import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NoResultsStateProps {
  onClearFilters: () => void;
  className?: string;
}

/**
 * No results state when filters don't match any authors.
 * Shows message and action to clear filters.
 */
export function NoResultsState({ onClearFilters, className }: NoResultsStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-6 p-12 text-center", className)}>
      {/* Icon */}
      <div className="flex items-center justify-center size-20 rounded-full bg-muted">
        <SearchX className="size-10 text-muted-foreground" />
      </div>

      {/* Message */}
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Brak wyników</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Nie znaleziono autorów pasujących do kryteriów wyszukiwania. Spróbuj zmienić filtry lub wyczyść je, aby
          zobaczyć wszystkich autorów.
        </p>
      </div>

      {/* Clear filters button */}
      <Button onClick={onClearFilters} variant="outline">
        Wyczyść filtry
      </Button>
    </div>
  );
}
