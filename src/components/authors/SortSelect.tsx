import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SortSelectProps {
  value: "name_asc" | "created_desc";
  onChange: (value: "name_asc" | "created_desc") => void;
  className?: string;
}

/**
 * Dropdown select for sorting authors list.
 * Options: alphabetically (A-Z) or by date added (newest first).
 */
export function SortSelect({ value, onChange, className }: SortSelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as "name_asc" | "created_desc");
  };

  return (
    <div className={cn("relative", className)}>
      <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <select
        value={value}
        onChange={handleChange}
        className={cn(
          "w-full h-9 pl-9 pr-8 rounded-md border bg-background text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "appearance-none cursor-pointer"
        )}
        aria-label="Sortowanie"
      >
        <option value="name_asc">Alfabetycznie (A-Z)</option>
        <option value="created_desc">Ostatnio dodane</option>
      </select>
      {/* Custom dropdown arrow */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="size-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
