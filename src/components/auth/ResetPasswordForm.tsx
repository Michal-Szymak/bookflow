import { useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordInput } from "@/components/ui/password-input";
import { ResetPasswordSchema } from "@/lib/validation/auth/reset-password.schema";
import { AlertCircle, Loader2 } from "lucide-react";

/**
 * Reset password form component with password and password confirmation fields.
 * Handles token validation from URL, validation, API calls, and error display.
 */
export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    // Extract token from URL query parameters
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    const type = params.get("type");

    if (!urlToken || type !== "recovery") {
      setTokenError("Nieprawidłowy link. Sprawdź czy link jest kompletny.");
      return;
    }

    setToken(urlToken);
  }, []);

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordError(null);
    setError(null);
    // Clear confirm password error if passwords match
    if (confirmPassword && value === confirmPassword) {
      setConfirmPasswordError(null);
    }
  };

  const handleConfirmPasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    setConfirmPasswordError(null);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);

    if (!token) {
      setTokenError("Token jest wymagany");
      return;
    }

    // Client-side validation
    const validation = ResetPasswordSchema.safeParse({ token, password });
    if (!validation.success) {
      const errors = validation.error.errors;
      errors.forEach((err) => {
        if (err.path[0] === "password") {
          setPasswordError(err.message);
        }
      });
      return;
    }

    // Check password confirmation
    if (password !== confirmPassword) {
      setConfirmPasswordError("Hasła nie są identyczne");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        await response.json(); // Read response body to avoid memory leak
        if (response.status === 400) {
          setError("Błędne dane lub nieprawidłowy token");
        } else if (response.status === 401) {
          setError("Token wygasł lub jest nieprawidłowy. Wyślij nowy link do resetu hasła.");
        } else {
          setError("Wystąpił błąd. Spróbuj ponownie później.");
        }
        setIsLoading(false);
        return;
      }

      // Success - redirect will be handled by backend or client-side navigation
      window.location.href = "/app/authors";
    } catch {
      setError("Wystąpił błąd. Spróbuj ponownie później.");
      setIsLoading(false);
    }
  };

  if (tokenError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{tokenError}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">Nowe hasło</Label>
        <PasswordInput
          id="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="••••••••"
          disabled={isLoading}
          aria-invalid={!!passwordError}
          aria-describedby={passwordError ? "password-error" : undefined}
        />
        {passwordError && (
          <p id="password-error" className="text-xs text-destructive">
            {passwordError}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Hasło musi mieć minimum 6 znaków</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Potwierdź nowe hasło</Label>
        <PasswordInput
          id="confirm-password"
          value={confirmPassword}
          onChange={handleConfirmPasswordChange}
          placeholder="••••••••"
          disabled={isLoading}
          aria-invalid={!!confirmPasswordError}
          aria-describedby={confirmPasswordError ? "confirm-password-error" : undefined}
        />
        {confirmPasswordError && (
          <p id="confirm-password-error" className="text-xs text-destructive">
            {confirmPasswordError}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading || !token}>
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Resetowanie hasła...
          </>
        ) : (
          "Zresetuj hasło"
        )}
      </Button>

      <div className="text-center">
        <a href="/login" className="text-sm text-primary hover:underline">
          Powrót do logowania
        </a>
      </div>
    </form>
  );
}
