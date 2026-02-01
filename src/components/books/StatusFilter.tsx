import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { UserWorkStatus } from "@/types";

export interface StatusFilterProps {
  selectedStatuses: UserWorkStatus[];
  onStatusesChange: (statuses: UserWorkStatus[]) => void;
  className?: string;
}

const ALL_STATUSES: UserWorkStatus[] = ["to_read", "in_progress", "read", "hidden"];
const ACTIVE_STATUSES: UserWorkStatus[] = ["to_read", "in_progress", "read"];

const STATUS_LABELS: Record<UserWorkStatus, string> = {
  to_read: "Do przeczytania",
  in_progress: "W trakcie",
  read: "Przeczytana",
  hidden: "Ukryta",
};

/**
 * Multi-select checkbox filter for work statuses.
 * Includes preset "Aktywne" (all except hidden) and "Wszystkie" (all statuses).
 */
export function StatusFilter({ selectedStatuses, onStatusesChange, className }: StatusFilterProps) {
  const isActivePreset = (() => {
    if (selectedStatuses.length !== ACTIVE_STATUSES.length) return false;
    return ACTIVE_STATUSES.every((s) => selectedStatuses.includes(s));
  })();

  const isAllSelected = (() => {
    if (selectedStatuses.length !== ALL_STATUSES.length) return false;
    return ALL_STATUSES.every((s) => selectedStatuses.includes(s));
  })();

  const handleStatusToggle = (status: UserWorkStatus) => {
    const newStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter((s) => s !== status)
      : [...selectedStatuses, status];

    // Ensure at least one status is selected
    if (newStatuses.length > 0) {
      onStatusesChange(newStatuses);
    }
  };

  const handleActivePreset = () => {
    if (isActivePreset) {
      // If already active preset, toggle it off (select all)
      onStatusesChange(ALL_STATUSES);
    } else {
      // Set to active preset
      onStatusesChange(ACTIVE_STATUSES);
    }
  };

  const handleAllPreset = () => {
    if (isAllSelected) {
      // If all selected, clear (but we need at least one, so set to active)
      onStatusesChange(ACTIVE_STATUSES);
    } else {
      // Select all
      onStatusesChange(ALL_STATUSES);
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap gap-4">
        {/* Preset: Aktywne */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="status-active"
            checked={isActivePreset && !isAllSelected}
            onCheckedChange={handleActivePreset}
            aria-label="Aktywne"
          />
          <Label htmlFor="status-active" className="cursor-pointer text-sm font-normal">
            Aktywne
          </Label>
        </div>

        {/* Preset: Wszystkie */}
        <div className="flex items-center gap-2">
          <Checkbox id="status-all" checked={isAllSelected} onCheckedChange={handleAllPreset} aria-label="Wszystkie" />
          <Label htmlFor="status-all" className="cursor-pointer text-sm font-normal">
            Wszystkie
          </Label>
        </div>
      </div>

      {/* Individual status checkboxes */}
      <div className="flex flex-wrap gap-4">
        {ALL_STATUSES.map((status) => (
          <div key={status} className="flex items-center gap-2">
            <Checkbox
              id={`status-${status}`}
              checked={selectedStatuses.includes(status)}
              onCheckedChange={() => handleStatusToggle(status)}
              aria-label={STATUS_LABELS[status]}
            />
            <Label htmlFor={`status-${status}`} className="cursor-pointer text-sm font-normal">
              {STATUS_LABELS[status]}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
