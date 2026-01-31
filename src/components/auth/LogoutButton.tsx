import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";

/**
 * Logout button component that handles user logout.
 * Calls the logout API endpoint and redirects to login page.
 */
export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        // Even if logout fails, redirect to login page
        // The session might be invalid anyway
        logger.error("LogoutButton: Logout failed, but redirecting to login", {
          status: response.status,
          statusText: response.statusText,
        });
      }

      // Small delay to ensure cookies are cleared before redirect
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Redirect to login page
      window.location.href = "/login";
    } catch (error) {
      // On error, still redirect to login page
      logger.error("LogoutButton: Logout error", error);
      window.location.href = "/login";
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleLogout}
      disabled={isLoading}
      aria-label="Wyloguj się"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="sr-only">Wylogowywanie...</span>
        </>
      ) : (
        <>
          <LogOut className="h-4 w-4" />
          <span>Wyloguj się</span>
        </>
      )}
    </Button>
  );
}
