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
 * Requires user to type confirmation text "USUŃ" before allowing deletion.
 *
 * Features:
 * - Confirmation text validation (case-sensitive, must be exactly "USUŃ")
 * - Error handling for 401 (session expired) and 500 (server error)
 * - Network error handling
 * - Automatic redirect to login on successful deletion
 *
 * Security:
 * - Requires explicit confirmation text to prevent accidental deletion
 * - Session validation handled by backend API
 * - All user data is permanently deleted via cascade (profiles, user_authors, user_works, etc.)
 *
 * @param isOpen - Controls dialog visibility
 * @param onClose - Callback invoked when dialog is closed (cancel or outside click)
 *
 * @example
 * ```tsx
 * <DeleteAccountDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />
 * ```
 */
export function DeleteAccountDialog({ isOpen, onClose }: DeleteAccountDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirmTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    setConfirmText(e.target.value);
    setError(null);
  };

  /**
   * Handles account deletion confirmation.
   * Validates confirmation text, calls DELETE API, and handles errors.
   *
   * Error scenarios:
   * - 401 Unauthorized: Session expired, user needs to log in again
   * - 500 Internal Server Error: Server error, user can try again later
   * - Network error: Connection issue, user can try again later
   *
   * On success (204 No Content), redirects to login page.
   * All user data is permanently deleted via database cascade.
   */
  const handleConfirm = async () => {
    // Guard clause: ensure confirmation text matches exactly
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
        credentials: "include", // Include cookies for session authentication
      });

      if (!response.ok) {
        // Handle different error status codes
        if (response.status === 401) {
          setError("Sesja wygasła. Zaloguj się ponownie.");
        } else {
          // 500 or other server errors
          setError("Wystąpił błąd podczas usuwania konta. Spróbuj ponownie później.");
        }
        setIsLoading(false);
        return;
      }

      // Success (204 No Content) - redirect to login
      // Note: 204 is in the 200-299 range, so response.ok is true
      window.location.href = "/login";
    } catch {
      // Network error or other exception
      setError("Wystąpił błąd podczas usuwania konta. Spróbuj ponownie później.");
      setIsLoading(false);
    }
  };

  /**
   * Handles dialog cancellation.
   * Resets form state (confirmation text and error) and closes dialog.
   */
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
          <Alert variant="destructive" role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
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
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canConfirm}
            variant="destructive"
            aria-label={isLoading ? "Usuwanie konta..." : "Usuń konto"}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Usuwanie...</span>
              </>
            ) : (
              <span>Usuń konto</span>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
