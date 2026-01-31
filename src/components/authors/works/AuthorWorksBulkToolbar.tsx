import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface AuthorWorksBulkToolbarProps {
  selectedCount: number;
  selectedWorkIds: string[];
  onBulkAdd: (workIds: string[], status?: string) => Promise<void>;
  isAdding: boolean;
  limitStatus?: {
    current: number;
    max: number;
    isAtLimit: boolean;
    remaining: number;
  };
}

export function AuthorWorksBulkToolbar({
  selectedCount,
  selectedWorkIds,
  onBulkAdd,
  isAdding,
  limitStatus,
}: AuthorWorksBulkToolbarProps) {
  const handleAdd = async () => {
    await onBulkAdd(selectedWorkIds, "to_read");
  };

  const isDisabled =
    isAdding || selectedCount === 0 || (limitStatus && limitStatus.current + selectedCount > limitStatus.max);

  return (
    <div className="sticky bottom-0 z-50 border-t bg-background p-4 shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="text-sm font-medium">
          Zaznaczono: {selectedCount}
          {limitStatus && (
            <span className="ml-2 text-muted-foreground">(Pozostało miejsca: {limitStatus.remaining})</span>
          )}
        </div>
        <Button onClick={handleAdd} disabled={isDisabled} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          {isAdding ? "Dodawanie..." : "Dodaj zaznaczone"}
        </Button>
      </div>
    </div>
  );
}
