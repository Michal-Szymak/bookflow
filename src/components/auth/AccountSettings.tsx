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
 */
export function AccountSettings({ userEmail }: AccountSettingsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

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
        <Button onClick={handleLogout} disabled={isLoggingOut} variant="outline" className="w-full sm:w-auto">
          {isLoggingOut ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Wylogowywanie...
            </>
          ) : (
            <>
              <LogOut className="h-4 w-4" />
              Wyloguj
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
        <Button onClick={handleDeleteClick} variant="destructive" className="w-full sm:w-auto">
          <Trash2 className="h-4 w-4" />
          Usuń konto
        </Button>
      </div>

      <DeleteAccountDialog isOpen={isDeleteDialogOpen} onClose={handleDeleteCancel} />
    </div>
  );
}
