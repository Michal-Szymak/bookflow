import { Checkbox } from "@/components/ui/checkbox";

export interface BooksTableHeaderProps {
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onToggleAll: () => void;
}

/**
 * Table header with "Select all" checkbox and column labels.
 * Checkbox shows indeterminate state when some (but not all) items are selected.
 */
export function BooksTableHeader({ isAllSelected, isIndeterminate, onToggleAll }: BooksTableHeaderProps) {
  return (
    <thead>
      <tr className="border-b">
        <th className="w-12 p-4">
          <Checkbox
            checked={isIndeterminate ? "indeterminate" : isAllSelected}
            onCheckedChange={onToggleAll}
            aria-label="Zaznacz wszystkie"
          />
        </th>
        <th className="w-24 p-4 text-left">Okładka</th>
        <th className="p-4 text-left">Tytuł</th>
        <th className="w-32 p-4 text-left">Status</th>
        <th className="w-40 p-4 text-left">Dostępność w Legimi</th>
        <th className="w-24 p-4 text-left">Rok</th>
        <th className="w-32 p-4 text-left">Akcje</th>
      </tr>
    </thead>
  );
}
