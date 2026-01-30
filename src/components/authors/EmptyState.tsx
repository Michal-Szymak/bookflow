import { BookUser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  onAddAuthor: () => void;
  className?: string;
}

/**
 * Empty state when user has no authors yet.
 * Shows illustration, message, and CTA to add first author.
 */
export function EmptyState({ onAddAuthor, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-6 p-12 text-center", className)}>
      {/* Illustration/Icon */}
      <div className="flex items-center justify-center size-20 rounded-full bg-primary/10">
        <BookUser className="size-10 text-primary" />
      </div>

      {/* Message */}
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Nie masz jeszcze autorów</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Dodaj pierwszego autora, aby rozpocząć budowanie biblioteki. Możesz wyszukać autora w OpenLibrary lub dodać
          ręcznie.
        </p>
      </div>

      {/* CTA Button */}
      <Button onClick={onAddAuthor} size="lg" className="gap-2">
        <BookUser className="size-4" />
        <span>Dodaj pierwszego autora</span>
      </Button>
    </div>
  );
}
