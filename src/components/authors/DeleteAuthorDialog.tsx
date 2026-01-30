import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuthorDto } from "@/types";
import { useEffect } from "react";

export interface DeleteAuthorDialogProps {
  isOpen: boolean;
  author: AuthorDto | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/**
 * Confirmation dialog for deleting an author from profile.
 * Shows author info and warning about cascade deletion of works.
 */
export function DeleteAuthorDialog({ isOpen, author, onConfirm, onCancel }: DeleteAuthorDialogProps) {
  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onCancel]);

  // Lock body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !author) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} role="presentation" />

      {/* Dialog content */}
      <div className="relative bg-background border rounded-lg shadow-lg max-w-md w-full mx-4 p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center size-10 rounded-full bg-destructive/10 shrink-0">
            <AlertTriangle className="size-5 text-destructive" />
          </div>
          <div>
            <h2 id="dialog-title" className="text-lg font-semibold">
              Usunąć autora z profilu?
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Ta operacja jest odwracalna.</p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2 text-sm">
          <p>
            Autor <strong>{author.name}</strong> zostanie usunięty z Twojego profilu.
          </p>
          <p className="text-muted-foreground">
            Wszystkie książki tego autora także zostaną usunięte z Twojej biblioteki.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel}>
            Anuluj
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Usuń
          </Button>
        </div>
      </div>
    </div>
  );
}
