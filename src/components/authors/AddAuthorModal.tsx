import { X, Search, UserPlus } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AuthorSearchTab } from "./AuthorSearchTab";
import { ManualAuthorTab } from "./ManualAuthorTab";
import { cn } from "@/lib/utils";

export interface AddAuthorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorAdded: () => void;
}

type TabType = "search" | "manual";

/**
 * Modal for adding authors with two tabs:
 * - Search in OpenLibrary
 * - Add manually
 */
export function AddAuthorModal({ isOpen, onClose, onAuthorAdded }: AddAuthorModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("search");

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Reset tab when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab("search");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} role="presentation" />

      {/* Modal content */}
      <div className="relative bg-background border rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 id="modal-title" className="text-xl font-semibold">
            Dodaj autora
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0" aria-label="Zamknij">
            <X className="size-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-4 border-b">
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md transition-colors",
              "hover:bg-accent/50",
              activeTab === "search" ? "bg-background border-t border-x border-b-0 -mb-px" : "text-muted-foreground"
            )}
          >
            <Search className="size-4" />
            <span>Szukaj w OpenLibrary</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md transition-colors",
              "hover:bg-accent/50",
              activeTab === "manual" ? "bg-background border-t border-x border-b-0 -mb-px" : "text-muted-foreground"
            )}
          >
            <UserPlus className="size-4" />
            <span>Dodaj ręcznie</span>
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "search" && <AuthorSearchTab onAuthorAdded={onAuthorAdded} />}
          {activeTab === "manual" && <ManualAuthorTab onAuthorAdded={onAuthorAdded} />}
        </div>
      </div>
    </div>
  );
}
