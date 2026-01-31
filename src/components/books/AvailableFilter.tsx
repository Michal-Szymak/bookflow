import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface AvailableFilterProps {
  value: boolean | null | undefined;
  onChange: (value: boolean | null | undefined) => void;
  className?: string;
}

/**
 * Tri-state filter for availability in Legimi.
 * Options: "Tak" (true), "Nie" (false), "Nieznane" (null), "Wszystkie" (undefined).
 */
export function AvailableFilter({ value, onChange, className }: AvailableFilterProps) {
  const handleValueChange = (newValue: string) => {
    if (newValue === "all") {
      onChange(undefined);
    } else if (newValue === "true") {
      onChange(true);
    } else if (newValue === "false") {
      onChange(false);
    } else if (newValue === "null") {
      onChange(null);
    }
  };

  const displayValue = (() => {
    if (value === true) return "true";
    if (value === false) return "false";
    if (value === null) return "null";
    return "all";
  })();

  const displayLabel = (() => {
    if (value === true) return "Tak";
    if (value === false) return "Nie";
    if (value === null) return "Nieznane";
    return "Wszystkie";
  })();

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor="available-filter" className="text-sm font-medium">
        Dostępność w Legimi
      </label>
      <Select value={displayValue} onValueChange={handleValueChange}>
        <SelectTrigger id="available-filter" className="w-full sm:w-[180px]" aria-label="Filtr dostępności">
          <SelectValue>{displayLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Wszystkie</SelectItem>
          <SelectItem value="true">Tak</SelectItem>
          <SelectItem value="false">Nie</SelectItem>
          <SelectItem value="null">Nieznane</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
