import { useState, type FormEvent, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordInput } from "@/components/ui/password-input";
import { LoginSchema } from "@/lib/validation/auth/login.schema";
import { AlertCircle, Loader2 } from "lucide-react";

/**
 * Login form component with email and password fields.
 * Handles validation, API calls, and error display.
 */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setEmailError(null);
    setPasswordError(null);

    // Client-side validation
    const validation = LoginSchema.safeParse({ email, password });
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

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        await response.json(); // Read response body to avoid memory leak
        if (response.status === 400) {
          setError("Błędne dane. Sprawdź wprowadzone informacje.");
        } else if (response.status === 401) {
          setError("Nieprawidłowy e-mail lub hasło");
        } else {
          setError("Wystąpił błąd. Spróbuj ponownie później.");
        }
        setIsLoading(false);
        return;
      }

      // Success - redirect will be handled by backend or client-side navigation
      window.location.href = new URLSearchParams(window.location.search).get("redirect_to") || "/app/authors";
    } catch {
      setError("Wystąpił błąd. Spróbuj ponownie później.");
      setIsLoading(false);
    }
  };

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
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Logowanie...
          </>
        ) : (
          "Zaloguj się"
        )}
      </Button>

      <div className="text-center space-y-2 text-sm">
        <a href="/forgot-password" className="text-primary hover:underline">
          Zapomniałeś hasła?
        </a>
        <p className="text-muted-foreground">
          Nie masz konta?{" "}
          <a href="/register" className="text-primary hover:underline">
            Zarejestruj się
          </a>
        </p>
      </div>
    </form>
  );
}
