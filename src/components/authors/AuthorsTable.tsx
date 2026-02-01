import { AuthorRow } from "./AuthorRow";
import type { UserAuthorDto } from "@/types";
import { cn } from "@/lib/utils";

export interface AuthorsTableProps {
  authors: UserAuthorDto[];
  onDeleteAuthor: (authorId: string) => void;
  className?: string;
}

/**
 * Table/list of authors with rows.
 * Maps authors array to AuthorRow components.
 */
export function AuthorsTable({ authors, onDeleteAuthor, className }: AuthorsTableProps) {
  return (
    <div className={cn("border rounded-md overflow-hidden", className)} data-testid="authors-table">
      {authors.map((author) => (
        <AuthorRow key={author.author.id} author={author} onDelete={onDeleteAuthor} />
      ))}
    </div>
  );
}
