import { UserPlus, Loader2, Info } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useManualAuthor } from "./hooks/useManualAuthor";
import { cn } from "@/lib/utils";

export interface ManualAuthorTabProps {
  onAuthorAdded: () => void;
  onResetRef?: (reset: () => void) => void;
}

/**
 * Tab for manually adding an author.
 * Shows form with name input and submit button.
 */
export function ManualAuthorTab({ onAuthorAdded, onResetRef }: ManualAuthorTabProps) {
  const { name, setName, isCreating, createError, createManualAuthor, validateName, resetForm } =
    useManualAuthor(onAuthorAdded);

  // Expose reset function to parent via ref callback
  useEffect(() => {
    if (onResetRef) {
      onResetRef(resetForm);
    }
  }, [onResetRef, resetForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate before submit
    const error = validateName(name);
    if (error) return;

    try {
      await createManualAuthor();
    } catch {
      // Error is handled in the hook
    }
  };

  const validationError = name.trim().length > 0 ? validateName(name) : null;
  const canSubmit = name.trim().length > 0 && !validationError && !isCreating;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Info message */}
      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
        <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Autor będzie oznaczony jako ręcznie dodany. Nie będzie połączony z OpenLibrary.
        </p>
      </div>

      {/* Name input */}
      <div className="space-y-2">
        <label htmlFor="author-name" className="text-sm font-medium">
          Nazwa autora <span className="text-destructive">*</span>
        </label>
        <input
          id="author-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="np. Jan Kowalski"
          maxLength={500}
          disabled={isCreating}
          aria-label="Nazwa autora"
          aria-required="true"
          aria-invalid={!!(validationError || createError)}
          aria-describedby={validationError || createError ? "author-name-error" : undefined}
          className={cn(
            "w-full h-10 px-3 rounded-md border bg-background text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            (validationError || createError) && "border-destructive focus-visible:ring-destructive"
          )}
        />

        {/* Validation error */}
        {validationError && (
          <p id="author-name-error" className="text-xs text-destructive" role="alert">
            {validationError}
          </p>
        )}

        {/* Create error */}
        {createError && !validationError && (
          <p id="author-name-error" className="text-xs text-destructive" role="alert">
            {createError}
          </p>
        )}

        {/* Character count hint */}
        {name.length > 400 && <p className="text-xs text-muted-foreground">{name.length} / 500 znaków</p>}
      </div>

      {/* Submit button */}
      <Button type="submit" disabled={!canSubmit} className="w-full gap-2">
        {isCreating ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>Dodawanie...</span>
          </>
        ) : (
          <>
            <UserPlus className="size-4" />
            <span>Dodaj autora</span>
          </>
        )}
      </Button>
    </form>
  );
}
