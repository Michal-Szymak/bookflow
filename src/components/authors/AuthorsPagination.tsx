import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AuthorsPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Pagination controls for authors list.
 * Shows previous/next buttons and page information.
 */
export function AuthorsPagination({ currentPage, totalPages, onPageChange, className }: AuthorsPaginationProps) {
  // Don't show pagination if only one page
  if (totalPages <= 1) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className={cn("flex items-center justify-between gap-4 mt-4", className)}>
      {/* Previous button */}
      <Button variant="outline" size="sm" onClick={handlePrevious} disabled={currentPage === 1} className="gap-1">
        <ChevronLeft className="size-4" />
        <span>Poprzednia</span>
      </Button>

      {/* Page info */}
      <span className="text-sm text-muted-foreground">
        Strona {currentPage} z {totalPages}
      </span>

      {/* Next button */}
      <Button variant="outline" size="sm" onClick={handleNext} disabled={currentPage === totalPages} className="gap-1">
        <span>Następna</span>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
