import { cn } from "@/lib/utils";

export interface AuthorsListSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Skeleton loading placeholder for authors list.
 * Shows animated shimmer effect while data is loading.
 */
export function AuthorsListSkeleton({ count = 5, className }: AuthorsListSkeletonProps) {
  return (
    <div className={cn("space-y-0 border rounded-md overflow-hidden", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 p-4 border-b last:border-b-0">
          {/* Author info skeleton */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              {/* Name skeleton */}
              <div className="h-4 bg-muted rounded animate-pulse w-40" />
              {/* Badge skeleton */}
              <div className="h-5 bg-muted rounded-full animate-pulse w-16" />
            </div>
            {/* Date skeleton */}
            <div className="h-3 bg-muted rounded animate-pulse w-32" />
          </div>

          {/* Delete button skeleton */}
          <div className="shrink-0">
            <div className="size-9 bg-muted rounded-md animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
