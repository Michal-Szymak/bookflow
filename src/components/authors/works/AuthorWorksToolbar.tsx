import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AuthorWorksToolbarProps {
  sort: "published_desc" | "title_asc";
  hasOpenLibraryId: boolean;
  onSortChange: (sort: "published_desc" | "title_asc") => void;
  onForceRefresh?: () => void;
}

export function AuthorWorksToolbar({ sort, hasOpenLibraryId, onSortChange, onForceRefresh }: AuthorWorksToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Select value={sort} onValueChange={(value: "published_desc" | "title_asc") => onSortChange(value)}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Sortuj według" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="published_desc">Data publikacji (od najnowszych)</SelectItem>
          <SelectItem value="title_asc">Tytuł (A-Z)</SelectItem>
        </SelectContent>
      </Select>

      {hasOpenLibraryId && onForceRefresh && (
        <Button variant="outline" onClick={onForceRefresh}>
          Odśwież dane
        </Button>
      )}
    </div>
  );
}
