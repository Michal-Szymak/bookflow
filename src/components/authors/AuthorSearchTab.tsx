import { Search, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthorSearch } from "./hooks/useAuthorSearch";
import { cn } from "@/lib/utils";

export interface AuthorSearchTabProps {
  onAuthorAdded: () => void;
}

/**
 * Tab for searching authors in OpenLibrary.
 * Shows search input, results list, and add buttons.
 */
export function AuthorSearchTab({ onAuthorAdded }: AuthorSearchTabProps) {
  const { query, setQuery, results, isSearching, searchError, isAdding, addAuthor } = useAuthorSearch(onAuthorAdded);

  const handleAddAuthor = async (index: number) => {
    const author = results[index];
    if (!author) return;

    try {
      await addAuthor(author);
    } catch {
      // Error is handled in the hook and will be shown via toast
    }
  };

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Wpisz nazwę autora..."
          maxLength={200}
          className={cn(
            "w-full h-10 pl-9 pr-3 rounded-md border bg-background text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        />
      </div>

      {/* Search states */}
      <div className="min-h-[300px] max-h-[400px] overflow-y-auto">
        {/* Empty state - no query */}
        {query.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <Search className="size-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Wprowadź nazwę autora, aby rozpocząć wyszukiwanie</p>
          </div>
        )}

        {/* Searching state */}
        {isSearching && query.length >= 2 && (
          <div className="flex flex-col items-center justify-center h-[300px]">
            <Loader2 className="size-8 animate-spin text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Wyszukiwanie...</p>
          </div>
        )}

        {/* Error state */}
        {searchError && !isSearching && (
          <div className="flex flex-col items-center justify-center h-[300px] text-center p-4">
            <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <span className="text-2xl">⚠️</span>
            </div>
            <p className="text-sm text-destructive max-w-sm">{searchError}</p>
          </div>
        )}

        {/* No results state */}
        {!isSearching && !searchError && query.length >= 2 && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <Search className="size-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nie znaleziono autorów pasujących do zapytania</p>
          </div>
        )}

        {/* Results list */}
        {!isSearching && !searchError && results.length > 0 && (
          <div className="space-y-2">
            {results.map((author, index) => (
              <div
                key={author.openlibrary_id}
                className="flex items-center justify-between gap-3 p-3 border rounded-md hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{author.name}</p>
                  {author.id && <p className="text-xs text-muted-foreground">Już w katalogu</p>}
                </div>
                <Button size="sm" onClick={() => handleAddAuthor(index)} disabled={isAdding} className="shrink-0 gap-1">
                  {isAdding ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                  <span>Dodaj</span>
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Query too short hint */}
        {query.length > 0 && query.length < 2 && (
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <p className="text-sm text-muted-foreground">Wpisz co najmniej 2 znaki, aby wyszukać</p>
          </div>
        )}
      </div>
    </div>
  );
}
