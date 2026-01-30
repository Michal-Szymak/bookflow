import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook for managing URL search parameters in Astro with React.
 * Provides a similar API to react-router-dom's useSearchParams but works
 * with standard Web APIs (window.location and history API).
 *
 * @returns Tuple of [searchParams, setSearchParams] similar to useState
 *
 * @example
 * const [searchParams, setSearchParams] = useUrlSearchParams();
 * const page = searchParams.get('page') || '1';
 *
 * const updatePage = (newPage: number) => {
 *   const newParams = new URLSearchParams(searchParams);
 *   newParams.set('page', newPage.toString());
 *   setSearchParams(newParams);
 * };
 */
export function useUrlSearchParams(): [URLSearchParams, (params: URLSearchParams) => void] {
  // Initialize from current URL
  const [searchParams, setSearchParamsState] = useState<URLSearchParams>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  });

  /**
   * Update URL search params and browser history.
   * Uses pushState to update URL without page reload.
   */
  const setSearchParams = useCallback((params: URLSearchParams) => {
    if (typeof window === "undefined") return;

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", newUrl);

    // Update state to trigger re-render
    setSearchParamsState(new URLSearchParams(params));
  }, []);

  /**
   * Listen to browser back/forward navigation.
   * Updates state when user navigates using browser buttons.
   */
  useEffect(() => {
    const handlePopState = () => {
      setSearchParamsState(new URLSearchParams(window.location.search));
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return [searchParams, setSearchParams];
}
