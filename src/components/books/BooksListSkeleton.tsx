import { cn } from "@/lib/utils";

export interface BooksListSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Skeleton loading placeholder for books list.
 * Shows animated shimmer effect while data is loading.
 * Default: 30 rows (page size).
 */
export function BooksListSkeleton({ count = 30, className }: BooksListSkeletonProps) {
  return (
    <div className={cn("space-y-0 border rounded-md overflow-hidden", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 p-4 border-b last:border-b-0">
          {/* Checkbox skeleton */}
          <div className="size-4 bg-muted rounded animate-pulse shrink-0" />

          {/* Cover skeleton */}
          <div className="h-16 w-12 bg-muted rounded animate-pulse shrink-0" />

          {/* Title skeleton */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse w-48" />
          </div>

          {/* Status skeleton */}
          <div className="h-9 bg-muted rounded animate-pulse w-32 shrink-0" />

          {/* Availability skeleton */}
          <div className="h-9 bg-muted rounded animate-pulse w-28 shrink-0" />

          {/* Year skeleton */}
          <div className="h-4 bg-muted rounded animate-pulse w-16 shrink-0" />

          {/* Actions skeleton */}
          <div className="h-9 bg-muted rounded animate-pulse w-24 shrink-0" />
        </div>
      ))}
    </div>
  );
}
