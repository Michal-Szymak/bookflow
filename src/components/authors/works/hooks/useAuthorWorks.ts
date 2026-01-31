import { useState, useEffect, useMemo, useCallback } from "react";
import { useUrlSearchParams } from "@/lib/hooks/useUrlSearchParams";
import { logger } from "@/lib/logger";
import type {
  AuthorDto,
  WorkListItemDto,
  AuthorWorksListResponseDto,
  AuthorResponseDto,
  ProfileResponseDto,
  BulkAttachUserWorksResponseDto,
  UserWorkStatus,
} from "@/types";

interface AuthorWorksFilters {
  page: number; // domyślnie 1
  sort: "published_desc" | "title_asc"; // domyślnie "published_desc"
}

interface UseAuthorWorksReturn {
  // Dane
  author: AuthorDto | null;
  works: WorkListItemDto[];
  total: number;
  profile: ProfileResponseDto | null;
  limitStatus: {
    current: number;
    max: number;
    isAtLimit: boolean;
    remaining: number;
  } | null;

  // Stan UI
  isLoading: boolean;
  isLoadingAuthor: boolean;
  isLoadingWorks: boolean;
  error: string | null;

  // Selekcja
  selectedWorkIds: Set<string>;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  userWorkIds: Set<string>;

  // Filtry
  filters: AuthorWorksFilters;

  // Akcje
  setPage: (page: number) => void;
  setSort: (sort: "published_desc" | "title_asc") => void;
  toggleWork: (workId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  fetchWorks: (forceRefresh?: boolean) => Promise<void>;
  bulkAddWorks: (workIds: string[], status?: UserWorkStatus) => Promise<BulkAttachUserWorksResponseDto>;
  refreshProfile: () => Promise<void>;
}

export function useAuthorWorks(
  authorId: string,
  initialPage?: number,
  initialSort?: "published_desc" | "title_asc"
): UseAuthorWorksReturn {
  // Stan danych
  const [author, setAuthor] = useState<AuthorDto | null>(null);
  const [works, setWorks] = useState<WorkListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [profile, setProfile] = useState<ProfileResponseDto | null>(null);
  const [userWorkIds, setUserWorkIds] = useState<Set<string>>(new Set());

  // Stan UI
  const [isLoadingAuthor, setIsLoadingAuthor] = useState(true);
  const [isLoadingWorks, setIsLoadingWorks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selekcja (per strona)
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set());

  // Filtry z URL
  const [searchParams, setSearchParams] = useUrlSearchParams();
  const filters: AuthorWorksFilters = {
    page: initialPage ?? parseInt(searchParams.get("page") || "1", 10),
    sort: initialSort ?? ((searchParams.get("sort") as "published_desc" | "title_asc") || "published_desc"),
  };

  // Obliczony limit status
  const limitStatus = useMemo(() => {
    if (!profile) return null;
    return {
      current: profile.work_count,
      max: profile.max_works,
      isAtLimit: profile.work_count >= profile.max_works,
      remaining: profile.max_works - profile.work_count,
    };
  }, [profile]);

  // Funkcje do zmiany filtrów (aktualizują URL)
  const setPage = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    if (page > 1) {
      newParams.set("page", page.toString());
    } else {
      newParams.delete("page");
    }
    setSearchParams(newParams);
    // Czyszczenie selekcji przy zmianie strony
    setSelectedWorkIds(new Set());
  };

  const setSort = (sort: "published_desc" | "title_asc") => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("sort", sort);
    newParams.delete("page"); // reset do pierwszej strony
    setSearchParams(newParams);
    // Czyszczenie selekcji przy zmianie sortu
    setSelectedWorkIds(new Set());
  };

  // Funkcje selekcji
  const toggleWork = (workId: string) => {
    setSelectedWorkIds((prev) => {
      const next = new Set(prev);
      if (next.has(workId)) {
        next.delete(workId);
      } else {
        next.add(workId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedWorkIds(new Set(works.map((w) => w.id)));
  };

  const deselectAll = () => {
    setSelectedWorkIds(new Set());
  };

  const isAllSelected = selectedWorkIds.size === works.length && works.length > 0;
  const isIndeterminate = selectedWorkIds.size > 0 && selectedWorkIds.size < works.length;

  // Funkcje API
  const fetchAuthor = useCallback(async () => {
    setIsLoadingAuthor(true);
    setError(null);
    try {
      const response = await fetch(`/api/authors/${authorId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Autor nie został znaleziony");
        }
        throw new Error("Nie udało się pobrać danych autora");
      }
      const data: AuthorResponseDto = await response.json();
      setAuthor(data.author);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd");
    } finally {
      setIsLoadingAuthor(false);
    }
  }, [authorId]);

  const fetchWorks = useCallback(
    async (forceRefresh = false) => {
      setIsLoadingWorks(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: filters.page.toString(),
          sort: filters.sort,
        });
        if (forceRefresh) {
          params.set("forceRefresh", "true");
        }
        const response = await fetch(`/api/authors/${authorId}/works?${params}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Autor nie został znaleziony");
          }
          if (response.status === 502) {
            throw new Error("OpenLibrary jest tymczasowo niedostępne. Spróbuj ponownie później.");
          }
          throw new Error("Nie udało się pobrać listy prac");
        }
        const data: AuthorWorksListResponseDto = await response.json();
        setWorks(data.items);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Wystąpił błąd");
      } finally {
        setIsLoadingWorks(false);
      }
    },
    [authorId, filters.page, filters.sort]
  );

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/user/profile");
      if (response.ok) {
        const data: ProfileResponseDto = await response.json();
        setProfile(data);
      }
    } catch (err) {
      // Nie pokazujemy błędu dla profilu, tylko logujemy
      logger.error("Failed to fetch profile:", err);
    }
  }, []);

  const fetchUserWorkIds = useCallback(async () => {
    try {
      // Pobierz tylko pierwszą stronę, aby sprawdzić które works są w profilu
      // W przyszłości można zoptymalizować przez dedykowany endpoint
      const response = await fetch("/api/user/works?page=1&page_size=1000");
      if (response.ok) {
        const data = await response.json();
        const workIds = new Set<string>(data.items.map((item: { work: { id: string } }) => item.work.id));
        setUserWorkIds(workIds);
      }
    } catch (err) {
      // Nie pokazujemy błędu, tylko logujemy
      logger.error("Failed to fetch user work IDs:", err);
    }
  }, []);

  const bulkAddWorks = async (
    workIds: string[],
    status: UserWorkStatus = "to_read"
  ): Promise<BulkAttachUserWorksResponseDto> => {
    // Pre-check limitu
    if (limitStatus?.isAtLimit) {
      throw new Error(`Osiągnięto limit książek (${limitStatus.max} książek na użytkownika)`);
    }

    if (limitStatus && limitStatus.current + workIds.length > limitStatus.max) {
      throw new Error(`Nie można dodać ${workIds.length} książek. Pozostało miejsca: ${limitStatus.remaining}`);
    }

    const response = await fetch("/api/user/works/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ work_ids: workIds, status }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Musisz być zalogowany, aby dodać książki");
      }
      if (response.status === 409) {
        throw new Error("Osiągnięto limit książek (5000 książek na użytkownika)");
      }
      if (response.status === 403) {
        throw new Error("Nie masz uprawnień do dodania tych książek");
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Nie udało się dodać książek");
    }

    const data: BulkAttachUserWorksResponseDto = await response.json();

    // Czyszczenie selekcji po sukcesie
    setSelectedWorkIds(new Set());

    // Odświeżenie profilu (aktualizacja licznika)
    await fetchProfile();

    // Odświeżenie listy work IDs w profilu
    await fetchUserWorkIds();

    return data;
  };

  // Effects
  useEffect(() => {
    fetchAuthor();
    fetchProfile();
    fetchUserWorkIds();
  }, [fetchAuthor, fetchProfile, fetchUserWorkIds]);

  useEffect(() => {
    fetchWorks();
  }, [fetchWorks]);

  return {
    // Dane
    author,
    works,
    total,
    profile,
    limitStatus,

    // Stan UI
    isLoading: isLoadingAuthor || isLoadingWorks,
    isLoadingAuthor,
    isLoadingWorks,
    error,

    // Selekcja
    selectedWorkIds,
    isAllSelected,
    isIndeterminate,
    userWorkIds,

    // Filtry
    filters,

    // Akcje
    setPage,
    setSort,
    toggleWork,
    selectAll,
    deselectAll,
    fetchWorks,
    bulkAddWorks,
    refreshProfile: fetchProfile,
  };
}
