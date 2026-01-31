import { useState, type FormEvent, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ForgotPasswordSchema } from "@/lib/validation/auth/forgot-password.schema";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

/**
 * Forgot password form component with email field.
 * Handles validation, API calls, and success/error display.
 * Always shows success message for security reasons (even if email doesn't exist).
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(null);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setEmailError(null);

    // Client-side validation
    const validation = ForgotPasswordSchema.safeParse({ email });
    if (!validation.success) {
      const errors = validation.error.errors;
      errors.forEach((err) => {
        if (err.path[0] === "email") {
          setEmailError(err.message);
        }
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        if (response.status === 400) {
          setError("Błędny format e-mail");
        } else {
          setError("Wystąpił błąd. Spróbuj ponownie później.");
        }
        setIsLoading(false);
        return;
      }

      // Always show success message for security
      setIsSuccess(true);
      setIsLoading(false);
    } catch {
      setError("Wystąpił błąd. Spróbuj ponownie później.");
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-4">
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Jeśli konto z tym e-mailem istnieje, otrzymasz link do resetu hasła.</AlertDescription>
        </Alert>
        <div className="text-center">
          <a href="/login" className="text-sm text-primary hover:underline">
            Powrót do logowania
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
        <p className="text-xs text-muted-foreground">
          Wprowadź adres e-mail powiązany z Twoim kontem, a wyślemy Ci link do resetu hasła.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Wysyłanie...
          </>
        ) : (
          "Wyślij link resetu hasła"
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
