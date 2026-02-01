import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { X, Loader2 } from "lucide-react";
import type { UserWorkStatus } from "@/types";
import { cn } from "@/lib/utils";

export interface BooksBulkToolbarProps {
  selectedCount: number;
  selectedWorkIds: string[];
  onBulkStatusChange: (workIds: string[], status?: UserWorkStatus, available?: boolean | null) => Promise<void>;
  onBulkDelete: (workIds: string[]) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

const STATUS_LABELS: Record<UserWorkStatus, string> = {
  to_read: "Do przeczytania",
  in_progress: "W trakcie",
  read: "Przeczytana",
  hidden: "Ukryta",
};

/**
 * Sticky toolbar at bottom of screen displayed only when selectedCount > 0.
 * Enables bulk operations on selected books (status change, availability change, delete).
 */
export function BooksBulkToolbar({
  selectedCount,
  selectedWorkIds,
  onBulkStatusChange,
  onBulkDelete,
  onCancel,
  className,
}: BooksBulkToolbarProps) {
  const [bulkStatus, setBulkStatus] = useState<UserWorkStatus | undefined>(undefined);
  const [bulkAvailable, setBulkAvailable] = useState<boolean | null | undefined>(undefined);
  const [isApplying, setIsApplying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleApply = async () => {
    if (bulkStatus === undefined && bulkAvailable === undefined) {
      return;
    }

    setIsApplying(true);
    try {
      await onBulkStatusChange(selectedWorkIds, bulkStatus, bulkAvailable);
      // Reset selections after successful update
      setBulkStatus(undefined);
      setBulkAvailable(undefined);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onBulkDelete(selectedWorkIds);
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const canApply = bulkStatus !== undefined || bulkAvailable !== undefined;

  return (
    <>
      <div className={cn("sticky bottom-0 z-50 border-t bg-background p-4 shadow-lg", className)}>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Selected count */}
          <div className="text-sm font-medium">Zaznaczono: {selectedCount}</div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status select */}
            <Select
              value={bulkStatus || ""}
              onValueChange={(value) => setBulkStatus(value ? (value as UserWorkStatus) : undefined)}
            >
              <SelectTrigger className="w-full sm:w-[160px]" aria-label="Zmień status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nie zmieniaj</SelectItem>
                <SelectItem value="to_read">{STATUS_LABELS.to_read}</SelectItem>
                <SelectItem value="in_progress">{STATUS_LABELS.in_progress}</SelectItem>
                <SelectItem value="read">{STATUS_LABELS.read}</SelectItem>
                <SelectItem value="hidden">{STATUS_LABELS.hidden}</SelectItem>
              </SelectContent>
            </Select>

            {/* Available select */}
            <Select
              value={
                bulkAvailable === true
                  ? "true"
                  : bulkAvailable === false
                    ? "false"
                    : bulkAvailable === null
                      ? "null"
                      : ""
              }
              onValueChange={(value) => {
                if (value === "true") setBulkAvailable(true);
                else if (value === "false") setBulkAvailable(false);
                else if (value === "null") setBulkAvailable(null);
                else setBulkAvailable(undefined);
              }}
            >
              <SelectTrigger className="w-full sm:w-[160px]" aria-label="Zmień dostępność">
                <SelectValue placeholder="Dostępność" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nie zmieniaj</SelectItem>
                <SelectItem value="true">Tak</SelectItem>
                <SelectItem value="false">Nie</SelectItem>
                <SelectItem value="null">Nieznane</SelectItem>
              </SelectContent>
            </Select>

            {/* Apply button */}
            <Button onClick={handleApply} disabled={!canApply || isApplying} size="sm" className="gap-2">
              {isApplying ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Zastosowuję...</span>
                </>
              ) : (
                <span>Zastosuj zmiany</span>
              )}
            </Button>

            {/* Delete button */}
            <Button
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              variant="destructive"
              size="sm"
              className="gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Usuwanie...</span>
                </>
              ) : (
                <>
                  <X className="size-4" />
                  <span>Usuń z profilu</span>
                </>
              )}
            </Button>

            {/* Cancel button */}
            <Button onClick={onCancel} variant="ghost" size="sm" className="gap-2">
              <X className="size-4" />
              <span>Anuluj</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć zaznaczone książki?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć {selectedCount} {selectedCount === 1 ? "książkę" : "książek"} z profilu? Ta
              operacja nie może zostać cofnięta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Usuwanie..." : "Usuń"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
