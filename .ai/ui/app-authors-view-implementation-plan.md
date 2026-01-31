# Plan implementacji widoku Autorzy – lista

## 1. Przegląd

Widok "Autorzy – lista" jest głównym ekranem zarządzania autorami użytkownika w aplikacji BookFlow. Jego celem jest umożliwienie przeglądania listy obserwowanych autorów, wyszukiwania ich oraz zarządzania relacją użytkownika z autorami (dodawanie, usuwanie). Widok wyświetla licznik aktualnych autorów względem limitu (author_count/max_authors) i umożliwia szybkie rozpoczęcie flow dodawania nowych autorów poprzez modal wyszukiwania w OpenLibrary lub ręcznego dodania. Wspiera paginację (30 autorów na stronę), sortowanie (alfabetycznie lub według daty dodania) oraz wyszukiwanie po nazwie autora.

## 2. Routing widoku

- **Ścieżka**: `/app/authors`
- **Typ**: Strona Astro z wyspą React dla interaktywności
- **Ochrona**: Wymaga uwierzytelnienia – brak sesji użytkownika powoduje redirect do `/login`
- **Parametry URL** (źródło prawdy dla stanu filtrów):
  - `page` (number, opcjonalny, domyślnie 1) – numer strony
  - `search` (string, opcjonalny) – fraza wyszukiwania po nazwie autora
  - `sort` (string, opcjonalny, domyślnie "name_asc") – sortowanie: "name_asc" lub "created_desc"

## 3. Struktura komponentów

Widok składa się z następujących komponentów w hierarchii:

```
AuthorsListPage.astro (Astro page)
└── AuthorsListView (React - główny kontener interaktywny)
    ├── PageHeader (React)
    │   ├── PageTitle ("Autorzy")
    │   └── LimitIndicator (wyświetla author_count/max_authors)
    ├── AuthorsToolbar (React)
    │   ├── SearchInput (input z debounce)
    │   ├── SortSelect (dropdown sortowania)
    │   └── AddAuthorButton (przycisk CTA)
    ├── AuthorsListContent (React - warunkowy render)
    │   ├── [gdy isLoading] AuthorsListSkeleton
    │   ├── [gdy error] ErrorDisplay
    │   ├── [gdy empty i bez filtrów] EmptyState
    │   ├── [gdy empty z filtrami] NoResultsState
    │   └── [gdy authors.length > 0] AuthorsTable
    │       └── AuthorRow (wiele, dla każdego autora)
    │           ├── AuthorInfo (nazwa autora, link do szczegółów)
    │           ├── AuthorMeta (data dodania, badge manual/OL)
    │           └── AuthorActions (przycisk usuwania)
    ├── AuthorsPagination (React - nawigacja stron)
    ├── AddAuthorModal (React - modal, warunkowo renderowany)
    │   ├── [tryb OL] AuthorSearchTab
    │   │   ├── SearchInput
    │   │   ├── SearchResults (lista wyników)
    │   │   └── SearchStates (loading/empty/error)
    │   └── [tryb manual] ManualAuthorTab
    │       └── ManualAuthorForm (formularz z name)
    └── DeleteAuthorDialog (React - dialog potwierdzenia, warunkowo)
        ├── DialogHeader (tytuł i opis)
        ├── DialogContent (informacje o autorze)
        └── DialogActions (Anuluj / Usuń)
```

## 4. Szczegóły komponentów

### 4.1. AuthorsListPage.astro

- **Opis**: Strona Astro będąca kontenerem dla widoku. Odpowiada za SSR, odczyt parametrów URL i sprawdzenie sesji użytkownika.
- **Główne elementy**:
  - Layout aplikacji (AppLayout z nawigacją)
  - Komponent React `<AuthorsListView client:load />`
- **Obsługiwane interakcje**: Brak (statyczny kontener)
- **Warunki walidacji**:
  - Weryfikacja sesji użytkownika (middleware Astro)
  - Redirect do `/login` jeśli brak autoryzacji
- **Typy**: `Astro.locals.supabase`, `Astro.locals.session`
- **Propsy**: Brak (strona Astro)

### 4.2. AuthorsListView

- **Opis**: Główny komponent React zarządzający stanem całego widoku. Enkapsuluje logikę pobierania danych, zarządzania filtrami i koordynacji działań podkomponentów.
- **Główne elementy**:
  - Kontener `<div>` z layoutem (flex/grid)
  - Renderowanie wszystkich podkomponentów
  - Provider stanu (jeśli używamy Context API)
- **Obsługiwane interakcje**:
  - Inicjalizacja widoku (fetch profilu i autorów)
  - Zarządzanie stanem modali (AddAuthorModal, DeleteAuthorDialog)
  - Koordynacja akcji podkomponentów
  - Synchronizacja stanu URL z filtami
- **Warunki walidacji**:
  - Sprawdzenie limitu autorów przed otwarciem modalu dodawania
  - Walidacja page number (>= 1)
- **Typy**:
  - `ProfileResponseDto` (profil użytkownika)
  - `UserAuthorsListResponseDto` (lista autorów)
  - `AuthorsListFilters` (stan filtrów)
  - `AuthorsListState` (pełny stan komponentu)
- **Propsy**: Brak (główny komponent widoku)

### 4.3. PageHeader

- **Opis**: Nagłówek strony z tytułem i wskaźnikiem limitu autorów.
- **Główne elementy**:
  - `<header>` z tytułem "Autorzy"
  - Komponent `<LimitIndicator />`
- **Obsługiwane interakcje**: Brak (komponent prezentacyjny)
- **Warunki walidacji**: Brak
- **Typy**:
  - `author_count: number`
  - `max_authors: number`
- **Propsy**:
  ```typescript
  interface PageHeaderProps {
    authorCount: number;
    maxAuthors: number;
  }
  ```

### 4.4. LimitIndicator

- **Opis**: Wizualny wskaźnik pokazujący aktualną liczbę autorów względem limitu (np. "125/500").
- **Główne elementy**:
  - `<span>` lub `<div>` z tekstem "{authorCount}/{maxAuthors}"
  - Warunkowe stylowanie (zmiana koloru przy zbliżaniu się do limitu)
  - Opcjonalnie progress bar
- **Obsługiwane interakcje**: Brak (komponent prezentacyjny)
- **Warunki walidacji**: Brak (tylko wyświetlanie)
- **Typy**:
  - `author_count: number`
  - `max_authors: number`
  - `LimitStatus` (computed)
- **Propsy**:
  ```typescript
  interface LimitIndicatorProps {
    current: number;
    max: number;
    className?: string;
  }
  ```

### 4.5. AuthorsToolbar

- **Opis**: Pasek narzędzi zawierający kontrolki filtrowania (wyszukiwanie, sortowanie) i przycisk dodawania autora.
- **Główne elementy**:
  - `<div>` z layoutem flex
  - `<SearchInput />`, `<SortSelect />`, `<AddAuthorButton />`
- **Obsługiwane interakcje**:
  - Zmiana wartości wyszukiwania (debounced)
  - Zmiana sortowania
  - Kliknięcie przycisku dodawania
- **Warunki walidacji**:
  - Search: max 200 znaków
  - Sort: tylko dozwolone wartości ("name_asc", "created_desc")
- **Typy**:
  - `search: string`
  - `sort: "name_asc" | "created_desc"`
  - `isAtLimit: boolean` (dla AddAuthorButton)
- **Propsy**:
  ```typescript
  interface AuthorsToolbarProps {
    search: string;
    sort: "name_asc" | "created_desc";
    isAtLimit: boolean;
    onSearchChange: (value: string) => void;
    onSortChange: (value: "name_asc" | "created_desc") => void;
    onAddAuthor: () => void;
  }
  ```

### 4.6. SearchInput

- **Opis**: Pole tekstowe do wyszukiwania autorów po nazwie z debounce.
- **Główne elementy**:
  - `<Input>` z ikoną wyszukiwania (z shadcn/ui)
  - Label "Szukaj autora"
  - Opcjonalnie przycisk czyszczenia (X)
- **Obsługiwane interakcje**:
  - Wprowadzanie tekstu (onChange)
  - Debounce 500ms przed wywołaniem callbacku
  - Czyszczenie pola (opcjonalnie)
- **Warunki walidacji**:
  - Max 200 znaków
  - Wyświetlenie komunikatu błędu przy przekroczeniu
- **Typy**:
  - `value: string`
- **Propsy**:
  ```typescript
  interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    maxLength?: number; // domyślnie 200
  }
  ```

### 4.7. SortSelect

- **Opis**: Dropdown do wyboru sposobu sortowania listy autorów.
- **Główne elementy**:
  - `<Select>` (z shadcn/ui)
  - Opcje: "Alfabetycznie (A-Z)" (name_asc), "Ostatnio dodane" (created_desc)
- **Obsługiwane interakcje**:
  - Zmiana wartości sortowania
- **Warunki walidacji**:
  - Tylko dozwolone wartości ("name_asc" | "created_desc")
- **Typy**:
  - `sort: "name_asc" | "created_desc"`
- **Propsy**:
  ```typescript
  interface SortSelectProps {
    value: "name_asc" | "created_desc";
    onChange: (value: "name_asc" | "created_desc") => void;
  }
  ```

### 4.8. AddAuthorButton

- **Opis**: Przycisk CTA do otwierania modalu dodawania autora.
- **Główne elementy**:
  - `<Button>` (z shadcn/ui) z tekstem "Dodaj autora"
  - Ikona plus (+)
  - Tooltip przy hover (szczególnie gdy disabled)
- **Obsługiwane interakcje**:
  - Kliknięcie otwiera AddAuthorModal
  - Wyłączony gdy osiągnięto limit
- **Warunki walidacji**:
  - Disabled gdy `isAtLimit === true`
  - Tooltip: "Osiągnięto limit 500 autorów" gdy disabled
- **Typy**:
  - `isDisabled: boolean`
- **Propsy**:
  ```typescript
  interface AddAuthorButtonProps {
    onClick: () => void;
    isDisabled: boolean;
    disabledReason?: string;
  }
  ```

### 4.9. AuthorsListContent

- **Opis**: Komponent warunkowego renderowania zawartości listy (loading, error, empty, table).
- **Główne elementy**:
  - Warunkowe renderowanie w zależności od stanu:
    - `isLoading` → `<AuthorsListSkeleton />`
    - `error` → `<ErrorDisplay />`
    - `authors.length === 0 && !hasFilters` → `<EmptyState />`
    - `authors.length === 0 && hasFilters` → `<NoResultsState />`
    - `authors.length > 0` → `<AuthorsTable />`
- **Obsługiwane interakcje**: Brak (deleguje do podkomponentów)
- **Warunki walidacji**: Brak
- **Typy**:
  - `isLoading: boolean`
  - `error: string | null`
  - `authors: UserAuthorDto[]`
  - `hasFilters: boolean`
- **Propsy**:
  ```typescript
  interface AuthorsListContentProps {
    isLoading: boolean;
    error: string | null;
    authors: UserAuthorDto[];
    hasFilters: boolean;
    onDeleteAuthor: (authorId: string) => void;
    onRetry?: () => void;
    onClearFilters?: () => void;
  }
  ```

### 4.10. AuthorsListSkeleton

- **Opis**: Placeholder loading state dla listy autorów.
- **Główne elementy**:
  - Skeleton UI (shimmer effect) z shadcn/ui
  - 5-10 wierszy skeleton odpowiadających AuthorRow
- **Obsługiwane interakcje**: Brak (animowany placeholder)
- **Warunki walidacji**: Brak
- **Typy**: Brak
- **Propsy**: Brak lub `count?: number` (liczba skeleton rows)

### 4.11. ErrorDisplay

- **Opis**: Komponent wyświetlania błędów z opcją retry.
- **Główne elementy**:
  - Ikona błędu
  - Komunikat błędu (przyjazny dla użytkownika)
  - Przycisk "Spróbuj ponownie"
- **Obsługiwane interakcje**:
  - Kliknięcie "Spróbuj ponownie" → wywołanie callbacku onRetry
- **Warunki walidacji**: Brak
- **Typy**:
  - `error: string`
- **Propsy**:
  ```typescript
  interface ErrorDisplayProps {
    message: string;
    onRetry?: () => void;
  }
  ```

### 4.12. EmptyState

- **Opis**: Stan pusty gdy użytkownik nie ma żadnych autorów.
- **Główne elementy**:
  - Ilustracja/ikona (pusta biblioteka)
  - Nagłówek: "Nie masz jeszcze autorów"
  - Opis: "Dodaj pierwszego autora, aby rozpocząć budowanie biblioteki"
  - Przycisk "Dodaj pierwszego autora" (CTA)
- **Obsługiwane interakcje**:
  - Kliknięcie CTA → otwiera AddAuthorModal
- **Warunki walidacji**: Brak
- **Typy**: Brak
- **Propsy**:
  ```typescript
  interface EmptyStateProps {
    onAddAuthor: () => void;
  }
  ```

### 4.13. NoResultsState

- **Opis**: Stan gdy brak wyników dla zastosowanych filtrów.
- **Główne elementy**:
  - Ikona
  - Nagłówek: "Brak wyników"
  - Opis: "Nie znaleziono autorów pasujących do kryteriów wyszukiwania"
  - Przycisk "Wyczyść filtry"
- **Obsługiwane interakcje**:
  - Kliknięcie "Wyczyść filtry" → reset search, reset sort do domyślnego
- **Warunki walidacji**: Brak
- **Typy**: Brak
- **Propsy**:
  ```typescript
  interface NoResultsStateProps {
    onClearFilters: () => void;
  }
  ```

### 4.14. AuthorsTable

- **Opis**: Tabela/lista autorów z wierszami.
- **Główne elementy**:
  - `<div>` lub `<table>` (responsywny layout)
  - Nagłówek tabeli (opcjonalnie): "Nazwa", "Data dodania", "Akcje"
  - Lista komponentów `<AuthorRow />`
- **Obsługiwane interakcje**:
  - Delegowanie akcji z AuthorRow (kliknięcie, usuwanie)
- **Warunki walidacji**: Brak
- **Typy**:
  - `authors: UserAuthorDto[]`
- **Propsy**:
  ```typescript
  interface AuthorsTableProps {
    authors: UserAuthorDto[];
    onDeleteAuthor: (authorId: string) => void;
  }
  ```

### 4.15. AuthorRow

- **Opis**: Pojedynczy wiersz reprezentujący autora w tabeli.
- **Główne elementy**:
  - `<div>` lub `<tr>` z layoutem
  - Nazwa autora (link do `/app/authors/{authorId}`)
  - Data dodania (opcjonalnie, format: "dd.MM.yyyy")
  - Badge: "OL" lub "Ręczny" (zależnie od author.manual)
  - Przycisk usuwania (ikona kosza)
- **Obsługiwane interakcje**:
  - Kliknięcie w nazwę → navigate do `/app/authors/{authorId}`
  - Kliknięcie przycisku usuwania → wywołanie callbacku onDelete
- **Warunki walidacji**: Brak
- **Typy**:
  - `UserAuthorDto`
- **Propsy**:
  ```typescript
  interface AuthorRowProps {
    author: UserAuthorDto;
    onDelete: (authorId: string) => void;
  }
  ```

### 4.16. AuthorsPagination

- **Opis**: Kontrolki paginacji dla listy autorów.
- **Główne elementy**:
  - Przycisk "Poprzednia" (disabled gdy page === 1)
  - Informacja "Strona X z Y"
  - Przycisk "Następna" (disabled gdy page === totalPages)
- **Obsługiwane interakcje**:
  - Kliknięcie "Poprzednia" → zmniejszenie page o 1
  - Kliknięcie "Następna" → zwiększenie page o 1
- **Warunki walidacji**:
  - page >= 1
  - page <= totalPages
- **Typy**:
  - `page: number`
  - `totalPages: number`
- **Propsy**:
  ```typescript
  interface AuthorsPaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  }
  ```

### 4.17. AddAuthorModal

- **Opis**: Modal do dodawania autora (wyszukiwanie w OL lub ręczne dodanie).
- **Główne elementy**:
  - `<Dialog>` (z shadcn/ui)
  - Tabs: "Szukaj w OpenLibrary" i "Dodaj ręcznie"
  - Zawartość zależna od aktywnej zakładki:
    - Tab OL: `<AuthorSearchTab />`
    - Tab manual: `<ManualAuthorTab />`
  - Przycisk zamknięcia (X)
- **Obsługiwane interakcje**:
  - Przełączanie między zakładkami
  - Zamknięcie modalu (ESC, kliknięcie backdrop, przycisk X)
  - Delegowanie akcji do zakładek
- **Warunki walidacji**: Delegowane do zakładek
- **Typy**:
  - `isOpen: boolean`
  - Stan wewnętrzny dla aktywnej zakładki
- **Propsy**:
  ```typescript
  interface AddAuthorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAuthorAdded: () => void; // callback do odświeżenia listy
  }
  ```

### 4.18. AuthorSearchTab

- **Opis**: Zakładka wyszukiwania autorów w OpenLibrary.
- **Główne elementy**:
  - `<SearchInput />` z debounce
  - Lista wyników wyszukiwania
  - Stany: loading (Skeleton), empty ("Wprowadź nazwę autora"), error (z retry)
  - Przyciski "Dodaj" przy każdym wyniku
- **Obsługiwane interakcje**:
  - Wprowadzanie tekstu wyszukiwania (debounced)
  - Kliknięcie "Dodaj" → wywołanie API import + attach
- **Warunki walidacji**:
  - Search: min 2 znaki, max 200 znaków
  - Obsługa błędu 429 (rate limit)
  - Obsługa błędu 409 (duplikat/limit)
  - Obsługa błędu 502 (OL niedostępne)
- **Typy**:
  - `AuthorSearchResultDto[]`
  - Stan wyszukiwania (loading, error)
- **Propsy**:
  ```typescript
  interface AuthorSearchTabProps {
    onAuthorAdded: () => void;
  }
  ```

### 4.19. ManualAuthorTab

- **Opis**: Zakładka ręcznego dodawania autora.
- **Główne elementy**:
  - Formularz z polem "Nazwa autora"
  - Przycisk "Dodaj autora"
  - Komunikat informacyjny: "Autor będzie oznaczony jako ręcznie dodany"
- **Obsługiwane interakcje**:
  - Wprowadzanie nazwy autora
  - Submit formularza → wywołanie API create manual + attach
- **Warunki walidacji**:
  - Nazwa: wymagana, min 1 znak, max 500 znaków, trimmed
  - Obsługa błędu 429 (rate limit)
  - Obsługa błędu 409 (limit)
- **Typy**:
  - `name: string`
  - Stan formularza (loading, error)
- **Propsy**:
  ```typescript
  interface ManualAuthorTabProps {
    onAuthorAdded: () => void;
  }
  ```

### 4.20. DeleteAuthorDialog

- **Opis**: Dialog potwierdzenia usunięcia autora z profilu.
- **Główne elementy**:
  - `<AlertDialog>` (z shadcn/ui)
  - Nagłówek: "Usunąć autora z profilu?"
  - Treść: "Autor {nazwa} zostanie usunięty z Twojego profilu. Wszystkie książki tego autora także zostaną usunięte. Ta operacja jest odwracalna."
  - Przyciski: "Anuluj" i "Usuń" (destructive style)
- **Obsługiwane interakcje**:
  - Kliknięcie "Anuluj" → zamknięcie dialogu
  - Kliknięcie "Usuń" → wywołanie API delete, zamknięcie dialogu, refresh listy
- **Warunki walidacji**: Brak (akcja jest odwracalna)
- **Typy**:
  - `AuthorDto` (informacje o usuwanym autorze)
- **Propsy**:
  ```typescript
  interface DeleteAuthorDialogProps {
    isOpen: boolean;
    author: AuthorDto | null;
    onConfirm: () => Promise<void>;
    onCancel: () => void;
  }
  ```

## 5. Typy

### 5.1. Typy z API (istniejące w types.ts)

```typescript
// Profil użytkownika
interface ProfileResponseDto {
  author_count: number;
  work_count: number;
  max_authors: number;
  max_works: number;
}

// Lista autorów użytkownika
interface UserAuthorsListResponseDto {
  items: UserAuthorDto[];
  total: number;
}

// Pojedynczy autor użytkownika z metadanymi
interface UserAuthorDto {
  author: AuthorDto;
  created_at: string; // ISO 8601
}

// Podstawowe dane autora
interface AuthorDto {
  id: string; // UUID
  name: string;
  openlibrary_id: string | null;
  manual: boolean;
  ol_fetched_at: string | null;
  ol_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// Query parameters dla listy autorów
interface UserAuthorsListQueryDto {
  page?: number;
  search?: string;
  sort?: "name_asc" | "created_desc";
}

// Command do dodawania autora do profilu
interface AttachUserAuthorCommand {
  author_id: string; // UUID
}

// Wynik wyszukiwania autora w OL
interface AuthorSearchResultDto {
  id?: string; // UUID (jeśli już w bazie)
  openlibrary_id: string; // OL ID
  name: string;
  ol_fetched_at: string | null;
  ol_expires_at: string | null;
}

// Odpowiedź z wyszukiwania autorów
interface AuthorSearchResponseDto {
  authors: AuthorSearchResultDto[];
}

// Command do importu autora z OL
interface ImportAuthorCommand {
  openlibrary_id: string;
}

// Command do utworzenia ręcznego autora
interface CreateAuthorCommand {
  name: string;
  manual: true;
  openlibrary_id?: null;
}

// Odpowiedź z utworzenia autora
interface AuthorResponseDto {
  author: AuthorDto;
}
```

### 5.2. Nowe typy ViewModel

```typescript
// Stan filtrów listy autorów
interface AuthorsListFilters {
  search: string;
  sort: "name_asc" | "created_desc";
  page: number;
}

// Pełny stan komponentu AuthorsListView
interface AuthorsListState {
  // Dane
  profile: ProfileResponseDto | null;
  authors: UserAuthorDto[];
  total: number;

  // Filtry
  filters: AuthorsListFilters;

  // Stany UI
  isLoading: boolean;
  error: string | null;

  // Modale
  isAddModalOpen: boolean;
  deleteAuthorId: string | null;
}

// Obliczony status limitu
interface LimitStatus {
  current: number; // author_count
  max: number; // max_authors
  isAtLimit: boolean; // current >= max
  remaining: number; // max - current
  percentage: number; // (current / max) * 100
}

// Stan wyszukiwania w AddAuthorModal
interface AuthorSearchState {
  query: string;
  results: AuthorSearchResultDto[];
  isSearching: boolean;
  searchError: string | null;
  isAdding: boolean;
  addError: string | null;
}

// Stan ręcznego dodawania w AddAuthorModal
interface ManualAuthorState {
  name: string;
  isCreating: boolean;
  createError: string | null;
}

// Typ dla API error response
interface ApiErrorResponse {
  error: string;
  message: string;
  details?: any[];
}
```

## 6. Zarządzanie stanem

### 6.1. Strategia zarządzania stanem

Widok wykorzystuje **URL jako jedyne źródło prawdy** dla filtrów listy (page, search, sort). Stan lokalny React jest używany tylko dla:

- Danych z API (profile, authors, total)
- Stanów UI (loading, error, modals)
- Danych tymczasowych (wpisywana fraza przed debounce)

### 6.2. Custom Hook: useAuthorsList

Główna logika widoku jest enkapsulowana w custom hooku `useAuthorsList`:

```typescript
function useAuthorsList() {
  // Stan danych
  const [profile, setProfile] = useState<ProfileResponseDto | null>(null);
  const [authors, setAuthors] = useState<UserAuthorDto[]>([]);
  const [total, setTotal] = useState(0);

  // Stan UI
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stan modali
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteAuthorId, setDeleteAuthorId] = useState<string | null>(null);

  // Odczyt filtrów z URL (Next.js useSearchParams lub własna implementacja)
  const [searchParams, setSearchParams] = useSearchParams();
  const filters: AuthorsListFilters = {
    page: parseInt(searchParams.get("page") || "1", 10),
    search: searchParams.get("search") || "",
    sort: (searchParams.get("sort") as "name_asc" | "created_desc") || "name_asc",
  };

  // Obliczony limit status
  const limitStatus: LimitStatus = useMemo(() => {
    if (!profile) return { current: 0, max: 500, isAtLimit: false, remaining: 500, percentage: 0 };
    return {
      current: profile.author_count,
      max: profile.max_authors,
      isAtLimit: profile.author_count >= profile.max_authors,
      remaining: profile.max_authors - profile.author_count,
      percentage: (profile.author_count / profile.max_authors) * 100,
    };
  }, [profile]);

  // Funkcje do zmiany filtrów (aktualizują URL)
  const setSearch = (search: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (search) {
      newParams.set("search", search);
    } else {
      newParams.delete("search");
    }
    newParams.delete("page"); // reset do pierwszej strony
    setSearchParams(newParams);
  };

  const setSort = (sort: "name_asc" | "created_desc") => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("sort", sort);
    newParams.delete("page"); // reset do pierwszej strony
    setSearchParams(newParams);
  };

  const setPage = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    if (page > 1) {
      newParams.set("page", page.toString());
    } else {
      newParams.delete("page");
    }
    setSearchParams(newParams);
  };

  // Funkcja do pobierania profilu
  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/user/profile");
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        throw new Error("Nie udało się pobrać profilu");
      }
      const data: ProfileResponseDto = await response.json();
      setProfile(data);
    } catch (err) {
      console.error("Error fetching profile:", err);
      // Profile error nie blokuje wyświetlania listy
    }
  };

  // Funkcja do pobierania listy autorów
  const fetchAuthors = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (filters.page > 1) queryParams.set("page", filters.page.toString());
      if (filters.search) queryParams.set("search", filters.search);
      if (filters.sort) queryParams.set("sort", filters.sort);

      const response = await fetch(`/api/user/authors?${queryParams}`);

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        throw new Error("Nie udało się pobrać listy autorów");
      }

      const data: UserAuthorsListResponseDto = await response.json();
      setAuthors(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd");
    } finally {
      setIsLoading(false);
    }
  };

  // Funkcja do usuwania autora
  const deleteAuthor = async (authorId: string) => {
    try {
      const response = await fetch(`/api/user/authors/${authorId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (response.status === 404) {
          throw new Error("Autor nie jest dołączony do Twojego profilu");
        }
        throw new Error("Nie udało się usunąć autora");
      }

      // Odśwież dane
      await Promise.all([fetchProfile(), fetchAuthors()]);

      // Wyświetl toast sukcesu
      toast.success("Autor został usunięty z profilu");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wystąpił błąd");
    }
  };

  // Effect do pobierania danych przy montowaniu i zmianie filtrów
  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    fetchAuthors();
  }, [filters.page, filters.search, filters.sort]);

  return {
    // Dane
    profile,
    authors,
    total,
    filters,
    limitStatus,

    // Stany UI
    isLoading,
    error,

    // Stany modali
    isAddModalOpen,
    setIsAddModalOpen,
    deleteAuthorId,
    setDeleteAuthorId,

    // Akcje
    setSearch,
    setSort,
    setPage,
    refreshList: fetchAuthors,
    refreshProfile: fetchProfile,
    deleteAuthor,
  };
}
```

### 6.3. Stan w AddAuthorModal

Modal zarządza własnym stanem wewnętrznym dla wyszukiwania i dodawania:

```typescript
function useAuthorSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 500);
  const [results, setResults] = useState<AuthorSearchResultDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Efekt wyszukiwania
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const searchAuthors = async () => {
      setIsSearching(true);
      setSearchError(null);

      try {
        const response = await fetch(`/api/authors/search?q=${encodeURIComponent(debouncedQuery)}&limit=10`);

        if (!response.ok) {
          if (response.status === 502) {
            throw new Error("OpenLibrary jest obecnie niedostępne. Spróbuj ponownie później lub dodaj autora ręcznie.");
          }
          throw new Error("Nie udało się wyszukać autorów");
        }

        const data: AuthorSearchResponseDto = await response.json();
        setResults(data.authors);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Wystąpił błąd");
      } finally {
        setIsSearching(false);
      }
    };

    searchAuthors();
  }, [debouncedQuery]);

  return { query, setQuery, results, isSearching, searchError };
}
```

## 7. Integracja API

### 7.1. Endpoint: GET /api/user/profile

**Cel**: Pobranie danych profilu użytkownika (liczniki i limity).

**Request**:

- Metoda: GET
- URL: `/api/user/profile`
- Headers: Authorization (session cookie/token)
- Body: Brak

**Response 200**:

```typescript
{
  author_count: number,
  work_count: number,
  max_authors: number,
  max_works: number
}
```

**Response 401**: Brak autoryzacji

```typescript
{
  error: "Unauthorized",
  message: "Authentication required"
}
```

**Response 404**: Profil nie znaleziony

```typescript
{
  error: "Not Found",
  message: "Profile not found"
}
```

**Frontend handling**:

- Wywołanie przy montowaniu komponentu
- 401 → redirect do `/login`
- 404 → wyświetlenie komunikatu błędu
- Sukces → zapisanie danych profilu w state

### 7.2. Endpoint: GET /api/user/authors

**Cel**: Pobranie paginowanej listy autorów użytkownika.

**Request**:

- Metoda: GET
- URL: `/api/user/authors?page={page}&search={search}&sort={sort}`
- Query params:
  - `page` (optional, default: 1): numer strony
  - `search` (optional): fraza wyszukiwania (max 200 znaków)
  - `sort` (optional, default: "name_asc"): "name_asc" | "created_desc"
- Headers: Authorization

**Response 200**:

```typescript
{
  items: UserAuthorDto[],
  total: number
}
```

**Response 400**: Błąd walidacji

```typescript
{
  error: "Validation error",
  message: string,
  details: any[]
}
```

**Response 401**: Brak autoryzacji

**Frontend handling**:

- Wywołanie przy montowaniu i zmianie filtrów (page, search, sort)
- Odczyt parametrów z URL
- Walidacja parametrów przed wysłaniem
- 401 → redirect do `/login`
- 400 → wyświetlenie komunikatu błędu
- Sukces → aktualizacja listy autorów

### 7.3. Endpoint: DELETE /api/user/authors/{authorId}

**Cel**: Usunięcie autora z profilu użytkownika (odłączenie).

**Request**:

- Metoda: DELETE
- URL: `/api/user/authors/{authorId}`
- Path params: `authorId` (UUID)
- Headers: Authorization

**Response 204**: Sukces (brak treści)

**Response 400**: Błąd walidacji UUID

```typescript
{
  error: "Validation error",
  message: "authorId must be a valid UUID"
}
```

**Response 401**: Brak autoryzacji

**Response 404**: Autor nie jest dołączony do profilu

```typescript
{
  error: "Not Found",
  message: "Author is not attached to your profile"
}
```

**Frontend handling**:

- Wywołanie po potwierdzeniu w DeleteAuthorDialog
- 401 → redirect do `/login`
- 404 → komunikat + refresh listy
- Sukces → refresh profilu i listy, toast sukcesu

### 7.4. Endpoint: GET /api/authors/search

**Cel**: Wyszukiwanie autorów w OpenLibrary (używane w AddAuthorModal).

**Request**:

- Metoda: GET
- URL: `/api/authors/search?q={query}&limit={limit}`
- Query params:
  - `q` (required): fraza wyszukiwania
  - `limit` (optional, default: 10): liczba wyników
- Headers: Authorization

**Response 200**:

```typescript
{
  authors: AuthorSearchResultDto[]
}
```

**Response 502**: OpenLibrary niedostępne

```typescript
{
  error: "Bad Gateway",
  message: "OpenLibrary service is currently unavailable"
}
```

**Frontend handling**:

- Wywołanie w AuthorSearchTab z debounce (500ms)
- Min 2 znaki do rozpoczęcia wyszukiwania
- 502 → komunikat + sugestia ręcznego dodania
- Sukces → wyświetlenie wyników

### 7.5. Endpoint: POST /api/openlibrary/import/author

**Cel**: Import autora z OpenLibrary do katalogu (używane przed attach).

**Request**:

- Metoda: POST
- URL: `/api/openlibrary/import/author`
- Body:

```typescript
{
  openlibrary_id: string;
}
```

**Response 200**:

```typescript
{
  author: AuthorDto;
}
```

**Response 502**: OpenLibrary niedostępne

**Frontend handling**:

- Wywołanie w AuthorSearchTab gdy wybrany autor OL nie ma jeszcze `id`
- 502 → komunikat błędu
- Sukces → przejście do attach

### 7.6. Endpoint: POST /api/user/authors

**Cel**: Dołączenie autora do profilu użytkownika.

**Request**:

- Metoda: POST
- URL: `/api/user/authors`
- Body:

```typescript
{
  author_id: string; // UUID
}
```

**Response 201**:

```typescript
{
  author_id: string,
  created_at: string
}
```

**Response 409**: Konflikt (limit/duplikat)

```typescript
{
  error: "Conflict",
  message: "Author limit reached (500 authors per user)" | "Author is already attached to your profile"
}
```

**Response 429**: Rate limit

```typescript
{
  error: "Too Many Requests",
  message: "Rate limit exceeded: maximum 10 author additions per minute"
}
```

**Response 404**: Autor nie znaleziony

```typescript
{
  error: "Not Found",
  message: "Author not found or not accessible"
}
```

**Frontend handling**:

- Wywołanie w AddAuthorModal po wybraniu/utworzeniu autora
- 409 (limit) → komunikat o limicie, disable przycisku dodawania
- 409 (duplikat) → komunikat że już dodany, zamknięcie modalu
- 429 → komunikat z sugestią odczekania 60s, opcjonalnie timer
- 404 → komunikat błędu
- Sukces → zamknięcie modalu, refresh profilu i listy, toast sukcesu

### 7.7. Endpoint: POST /api/authors (dla ręcznego dodawania)

**Cel**: Utworzenie ręcznego autora (manual=true).

**Request**:

- Metoda: POST
- URL: `/api/authors`
- Body:

```typescript
{
  name: string,
  manual: true
}
```

**Response 201**:

```typescript
{
  author: AuthorDto;
}
```

**Response 400**: Błąd walidacji

```typescript
{
  error: "Validation error",
  message: string
}
```

**Response 409**: Konflikt (np. duplikat)

**Frontend handling**:

- Wywołanie w ManualAuthorTab
- Walidacja: name min 1 znak, max 500 znaków, trimmed
- Po sukcesie → wywołanie POST /api/user/authors z author.id

## 8. Interakcje użytkownika

### 8.1. Załadowanie widoku

**Akcja**: Użytkownik wchodzi na `/app/authors`

**Przebieg**:

1. Astro middleware weryfikuje sesję
2. Brak sesji → redirect do `/login`
3. Sesja OK → renderowanie strony
4. Komponent React montuje się
5. useAuthorsList wywołuje `fetchProfile()` i `fetchAuthors()`
6. Podczas ładowania → wyświetlenie AuthorsListSkeleton
7. Po załadowaniu → wyświetlenie listy lub EmptyState

**Stan UI**:

- isLoading: true → false
- Skeleton → Lista/EmptyState

### 8.2. Wyszukiwanie autora

**Akcja**: Użytkownik wpisuje frazę w SearchInput

**Przebieg**:

1. Zmiana wartości inputu → aktualizacja lokalnego stanu
2. Po 500ms debounce → wywołanie setSearch(value)
3. setSearch aktualizuje URL (search param)
4. Zmiana URL triggeruje useEffect w useAuthorsList
5. Wywołanie fetchAuthors() z nowym search
6. Lista jest aktualizowana, page resetuje się do 1

**Stan UI**:

- Wyświetlenie loading state
- Po załadowaniu → nowa lista lub NoResultsState

### 8.3. Zmiana sortowania

**Akcja**: Użytkownik wybiera opcję z SortSelect

**Przebieg**:

1. onChange → wywołanie setSort(newSort)
2. setSort aktualizuje URL (sort param)
3. Zmiana URL triggeruje useEffect
4. Wywołanie fetchAuthors() z nowym sort
5. Lista jest aktualizowana, page resetuje się do 1

**Stan UI**:

- Loading state podczas pobierania
- Zaktualizowana lista z nowym sortowaniem

### 8.4. Nawigacja między stronami

**Akcja**: Użytkownik klika "Następna" lub "Poprzednia"

**Przebieg**:

1. onClick → wywołanie setPage(currentPage + 1) lub setPage(currentPage - 1)
2. setPage aktualizuje URL (page param)
3. Zmiana URL triggeruje useEffect
4. Wywołanie fetchAuthors() z nowym page
5. Lista jest aktualizowana

**Stan UI**:

- Loading state
- Nowa strona autorów
- Zaktualizowana informacja "Strona X z Y"
- Stan przycisków (disabled gdy na pierwszej/ostatniej)

### 8.5. Kliknięcie w autora

**Akcja**: Użytkownik klika w wiersz autora (AuthorRow)

**Przebieg**:

1. onClick → navigate do `/app/authors/{authorId}`
2. Przejście do widoku szczegółów autora

**Stan UI**:

- Nawigacja do nowego widoku

### 8.6. Otwieranie modalu dodawania autora

**Akcja**: Użytkownik klika przycisk "Dodaj autora"

**Przebieg**:

1. onClick na AddAuthorButton
2. Sprawdzenie limitStatus.isAtLimit
3. Jeśli at limit → brak akcji (przycisk disabled)
4. Jeśli OK → setIsAddModalOpen(true)
5. Modal się otwiera z domyślną zakładką (OL search)

**Stan UI**:

- isAddModalOpen: false → true
- Modal widoczny, focus w polu wyszukiwania

### 8.7. Wyszukiwanie w modalu OL

**Akcja**: Użytkownik wpisuje nazwę autora w AuthorSearchTab

**Przebieg**:

1. Zmiana wartości inputu → aktualizacja query
2. Po 500ms debounce → wywołanie API search
3. isSearching: true
4. Po otrzymaniu wyników → setResults()
5. isSearching: false
6. Wyświetlenie listy wyników

**Stan UI**:

- Podczas wyszukiwania: Skeleton/spinner
- Po wyszukiwaniu: Lista wyników lub empty state
- Error: Komunikat błędu + retry

### 8.8. Dodawanie autora z OL

**Akcja**: Użytkownik klika "Dodaj" przy wyniku z OL

**Przebieg**:

1. onClick → sprawdzenie czy autor ma już `id` w bazie
2. Jeśli nie ma `id` → wywołanie POST /api/openlibrary/import/author
3. Jeśli ma `id` lub po imporcie → wywołanie POST /api/user/authors
4. isAdding: true
5. Po sukcesie:
   - Toast sukcesu
   - setIsAddModalOpen(false)
   - Wywołanie onAuthorAdded() → refresh profilu i listy
6. Po błędzie:
   - Wyświetlenie komunikatu błędu (toast lub inline)
   - Modal pozostaje otwarty

**Stan UI**:

- isAdding: true → false
- Przycisk "Dodaj" → disabled + spinner
- Po sukcesie: modal zamknięty, zaktualizowana lista
- Po błędzie: komunikat błędu

**Obsługa błędów**:

- 429 → "Dodano zbyt wielu autorów. Odczekaj 60 sekund."
- 409 (limit) → "Osiągnięto limit 500 autorów"
- 409 (duplikat) → "Autor jest już w Twoim profilu" + zamknięcie modalu
- 502 → "OpenLibrary niedostępne. Spróbuj ponownie lub dodaj ręcznie"

### 8.9. Ręczne dodawanie autora

**Akcja**: Użytkownik przełącza się na zakładkę "Dodaj ręcznie" i wypełnia formularz

**Przebieg**:

1. Przełączenie zakładki → ManualAuthorTab
2. Wprowadzenie nazwy autora
3. Submit formularza:
   - Walidacja: name min 1 znak, max 500, trimmed
   - POST /api/authors (manual: true)
   - Po sukcesie → POST /api/user/authors z author.id
4. isCreating: true
5. Po sukcesie:
   - Toast sukcesu
   - Zamknięcie modalu
   - Refresh profilu i listy
6. Po błędzie:
   - Komunikat błędu (inline w formularzu)

**Stan UI**:

- isCreating: true → false
- Przycisk submit → disabled + spinner podczas tworzenia
- Po sukcesie: modal zamknięty, zaktualizowana lista

### 8.10. Usuwanie autora

**Akcja**: Użytkownik klika przycisk usuwania w AuthorRow

**Przebieg**:

1. onClick → setDeleteAuthorId(author.id)
2. DeleteAuthorDialog otwiera się
3. Wyświetlenie informacji o autorze i ostrzeżenia
4. Użytkownik klika "Usuń":
   - DELETE /api/user/authors/{authorId}
   - Po sukcesie:
     - Toast sukcesu
     - setDeleteAuthorId(null)
     - Refresh profilu i listy
   - Po błędzie:
     - Toast błędu
     - Dialog zamknięty
5. Użytkownik klika "Anuluj":
   - setDeleteAuthorId(null)
   - Dialog zamknięty

**Stan UI**:

- deleteAuthorId: null → authorId → null
- Dialog: otwarty → zamknięty
- Lista: zaktualizowana po usunięciu

### 8.11. Osiągnięcie limitu autorów

**Akcja**: Użytkownik próbuje dodać autora gdy author_count >= max_authors

**Przebieg**:

1. limitStatus.isAtLimit === true
2. AddAuthorButton jest disabled
3. Tooltip przy hover: "Osiągnięto limit 500 autorów"
4. Próba dodania autora w modalu (jeśli był otwarty wcześniej):
   - API zwraca 409
   - Komunikat: "Osiągnięto limit 500 autorów"
   - Modal można zamknąć

**Stan UI**:

- AddAuthorButton: disabled
- Tooltip widoczny przy hover
- LimitIndicator: wizualizacja 100% (np. czerwony kolor)

### 8.12. Rate limit (429)

**Akcja**: Użytkownik próbuje dodać > 10 autorów w ciągu minuty

**Przebieg**:

1. API zwraca 429 z header "Retry-After: 60"
2. Wyświetlenie komunikatu: "Dodano zbyt wielu autorów. Odczekaj 60 sekund."
3. Opcjonalnie: timer odliczający pozostały czas
4. Użytkownik musi odczekać przed kolejną próbą

**Stan UI**:

- Komunikat błędu (toast lub inline w modalu)
- Opcjonalnie countdown timer

## 9. Warunki i walidacja

### 9.1. Walidacja po stronie klienta

#### SearchInput (wyszukiwanie autorów w liście)

- **Max length**: 200 znaków
- **Warunek**: Długość search <= 200
- **Gdzie**: AuthorsToolbar → SearchInput
- **Reakcja**: Wyświetlenie komunikatu błędu pod inputem gdy przekroczono limit
- **Implementacja**: `maxLength` attribute + walidacja onChange

#### Page number (paginacja)

- **Min value**: 1
- **Max value**: Math.ceil(total / PAGE_SIZE)
- **Warunek**: 1 <= page <= totalPages
- **Gdzie**: AuthorsPagination
- **Reakcja**: Disable przycisków "Poprzednia"/"Następna" gdy na granicy
- **Implementacja**: Warunkowe disabled na przyciskach

#### Sort parameter

- **Dozwolone wartości**: "name_asc" | "created_desc"
- **Warunek**: sort in ["name_asc", "created_desc"]
- **Gdzie**: AuthorsToolbar → SortSelect
- **Reakcja**: Dropdown z tylko dozwolonymi opcjami
- **Implementacja**: Kontrolowany select z predefiniowanymi opcjami

#### Author limit check (przed otwarciem modalu)

- **Warunek**: author_count < max_authors
- **Gdzie**: AddAuthorButton
- **Reakcja**: Disable przycisku gdy at limit, tooltip z wyjaśnieniem
- **Implementacja**: `disabled={limitStatus.isAtLimit}`

#### Author search query (w modalu OL)

- **Min length**: 2 znaki (przed wywołaniem API)
- **Max length**: 200 znaków
- **Warunek**: 2 <= query.length <= 200
- **Gdzie**: AddAuthorModal → AuthorSearchTab
- **Reakcja**: Nie wywołuj API gdy < 2 znaki, komunikat błędu gdy > 200
- **Implementacja**: Conditional API call + maxLength

#### Manual author name

- **Min length**: 1 znak (po trim)
- **Max length**: 500 znaków
- **Warunek**: 1 <= name.trim().length <= 500
- **Gdzie**: AddAuthorModal → ManualAuthorTab
- **Reakcja**: Wyświetlenie błędu walidacji, disable submit gdy niepoprawne
- **Implementacja**: Form validation z Zod lub React Hook Form

### 9.2. Walidacja po stronie API (obsługa błędów)

#### 400 Validation Error

- **Przyczyna**: Niepoprawne parametry (page, search, sort)
- **Gdzie**: GET /api/user/authors, DELETE /api/user/authors/{authorId}
- **Reakcja**: Wyświetlenie komunikatu błędu, sugestia poprawienia parametrów
- **Implementacja**: Parsowanie error response, wyświetlenie details

#### 401 Unauthorized

- **Przyczyna**: Brak sesji lub wygasła sesja
- **Gdzie**: Wszystkie endpointy
- **Reakcja**: Redirect do `/login`
- **Implementacja**: Global error handler lub per-request check

#### 404 Not Found (profile)

- **Przyczyna**: Profil użytkownika nie istnieje
- **Gdzie**: GET /api/user/profile
- **Reakcja**: Komunikat błędu "Profil nie znaleziony. Skontaktuj się z pomocą techniczną."
- **Implementacja**: Error state w UI

#### 404 Not Found (author not attached)

- **Przyczyna**: Próba usunięcia autora który nie jest dołączony (race condition)
- **Gdzie**: DELETE /api/user/authors/{authorId}
- **Reakcja**: Toast z informacją, refresh listy
- **Implementacja**: Catch 404, show message, refresh

#### 409 Conflict (limit reached)

- **Przyczyna**: author_count >= max_authors
- **Gdzie**: POST /api/user/authors
- **Reakcja**: Komunikat "Osiągnięto limit 500 autorów", zamknięcie modalu, refresh profilu
- **Implementacja**: Parsowanie error message, różnicowanie od duplikatu

#### 409 Conflict (duplicate)

- **Przyczyna**: Autor już dołączony do profilu
- **Gdzie**: POST /api/user/authors
- **Reakcja**: Komunikat "Autor jest już w Twoim profilu", zamknięcie modalu
- **Implementacja**: Parsowanie error message

#### 429 Too Many Requests

- **Przyczyna**: > 10 requests/min do POST /api/user/authors
- **Gdzie**: POST /api/user/authors
- **Reakcja**: Komunikat "Dodano zbyt wielu autorów. Odczekaj 60 sekund.", opcjonalnie timer
- **Implementacja**: Parsowanie Retry-After header, countdown

#### 502 Bad Gateway (OpenLibrary)

- **Przyczyna**: OpenLibrary niedostępne
- **Gdzie**: GET /api/authors/search, POST /api/openlibrary/import/author
- **Reakcja**: Komunikat "OpenLibrary jest niedostępne. Spróbuj ponownie później lub dodaj autora ręcznie.", pokazanie zakładki ręcznego dodania
- **Implementacja**: Error state + sugestia fallbacku

#### 500 Internal Server Error

- **Przyczyna**: Błąd serwera
- **Gdzie**: Wszystkie endpointy
- **Reakcja**: Komunikat "Wystąpił błąd serwera. Spróbuj ponownie.", przycisk retry
- **Implementacja**: Generic error handler

### 9.3. Wpływ warunków na stan UI

| Warunek                             | Komponent          | Efekt UI                            |
| ----------------------------------- | ------------------ | ----------------------------------- |
| author_count >= max_authors         | AddAuthorButton    | Disabled + tooltip                  |
| author_count >= max_authors         | LimitIndicator     | Kolor czerwony, 100%                |
| page === 1                          | AuthorsPagination  | "Poprzednia" disabled               |
| page === totalPages                 | AuthorsPagination  | "Następna" disabled                 |
| authors.length === 0 && !hasFilters | AuthorsListContent | EmptyState                          |
| authors.length === 0 && hasFilters  | AuthorsListContent | NoResultsState                      |
| isLoading                           | AuthorsListContent | Skeleton                            |
| error !== null                      | AuthorsListContent | ErrorDisplay                        |
| search.length > 200                 | SearchInput        | Komunikat błędu                     |
| query.length < 2                    | AuthorSearchTab    | Nie wywołuj API                     |
| isSearching                         | AuthorSearchTab    | Loading state                       |
| searchError !== null                | AuthorSearchTab    | Error state + retry                 |
| name.trim().length < 1              | ManualAuthorTab    | Submit disabled                     |
| isAdding                            | AuthorSearchTab    | Przycisk "Dodaj" disabled + spinner |
| isCreating                          | ManualAuthorTab    | Submit disabled + spinner           |
| deleteAuthorId !== null             | DeleteAuthorDialog | Dialog otwarty                      |

## 10. Obsługa błędów

### 10.1. Kategorie błędów

#### Błędy autentykacji (401)

- **Przyczyna**: Brak sesji lub wygasła sesja
- **Obsługa**: Automatyczny redirect do `/login`
- **Implementacja**: Global error interceptor lub per-request check
- **UX**: Brak komunikatu (tylko redirect), opcjonalnie toast "Sesja wygasła, zaloguj się ponownie"

#### Błędy walidacji (400)

- **Przyczyna**: Niepoprawne parametry lub body requestu
- **Obsługa**: Wyświetlenie komunikatu błędu z details
- **Implementacja**: Parsowanie response.details, mapowanie na pola formularza
- **UX**: Inline errors przy polach, lub toast z opisem błędu

#### Błędy zasobów (404)

- **Przyczyna**: Zasób nie istnieje lub nie jest dostępny (RLS)
- **Obsługa**:
  - Profile 404: Komunikat błędu "Profil nie znaleziony"
  - Author 404 (delete): Toast + refresh listy
- **Implementacja**: Różnicowanie kontekstu błędu
- **UX**: Toast lub inline message

#### Błędy konfliktów (409)

- **Przyczyna**: Limit osiągnięty lub duplikat
- **Obsługa**:
  - Limit: Komunikat o limicie, refresh profilu, zamknięcie modalu
  - Duplikat: Komunikat że już dodany, zamknięcie modalu
- **Implementacja**: Parsowanie error.message do rozróżnienia typu konfliktu
- **UX**: Toast + zamknięcie modalu, opcjonalnie redirect do szczegółów autora

#### Błędy rate limiting (429)

- **Przyczyna**: Przekroczono limit requestów (10/min)
- **Obsługa**: Komunikat z sugestią odczekania, opcjonalnie countdown timer
- **Implementacja**: Parsowanie Retry-After header, useState z timerem
- **UX**: Toast lub inline message w modalu, disable przycisku dodawania na X sekund

#### Błędy zewnętrznych serwisów (502)

- **Przyczyna**: OpenLibrary niedostępne
- **Obsługa**: Komunikat o niedostępności, sugestia fallbacku (ręczne dodanie)
- **Implementacja**: Error state w AuthorSearchTab, automatyczne pokazanie zakładki manual
- **UX**: Inline error w modalu z przyciskiem "Dodaj ręcznie"

#### Błędy serwera (500)

- **Przyczyna**: Wewnętrzny błąd serwera
- **Obsługa**: Komunikat ogólny, przycisk retry
- **Implementacja**: Generic error handler, funkcja retry
- **UX**: ErrorDisplay z przyciskiem "Spróbuj ponownie"

#### Błędy sieci (Network Error)

- **Przyczyna**: Brak połączenia z internetem
- **Obsługa**: Komunikat o braku połączenia, przycisk retry
- **Implementacja**: Catch w try-catch fetch, sprawdzenie `error instanceof TypeError`
- **UX**: ErrorDisplay "Sprawdź połączenie z internetem"

### 10.2. Strategia wyświetlania błędów

#### Toast notifications (Sonner)

- **Kiedy**: Akcje zakończone sukcesem lub błędem (add, delete)
- **Typy**:
  - Success: "Autor został dodany", "Autor został usunięty"
  - Error: Błędy API (409, 429, 500)
- **Pozycja**: Top-right lub top-center
- **Auto-dismiss**: 5s dla success, 10s dla error

#### Inline errors

- **Kiedy**: Błędy walidacji formularzy, błędy wyszukiwania w modalu
- **Gdzie**: Pod inputem/formularzem w którym wystąpił błąd
- **Przykład**: SearchInput z komunikatem "Maksymalnie 200 znaków"

#### Error states komponentów

- **Kiedy**: Błąd podczas ładowania danych głównych (lista autorów)
- **Gdzie**: ErrorDisplay zamiast tabeli
- **Zawartość**: Ikona, komunikat, przycisk retry

#### Dialog errors

- **Kiedy**: Krytyczne błędy wymagające potwierdzenia użytkownika
- **Przykład**: Nieudane usunięcie autora z przyczyn systemowych
- **Implementacja**: AlertDialog z komunikatem błędu

### 10.3. Mapowanie błędów API na komunikaty użytkownika

| Status         | Endpoint                            | Komunikat                                             |
| -------------- | ----------------------------------- | ----------------------------------------------------- |
| 401            | Wszystkie                           | Redirect do `/login`                                  |
| 400            | GET /api/user/authors               | "Niepoprawne parametry wyszukiwania"                  |
| 400            | DELETE /api/user/authors/{id}       | "Niepoprawny identyfikator autora"                    |
| 400            | POST /api/authors                   | "Nazwa autora jest wymagana"                          |
| 404            | GET /api/user/profile               | "Profil nie znaleziony"                               |
| 404            | DELETE /api/user/authors/{id}       | "Autor nie jest dołączony do profilu"                 |
| 409 (limit)    | POST /api/user/authors              | "Osiągnięto limit 500 autorów"                        |
| 409 (duplikat) | POST /api/user/authors              | "Autor jest już w Twoim profilu"                      |
| 429            | POST /api/user/authors              | "Dodano zbyt wielu autorów. Odczekaj 60 sekund."      |
| 502            | GET /api/authors/search             | "OpenLibrary jest niedostępne. Dodaj autora ręcznie." |
| 502            | POST /api/openlibrary/import/author | "Nie można zaimportować autora. Spróbuj ponownie."    |
| 500            | Wszystkie                           | "Wystąpił błąd serwera. Spróbuj ponownie później."    |
| Network Error  | Wszystkie                           | "Brak połączenia z internetem"                        |

### 10.4. Mechanizmy odzyskiwania (Recovery)

#### Retry mechanism

- **Gdzie**: ErrorDisplay, AuthorSearchTab (po 502)
- **Implementacja**: Przycisk "Spróbuj ponownie" → ponowne wywołanie funkcji fetch
- **Limit**: Brak automatycznego retry, tylko manualnie przez użytkownika

#### Automatic refresh after error

- **Kiedy**: 404 po delete (race condition) → automatyczny refresh listy
- **Implementacja**: Po złapaniu 404 w deleteAuthor, wywołaj fetchAuthors()

#### Fallback UI

- **Gdzie**: AuthorSearchTab → ManualAuthorTab po 502
- **Implementacja**: Error state pokazuje przycisk "Dodaj ręcznie" który przełącza zakładkę

#### Optimistic updates rollback

- **Nie stosujemy w MVP**: Dla uproszczenia, zawsze czekamy na odpowiedź API przed aktualizacją UI
- **Przyszłość**: Możliwość dodania dla lepszego UX (np. natychmiastowe usunięcie z listy, rollback jeśli błąd)

## 11. Kroki implementacji

### Krok 1: Przygotowanie struktury projektu

1. Utworzenie struktury katalogów:
   - `src/pages/app/authors.astro` (strona Astro)
   - `src/components/authors/` (komponenty React)
2. Konfiguracja Astro dla React islands (`client:load`)
3. Sprawdzenie konfiguracji Tailwind i shadcn/ui

### Krok 2: Implementacja typów

1. Weryfikacja typów w `src/types.ts` (czy wszystkie potrzebne istnieją)
2. Dodanie nowych typów ViewModel w `src/components/authors/types.ts`:
   - `AuthorsListFilters`
   - `AuthorsListState`
   - `LimitStatus`
   - `AuthorSearchState`
   - `ManualAuthorState`
3. Eksport typów

### Krok 3: Utworzenie custom hooks

1. Implementacja `src/components/authors/hooks/useAuthorsList.ts`:
   - State management (profile, authors, filters, UI states)
   - Funkcje fetch (fetchProfile, fetchAuthors)
   - Funkcje akcji (setSearch, setSort, setPage, deleteAuthor)
   - Synchronizacja z URL (useSearchParams)
   - useEffect dla inicjalizacji i reakcji na zmiany filtrów
2. Implementacja `src/components/authors/hooks/useAuthorSearch.ts`:
   - State dla wyszukiwania OL
   - Debounced search
   - Funkcja addAuthor (import + attach)
3. Implementacja `src/components/authors/hooks/useManualAuthor.ts`:
   - State dla ręcznego dodawania
   - Funkcja createManualAuthor (create + attach)
4. Implementacja `src/lib/hooks/useDebounce.ts` (jeśli nie istnieje):
   - Generic debounce hook

### Krok 4: Implementacja komponentów prezentacyjnych (atomic)

1. `LimitIndicator.tsx`:
   - Props: current, max, className
   - Obliczenie percentage, isAtLimit
   - Warunkowe stylowanie
2. `SearchInput.tsx`:
   - Input z shadcn/ui
   - Ikona search, przycisk clear
   - Obsługa maxLength, validacja
3. `SortSelect.tsx`:
   - Select z shadcn/ui
   - Opcje: name_asc, created_desc
4. `AddAuthorButton.tsx`:
   - Button z shadcn/ui
   - Tooltip z shadcn/ui (gdy disabled)
   - Props: onClick, isDisabled, disabledReason
5. `AuthorRow.tsx`:
   - Layout wiersza (flex/grid)
   - Link do szczegółów autora
   - Badge (OL/Manual)
   - Przycisk usuwania (ikona)
6. `AuthorsListSkeleton.tsx`:
   - Skeleton UI z shadcn/ui
   - 5-10 wierszy
7. `ErrorDisplay.tsx`:
   - Ikona błędu
   - Komunikat
   - Przycisk retry
8. `EmptyState.tsx`:
   - Ilustracja
   - Tekst
   - Przycisk CTA
9. `NoResultsState.tsx`:
   - Podobnie do EmptyState
   - Przycisk "Wyczyść filtry"

### Krok 5: Implementacja komponentów złożonych (molecules)

1. `PageHeader.tsx`:
   - Layout z tytułem i LimitIndicator
2. `AuthorsToolbar.tsx`:
   - Layout flex
   - Kompozycja: SearchInput, SortSelect, AddAuthorButton
   - Obsługa callbacków
3. `AuthorsTable.tsx`:
   - Layout tabeli/listy
   - Mapowanie authors → AuthorRow
   - Props: authors, onDeleteAuthor
4. `AuthorsListContent.tsx`:
   - Warunkowe renderowanie (loading/error/empty/table)
   - Props: isLoading, error, authors, hasFilters
5. `AuthorsPagination.tsx`:
   - Przyciski Previous/Next
   - Informacja o stronie
   - Obliczenie totalPages
   - Conditional disabled

### Krok 6: Implementacja modali

1. `DeleteAuthorDialog.tsx`:
   - AlertDialog z shadcn/ui
   - Props: isOpen, author, onConfirm, onCancel
   - Treść z nazwą autora
   - Przyciski akcji
2. `AuthorSearchTab.tsx`:
   - SearchInput z debounce
   - useAuthorSearch hook
   - Lista wyników (Command list)
   - Loading/empty/error states
   - Przycisk "Dodaj" przy każdym wyniku
   - Obsługa błędów (429, 409, 502)
3. `ManualAuthorTab.tsx`:
   - Formularz z React Hook Form + Zod
   - Input nazwy autora
   - useManualAuthor hook
   - Submit handler
   - Obsługa błędów
4. `AddAuthorModal.tsx`:
   - Dialog z shadcn/ui
   - Tabs z shadcn/ui
   - Props: isOpen, onClose, onAuthorAdded
   - Kompozycja AuthorSearchTab i ManualAuthorTab
   - Focus management (focus w input po otwarciu)

### Krok 7: Implementacja głównego widoku React

1. `AuthorsListView.tsx`:
   - Inicjalizacja useAuthorsList
   - Obliczenie hasFilters
   - Obliczenie totalPages
   - Layout główny (flex/grid)
   - Kompozycja wszystkich podkomponentów:
     - PageHeader
     - AuthorsToolbar
     - AuthorsListContent
     - AuthorsPagination
     - AddAuthorModal (warunkowo)
     - DeleteAuthorDialog (warunkowo)
   - Przekazywanie props i callbacków

### Krok 8: Implementacja strony Astro

1. `src/pages/app/authors.astro`:
   - Import Layout (`src/layouts/Layout.astro`)
   - Middleware check (auth verification)
   - Renderowanie AuthorsListView z `client:load`
   - SEO meta tags (title, description)
   - Przykład:

   ```astro
   ---
   import Layout from "@/layouts/Layout.astro";
   import AuthorsListView from "@/components/authors/AuthorsListView";

   // Middleware sprawdza sesję automatycznie
   // Redirect do /login jeśli brak autoryzacji
   ---

   <Layout title="Autorzy - BookFlow">
     <AuthorsListView client:load />
   </Layout>
   ```

### Krok 9: Stylowanie i responsywność

1. Wykorzystanie Tailwind utility classes
2. Wykorzystanie komponentów shadcn/ui (już ostylowane)
3. Sprawdzenie responsywności:
   - Mobile: Stack layout, uproszczone view
   - Tablet: 2-column gdzie możliwe
   - Desktop: Pełny layout z sidebar (jeśli planowany)
4. Testy na różnych rozdzielczościach
5. Accessibility: focus states, aria-labels, keyboard navigation

### Krok 10: Integracja z API

1. Weryfikacja że wszystkie endpointy działają (testy w Postman/Insomnia)
2. Testy wywołań fetch w komponentach
3. Sprawdzenie obsługi wszystkich kodów błędów
4. Testy rate limiting (dodanie 11 autorów w minucie)
5. Testy limitu autorów (zbliżenie się do 500)

### Krok 11: Obsługa błędów i edge cases

1. Test scenariuszy błędów:
   - Brak internetu
   - 401 (wylogowanie)
   - 404 (zasób nie istnieje)
   - 409 (limit, duplikat)
   - 429 (rate limit)
   - 502 (OL down)
   - 500 (server error)
2. Implementacja toast notifications (Sonner)
3. Sprawdzenie wszystkich error messages
4. Test recovery mechanisms (retry)

### Krok 12: Testy manualne

\*\* do zapisania w pliku `.ai/ui/app-authors-view-manual-tests.md`

1. Happy path:
   - Załadowanie strony z autorami
   - Wyszukiwanie autora
   - Sortowanie
   - Paginacja
   - Dodanie autora z OL
   - Dodanie ręcznego autora
   - Usunięcie autora
2. Edge cases:
   - Brak autorów (EmptyState)
   - Brak wyników wyszukiwania (NoResultsState)
   - Osiągnięcie limitu
   - Rate limiting

### Krok 13: Optymalizacja i refactoring

1. Code review
2. Wydzielenie powtarzalnej logiki do utility functions
3. Optymalizacja re-renders (React.memo gdzie potrzeba)
4. Lazy loading komponentów jeśli potrzeba
5. Bundle size check

### Krok 14: Dokumentacja

1. Komentarze JSDoc dla głównych komponentów i hooks
2. README dla folderu `components/authors/`
3. Przykłady użycia komponentów (Storybook opcjonalnie)

### Krok 15: Finalizacja

1. Final testing
2. Fix bugów znalezionych podczas testów
3. Deploy do środowiska testowego
4. UAT (User Acceptance Testing)
5. Deploy do produkcji

## 12. Dodatkowe uwagi

### 12.1. Performance considerations

- Debounce dla wyszukiwania (500ms)
- Lazy loading okładek (loading="lazy") w przyszłych rozszerzeniach
- Paginacja po 30 elementów (zgodnie z PRD)
- Brak wirtualizacji w MVP (zgodnie z PRD)
- Memoizacja obliczonych wartości (limitStatus) z useMemo

### 12.2. Accessibility

- Semantyczny HTML (nav, header, main)
- ARIA labels dla interaktywnych elementów
- Keyboard navigation (Tab, Enter, Escape)
- Focus management w modalach (focus trap)
- Announce changes dla screen readers (aria-live)
- Kontrast kolorów (WCAG AA minimum)

### 12.3. Security

- Walidacja input po stronie klienta (XSS prevention)
- Sanitizacja wyświetlanych danych z API
- Brak przechowywania wrażliwych danych w localStorage
- Session management delegowane do Supabase
- CSRF protection (jeśli używamy session cookies)

### 12.4. Future enhancements (poza MVP)

- Infinite scroll zamiast paginacji
- Wirtualizacja listy dla lepszej wydajności
- Bulk operations (zaznaczanie wielu autorów, usuwanie)
- Export listy autorów (CSV, JSON)
- Drag & drop sorting
- Advanced filters (OL vs Manual, data dodania range)
- Caching API responses w IndexedDB
- Offline support (Service Worker)
- Animations (Framer Motion)

### 12.5. Zależności do zainstalacji

```bash
# Jeśli nie są już w projekcie:
npm install sonner # Toast notifications
npm install @tanstack/react-query # Opcjonalnie dla lepszego cache management
npm install react-hook-form zod # Formularze i walidacja
npm install @hookform/resolvers # Integracja zod z react-hook-form
```

### 12.6. Struktura plików

```
src/
├── pages/
│   └── app/
│       └── authors.astro
├── components/
│   └── authors/
│       ├── AuthorsListView.tsx (główny komponent)
│       ├── types.ts (ViewModels)
│       ├── hooks/
│       │   ├── useAuthorsList.ts
│       │   ├── useAuthorSearch.ts
│       │   └── useManualAuthor.ts
│       ├── PageHeader.tsx
│       ├── LimitIndicator.tsx
│       ├── AuthorsToolbar.tsx
│       ├── SearchInput.tsx
│       ├── SortSelect.tsx
│       ├── AddAuthorButton.tsx
│       ├── AuthorsListContent.tsx
│       ├── AuthorsListSkeleton.tsx
│       ├── ErrorDisplay.tsx
│       ├── EmptyState.tsx
│       ├── NoResultsState.tsx
│       ├── AuthorsTable.tsx
│       ├── AuthorRow.tsx
│       ├── AuthorsPagination.tsx
│       ├── AddAuthorModal.tsx
│       ├── AuthorSearchTab.tsx
│       ├── ManualAuthorTab.tsx
│       └── DeleteAuthorDialog.tsx
├── lib/
│   └── hooks/
│       └── useDebounce.ts
└── types.ts (API types)
```

---

**Koniec planu implementacji**
