import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { UserWorkStatus } from "@/types";

export interface WorkStatusControlProps {
  value: UserWorkStatus;
  onChange: (status: UserWorkStatus) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

const STATUS_LABELS: Record<UserWorkStatus, string> = {
  to_read: "Do przeczytania",
  in_progress: "W trakcie",
  read: "Przeczytana",
  hidden: "Ukryta",
};

/**
 * Control for changing work status.
 * Uses select dropdown with all available statuses.
 */
export function WorkStatusControl({ value, onChange, disabled, className }: WorkStatusControlProps) {
  const handleChange = async (newValue: string) => {
    if (newValue !== value) {
      await onChange(newValue as UserWorkStatus);
    }
  };

  return (
    <Select value={value} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className={cn("w-full sm:w-[160px]", className)} aria-label="Status książki">
        <SelectValue>{STATUS_LABELS[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="to_read">{STATUS_LABELS.to_read}</SelectItem>
        <SelectItem value="in_progress">{STATUS_LABELS.in_progress}</SelectItem>
        <SelectItem value="read">{STATUS_LABELS.read}</SelectItem>
        <SelectItem value="hidden">{STATUS_LABELS.hidden}</SelectItem>
      </SelectContent>
    </Select>
  );
}
