import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  exact?: boolean; // Whether the link must exactly match the path
}

const navItems: NavItem[] = [
  { href: "/app/authors", label: "Autorzy", exact: false },
  { href: "/app/books", label: "Książki", exact: false },
  { href: "/app/settings", label: "Ustawienia", exact: true },
];

/**
 * AppNavigation component renders top-level navigation with links to main app sections.
 * Detects active path based on window.location.pathname and highlights active link.
 */
export function AppNavigation() {
  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.pathname : ""
  );

  useEffect(() => {
    // Update path on initial load
    const updatePath = () => {
      if (typeof window !== "undefined") {
        setCurrentPath(window.location.pathname);
      }
    };

    // Listen to popstate (back/forward navigation)
    window.addEventListener("popstate", updatePath);

    // For programmatic navigation, we might need to check periodically
    // or listen to custom events, but for now popstate should be sufficient
    // since Astro uses full page reloads for navigation

    return () => {
      window.removeEventListener("popstate", updatePath);
    };
  }, []);

  const isActive = (item: NavItem): boolean => {
    if (!currentPath.startsWith("/app/")) {
      return false;
    }

    if (item.exact) {
      return currentPath === item.href;
    }

    // For non-exact matches, check if path starts with href
    return currentPath.startsWith(item.href);
  };

  return (
    <nav aria-label="Główna nawigacja" className="flex items-center gap-1">
      {navItems.map((item) => {
        const active = isActive(item);
        return (
          <a
            key={item.href}
            href={item.href}
            className={cn(
              "px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground"
            )}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
