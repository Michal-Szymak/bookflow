import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface WorkAvailableControlProps {
  value: boolean | null;
  onChange: (available: boolean | null) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

const AVAILABLE_LABELS: Record<string, string> = {
  true: "Tak",
  false: "Nie",
  null: "Nieznane",
};

/**
 * Tri-state control for availability in Legimi.
 * Options: "Tak" (true), "Nie" (false), "Nieznane" (null).
 */
export function WorkAvailableControl({ value, onChange, disabled, className }: WorkAvailableControlProps) {
  const displayValue = value === true ? "true" : value === false ? "false" : "null";
  const displayLabel = AVAILABLE_LABELS[displayValue];

  const handleChange = async (newValue: string) => {
    let newAvailable: boolean | null;
    if (newValue === "true") {
      newAvailable = true;
    } else if (newValue === "false") {
      newAvailable = false;
    } else {
      newAvailable = null;
    }

    if (newAvailable !== value) {
      await onChange(newAvailable);
    }
  };

  return (
    <Select value={displayValue} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className={cn("w-full sm:w-[140px]", className)} aria-label="Dostępność w Legimi">
        <SelectValue>{displayLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="true">{AVAILABLE_LABELS.true}</SelectItem>
        <SelectItem value="false">{AVAILABLE_LABELS.false}</SelectItem>
        <SelectItem value="null">{AVAILABLE_LABELS.null}</SelectItem>
      </SelectContent>
    </Select>
  );
}
