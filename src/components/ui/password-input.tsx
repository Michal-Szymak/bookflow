import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends Omit<React.ComponentProps<typeof Input>, "type"> {
  showPasswordToggle?: boolean;
}

/**
 * Password input component with optional show/hide password toggle.
 * Integrates with Shadcn/ui Input component.
 */
export function PasswordInput({ className, showPasswordToggle = true, ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="relative">
      <Input type={showPassword ? "text" : "password"} className={cn("pr-10", className)} {...props} />
      {showPasswordToggle && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      )}
    </div>
  );
}
