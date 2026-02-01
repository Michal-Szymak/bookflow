import { Checkbox } from "@/components/ui/checkbox";

interface AuthorWorksTableHeaderProps {
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onToggleAll: () => void;
}

export function AuthorWorksTableHeader({ isAllSelected, isIndeterminate, onToggleAll }: AuthorWorksTableHeaderProps) {
  return (
    <thead>
      <tr className="border-b">
        <th className="w-12 p-4">
          <Checkbox
            checked={isIndeterminate ? "indeterminate" : isAllSelected}
            onCheckedChange={onToggleAll}
            aria-label="Zaznacz wszystkie"
            data-testid="author-works-select-all"
          />
        </th>
        <th className="w-24 p-4 text-left">Okładka</th>
        <th className="p-4 text-left">Tytuł</th>
        <th className="w-24 p-4 text-left">Rok</th>
        <th className="w-32 p-4 text-left">Język</th>
        <th className="w-24 p-4 text-left">Status</th>
        <th className="w-32 p-4 text-left">Szczegóły</th>
      </tr>
    </thead>
  );
}
