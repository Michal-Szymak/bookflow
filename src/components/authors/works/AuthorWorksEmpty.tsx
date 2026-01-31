import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

interface AuthorWorksEmptyProps {
  onManualAdd?: () => void;
  className?: string;
}

export function AuthorWorksEmpty({ onManualAdd, className }: AuthorWorksEmptyProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 rounded-lg border p-8 text-center ${className || ""}`}
    >
      <BookOpen className="h-12 w-12 text-muted-foreground" />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Brak prac</h3>
        <p className="text-muted-foreground">Ten autor nie ma jeszcze żadnych prac</p>
      </div>
      {onManualAdd && (
        <Button onClick={onManualAdd} variant="outline">
          Dodaj ręcznie
        </Button>
      )}
    </div>
  );
}
