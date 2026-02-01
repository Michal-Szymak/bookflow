import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { Loader2, LogOut, Trash2, AlertTriangle } from "lucide-react";

export interface AccountSettingsProps {
  userEmail?: string;
}

/**
 * Account settings component displaying user account information,
 * logout button, and account deletion section.
 *
 * Features:
 * - Displays user email address
 * - Logout functionality with error handling
 * - Account deletion dialog with confirmation requirement
 *
 * @param userEmail - Optional user email address from server-side session
 *
 * @example
 * ```tsx
 * <AccountSettings userEmail="user@example.com" />
 * ```
 */
export function AccountSettings({ userEmail }: AccountSettingsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  /**
   * Handles user logout by calling the logout API endpoint.
   * On success, redirects to login page. On error, displays error message.
   *
   * Error handling:
   * - Network errors: displays generic error message
   * - API errors (non-200 status): displays error message
   * - Even on error, user might be logged out (session invalid), but we show error for transparency
   */
  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        setLogoutError("Wystąpił błąd podczas wylogowania. Spróbuj ponownie.");
        setIsLoggingOut(false);
        return;
      }

      // Success - redirect to login
      window.location.href = "/login";
    } catch {
      // Network error or other exception
      setLogoutError("Wystąpił błąd podczas wylogowania. Spróbuj ponownie.");
      setIsLoggingOut(false);
    }
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Account Information Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Konto</h2>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">E-mail</p>
          <p className="text-sm">{userEmail || "Ładowanie..."}</p>
        </div>
        <Button
          onClick={handleLogout}
          disabled={isLoggingOut}
          variant="outline"
          className="w-full sm:w-auto"
          aria-label={isLoggingOut ? "Wylogowywanie..." : "Wyloguj się"}
        >
          {isLoggingOut ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Wylogowywanie...</span>
            </>
          ) : (
            <>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Wyloguj</span>
            </>
          )}
        </Button>
        {logoutError && (
          <Alert variant="destructive">
            <AlertDescription>{logoutError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Delete Account Section */}
      <div className="space-y-4 border-t pt-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-destructive">Usuń konto</h2>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Usunięcie konta jest operacją nieodwracalną. Wszystkie Twoje dane, w tym autorzy, książki i ustawienia,
              zostaną trwale usunięte.
            </AlertDescription>
          </Alert>
        </div>
        <Button onClick={handleDeleteClick} variant="destructive" className="w-full sm:w-auto" aria-label="Usuń konto">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span>Usuń konto</span>
        </Button>
      </div>

      <DeleteAccountDialog isOpen={isDeleteDialogOpen} onClose={handleDeleteCancel} />
    </div>
  );
}
