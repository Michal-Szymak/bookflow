import { useState, type ChangeEvent } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

export interface DeleteAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const CONFIRM_TEXT = "USUŃ";

/**
 * Dialog component for account deletion confirmation.
 * Requires user to type confirmation text before allowing deletion.
 */
export function DeleteAccountDialog({ isOpen, onClose }: DeleteAccountDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirmTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    setConfirmText(e.target.value);
    setError(null);
  };

  const handleConfirm = async () => {
    if (confirmText !== CONFIRM_TEXT) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Backend will validate session from cookie/header
      const response = await fetch("/api/user/account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for session
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError("Sesja wygasła. Zaloguj się ponownie.");
        } else {
          setError("Wystąpił błąd podczas usuwania konta. Spróbuj ponownie później.");
        }
        setIsLoading(false);
        return;
      }

      // Success - redirect to login
      window.location.href = "/login";
    } catch {
      setError("Wystąpił błąd podczas usuwania konta. Spróbuj ponownie później.");
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setConfirmText("");
    setError(null);
    onClose();
  };

  const canConfirm = confirmText === CONFIRM_TEXT && !isLoading;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usuń konto</AlertDialogTitle>
          <AlertDialogDescription>
            Ta operacja jest nieodwracalna. Wszystkie Twoje dane, w tym autorzy, książki i ustawienia, zostaną trwale
            usunięte.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="confirm-delete">
            Aby potwierdzić, wpisz <strong>{CONFIRM_TEXT}</strong> poniżej:
          </Label>
          <Input
            id="confirm-delete"
            type="text"
            value={confirmText}
            onChange={handleConfirmTextChange}
            placeholder={CONFIRM_TEXT}
            disabled={isLoading}
            className="uppercase"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            Anuluj
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={!canConfirm} variant="destructive">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Usuwanie...
              </>
            ) : (
              "Usuń konto"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
