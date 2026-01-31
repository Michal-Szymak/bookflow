import { useState } from "react";
import { toast } from "sonner";
import type { CreateAuthorCommand, AttachUserAuthorCommand, AuthorResponseDto } from "@/types";

/**
 * Hook for managing manual author creation in AddAuthorModal.
 * Handles form state, validation, and author creation/attach flow.
 *
 * @param onAuthorAdded - Callback function called after successfully adding an author
 * @returns Manual author state and action handlers
 */
export function useManualAuthor(onAuthorAdded: () => void) {
  // ============================================================================
  // STATE - Form
  // ============================================================================
  const [name, setName] = useState("");

  // ============================================================================
  // STATE - Creating author
  // ============================================================================
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * Validate author name.
   * @returns Error message if invalid, null if valid
   */
  const validateName = (value: string): string | null => {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return "Nazwa autora jest wymagana";
    }

    if (trimmed.length > 500) {
      return "Nazwa autora nie może przekraczać 500 znaków";
    }

    return null;
  };

  // ============================================================================
  // CREATE MANUAL AUTHOR FUNCTION
  // ============================================================================

  /**
   * Create a manual author and attach to user's profile.
   * Validates input, creates author, then attaches it.
   */
  const createManualAuthor = async () => {
    const trimmedName = name.trim();

    // Validate
    const validationError = validateName(trimmedName);
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      // Step 1: Create manual author
      const createCommand: CreateAuthorCommand = {
        name: trimmedName,
        manual: true,
      };

      const createResponse = await fetch("/api/authors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createCommand),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();

        if (createResponse.status === 400) {
          const errorMsg = errorData.message || "Niepoprawna nazwa autora";
          toast.error(errorMsg);
          throw new Error(errorMsg);
        }

        if (createResponse.status === 409) {
          if (errorData.message?.includes("limit")) {
            const errorMsg = "Osiągnięto limit 500 autorów";
            toast.error(errorMsg);
            throw new Error(errorMsg);
          }
        }

        const errorMsg = "Nie udało się utworzyć autora";
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      const createData: AuthorResponseDto = await createResponse.json();
      const authorId = createData.author.id;

      // Step 2: Attach author to user's profile
      const attachCommand: AttachUserAuthorCommand = {
        author_id: authorId,
      };

      const attachResponse = await fetch("/api/user/authors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(attachCommand),
      });

      if (!attachResponse.ok) {
        const errorData = await attachResponse.json();

        if (attachResponse.status === 409) {
          if (errorData.message.includes("limit")) {
            const errorMsg = "Osiągnięto limit 500 autorów";
            toast.error(errorMsg);
            throw new Error(errorMsg);
          }
          if (errorData.message.includes("already attached")) {
            const errorMsg = "Autor jest już w Twoim profilu";
            toast.error(errorMsg);
            throw new Error(errorMsg);
          }
        }

        if (attachResponse.status === 429) {
          const errorMsg = "Dodano zbyt wielu autorów. Odczekaj 60 sekund.";
          toast.error(errorMsg);
          throw new Error(errorMsg);
        }

        const errorMsg = "Nie udało się dodać autora";
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Success - call callback to refresh list
      toast.success("Autor został dodany do profilu");
      onAuthorAdded();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Wystąpił błąd");
      throw err; // Re-throw so component can handle toast
    } finally {
      setIsCreating(false);
    }
  };

  // ============================================================================
  // RESET FUNCTION
  // ============================================================================

  /**
   * Reset form state (called when modal closes).
   */
  const resetForm = () => {
    setName("");
    setCreateError(null);
  };

  // ============================================================================
  // RETURN VALUES
  // ============================================================================

  return {
    // Form state
    name,
    setName,

    // Creation state
    isCreating,
    createError,

    // Actions
    createManualAuthor,
    resetForm,
    validateName,
  };
}
