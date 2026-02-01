import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserAuthorDto } from "@/types";

export interface AuthorRowProps {
  author: UserAuthorDto;
  onDelete: (authorId: string) => void;
  className?: string;
}

/**
 * Single row representing an author in the table.
 * Shows author name (as link), date added, manual/OL badge, and delete button.
 */
export function AuthorRow({ author, onDelete, className }: AuthorRowProps) {
  const { author: authorData, created_at } = author;
  const formattedDate = new Date(created_at).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 p-4 border-b last:border-b-0",
        "hover:bg-accent/50 transition-colors",
        className
      )}
      data-testid="author-row"
      data-author-id={authorData.id}
    >
      {/* Author info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <a
            href={`/app/authors/${authorData.id}`}
            className="text-sm font-medium hover:underline truncate"
            data-testid="author-name-link"
          >
            {authorData.name}
          </a>
          {/* Manual/OL Badge */}
          {authorData.manual ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
              Ręczny
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              OL
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Dodano: {formattedDate}</p>
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(authorData.id)}
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Usuń autora ${authorData.name}`}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
