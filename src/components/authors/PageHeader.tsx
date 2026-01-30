import { LimitIndicator } from "./LimitIndicator";
import type { LimitStatus } from "./types";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  limitStatus: LimitStatus;
  className?: string;
}

/**
 * Page header with title and author limit indicator.
 * Shows "Autorzy" heading and current/max author count.
 */
export function PageHeader({ limitStatus, className }: PageHeaderProps) {
  return (
    <header
      className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6", className)}
    >
      <h1 className="text-2xl sm:text-3xl font-bold">Autorzy</h1>
      <LimitIndicator limitStatus={limitStatus} />
    </header>
  );
}
