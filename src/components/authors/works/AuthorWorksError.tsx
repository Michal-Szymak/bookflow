import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface AuthorWorksErrorProps {
  message: string;
  onRetry?: () => void;
  onManualAdd?: () => void;
  className?: string;
}

export function AuthorWorksError({ message, onRetry, onManualAdd, className }: AuthorWorksErrorProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 rounded-lg border p-8 text-center ${className || ""}`}
    >
      <AlertCircle className="h-12 w-12 text-destructive" />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Wystąpił błąd</h3>
        <p className="text-muted-foreground">{message}</p>
      </div>
      <div className="flex gap-2">
        {onRetry && (
          <Button onClick={onRetry} variant="default">
            Spróbuj ponownie
          </Button>
        )}
        {onManualAdd && (
          <Button onClick={onManualAdd} variant="outline">
            Dodaj ręcznie
          </Button>
        )}
        <Button variant="outline" asChild>
          <a href="/app/authors">Powrót do autorów</a>
        </Button>
      </div>
    </div>
  );
}
