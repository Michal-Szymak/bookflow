import { Search, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { cn } from "@/lib/utils";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

/**
 * Search input with debounce and clear button.
 * Debounces onChange callback by 500ms.
 * Shows character count when approaching maxLength.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Szukaj autora...",
  maxLength = 200,
  className,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, 500);

  // Sync external value changes to local state
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Call onChange when debounced value changes
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength) {
      setLocalValue(newValue);
    }
  };

  const handleClear = () => {
    setLocalValue("");
    onChange("");
  };

  const showCharCount = localValue.length > maxLength * 0.8;
  const isOverLimit = localValue.length > maxLength;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn(
            "w-full h-9 pl-9 pr-9 rounded-md border bg-background text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isOverLimit && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {localValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Wyczyść"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {showCharCount && (
        <span className={cn("text-xs text-muted-foreground", isOverLimit && "text-destructive")}>
          {localValue.length} / {maxLength}
        </span>
      )}
    </div>
  );
}
