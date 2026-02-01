import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NotFoundViewProps {
  /**
   * Określa, czy użytkownik jest zalogowany.
   * Wpływa na wyświetlane przyciski nawigacji.
   */
  isAuthenticated: boolean;

  /**
   * Opcjonalna klasa CSS do dostosowania stylów komponentu.
   */
  className?: string;
}

/**
 * NotFoundView component displays a 404 error page with friendly message
 * and navigation buttons based on authentication status.
 */
export function NotFoundView({ isAuthenticated, className }: NotFoundViewProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-6 p-6 sm:p-12 min-h-[60vh]", className)}
      role="main"
      aria-labelledby="not-found-title"
    >
      {/* Error icon */}
      <div className="flex items-center justify-center size-16 rounded-full bg-muted" aria-hidden="true">
        <AlertCircle className="size-8 text-muted-foreground" />
      </div>

      {/* Error message */}
      <div className="space-y-2 text-center max-w-md">
        <h2 id="not-found-title" className="text-2xl font-semibold">
          Strona nie została znaleziona
        </h2>
        <p className="text-sm text-muted-foreground">
          Przepraszamy, ale strona, której szukasz, nie istnieje lub została przeniesiona.
        </p>
      </div>

      {/* Navigation buttons */}
      <nav className="flex flex-col sm:flex-row gap-3 mt-2" aria-label="Nawigacja powrotna">
        {isAuthenticated ? (
          <>
            <Button asChild variant="default">
              <a href="/app/authors" aria-label="Wróć do listy autorów">
                Wróć do Autorów
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/app/books" aria-label="Wróć do listy książek">
                Wróć do Książek
              </a>
            </Button>
          </>
        ) : (
          <Button asChild variant="default">
            <a href="/" aria-label="Wróć do strony głównej">
              Wróć do strony głównej
            </a>
          </Button>
        )}
      </nav>
    </div>
  );
}
