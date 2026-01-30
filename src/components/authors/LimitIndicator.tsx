import { cn } from "@/lib/utils";
import type { LimitStatus } from "./types";

export interface LimitIndicatorProps {
  limitStatus: LimitStatus;
  className?: string;
}

/**
 * Visual indicator showing current author count vs maximum limit.
 * Changes color based on percentage filled.
 *
 * Color scheme:
 * - Green: 0-70%
 * - Yellow: 70-90%
 * - Red: 90-100%
 */
export function LimitIndicator({ limitStatus, className }: LimitIndicatorProps) {
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
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground">Autorzy:</span>
      <span className={cn("text-sm font-semibold", getColorClasses())}>
        {current} / {max}
      </span>
      {percentage >= 90 && <span className="text-xs text-muted-foreground">(Zbliżasz się do limitu)</span>}
    </div>
  );
}
