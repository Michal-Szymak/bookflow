import { X, Search, UserPlus } from "lucide-react";
import { useState, useEffect, useRef } from "react";
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
  const resetSearchRef = useRef<(() => void) | null>(null);
  const resetFormRef = useRef<(() => void) | null>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Reset tab and form state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab("search");
      // Reset search and form state
      resetSearchRef.current?.();
      resetFormRef.current?.();
    }
  }, [isOpen]);

  // Focus management: focus on search input when modal opens and search tab is active
  useEffect(() => {
    if (isOpen && activeTab === "search" && searchInputRef.current) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab]);

  // Focus trap: prevent focus from leaving modal
  useEffect(() => {
    if (!isOpen || !modalContentRef.current) return;

    const modal = modalContentRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener("keydown", handleTabKey);
    return () => modal.removeEventListener("keydown", handleTabKey);
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
      <div
        ref={modalContentRef}
        className="relative bg-background border rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col"
      >
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
        <div className="flex items-center gap-1 px-6 pt-4 border-b" role="tablist" aria-label="Tryby dodawania autora">
          <button
            id="search-tab"
            type="button"
            onClick={() => setActiveTab("search")}
            aria-selected={activeTab === "search"}
            aria-controls="search-tab-panel"
            role="tab"
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md transition-colors",
              "hover:bg-accent/50",
              activeTab === "search" ? "bg-background border-t border-x border-b-0 -mb-px" : "text-muted-foreground"
            )}
          >
            <Search className="size-4" aria-hidden="true" />
            <span>Szukaj w OpenLibrary</span>
          </button>
          <button
            id="manual-tab"
            type="button"
            onClick={() => setActiveTab("manual")}
            aria-selected={activeTab === "manual"}
            aria-controls="manual-tab-panel"
            role="tab"
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md transition-colors",
              "hover:bg-accent/50",
              activeTab === "manual" ? "bg-background border-t border-x border-b-0 -mb-px" : "text-muted-foreground"
            )}
          >
            <UserPlus className="size-4" aria-hidden="true" />
            <span>Dodaj ręcznie</span>
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "search" && (
            <div id="search-tab-panel" role="tabpanel" aria-labelledby="search-tab">
              <AuthorSearchTab
                onAuthorAdded={onAuthorAdded}
                onResetRef={(reset) => (resetSearchRef.current = reset)}
                searchInputRef={searchInputRef}
              />
            </div>
          )}
          {activeTab === "manual" && (
            <div id="manual-tab-panel" role="tabpanel" aria-labelledby="manual-tab">
              <ManualAuthorTab onAuthorAdded={onAuthorAdded} onResetRef={(reset) => (resetFormRef.current = reset)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
