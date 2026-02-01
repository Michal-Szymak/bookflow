import { cn } from "@/lib/utils";
import type { LimitStatus } from "./types";

export interface LimitIndicatorProps {
  limitStatus: LimitStatus;
  label?: string; // Optional label, defaults to "Autorzy:" for backward compatibility
  className?: string;
}

/**
 * Visual indicator showing current count vs maximum limit.
 * Changes color based on percentage filled.
 *
 * Color scheme:
 * - Green: 0-70%
 * - Yellow: 70-90%
 * - Red: 90-100%
 */
export function LimitIndicator({ limitStatus, label = "Autorzy:", className }: LimitIndicatorProps) {
  const { current, max, percentage } = limitStatus;

  // Determine color based on percentage
  const getColorClasses = () => {
    if (percentage >= 90) {
      return "text-red-600 dark:text-red-400";
    }
    if (percentage >= 70) {
      return "text-yellow-600 dark:text-yellow-400";
    }
    return "text-green-600 dark:text-green-400";
  };

  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="author-limit-indicator">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold", getColorClasses())} data-testid="author-limit-count">
        {current} / {max}
      </span>
      {percentage >= 90 && <span className="text-xs text-muted-foreground">(Zbliżasz się do limitu)</span>}
    </div>
  );
}
