import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { WorkStatusControl } from "./WorkStatusControl";
import { WorkAvailableControl } from "./WorkAvailableControl";
import { WorkDetailsAccordion } from "./WorkDetailsAccordion";
import type { UserWorkItemDto, UserWorkStatus } from "@/types";
import { cn } from "@/lib/utils";

export interface BooksTableRowProps {
  item: UserWorkItemDto;
  isSelected: boolean;
  isUpdating: boolean;
  onToggle: () => void;
  onStatusChange: (status: UserWorkStatus) => Promise<void>;
  onAvailableChange: (available: boolean | null) => Promise<void>;
  onDelete: () => Promise<void>;
}

/**
 * Single table row with book data, status/availability controls, and details accordion.
 * Shows checkbox, cover, title, status control, availability control, year, and actions.
 */
export function BooksTableRow({
  item,
  isSelected,
  isUpdating,
  onToggle,
  onStatusChange,
  onAvailableChange,
  onDelete,
}: BooksTableRowProps) {
  const { work } = item;
  const edition = work.primary_edition;
  const title = edition?.title || work.title || "Brak tytułu";
  const coverUrl = edition?.cover_url;
  const publishYear = edition?.publish_year || work.first_publish_year;

  return (
    <tr className={cn("border-b hover:bg-muted/50", isUpdating && "opacity-50")}>
      {/* Checkbox */}
      <td className="p-4">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          aria-label={`Zaznacz ${title}`}
          disabled={isUpdating}
        />
      </td>

      {/* Cover */}
      <td className="p-4">
        {coverUrl ? (
          <img src={coverUrl} alt={`Okładka ${title}`} className="h-16 w-12 object-cover rounded" loading="lazy" />
        ) : (
          <div className="h-16 w-12 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
            Brak
          </div>
        )}
      </td>

      {/* Title */}
      <td className="p-4">
        <div className="font-medium">{title}</div>
      </td>

      {/* Status */}
      <td className="p-4">
        <WorkStatusControl value={item.status} onChange={onStatusChange} disabled={isUpdating} />
      </td>

      {/* Availability */}
      <td className="p-4">
        <WorkAvailableControl value={item.available_in_legimi} onChange={onAvailableChange} disabled={isUpdating} />
      </td>

      {/* Year */}
      <td className="p-4">{publishYear || "N/A"}</td>

      {/* Actions */}
      <td className="p-4">
        <div className="flex flex-col gap-2">
          <WorkDetailsAccordion item={item} />
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isUpdating}
            className="gap-2 text-destructive hover:text-destructive"
            aria-label={`Usuń ${title} z profilu`}
          >
            {isUpdating ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            <span className="hidden sm:inline">Usuń</span>
          </Button>
        </div>
      </td>
    </tr>
  );
}
