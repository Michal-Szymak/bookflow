import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AuthorWorksPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function AuthorWorksPagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: AuthorWorksPaginationProps) {
  return (
    <div className={`flex items-center justify-center gap-4 ${className || ""}`}>
      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
        <ChevronLeft className="h-4 w-4" />
        Poprzednia
      </Button>
      <span className="text-sm text-muted-foreground">
        Strona {currentPage} z {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Następna
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
