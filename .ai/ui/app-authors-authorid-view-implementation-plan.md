# Plan implementacji widoku: Autor – works

## 1. Przegląd

Widok "Autor – works" (`/app/authors/:authorId`) wyświetla pełną listę prac (works) wybranego autora z możliwością masowego dodania książek do profilu użytkownika. Widok realizuje wymagania z US-005 (pobranie i sortowanie prac autora) oraz US-006 (dodanie książek autora hurtowo).

Główne funkcjonalności:
- Wyświetlanie listy works autora z danymi z primary edition (tytuł, okładka, język, ISBN, rok publikacji)
- Informacja o tym, czy dana książka jest już w profilu użytkownika
- Sortowanie po dacie publikacji (domyślnie od najnowszych) lub po tytule (A-Z)
- Paginacja (30 pozycji na stronę)
- Selekcja wielu pozycji za pomocą checkboxów
- Masowe dodanie zaznaczonych książek do profilu z domyślnym statusem "Do przeczytania"
- Obsługa błędów API (502 OpenLibrary, 409 limit książek, 404 autor nie znaleziony)
- Pre-check limitu 5000 książek przed bulk dodaniem

## 2. Routing widoku

**Ścieżka**: `/app/authors/:authorId`

**Plik**: `src/pages/app/authors/[authorId].astro`

**Parametry URL**:
- `authorId` (path parameter): UUID autora
- `page` (query parameter, opcjonalny): numer strony (domyślnie 1)
- `sort` (query parameter, opcjonalny): `published_desc` (domyślnie) lub `title_asc`

**Struktura pliku Astro**:
- Import `AppLayout`
- Odczyt `authorId` z `Astro.params`
- Odczyt parametrów query z `Astro.url.searchParams`
- Renderowanie React island `AuthorWorksView` z przekazanymi props

## 3. Struktura komponentów

```
AuthorWorksView (React island)
├── AuthorWorksHeader
│   └── Nazwa autora + breadcrumb
├── AuthorWorksToolbar
│   ├── SortSelect (published_desc / title_asc)
│   └── Opcjonalnie: przycisk "Odśwież" (forceRefresh)
├── AuthorWorksContent (warunkowe renderowanie)
│   ├── AuthorWorksSkeleton (loading)
│   ├── AuthorWorksError (błąd)
│   ├── AuthorWorksEmpty (brak works)
│   └── AuthorWorksTable (lista works)
│       ├── AuthorWorksTableHeader (checkbox "Zaznacz wszystkie" + kolumny)
│       └── AuthorWorksTableRow[] (wiersze z checkboxami)
│           └── WorkRowDetails (Accordion z szczegółami)
├── AuthorWorksPagination
└── AuthorWorksBulkToolbar (sticky, tylko gdy selectedCount > 0)
    ├── Licznik zaznaczonych
    ├── Przycisk "Dodaj zaznaczone"
    └── Opcjonalnie: Select statusu początkowego
```

## 4. Szczegóły komponentów

### 4.1. AuthorWorksView

**Opis**: Główny komponent React island zarządzający całym widokiem. Orkiestruje wszystkie podkomponenty i zarządza stanem.

**Główne elementy**:
- Hook `useAuthorWorks` do zarządzania stanem i logiką
- Renderowanie sekwencyjne: Header → Toolbar → Content → Pagination → BulkToolbar
- Obsługa modali i dialogów (jeśli potrzebne)

**Obsługiwane interakcje**:
- Zmiana sortowania → aktualizacja URL i odświeżenie danych
- Zmiana strony → aktualizacja URL i odświeżenie danych
- Zaznaczanie/odznaczanie checkboxów → aktualizacja lokalnego stanu selekcji
- Bulk dodanie → wywołanie API i aktualizacja UI

**Obsługiwana walidacja**:
- Walidacja `authorId` (UUID format) - po stronie API
- Walidacja parametrów query (page ≥ 1, sort enum) - po stronie API
- Pre-check limitu 5000 książek przed bulk dodaniem

**Typy**:
- `authorId: string` (z props)
- `initialPage?: number` (z URL)
- `initialSort?: "published_desc" | "title_asc"` (z URL)

**Propsy**:
```typescript
interface AuthorWorksViewProps {
  authorId: string;
  initialPage?: number;
  initialSort?: "published_desc" | "title_asc";
}
```

### 4.2. AuthorWorksHeader

**Opis**: Nagłówek widoku z nazwą autora i breadcrumb nawigacją.

**Główne elementy**:
- Breadcrumb: "Autorzy" → "Nazwa autora"
- Tytuł: "Prace: [Nazwa autora]"
- Opcjonalnie: link powrotu do `/app/authors`

**Obsługiwane interakcje**:
- Kliknięcie w breadcrumb "Autorzy" → nawigacja do `/app/authors`

**Obsługiwana walidacja**: Brak

**Typy**:
- `authorName: string`

**Propsy**:
```typescript
interface AuthorWorksHeaderProps {
  authorName: string;
}
```

### 4.3. AuthorWorksToolbar

**Opis**: Pasek narzędzi z kontrolkami sortowania i opcjonalnym przyciskiem odświeżania.

**Główne elementy**:
- `SortSelect` komponent (published_desc / title_asc)
- Opcjonalnie: przycisk "Odśwież dane" (tylko dla autorów z OpenLibrary)

**Obsługiwane interakcje**:
- Zmiana sortowania → wywołanie `onSortChange(sort)`
- Kliknięcie "Odśwież" → wywołanie `onForceRefresh()` z parametrem `forceRefresh=true`

**Obsługiwana walidacja**: Brak (walidacja po stronie API)

**Typy**:
- `sort: "published_desc" | "title_asc"`
- `hasOpenLibraryId: boolean` (czy autor ma openlibrary_id)
- `onSortChange: (sort: "published_desc" | "title_asc") => void`
- `onForceRefresh?: () => void`

**Propsy**:
```typescript
interface AuthorWorksToolbarProps {
  sort: "published_desc" | "title_asc";
  hasOpenLibraryId: boolean;
  onSortChange: (sort: "published_desc" | "title_asc") => void;
  onForceRefresh?: () => void;
}
```

### 4.4. AuthorWorksContent

**Opis**: Komponent warunkowego renderowania zawartości (loading, error, empty, table).

**Główne elementy**:
- Warunkowe renderowanie w zależności od stanu:
  - `isLoading` → `<AuthorWorksSkeleton />`
  - `error` → `<AuthorWorksError />`
  - `works.length === 0` → `<AuthorWorksEmpty />`
  - `works.length > 0` → `<AuthorWorksTable />`

**Obsługiwane interakcje**: Brak (deleguje do podkomponentów)

**Obsługiwana walidacja**: Brak

**Typy**:
- `isLoading: boolean`
- `error: string | null`
- `works: WorkListItemDto[]`
- `selectedWorkIds: Set<string>`
- `onWorkToggle: (workId: string) => void`
- `onSelectAll: () => void`
- `onDeselectAll: () => void`
- `isAllSelected: boolean`

**Propsy**:
```typescript
interface AuthorWorksContentProps {
  isLoading: boolean;
  error: string | null;
  works: WorkListItemDto[];
  selectedWorkIds: Set<string>;
  onWorkToggle: (workId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  isAllSelected: boolean;
  onRetry?: () => void;
}
```

### 4.5. AuthorWorksSkeleton

**Opis**: Placeholder loading state dla listy works.

**Główne elementy**:
- Skeleton UI (shimmer effect) z shadcn/ui
- 5-10 wierszy skeleton odpowiadających `AuthorWorksTableRow`

**Obsługiwane interakcje**: Brak (animowany placeholder)

**Obsługiwana walidacja**: Brak

**Typy**: Brak

**Propsy**:
```typescript
interface AuthorWorksSkeletonProps {
  count?: number;
  className?: string;
}
```

### 4.6. AuthorWorksError

**Opis**: Komponent wyświetlania błędów z opcją retry i fallback do ręcznego dodania.

**Główne elementy**:
- Ikona błędu
- Komunikat błędu (przyjazny dla użytkownika)
- Przycisk "Spróbuj ponownie"
- Opcjonalnie: przycisk "Dodaj ręcznie" (jeśli wspierane w MVP)

**Obsługiwane interakcje**:
- Kliknięcie "Spróbuj ponownie" → wywołanie `onRetry()`
- Kliknięcie "Dodaj ręcznie" → otwarcie modalu (jeśli wspierane)

**Obsługiwana walidacja**: Brak

**Typy**:
- `message: string`
- `onRetry?: () => void`
- `onManualAdd?: () => void`

**Propsy**:
```typescript
interface AuthorWorksErrorProps {
  message: string;
  onRetry?: () => void;
  onManualAdd?: () => void;
  className?: string;
}
```

### 4.7. AuthorWorksEmpty

**Opis**: Stan pusty gdy autor nie ma żadnych works.

**Główne elementy**:
- Ilustracja/ikona (pusta lista)
- Komunikat: "Ten autor nie ma jeszcze żadnych prac"
- Opcjonalnie: CTA "Dodaj ręcznie" (jeśli wspierane w MVP)

**Obsługiwane interakcje**:
- Kliknięcie "Dodaj ręcznie" → otwarcie modalu (jeśli wspierane)

**Obsługiwana walidacja**: Brak

**Typy**: Brak

**Propsy**:
```typescript
interface AuthorWorksEmptyProps {
  onManualAdd?: () => void;
  className?: string;
}
```

### 4.8. AuthorWorksTable

**Opis**: Tabela z listą works z checkboxami do selekcji.

**Główne elementy**:
- `<table>` lub `<div>` z klasami table (responsywny stacked rows)
- `AuthorWorksTableHeader` z checkboxem "Zaznacz wszystkie"
- `AuthorWorksTableRow[]` dla każdego work

**Obsługiwane interakcje**:
- Zaznaczanie/odznaczanie pojedynczych works → wywołanie `onWorkToggle(workId)`
- Zaznaczanie/odznaczanie wszystkich → wywołanie `onSelectAll()` / `onDeselectAll()`

**Obsługiwana walidacja**: Brak

**Typy**:
- `works: WorkListItemDto[]`
- `selectedWorkIds: Set<string>`
- `onWorkToggle: (workId: string) => void`
- `onSelectAll: () => void`
- `onDeselectAll: () => void`
- `isAllSelected: boolean`

**Propsy**:
```typescript
interface AuthorWorksTableProps {
  works: WorkListItemDto[];
  selectedWorkIds: Set<string>;
  onWorkToggle: (workId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  isAllSelected: boolean;
  className?: string;
}
```

### 4.9. AuthorWorksTableHeader

**Opis**: Nagłówek tabeli z checkboxem "Zaznacz wszystkie" i kolumnami.

**Główne elementy**:
- Checkbox w pierwszej kolumnie (indeterminate state gdy część zaznaczona)
- Kolumny: Checkbox, Okładka, Tytuł, Rok, Język, Status (jeśli w profilu)

**Obsługiwane interakcje**:
- Kliknięcie checkboxa → wywołanie `onToggleAll()`

**Obsługiwana walidacja**: Brak

**Typy**:
- `isAllSelected: boolean`
- `isIndeterminate: boolean` (część zaznaczona)
- `onToggleAll: () => void`

**Propsy**:
```typescript
interface AuthorWorksTableHeaderProps {
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onToggleAll: () => void;
}
```

### 4.10. AuthorWorksTableRow

**Opis**: Pojedynczy wiersz tabeli z danymi work i checkboxem.

**Główne elementy**:
- Checkbox (pierwsza kolumna)
- Okładka (CoverImage z lazy loading)
- Tytuł work (z primary edition fallback)
- Rok publikacji (z fallback: `work.first_publish_year || edition.publish_year`)
- Język (z primary edition)
- Badge "Dodane" (jeśli work jest już w profilu użytkownika)
- Accordion z dodatkowymi szczegółami (ISBN, pełna data publikacji)

**Obsługiwane interakcje**:
- Kliknięcie checkboxa → wywołanie `onToggle()`
- Rozwijanie/zwijanie Accordion → lokalny stan

**Obsługiwana walidacja**: Brak

**Typy**:
- `work: WorkListItemDto`
- `isSelected: boolean`
- `isInProfile: boolean` (czy work jest już w profilu)
- `onToggle: () => void`

**Propsy**:
```typescript
interface AuthorWorksTableRowProps {
  work: WorkListItemDto;
  isSelected: boolean;
  isInProfile: boolean;
  onToggle: () => void;
}
```

### 4.11. AuthorWorksPagination

**Opis**: Kontrolki paginacji (Poprzednia/Następna + "Strona X z Y").

**Główne elementy**:
- Przycisk "Poprzednia" (disabled na pierwszej stronie)
- Tekst "Strona X z Y"
- Przycisk "Następna" (disabled na ostatniej stronie)

**Obsługiwane interakcje**:
- Kliknięcie "Poprzednia" → wywołanie `onPageChange(currentPage - 1)`
- Kliknięcie "Następna" → wywołanie `onPageChange(currentPage + 1)`

**Obsługiwana walidacja**: Brak

**Typy**:
- `currentPage: number`
- `totalPages: number`
- `onPageChange: (page: number) => void`

**Propsy**:
```typescript
interface AuthorWorksPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}
```

### 4.12. AuthorWorksBulkToolbar

**Opis**: Sticky toolbar na dole ekranu wyświetlany tylko gdy `selectedCount > 0`.

**Główne elementy**:
- Licznik zaznaczonych: "Zaznaczono: N"
- Przycisk "Dodaj zaznaczone" (domyślnie status `to_read`)
- Opcjonalnie: Select statusu początkowego (jeśli wymagane w UI)

**Obsługiwane interakcje**:
- Kliknięcie "Dodaj zaznaczone" → wywołanie `onBulkAdd(workIds, status)`
- Zmiana statusu początkowego → aktualizacja lokalnego stanu

**Obsługiwana walidacja**:
- Pre-check limitu 5000 książek (z profilu użytkownika)
- Walidacja `work_ids` array (min 1, max 100, UUID format) - po stronie API

**Typy**:
- `selectedCount: number`
- `selectedWorkIds: string[]`
- `onBulkAdd: (workIds: string[], status?: UserWorkStatus) => Promise<void>`
- `isAdding: boolean` (loading state)
- `limitStatus?: { current: number; max: number; isAtLimit: boolean }`

**Propsy**:
```typescript
interface AuthorWorksBulkToolbarProps {
  selectedCount: number;
  selectedWorkIds: string[];
  onBulkAdd: (workIds: string[], status?: UserWorkStatus) => Promise<void>;
  isAdding: boolean;
  limitStatus?: {
    current: number;
    max: number;
    isAtLimit: boolean;
  };
}
```

## 5. Typy

### 5.1. Typy DTO (z `src/types.ts`)

**WorkListItemDto**:
```typescript
type WorkListItemDto = WorkWithPrimaryEditionDto & {
  publish_year: number | null; // COALESCE(work.first_publish_year, edition.publish_year)
};
```

**WorkWithPrimaryEditionDto**:
```typescript
type WorkWithPrimaryEditionDto = WorkDto & {
  primary_edition: PrimaryEditionSummaryDto | null;
};
```

**PrimaryEditionSummaryDto**:
```typescript
type PrimaryEditionSummaryDto = Pick<
  EditionRow,
  | "id"
  | "title"
  | "openlibrary_id"
  | "publish_year"
  | "publish_date"
  | "publish_date_raw"
  | "isbn13"
  | "cover_url"
  | "language"
>;
```

**AuthorWorksListResponseDto**:
```typescript
type AuthorWorksListResponseDto = PaginatedResponseDto<WorkListItemDto>;
```

**PaginatedResponseDto**:
```typescript
interface PaginatedResponseDto<TItem> {
  items: TItem[];
  page: number;
  total: number;
}
```

**BulkAttachUserWorksCommand**:
```typescript
interface BulkAttachUserWorksCommand {
  work_ids: WorkRow["id"][];
  status?: UserWorkStatus; // "to_read" | "in_progress" | "read" | "hidden"
}
```

**BulkAttachUserWorksResponseDto**:
```typescript
interface BulkAttachUserWorksResponseDto {
  added: WorkRow["id"][];
  skipped: WorkRow["id"][];
}
```

**AuthorResponseDto**:
```typescript
interface AuthorResponseDto {
  author: AuthorDto;
}
```

**ProfileResponseDto**:
```typescript
interface ProfileResponseDto {
  author_count: number;
  work_count: number;
  max_authors: number;
  max_works: number;
}
```

### 5.2. Typy ViewModel (lokalne dla komponentów)

**AuthorWorksFilters**:
```typescript
interface AuthorWorksFilters {
  page: number; // domyślnie 1
  sort: "published_desc" | "title_asc"; // domyślnie "published_desc"
}
```

**AuthorWorksState**:
```typescript
interface AuthorWorksState {
  // Dane
  author: AuthorDto | null;
  works: WorkListItemDto[];
  total: number;
  profile: ProfileResponseDto | null;
  
  // Stan UI
  isLoading: boolean;
  isLoadingAuthor: boolean;
  isLoadingWorks: boolean;
  error: string | null;
  
  // Selekcja
  selectedWorkIds: Set<string>; // selekcja per strona
  
  // Filtry (z URL)
  filters: AuthorWorksFilters;
}
```

**WorkInProfileStatus**:
```typescript
// Informacja czy work jest już w profilu użytkownika
// Można sprawdzić przez porównanie work.id z listą user_works
// W MVP: sprawdzamy przez badge "Dodane" lub status w wierszu
type WorkInProfileStatus = {
  isInProfile: boolean;
  // Opcjonalnie: status jeśli w profilu
  status?: UserWorkStatus;
};
```

## 6. Zarządzanie stanem

### 6.1. Custom Hook: useAuthorWorks

Główna logika widoku jest enkapsulowana w custom hooku `useAuthorWorks`:

```typescript
function useAuthorWorks(authorId: string, initialPage?: number, initialSort?: "published_desc" | "title_asc") {
  // Stan danych
  const [author, setAuthor] = useState<AuthorDto | null>(null);
  const [works, setWorks] = useState<WorkListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [profile, setProfile] = useState<ProfileResponseDto | null>(null);
  
  // Stan UI
  const [isLoadingAuthor, setIsLoadingAuthor] = useState(true);
  const [isLoadingWorks, setIsLoadingWorks] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selekcja (per strona)
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set());
  
  // Filtry z URL
  const [searchParams, setSearchParams] = useSearchParams();
  const filters: AuthorWorksFilters = {
    page: initialPage ?? parseInt(searchParams.get("page") || "1", 10),
    sort: initialSort ?? (searchParams.get("sort") as "published_desc" | "title_asc") || "published_desc",
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
  const fetchAuthor = async () => {
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
  };
  
  const fetchWorks = async (forceRefresh = false) => {
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
  };
  
  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/user/profile");
      if (response.ok) {
        const data: ProfileResponseDto = await response.json();
        setProfile(data);
      }
    } catch (err) {
      // Nie pokazujemy błędu dla profilu, tylko logujemy
      console.error("Failed to fetch profile:", err);
    }
  };
  
  const bulkAddWorks = async (workIds: string[], status: UserWorkStatus = "to_read") => {
    // Pre-check limitu
    if (limitStatus?.isAtLimit) {
      throw new Error(`Osiągnięto limit książek (${limitStatus.max} książek na użytkownika)`);
    }
    
    if (limitStatus && limitStatus.current + workIds.length > limitStatus.max) {
      throw new Error(
        `Nie można dodać ${workIds.length} książek. Pozostało miejsca: ${limitStatus.remaining}`
      );
    }
    
    try {
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
      
      return data;
    } catch (err) {
      throw err;
    }
  };
  
  // Effects
  useEffect(() => {
    fetchAuthor();
    fetchProfile();
  }, [authorId]);
  
  useEffect(() => {
    fetchWorks();
  }, [authorId, filters.page, filters.sort]);
  
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
```

### 6.2. SessionStorage dla selekcji (opcjonalnie)

Zgodnie z notatkami w UI plan, selekcje mogą być utrzymywane w sessionStorage, aby nie "przeskakiwały" między stronami. W MVP można to pominąć, ale warto zaplanować:

```typescript
// W useAuthorWorks, przy zmianie selectedWorkIds:
useEffect(() => {
  if (selectedWorkIds.size > 0) {
    sessionStorage.setItem(
      `authorWorksSelection_${authorId}_${filters.page}`,
      JSON.stringify(Array.from(selectedWorkIds))
    );
  } else {
    sessionStorage.removeItem(`authorWorksSelection_${authorId}_${filters.page}`);
  }
}, [selectedWorkIds, authorId, filters.page]);

// Przy ładowaniu works:
useEffect(() => {
  const stored = sessionStorage.getItem(`authorWorksSelection_${authorId}_${filters.page}`);
  if (stored) {
    try {
      setSelectedWorkIds(new Set(JSON.parse(stored)));
    } catch {
      // Ignore invalid storage
    }
  }
}, [authorId, filters.page]);
```

## 7. Integracja API

### 7.1. GET /api/authors/{authorId}

**Typ żądania**: `GET`

**Typ odpowiedzi**: `AuthorResponseDto`

**Obsługa błędów**:
- `400`: Błąd walidacji UUID → komunikat "Nieprawidłowy identyfikator autora"
- `404`: Autor nie znaleziony → komunikat "Autor nie został znaleziony" + link powrotu
- `500`: Błąd serwera → komunikat "Wystąpił błąd serwera" + retry

**Użycie w komponencie**:
```typescript
const response = await fetch(`/api/authors/${authorId}`);
const data: AuthorResponseDto = await response.json();
setAuthor(data.author);
```

### 7.2. GET /api/authors/{authorId}/works

**Typ żądania**: `GET`

**Query parameters**:
- `page?: number` (domyślnie 1)
- `sort?: "published_desc" | "title_asc"` (domyślnie "published_desc")
- `forceRefresh?: boolean` (domyślnie false)

**Typ odpowiedzi**: `AuthorWorksListResponseDto`

**Obsługa błędów**:
- `400`: Błąd walidacji → komunikat "Nieprawidłowe parametry zapytania"
- `404`: Autor nie znaleziony → komunikat "Autor nie został znaleziony" + link powrotu
- `502`: OpenLibrary niedostępne → komunikat "OpenLibrary jest tymczasowo niedostępne" + retry + opcja ręcznego dodania
- `500`: Błąd serwera → komunikat "Wystąpił błąd serwera" + retry

**Użycie w komponencie**:
```typescript
const params = new URLSearchParams({
  page: filters.page.toString(),
  sort: filters.sort,
});
if (forceRefresh) {
  params.set("forceRefresh", "true");
}
const response = await fetch(`/api/authors/${authorId}/works?${params}`);
const data: AuthorWorksListResponseDto = await response.json();
setWorks(data.items);
setTotal(data.total);
```

### 7.3. POST /api/user/works/bulk

**Typ żądania**: `POST`

**Typ body**: `BulkAttachUserWorksCommand`

**Typ odpowiedzi**: `BulkAttachUserWorksResponseDto`

**Obsługa błędów**:
- `400`: Błąd walidacji (pusta lista, nieprawidłowe UUID) → komunikat "Nieprawidłowe dane"
- `401`: Brak autoryzacji → komunikat "Musisz być zalogowany" + redirect do logowania
- `403`: Brak uprawnień (RLS) → komunikat "Nie masz uprawnień do dodania tych książek"
- `409`: Limit osiągnięty → komunikat "Osiągnięto limit książek (5000 książek na użytkownika)"
- `500`: Błąd serwera → komunikat "Wystąpił błąd serwera" + retry

**Użycie w komponencie**:
```typescript
const response = await fetch("/api/user/works/bulk", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ work_ids: workIds, status: "to_read" }),
});
const data: BulkAttachUserWorksResponseDto = await response.json();
// data.added - lista ID dodanych
// data.skipped - lista ID pominiętych (już w profilu)
```

### 7.4. GET /api/user/profile

**Typ żądania**: `GET`

**Typ odpowiedzi**: `ProfileResponseDto`

**Obsługa błędów**:
- `401`: Brak autoryzacji → ciche zignorowanie (nie blokuje widoku)
- `404`: Profil nie znaleziony → ciche zignorowanie
- `500`: Błąd serwera → ciche zignorowanie (nie blokuje widoku)

**Użycie w komponencie**:
```typescript
const response = await fetch("/api/user/profile");
if (response.ok) {
  const data: ProfileResponseDto = await response.json();
  setProfile(data);
}
```

## 8. Interakcje użytkownika

### 8.1. Zmiana sortowania

**Akcja użytkownika**: Wybór opcji sortowania w `SortSelect`

**Oczekiwany wynik**:
1. Aktualizacja URL (`?sort=title_asc` lub `?sort=published_desc`)
2. Reset paginacji do strony 1
3. Czyszczenie selekcji checkboxów
4. Odświeżenie listy works z nowym sortowaniem
5. Wyświetlenie loading state podczas pobierania danych

**Implementacja**:
```typescript
const handleSortChange = (sort: "published_desc" | "title_asc") => {
  setSort(sort); // Aktualizuje URL i wywołuje fetchWorks
};
```

### 8.2. Zmiana strony

**Akcja użytkownika**: Kliknięcie "Poprzednia" lub "Następna" w paginacji

**Oczekiwany wynik**:
1. Aktualizacja URL (`?page=2`)
2. Czyszczenie selekcji checkboxów (selekcja per strona)
3. Przewinięcie do góry listy
4. Odświeżenie listy works z nową stroną
5. Wyświetlenie loading state podczas pobierania danych

**Implementacja**:
```typescript
const handlePageChange = (page: number) => {
  setPage(page); // Aktualizuje URL i wywołuje fetchWorks
  window.scrollTo({ top: 0, behavior: "smooth" });
};
```

### 8.3. Zaznaczanie pojedynczego work

**Akcja użytkownika**: Kliknięcie checkboxa przy pojedynczym work

**Oczekiwany wynik**:
1. Dodanie/usunięcie `workId` z `selectedWorkIds`
2. Aktualizacja stanu checkboxa (checked/unchecked)
3. Aktualizacja stanu checkboxa "Zaznacz wszystkie" (indeterminate/checked/unchecked)
4. Aktualizacja licznika w `BulkToolbar`
5. Pojawienie się/zniknięcie `BulkToolbar` (jeśli `selectedCount > 0`)

**Implementacja**:
```typescript
const handleWorkToggle = (workId: string) => {
  toggleWork(workId); // Aktualizuje selectedWorkIds
};
```

### 8.4. Zaznaczanie wszystkich works na stronie

**Akcja użytkownika**: Kliknięcie checkboxa "Zaznacz wszystkie" w nagłówku tabeli

**Oczekiwany wynik**:
1. Zaznaczenie wszystkich works z bieżącej strony
2. Aktualizacja wszystkich checkboxów w wierszach
3. Aktualizacja checkboxa "Zaznacz wszystkie" (checked)
4. Aktualizacja licznika w `BulkToolbar`
5. Pojawienie się `BulkToolbar` (jeśli `selectedCount > 0`)

**Implementacja**:
```typescript
const handleSelectAll = () => {
  if (isAllSelected) {
    deselectAll();
  } else {
    selectAll();
  }
};
```

### 8.5. Masowe dodanie works

**Akcja użytkownika**: Kliknięcie "Dodaj zaznaczone" w `BulkToolbar`

**Oczekiwany wynik**:
1. Pre-check limitu 5000 książek (z profilu)
2. Wyświetlenie loading state na przycisku
3. Wywołanie API `POST /api/user/works/bulk`
4. Po sukcesie:
   - Toast z komunikatem: "Dodano N książek, pominięto M" (gdzie N = added.length, M = skipped.length)
   - Czyszczenie selekcji
   - Odświeżenie profilu (aktualizacja licznika)
   - Opcjonalnie: oznaczenie works jako "Dodane" w tabeli (badge)
5. Po błędzie:
   - Toast z komunikatem błędu
   - Zachowanie selekcji (użytkownik może spróbować ponownie)

**Implementacja**:
```typescript
const handleBulkAdd = async () => {
  setIsAdding(true);
  try {
    const workIds = Array.from(selectedWorkIds);
    const result = await bulkAddWorks(workIds, "to_read");
    
    toast.success(
      `Dodano ${result.added.length} książek${result.skipped.length > 0 ? `, pominięto ${result.skipped.length}` : ""}`
    );
    
    // Selekcja jest czyszczona w bulkAddWorks
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Nie udało się dodać książek");
  } finally {
    setIsAdding(false);
  }
};
```

### 8.6. Odświeżanie danych (forceRefresh)

**Akcja użytkownika**: Kliknięcie "Odśwież dane" w toolbarze (tylko dla autorów z OpenLibrary)

**Oczekiwany wynik**:
1. Wyświetlenie loading state
2. Wywołanie API z parametrem `forceRefresh=true`
3. Odświeżenie danych autora z OpenLibrary (jeśli cache wygasł)
4. Odświeżenie listy works
5. Toast z potwierdzeniem: "Dane zostały odświeżone"

**Implementacja**:
```typescript
const handleForceRefresh = async () => {
  setIsLoadingWorks(true);
  try {
    await fetchWorks(true); // forceRefresh = true
    toast.success("Dane zostały odświeżone");
  } catch (err) {
    toast.error("Nie udało się odświeżyć danych");
  }
};
```

## 9. Warunki i walidacja

### 9.1. Walidacja po stronie frontendu

**Walidacja authorId (UUID format)**:
- Wykonywana po stronie API
- Frontend przekazuje `authorId` z URL bez walidacji
- W przypadku błędu 400, wyświetlamy komunikat: "Nieprawidłowy identyfikator autora"

**Walidacja parametrów query**:
- `page`: musi być ≥ 1 (domyślnie 1)
- `sort`: musi być `"published_desc"` lub `"title_asc"` (domyślnie `"published_desc"`)
- Wykonywana po stronie API
- Frontend używa wartości z URL bez walidacji
- W przypadku błędu 400, wyświetlamy komunikat: "Nieprawidłowe parametry zapytania"

**Pre-check limitu 5000 książek**:
- Sprawdzamy przed wywołaniem `POST /api/user/works/bulk`
- Źródło: `profile.work_count` i `profile.max_works`
- Warunek: `work_count + selectedWorkIds.length <= max_works`
- Jeśli warunek nie jest spełniony:
  - Wyświetlamy komunikat: "Nie można dodać N książek. Pozostało miejsca: M"
  - Blokujemy wywołanie API
  - Nie czyszczymy selekcji

**Walidacja selekcji**:
- `selectedWorkIds` nie może być pusty przed bulk dodaniem
- Sprawdzamy w `BulkToolbar` przed wywołaniem `onBulkAdd`
- Jeśli puste, przycisk "Dodaj zaznaczone" jest disabled

### 9.2. Walidacja po stronie API

**GET /api/authors/{authorId}/works**:
- `authorId`: UUID format (walidacja przez `AuthorIdParamSchema`)
- `page`: integer ≥ 1 (walidacja przez `AuthorWorksListQuerySchema`)
- `sort`: enum `["published_desc", "title_asc"]` (walidacja przez `AuthorWorksListQuerySchema`)
- `forceRefresh`: boolean (walidacja przez `AuthorWorksListQuerySchema`)

**POST /api/user/works/bulk**:
- `work_ids`: array UUID, min 1, max 100, deduplikacja automatyczna (walidacja przez `BulkAttachUserWorksCommandSchema`)
- `status`: enum `["to_read", "in_progress", "read", "hidden"]`, opcjonalny, domyślnie `"to_read"` (walidacja przez `BulkAttachUserWorksCommandSchema`)
- Limit 5000 książek: sprawdzany w `WorksService.bulkAttachUserWorks`

### 9.3. Wpływ walidacji na stan UI

**Błąd walidacji UUID**:
- `error` state = "Nieprawidłowy identyfikator autora"
- Wyświetlenie `AuthorWorksError` z komunikatem
- Brak możliwości retry (błąd w URL)

**Błąd walidacji query parameters**:
- `error` state = "Nieprawidłowe parametry zapytania"
- Wyświetlenie `AuthorWorksError` z komunikatem
- Możliwość retry (po poprawieniu URL)

**Błąd limitu 5000 książek (pre-check)**:
- Toast z komunikatem błędu
- `BulkToolbar` pozostaje widoczny
- Selekcja pozostaje zachowana
- Przycisk "Dodaj zaznaczone" pozostaje aktywny (użytkownik może zmniejszyć selekcję)

**Błąd limitu 5000 książek (z API, 409)**:
- Toast z komunikatem: "Osiągnięto limit książek (5000 książek na użytkownika)"
- `BulkToolbar` pozostaje widoczny
- Selekcja pozostaje zachowana
- Odświeżenie profilu (aktualizacja licznika)

**Błąd RLS (403)**:
- Toast z komunikatem: "Nie masz uprawnień do dodania tych książek"
- `BulkToolbar` pozostaje widoczny
- Selekcja pozostaje zachowana

## 10. Obsługa błędów

### 10.1. Błędy API

**400 Bad Request (walidacja)**:
- **Przyczyna**: Nieprawidłowy UUID autora lub nieprawidłowe parametry query
- **Obsługa**: Wyświetlenie `AuthorWorksError` z komunikatem: "Nieprawidłowe dane. Sprawdź adres URL."
- **Akcje**: Link powrotu do `/app/authors`

**401 Unauthorized**:
- **Przyczyna**: Sesja wygasła lub użytkownik nie jest zalogowany
- **Obsługa**: Redirect do `/login` + toast: "Zaloguj się ponownie"
- **Akcje**: Automatyczny redirect

**403 Forbidden (RLS)**:
- **Przyczyna**: Użytkownik nie ma uprawnień do autora lub works
- **Obsługa**: Wyświetlenie `AuthorWorksError` z komunikatem: "Nie masz uprawnień do wyświetlenia tego autora"
- **Akcje**: Link powrotu do `/app/authors`

**404 Not Found**:
- **Przyczyna**: Autor nie został znaleziony lub nie jest dostępny (RLS)
- **Obsługa**: Wyświetlenie `AuthorWorksError` z komunikatem: "Autor nie został znaleziony"
- **Akcje**: Link powrotu do `/app/authors` + przycisk "Spróbuj ponownie"

**409 Conflict (limit książek)**:
- **Przyczyna**: Próba dodania książek przekraczająca limit 5000
- **Obsługa**: Toast z komunikatem: "Osiągnięto limit książek (5000 książek na użytkownika)"
- **Akcje**: Zachowanie selekcji, możliwość zmniejszenia liczby zaznaczonych

**502 Bad Gateway (OpenLibrary)**:
- **Przyczyna**: OpenLibrary jest niedostępne
- **Obsługa**: Wyświetlenie `AuthorWorksError` z komunikatem: "OpenLibrary jest tymczasowo niedostępne. Spróbuj ponownie później."
- **Akcje**: Przycisk "Spróbuj ponownie" + opcjonalnie "Dodaj ręcznie" (jeśli wspierane w MVP)

**500 Internal Server Error**:
- **Przyczyna**: Błąd serwera
- **Obsługa**: Wyświetlenie `AuthorWorksError` z komunikatem: "Wystąpił błąd serwera. Spróbuj ponownie później."
- **Akcje**: Przycisk "Spróbuj ponownie"

### 10.2. Błędy sieciowe

**Brak połączenia z internetem**:
- **Obsługa**: Wyświetlenie `AuthorWorksError` z komunikatem: "Brak połączenia z internetem. Sprawdź swoje połączenie."
- **Akcje**: Przycisk "Spróbuj ponownie"

**Timeout**:
- **Obsługa**: Wyświetlenie `AuthorWorksError` z komunikatem: "Przekroczono limit czasu oczekiwania. Spróbuj ponownie."
- **Akcje**: Przycisk "Spróbuj ponownie"

### 10.3. Przypadki brzegowe

**Autor bez works**:
- **Obsługa**: Wyświetlenie `AuthorWorksEmpty` z komunikatem: "Ten autor nie ma jeszcze żadnych prac"
- **Akcje**: Opcjonalnie "Dodaj ręcznie" (jeśli wspierane w MVP)

**Wszystkie works już w profilu**:
- **Obsługa**: Normalne wyświetlenie listy z badgeami "Dodane"
- **Akcje**: Użytkownik może zobaczyć, które książki już ma

**Selekcja works już w profilu**:
- **Obsługa**: API zwraca `skipped` array z ID works już w profilu
- **Akcje**: Toast informuje: "Dodano N książek, pominięto M (już w profilu)"

**Zmiana strony podczas bulk dodawania**:
- **Obsługa**: Blokada zmiany strony podczas `isAdding === true`
- **Akcje**: Disable przycisków paginacji podczas dodawania

**Równoczesne wywołania API**:
- **Obsługa**: Użycie flag `isLoadingWorks` i `isAdding` do blokady równoczesnych wywołań
- **Akcje**: Ignorowanie kolejnych kliknięć podczas loading

## 11. Kroki implementacji

### Krok 1: Utworzenie struktury plików

1. Utworzenie pliku `src/pages/app/authors/[authorId].astro`
2. Utworzenie katalogu `src/components/authors/works/`
3. Utworzenie plików komponentów:
   - `AuthorWorksView.tsx` (główny komponent)
   - `AuthorWorksHeader.tsx`
   - `AuthorWorksToolbar.tsx`
   - `AuthorWorksContent.tsx`
   - `AuthorWorksSkeleton.tsx`
   - `AuthorWorksError.tsx`
   - `AuthorWorksEmpty.tsx`
   - `AuthorWorksTable.tsx`
   - `AuthorWorksTableHeader.tsx`
   - `AuthorWorksTableRow.tsx`
   - `AuthorWorksPagination.tsx`
   - `AuthorWorksBulkToolbar.tsx`
4. Utworzenie pliku `src/components/authors/works/hooks/useAuthorWorks.ts`

### Krok 2: Implementacja custom hooka useAuthorWorks

1. Definicja stanów (author, works, total, profile, loading, error, selekcja)
2. Implementacja odczytu parametrów z URL (useSearchParams)
3. Implementacja funkcji fetchAuthor, fetchWorks, fetchProfile
4. Implementacja funkcji selekcji (toggleWork, selectAll, deselectAll)
5. Implementacja funkcji bulkAddWorks z pre-check limitu
6. Implementacja funkcji zmiany filtrów (setPage, setSort)
7. Implementacja effects (useEffect dla fetchAuthor, fetchWorks, fetchProfile)
8. Opcjonalnie: implementacja sessionStorage dla selekcji

### Krok 3: Implementacja komponentu AuthorWorksView

1. Użycie hooka `useAuthorWorks`
2. Renderowanie sekwencyjne: Header → Toolbar → Content → Pagination → BulkToolbar
3. Obsługa stanów loading, error, empty
4. Integracja z toast notifications (Sonner)

### Krok 4: Implementacja komponentów pomocniczych

1. **AuthorWorksHeader**:
   - Breadcrumb nawigacja
   - Wyświetlenie nazwy autora
2. **AuthorWorksToolbar**:
   - SortSelect komponent
   - Przycisk "Odśwież" (tylko dla autorów z OpenLibrary)
3. **AuthorWorksContent**:
   - Warunkowe renderowanie (loading, error, empty, table)
4. **AuthorWorksSkeleton**:
   - Skeleton UI z shadcn/ui
5. **AuthorWorksError**:
   - Ikona błędu
   - Komunikat błędu
   - Przycisk "Spróbuj ponownie"
   - Opcjonalnie: przycisk "Dodaj ręcznie"
6. **AuthorWorksEmpty**:
   - Ilustracja/ikona
   - Komunikat
   - Opcjonalnie: CTA "Dodaj ręcznie"

### Krok 5: Implementacja komponentów tabeli

1. **AuthorWorksTable**:
   - Renderowanie nagłówka i wierszy
   - Obsługa selekcji
2. **AuthorWorksTableHeader**:
   - Checkbox "Zaznacz wszystkie" (z indeterminate state)
   - Kolumny: Checkbox, Okładka, Tytuł, Rok, Język, Status
3. **AuthorWorksTableRow**:
   - Checkbox
   - CoverImage (lazy loading)
   - Tytuł work (z primary edition fallback)
   - Rok publikacji (z fallback)
   - Język (z primary edition)
   - Badge "Dodane" (jeśli work w profilu)
   - Accordion z szczegółami (ISBN, pełna data)

### Krok 6: Implementacja paginacji i bulk toolbar

1. **AuthorWorksPagination**:
   - Przyciski "Poprzednia"/"Następna"
   - Tekst "Strona X z Y"
   - Ukrycie gdy tylko jedna strona
2. **AuthorWorksBulkToolbar**:
   - Sticky positioning (na dole ekranu)
   - Renderowanie tylko gdy `selectedCount > 0`
   - Licznik zaznaczonych
   - Przycisk "Dodaj zaznaczone" (z loading state)
   - Opcjonalnie: Select statusu początkowego

### Krok 7: Implementacja strony Astro

1. Odczyt `authorId` z `Astro.params`
2. Odczyt parametrów query z `Astro.url.searchParams`
3. Renderowanie `AppLayout`
4. Renderowanie React island `AuthorWorksView` z props

### Krok 8: Integracja z istniejącymi komponentami

1. Użycie `SortSelect` z `src/components/authors/SortSelect.tsx` (lub stworzenie nowego dla works)
2. Użycie `CoverImage` (jeśli istnieje) lub stworzenie nowego
3. Użycie komponentów UI z shadcn/ui (Button, Checkbox, Accordion, etc.)

### Krok 9: Obsługa błędów i toast notifications

1. Integracja z Sonner (toast notifications)
2. Mapowanie kodów HTTP na komunikaty błędów
3. Obsługa wszystkich scenariuszy błędów (400, 401, 403, 404, 409, 500, 502)
4. Obsługa błędów sieciowych (brak połączenia, timeout)

### Krok 10: Testowanie i optymalizacja

1. Testowanie wszystkich interakcji użytkownika
2. Testowanie obsługi błędów
3. Testowanie paginacji i sortowania
4. Testowanie bulk dodawania (sukces, błędy, limit)
5. Testowanie responsywności (mobile, tablet, desktop)
6. Optymalizacja wydajności (lazy loading obrazów, memoization)
7. Testowanie dostępności (a11y): keyboard navigation, screen readers

### Krok 11: Dokumentacja i cleanup

1. Dodanie komentarzy JSDoc do komponentów
2. Sprawdzenie zgodności z PRD i User Stories
3. Aktualizacja dokumentacji projektu (jeśli potrzebna)
4. Code review i refaktoryzacja

