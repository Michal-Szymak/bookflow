import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AddAuthorButtonProps {
  onClick: () => void;
  isDisabled: boolean;
  disabledReason?: string;
  className?: string;
}

/**
 * CTA button to open AddAuthorModal.
 * Disabled when user has reached the author limit.
 * Shows tooltip with reason when disabled.
 */
export function AddAuthorButton({
  onClick,
  isDisabled,
  disabledReason = "Osiągnięto limit autorów",
  className,
}: AddAuthorButtonProps) {
  return (
    <div className={cn("relative group", className)}>
      <Button onClick={onClick} disabled={isDisabled} size="default" className="gap-2">
        <Plus className="size-4" />
        <span>Dodaj autora</span>
      </Button>

      {/* Tooltip on hover when disabled */}
      {isDisabled && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-sm rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          {disabledReason}
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-4 border-transparent border-t-popover" />
          </div>
        </div>
      )}
    </div>
  );
}
