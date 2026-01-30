import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Error state component with optional retry button.
 * Shows error icon, message, and retry action.
 */
export function ErrorDisplay({ message, onRetry, className }: ErrorDisplayProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 p-12 text-center", className)}>
      {/* Error icon */}
      <div className="flex items-center justify-center size-12 rounded-full bg-destructive/10">
        <AlertCircle className="size-6 text-destructive" />
      </div>

      {/* Error message */}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Coś poszło nie tak</h3>
        <p className="text-sm text-muted-foreground max-w-md">{message}</p>
      </div>

      {/* Retry button */}
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCw className="size-4" />
          <span>Spróbuj ponownie</span>
        </Button>
      )}
    </div>
  );
}
