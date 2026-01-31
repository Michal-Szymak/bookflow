import { useState, type FormEvent, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordInput } from "@/components/ui/password-input";
import { RegisterSchema } from "@/lib/validation/auth/register.schema";
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

/**
 * Registration form component with email, password, and password confirmation fields.
 * Handles validation, API calls, and error display.
 * Shows email confirmation message when required by Supabase.
 */
export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [requiresEmailConfirmation, setRequiresEmailConfirmation] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(null);
    setError(null);
  };

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
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    setRequiresEmailConfirmation(false);
    setRegisteredEmail(null);

    // Client-side validation
    const validation = RegisterSchema.safeParse({ email, password });
    if (!validation.success) {
      const errors = validation.error.errors;
      errors.forEach((err) => {
        if (err.path[0] === "email") {
          setEmailError(err.message);
        } else if (err.path[0] === "password") {
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
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        let errorMessage = "Wystąpił błąd. Spróbuj ponownie później.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If JSON parsing fails, use default message based on status
          if (response.status === 400) {
            errorMessage = "Błędne dane. Sprawdź wprowadzone informacje.";
          } else if (response.status === 409) {
            errorMessage = "Konto z tym e-mailem już istnieje";
          }
        }
        setError(errorMessage);
        setIsLoading(false);
        return;
      }

      // Success - parse response to check if email confirmation is required
      const data = await response.json();
      const needsConfirmation = data.requiresEmailConfirmation === true;

      if (needsConfirmation) {
        // Show email confirmation message
        setRequiresEmailConfirmation(true);
        setRegisteredEmail(email);
        // Clear form
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      } else {
        // No email confirmation required - redirect to app
        window.location.href = "/app/authors";
      }
      setIsLoading(false);
    } catch {
      setError("Wystąpił błąd. Spróbuj ponownie później.");
      setIsLoading(false);
    }
  };

  // Show success message if email confirmation is required
  if (requiresEmailConfirmation && registeredEmail) {
    return (
      <div className="space-y-4">
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Rejestracja zakończona pomyślnie!</p>
              <p className="text-sm">
                Na adres <strong>{registeredEmail}</strong> został wysłany link do potwierdzenia konta. Sprawdź swoją
                skrzynkę pocztową i kliknij w link, aby aktywować konto.
              </p>
              <p className="text-sm text-muted-foreground">Po potwierdzeniu konta będziesz mógł się zalogować.</p>
            </div>
          </AlertDescription>
        </Alert>
        <div className="text-center">
          <a href="/login" className="text-primary hover:underline text-sm">
            Przejdź do logowania
          </a>
        </div>
      </div>
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
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="twoj@email.pl"
          disabled={isLoading}
          aria-invalid={!!emailError}
          aria-describedby={emailError ? "email-error" : undefined}
        />
        {emailError && (
          <p id="email-error" className="text-xs text-destructive">
            {emailError}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Hasło</Label>
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
        <Label htmlFor="confirm-password">Potwierdź hasło</Label>
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

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Rejestrowanie...
          </>
        ) : (
          "Zarejestruj się"
        )}
      </Button>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Masz już konto?{" "}
          <a href="/login" className="text-primary hover:underline">
            Zaloguj się
          </a>
        </p>
      </div>
    </form>
  );
}
