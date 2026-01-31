# Plan implementacji widoku Książki użytkownika

## 1. Przegląd

Widok "Książki użytkownika" (`/app/books`) jest głównym centrum zarządzania biblioteką użytkownika. Umożliwia przeglądanie, filtrowanie, sortowanie i zarządzanie statusami oraz dostępnością w Legimi dla wszystkich książek przypisanych do profilu użytkownika.

**Główne funkcjonalności:**
- Przeglądanie listy książek z paginacją (30 pozycji na stronę)
- Filtrowanie po statusie (multi-select), dostępności w Legimi (tri-state), tytule (wyszukiwanie) i autorze
- Sortowanie po dacie publikacji (od najnowszych) lub tytule (A-Z)
- Zmiana statusu pojedynczej książki (Do przeczytania, W trakcie, Przeczytana, Ukryj)
- Zmiana dostępności w Legimi pojedynczej książki (Tak/Nie/Nieznane)
- Masowe operacje na zaznaczonych książkach (zmiana statusu, dostępności, usunięcie z profilu)
- Domyślny preset filtrów "Aktywne" (wyklucza status `hidden`)
- Optymistyczne aktualizacje UI z rollbackiem przy błędzie
- Obsługa limitów (5000 książek na użytkownika)

**User Stories realizowane:**
- US-007: Zmiana statusu pojedynczej książki
- US-008: Zmiana statusu wielu książek jednocześnie
- US-009: Filtry i sortowanie listy
- US-010: Oznaczenie dostępności w Legimi ręcznie
- US-013: Ukrywanie i przywracanie tytułów
- US-014: Przegląd profilu z paginacją i limitami

## 2. Routing widoku

**Ścieżka:** `/app/books`

**Plik implementacji:** `src/pages/app/books.astro`

**Struktura:**
- Astro page jako shell routingu
- React island `BooksListView` dla interaktywności
- Wymaga autoryzacji (middleware redirect do `/login` jeśli brak sesji)

**Przykładowa implementacja:**
```astro
---
import { AppLayout } from "@/layouts/AppLayout";
import { BooksListView } from "@/components/books/BooksListView";

// Middleware zapewnia autoryzację
---

<AppLayout title="Książki">
  <BooksListView client:load />
</AppLayout>
```

## 3. Struktura komponentów

```
BooksListView (główny komponent React)
├── PageHeader (nagłówek z licznikiem limitów)
├── BooksFiltersBar (pasek filtrów)
│   ├── StatusFilter (multi-select checkboxy)
│   ├── AvailableFilter (tri-state RadioGroup)
│   ├── SearchInput (wyszukiwanie po tytule)
│   ├── AuthorFilter (opcjonalny select autora)
│   └── SortSelect (sortowanie)
├── BooksListContent (główna zawartość)
│   ├── BooksTable (tabela z książkami)
│   │   ├── BooksTableHeader (nagłówek z checkboxem "Zaznacz wszystkie")
│   │   └── BooksTableRow[] (wiersze z książkami)
│   │       ├── WorkRowCheckbox
│   │       ├── WorkCoverImage (lazy loading)
│   │       ├── WorkTitle
│   │       ├── WorkStatusControl (select/button group)
│   │       ├── WorkAvailableControl (tri-state)
│   │       └── WorkDetailsAccordion (szczegóły)
│   ├── BooksListSkeleton (loading state)
│   ├── BooksEmptyState (brak książek)
│   └── BooksNoResultsState (brak wyników filtrów)
├── BooksPagination (kontrolki paginacji)
└── BooksBulkToolbar (sticky toolbar dla bulk operations)
    ├── SelectedCount
    ├── BulkStatusSelect
    ├── BulkAvailableSelect
    └── BulkDeleteButton
```

## 4. Szczegóły komponentów

### 4.1. BooksListView

**Opis:** Główny komponent widoku, orchestrator wszystkich subkomponentów. Zarządza stanem, integracją z API i koordynuje interakcje użytkownika.

**Główne elementy:**
- Kontener główny z responsywnym layoutem
- Komponenty potomne: `PageHeader`, `BooksFiltersBar`, `BooksListContent`, `BooksPagination`, `BooksBulkToolbar`
- Custom hook `useBooksList` dla logiki biznesowej

**Obsługiwane interakcje:**
- Inicjalizacja widoku (pobranie profilu i listy książek)
- Obsługa zmian filtrów (synchronizacja z URL)
- Obsługa zmian statusu/dostępności (pojedynczo i bulk)
- Obsługa usuwania książek z profilu
- Obsługa błędów i retry

**Obsługiwana walidacja:**
- Walidacja parametrów URL przez `UserWorksListQuerySchema`
- Pre-check limitów przed bulk operations
- Walidacja UUID dla workId w operacjach pojedynczych

**Typy:**
- `UserWorkItemDto[]` - lista książek
- `ProfileResponseDto` - profil użytkownika z limitami
- `BooksListFilters` - filtry z URL
- `Set<string>` - zaznaczone work IDs

**Propsy:**
```typescript
// Brak propsów - komponent jest self-contained
// Dane pobierane przez custom hook z API i URL
```

### 4.2. PageHeader

**Opis:** Nagłówek strony wyświetlający tytuł i licznik limitów książek.

**Główne elementy:**
- `<h1>` z tytułem "Książki"
- `LimitIndicator` z licznikiem `work_count/max_works` (np. "1250 / 5000")

**Obsługiwane interakcje:**
- Brak interakcji (tylko wyświetlanie)

**Obsługiwana walidacja:**
- Brak

**Typy:**
- `LimitStatus` - obliczony status limitu z profilu

**Propsy:**
```typescript
interface PageHeaderProps {
  limitStatus: {
    current: number;
    max: number;
    isAtLimit: boolean;
    remaining: number;
    percentage: number;
  };
  className?: string;
}
```

### 4.3. BooksFiltersBar

**Opis:** Pasek filtrów z kontrolkami do filtrowania i sortowania listy książek. Wszystkie filtry są synchronizowane z URL jako źródłem prawdy.

**Główne elementy:**
- `StatusFilter` - multi-select checkboxy dla statusów
- `AvailableFilter` - tri-state RadioGroup (Tak/Nie/Nieznane/Wszystkie)
- `SearchInput` - input z debounce dla wyszukiwania po tytule
- `AuthorFilter` - opcjonalny select autora (jeśli wspierane)
- `SortSelect` - select sortowania (Data od najnowszych / Tytuł A-Z)
- Przycisk "Wyczyść filtry" (widoczny tylko gdy są aktywne filtry)

**Obsługiwane interakcje:**
- Zmiana statusu → aktualizacja URL (`status` param jako array)
- Zmiana dostępności → aktualizacja URL (`available` param: "true"/"false"/"null")
- Zmiana wyszukiwania → debounce → aktualizacja URL (`search` param)
- Zmiana autora → aktualizacja URL (`author_id` param)
- Zmiana sortowania → aktualizacja URL (`sort` param)
- Wszystkie zmiany filtrów resetują `page` do 1

**Obsługiwana walidacja:**
- Status: enum `["to_read", "in_progress", "read", "hidden"]` (min 1 element w array)
- Available: `true | false | null` (tri-state)
- Search: string max 200 znaków, trim, nie może być pusty po trim
- Author ID: UUID format
- Sort: enum `["published_desc", "title_asc"]`
- Page: integer min 1 (resetowany przy zmianie filtrów)

**Typy:**
- `BooksListFilters` - zsynchronizowane z URL
- `UserWorkStatus[]` - statusy
- `boolean | null` - dostępność

**Propsy:**
```typescript
interface BooksFiltersBarProps {
  filters: {
    status?: UserWorkStatus[];
    available?: boolean | null;
    search?: string;
    author_id?: string;
    sort: "published_desc" | "title_asc";
    page: number;
  };
  hasFilters: boolean;
  onStatusChange: (statuses: UserWorkStatus[] | undefined) => void;
  onAvailableChange: (available: boolean | null | undefined) => void;
  onSearchChange: (search: string) => void;
  onAuthorChange: (authorId: string | undefined) => void;
  onSortChange: (sort: "published_desc" | "title_asc") => void;
  onClearFilters: () => void;
  className?: string;
}
```

### 4.4. StatusFilter

**Opis:** Multi-select checkboxy dla statusów książek. Domyślnie wybrane są wszystkie statusy oprócz `hidden` (preset "Aktywne").

**Główne elementy:**
- Checkboxy dla każdego statusu: "Do przeczytania", "W trakcie", "Przeczytana", "Ukryj"
- Checkbox "Aktywne" (preset) - zaznacza wszystkie oprócz `hidden`
- Checkbox "Wszystkie" - zaznacza wszystkie statusy

**Obsługiwane interakcje:**
- Kliknięcie checkboxa statusu → dodanie/usunięcie z array w URL
- Kliknięcie "Aktywne" → ustawienie `status=to_read,in_progress,read` (bez `hidden`)
- Kliknięcie "Wszystkie" → ustawienie wszystkich statusów lub usunięcie parametru

**Obsługiwana walidacja:**
- Status array: min 1 element, każdy element musi być z enum
- Jeśli array jest pusty, parametr jest usuwany z URL

**Typy:**
- `UserWorkStatus[]` - zaznaczone statusy

**Propsy:**
```typescript
interface StatusFilterProps {
  selectedStatuses: UserWorkStatus[];
  onStatusesChange: (statuses: UserWorkStatus[]) => void;
  className?: string;
}
```

### 4.5. AvailableFilter

**Opis:** Tri-state RadioGroup dla filtrowania po dostępności w Legimi.

**Główne elementy:**
- Radio button "Tak" (available = true)
- Radio button "Nie" (available = false)
- Radio button "Nieznane" (available = null)
- Radio button "Wszystkie" (brak filtra, undefined)

**Obsługiwane interakcje:**
- Wybór opcji → aktualizacja URL (`available` param: "true"/"false"/"null" lub usunięcie)

**Obsługiwana walidacja:**
- Available: `true | false | null` (tri-state) lub undefined (brak filtra)

**Typy:**
- `boolean | null | undefined` - wartość filtra

**Propsy:**
```typescript
interface AvailableFilterProps {
  value: boolean | null | undefined;
  onChange: (value: boolean | null | undefined) => void;
  className?: string;
}
```

### 4.6. BooksListContent

**Opis:** Główna zawartość widoku z warunkowym renderowaniem stanów (loading, error, empty, lista).

**Główne elementy:**
- `BooksListSkeleton` - gdy `isLoading === true`
- `BooksTable` - gdy `!isLoading && !error && items.length > 0`
- `BooksEmptyState` - gdy `!isLoading && !error && items.length === 0 && !hasFilters`
- `BooksNoResultsState` - gdy `!isLoading && !error && items.length === 0 && hasFilters`
- `ErrorDisplay` - gdy `error !== null`

**Obsługiwane interakcje:**
- Retry po błędzie → wywołanie `onRetry()`
- Wyczyść filtry (z NoResultsState) → wywołanie `onClearFilters()`
- Dodaj autora (z EmptyState) → przekierowanie do `/app/authors`

**Obsługiwana walidacja:**
- Brak

**Typy:**
- `UserWorkItemDto[]` - lista książek
- `string | null` - komunikat błędu

**Propsy:**
```typescript
interface BooksListContentProps {
  isLoading: boolean;
  error: string | null;
  items: UserWorkItemDto[];
  hasFilters: boolean;
  onRetry: () => void;
  onClearFilters: () => void;
  className?: string;
}
```

### 4.7. BooksTable

**Opis:** Tabela z listą książek użytkownika. Responsywna implementacja z stacked rows na mobile.

**Główne elementy:**
- `BooksTableHeader` - nagłówek z checkboxem "Zaznacz wszystkie"
- `BooksTableRow[]` - wiersze dla każdej książki

**Obsługiwane interakcje:**
- Zaznaczanie/odznaczanie pojedynczych książek → wywołanie `onWorkToggle(workId)`
- Zaznaczanie/odznaczanie wszystkich → wywołanie `onSelectAll()` / `onDeselectAll()`

**Obsługiwana walidacja:**
- Brak

**Typy:**
- `UserWorkItemDto[]` - lista książek
- `Set<string>` - zaznaczone work IDs

**Propsy:**
```typescript
interface BooksTableProps {
  items: UserWorkItemDto[];
  selectedWorkIds: Set<string>;
  onWorkToggle: (workId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  isAllSelected: boolean;
  onStatusChange: (workId: string, status: UserWorkStatus) => Promise<void>;
  onAvailableChange: (workId: string, available: boolean | null) => Promise<void>;
  onDelete: (workId: string) => Promise<void>;
  className?: string;
}
```

### 4.8. BooksTableHeader

**Opis:** Nagłówek tabeli z checkboxem "Zaznacz wszystkie" i etykietami kolumn.

**Główne elementy:**
- Checkbox w pierwszej kolumnie (indeterminate state gdy część zaznaczona)
- Kolumny: Checkbox, Okładka, Tytuł, Status, Dostępność w Legimi, Rok, Akcje

**Obsługiwane interakcje:**
- Kliknięcie checkboxa → wywołanie `onToggleAll()` (zaznacza/odznacza wszystkie na bieżącej stronie)

**Obsługiwana walidacja:**
- Brak

**Typy:**
- `boolean` - czy wszystkie zaznaczone
- `boolean` - czy część zaznaczona (indeterminate)

**Propsy:**
```typescript
interface BooksTableHeaderProps {
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onToggleAll: () => void;
}
```

### 4.9. BooksTableRow

**Opis:** Pojedynczy wiersz tabeli z danymi książki, kontrolkami statusu/dostępności i szczegółami w Accordion.

**Główne elementy:**
- Checkbox (pierwsza kolumna)
- Okładka (`CoverImage` z lazy loading i placeholder)
- Tytuł książki (z `work.title` lub `primary_edition.title`)
- Kontrolka statusu (`WorkStatusControl` - select lub button group)
- Kontrolka dostępności (`WorkAvailableControl` - tri-state)
- Rok publikacji (z `publish_year` computed)
- Accordion z szczegółami (ISBN, język, pełna data publikacji, autorzy)
- Przycisk "Usuń z profilu" (opcjonalnie w menu akcji)

**Obsługiwane interakcje:**
- Kliknięcie checkboxa → wywołanie `onToggle()`
- Zmiana statusu → optymistyczna aktualizacja → wywołanie `onStatusChange(workId, status)`
- Zmiana dostępności → optymistyczna aktualizacja → wywołanie `onAvailableChange(workId, available)`
- Rozwijanie/zwijanie Accordion → lokalny stan
- Usunięcie z profilu → wywołanie `onDelete(workId)`

**Obsługiwana walidacja:**
- Status: enum `["to_read", "in_progress", "read", "hidden"]`
- Available: `boolean | null`
- WorkId: UUID format

**Typy:**
- `UserWorkItemDto` - dane książki
- `boolean` - czy zaznaczona
- `boolean` - czy w trakcie aktualizacji (loading state)

**Propsy:**
```typescript
interface BooksTableRowProps {
  item: UserWorkItemDto;
  isSelected: boolean;
  isUpdating: boolean;
  onToggle: () => void;
  onStatusChange: (status: UserWorkStatus) => Promise<void>;
  onAvailableChange: (available: boolean | null) => Promise<void>;
  onDelete: () => Promise<void>;
}
```

### 4.10. WorkStatusControl

**Opis:** Kontrolka zmiany statusu książki. Może być select dropdown lub button group w zależności od designu.

**Główne elementy:**
- Select dropdown z opcjami: "Do przeczytania", "W trakcie", "Przeczytana", "Ukryj"
- Lub button group z ikonami dla każdego statusu

**Obsługiwane interakcje:**
- Wybór statusu → optymistyczna aktualizacja UI → wywołanie API → rollback przy błędzie

**Obsługiwana walidacja:**
- Status: enum `["to_read", "in_progress", "read", "hidden"]`
- Co najmniej jeden z `status` lub `available_in_legimi` musi być podany (walidacja API)

**Typy:**
- `UserWorkStatus` - aktualny status
- `UserWorkStatus` - nowy status

**Propsy:**
```typescript
interface WorkStatusControlProps {
  value: UserWorkStatus;
  onChange: (status: UserWorkStatus) => Promise<void>;
  disabled?: boolean;
  className?: string;
}
```

### 4.11. WorkAvailableControl

**Opis:** Tri-state kontrolka dostępności w Legimi.

**Główne elementy:**
- Select dropdown lub button group z opcjami: "Tak" (true), "Nie" (false), "Nieznane" (null)
- Wizualne oznaczenie stanu (ikony, kolory)

**Obsługiwane interakcje:**
- Wybór dostępności → optymistyczna aktualizacja UI → wywołanie API → rollback przy błędzie

**Obsługiwana walidacja:**
- Available: `boolean | null`
- Co najmniej jeden z `status` lub `available_in_legimi` musi być podany (walidacja API)

**Typy:**
- `boolean | null` - aktualna dostępność
- `boolean | null` - nowa dostępność

**Propsy:**
```typescript
interface WorkAvailableControlProps {
  value: boolean | null;
  onChange: (available: boolean | null) => Promise<void>;
  disabled?: boolean;
  className?: string;
}
```

### 4.12. WorkDetailsAccordion

**Opis:** Accordion z dodatkowymi szczegółami książki (rozwijany/zwijany).

**Główne elementy:**
- Trigger button "Pokaż szczegóły" / "Ukryj szczegóły"
- Zawartość Accordion:
  - Okładka (większy rozmiar, lazy loading)
  - `<dl>` z metadanymi:
    - ISBN-13 (jeśli dostępne)
    - Język (jeśli dostępne)
    - Pełna data publikacji (jeśli dostępna)
    - Autorzy (lista autorów work)
    - Data dodania do profilu
    - Data ostatniej zmiany statusu

**Obsługiwane interakcje:**
- Rozwijanie/zwijanie → lokalny stan `useState<boolean>`

**Obsługiwana walidacja:**
- Brak

**Typy:**
- `UserWorkItemDto` - dane książki

**Propsy:**
```typescript
interface WorkDetailsAccordionProps {
  item: UserWorkItemDto;
  className?: string;
}
```

### 4.13. BooksPagination

**Opis:** Kontrolki paginacji (Poprzednia/Następna + "Strona X z Y").

**Główne elementy:**
- Przycisk "Poprzednia" (disabled na pierwszej stronie)
- Tekst "Strona X z Y"
- Przycisk "Następna" (disabled na ostatniej stronie)

**Obsługiwane interakcje:**
- Kliknięcie "Poprzednia" → wywołanie `onPageChange(currentPage - 1)`
- Kliknięcie "Następna" → wywołanie `onPageChange(currentPage + 1)`
- Scroll do góry po zmianie strony

**Obsługiwana walidacja:**
- Page: integer min 1, max totalPages

**Typy:**
- `number` - aktualna strona
- `number` - całkowita liczba stron

**Propsy:**
```typescript
interface BooksPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}
```

### 4.14. BooksBulkToolbar

**Opis:** Sticky toolbar na dole ekranu wyświetlany tylko gdy `selectedCount > 0`. Umożliwia masowe operacje na zaznaczonych książkach.

**Główne elementy:**
- Licznik zaznaczonych: "Zaznaczono: N"
- `BulkStatusSelect` - select zmiany statusu dla zaznaczonych
- `BulkAvailableSelect` - select zmiany dostępności z opcją "Nie zmieniaj" (undefined)
- Przycisk "Zastosuj zmiany" (wywołuje bulk update)
- Przycisk "Usuń z profilu" (opcjonalnie, z potwierdzeniem)
- Przycisk "Anuluj" (czyści selekcję)

**Obsługiwane interakcje:**
- Wybór statusu → lokalny stan (nie zapisuje od razu)
- Wybór dostępności → lokalny stan (nie zapisuje od razu)
- Kliknięcie "Zastosuj zmiany" → walidacja → wywołanie `POST /api/user/works/status-bulk`
- Kliknięcie "Usuń z profilu" → AlertDialog potwierdzenia → wywołanie `DELETE /api/user/works/{workId}` dla każdego
- Kliknięcie "Anuluj" → czyszczenie selekcji

**Obsługiwana walidacja:**
- Work IDs: array min 1, max 100, deduplikacja automatyczna
- Co najmniej jeden z `status` lub `available_in_legimi` musi być podany
- Status: enum `["to_read", "in_progress", "read", "hidden"]`
- Available: `boolean | null | undefined` (undefined = "Nie zmieniaj")

**Typy:**
- `Set<string>` - zaznaczone work IDs
- `UserWorkStatus | undefined` - wybrany status
- `boolean | null | undefined` - wybrana dostępność

**Propsy:**
```typescript
interface BooksBulkToolbarProps {
  selectedCount: number;
  selectedWorkIds: string[];
  onBulkStatusChange: (workIds: string[], status?: UserWorkStatus, available?: boolean | null) => Promise<void>;
  onBulkDelete: (workIds: string[]) => Promise<void>;
  onCancel: () => void;
  className?: string;
}
```

### 4.15. BooksEmptyState

**Opis:** Stan pusty gdy użytkownik nie ma jeszcze żadnych książek (bez aktywnych filtrów).

**Główne elementy:**
- Ikona/ilustracja
- Nagłówek "Nie masz jeszcze książek"
- Opis tekstowy
- CTA button "Dodaj autora" (przekierowanie do `/app/authors`)

**Obsługiwane interakcje:**
- Kliknięcie "Dodaj autora" → nawigacja do `/app/authors`

**Obsługiwana walidacja:**
- Brak

**Typy:**
- Brak

**Propsy:**
```typescript
interface BooksEmptyStateProps {
  onAddAuthor: () => void;
  className?: string;
}
```

### 4.16. BooksNoResultsState

**Opis:** Stan gdy nie ma wyników dla aktywnych filtrów.

**Główne elementy:**
- Ikona/ilustracja
- Nagłówek "Brak wyników dla filtrów"
- Opis tekstowy
- CTA button "Wyczyść filtry"

**Obsługiwane interakcje:**
- Kliknięcie "Wyczyść filtry" → wywołanie `onClearFilters()`

**Obsługiwana walidacja:**
- Brak

**Typy:**
- Brak

**Propsy:**
```typescript
interface BooksNoResultsStateProps {
  onClearFilters: () => void;
  className?: string;
}
```

### 4.17. BooksListSkeleton

**Opis:** Skeleton loader wyświetlany podczas ładowania danych.

**Główne elementy:**
- Powtarzalne skeleton rows (30 sztuk)
- Każdy row: checkbox, okładka, tytuł, status, dostępność

**Obsługiwane interakcje:**
- Brak

**Obsługiwana walidacja:**
- Brak

**Typy:**
- Brak

**Propsy:**
```typescript
interface BooksListSkeletonProps {
  count?: number; // domyślnie 30
  className?: string;
}
```

## 5. Typy

### 5.1. DTO z API

**UserWorkItemDto:**
```typescript
interface UserWorkItemDto {
  work: WorkWithPrimaryEditionDto;
  status: UserWorkStatus; // "to_read" | "in_progress" | "read" | "hidden"
  available_in_legimi: boolean | null;
  status_updated_at: string | null;
  created_at: string;
  updated_at: string;
}
```

**WorkWithPrimaryEditionDto:**
```typescript
interface WorkWithPrimaryEditionDto {
  id: string;
  title: string;
  openlibrary_id: string | null;
  first_publish_year: number | null;
  primary_edition_id: string | null;
  manual: boolean;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
  primary_edition: PrimaryEditionSummaryDto | null;
}
```

**PrimaryEditionSummaryDto:**
```typescript
interface PrimaryEditionSummaryDto {
  id: string;
  title: string;
  openlibrary_id: string | null;
  publish_year: number | null;
  publish_date: string | null;
  publish_date_raw: string | null;
  isbn13: string | null;
  cover_url: string | null;
  language: string | null;
}
```

**UserWorksListResponseDto:**
```typescript
interface UserWorksListResponseDto {
  items: UserWorkItemDto[];
  page: number;
  total: number;
}
```

**ProfileResponseDto:**
```typescript
interface ProfileResponseDto {
  author_count: number;
  work_count: number;
  max_authors: number;
  max_works: number;
}
```

**UserWorkResponseDto:**
```typescript
interface UserWorkResponseDto {
  work: UserWorkItemDto;
}
```

**UserWorksBulkUpdateResponseDto:**
```typescript
interface UserWorksBulkUpdateResponseDto {
  works: UserWorkItemDto[];
}
```

### 5.2. Typy ViewModel (lokalne)

**BooksListFilters:**
```typescript
interface BooksListFilters {
  page: number; // min 1, default 1
  status?: UserWorkStatus[]; // min 1 element jeśli podane
  available?: boolean | null; // tri-state
  search?: string; // max 200 znaków, trim
  author_id?: string; // UUID
  sort: "published_desc" | "title_asc"; // default "published_desc"
}
```

**LimitStatus:**
```typescript
interface LimitStatus {
  current: number; // work_count
  max: number; // max_works (5000)
  isAtLimit: boolean; // current >= max
  remaining: number; // max - current
  percentage: number; // (current / max) * 100
}
```

**BooksListState:**
```typescript
interface BooksListState {
  // Data
  items: UserWorkItemDto[];
  total: number;
  profile: ProfileResponseDto | null;
  
  // UI
  isLoading: boolean;
  error: string | null;
  
  // Selection
  selectedWorkIds: Set<string>;
  
  // Optimistic updates tracking
  updatingWorkIds: Set<string>; // work IDs w trakcie aktualizacji
  optimisticUpdates: Map<string, Partial<UserWorkItemDto>>; // tymczasowe zmiany
}
```

### 5.3. Typy komend API

**UpdateUserWorkCommand:**
```typescript
interface UpdateUserWorkCommand {
  status?: UserWorkStatus;
  available_in_legimi?: boolean | null;
  // Co najmniej jeden z powyższych musi być podany
}
```

**UpdateUserWorksBulkCommand:**
```typescript
interface UpdateUserWorksBulkCommand {
  work_ids: string[]; // min 1, max 100, deduplikacja automatyczna
  status?: UserWorkStatus;
  available_in_legimi?: boolean | null;
  // Co najmniej jeden z status/available_in_legimi musi być podany
}
```

**UserWorksListQueryDto:**
```typescript
interface UserWorksListQueryDto {
  page?: number; // min 1
  status?: UserWorkStatus[]; // min 1 element jeśli podane
  available?: boolean | null; // tri-state
  sort?: "published_desc" | "title_asc";
  author_id?: string; // UUID
  search?: string; // max 200 znaków
}
```

## 6. Zarządzanie stanem

### 6.1. Custom Hook: useBooksList

Główna logika widoku jest enkapsulowana w custom hooku `useBooksList`:

**Stan danych:**
- `items: UserWorkItemDto[]` - lista książek z API
- `total: number` - całkowita liczba książek (dla paginacji)
- `profile: ProfileResponseDto | null` - profil użytkownika z limitami

**Stan UI:**
- `isLoading: boolean` - czy trwa ładowanie
- `error: string | null` - komunikat błędu

**Stan selekcji:**
- `selectedWorkIds: Set<string>` - zaznaczone work IDs (tylko z bieżącej strony)

**Stan optymistycznych aktualizacji:**
- `updatingWorkIds: Set<string>` - work IDs w trakcie aktualizacji
- `optimisticUpdates: Map<string, Partial<UserWorkItemDto>>` - tymczasowe zmiany przed potwierdzeniem z API

**Filtry z URL:**
- `searchParams: URLSearchParams` - odczyt z `useUrlSearchParams()`
- `filters: BooksListFilters` - obliczone z URL params z domyślnymi wartościami
- Domyślny preset: `status = ["to_read", "in_progress", "read"]` (bez `hidden`)

**Obliczone wartości:**
- `limitStatus: LimitStatus` - obliczony z profilu
- `hasFilters: boolean` - czy są aktywne filtry (poza domyślnymi)
- `isAllSelected: boolean` - czy wszystkie książki na stronie są zaznaczone
- `isIndeterminate: boolean` - czy część książek jest zaznaczona

**Funkcje:**
- `fetchProfile()` - pobranie profilu
- `fetchBooks()` - pobranie listy książek z filtrami
- `setStatus(workId, status)` - zmiana statusu pojedynczej książki (optymistyczna)
- `setAvailable(workId, available)` - zmiana dostępności pojedynczej książki (optymistyczna)
- `bulkUpdateStatus(workIds, status?, available?)` - masowa zmiana statusu/dostępności
- `deleteWork(workId)` - usunięcie książki z profilu
- `toggleWork(workId)` - zaznaczenie/odznaczenie książki
- `selectAll()` - zaznaczenie wszystkich na stronie
- `deselectAll()` - odznaczenie wszystkich
- `setPage(page)` - zmiana strony (resetuje selekcję)
- `setStatusFilter(statuses)` - zmiana filtra statusu (resetuje page do 1)
- `setAvailableFilter(available)` - zmiana filtra dostępności (resetuje page do 1)
- `setSearch(search)` - zmiana wyszukiwania (debounce, resetuje page do 1)
- `setSort(sort)` - zmiana sortowania (resetuje page do 1)
- `clearFilters()` - wyczyszczenie wszystkich filtrów

**Efekty:**
- `useEffect(() => fetchProfile(), [])` - pobranie profilu raz na mount
- `useEffect(() => fetchBooks(), [filters])` - pobranie książek przy zmianie filtrów

### 6.2. Optymistyczne aktualizacje

Dla zmian statusu i dostępności (pojedynczo i bulk) implementujemy optymistyczne UI:

1. **Przed wywołaniem API:**
   - Dodanie `workId` do `updatingWorkIds`
   - Zapisanie oryginalnej wartości w `optimisticUpdates`
   - Aktualizacja UI z nową wartością

2. **Po sukcesie API:**
   - Usunięcie `workId` z `updatingWorkIds`
   - Usunięcie z `optimisticUpdates`
   - Aktualizacja `items` z danymi z API

3. **Po błędzie API:**
   - Przywrócenie oryginalnej wartości z `optimisticUpdates`
   - Usunięcie `workId` z `updatingWorkIds`
   - Wyświetlenie toast z komunikatem błędu

### 6.3. Synchronizacja z URL

Wszystkie filtry są synchronizowane z URL jako źródłem prawdy:

- Odczyt: `useUrlSearchParams()` → parsowanie do `BooksListFilters`
- Zapis: aktualizacja `URLSearchParams` → `setSearchParams()` → trigger `fetchBooks()`
- Reset page: przy zmianie filtrów (oprócz `page`) parametr `page` jest usuwany z URL

## 7. Integracja API

### 7.1. GET /api/user/profile

**Cel:** Pobranie profilu użytkownika z licznikami i limitami.

**Request:**
- Method: `GET`
- Headers: `Authorization: Bearer <token>` (automatycznie przez Supabase client)
- Body: brak

**Response:**
- `200 OK`: `ProfileResponseDto`
- `401 Unauthorized`: brak autoryzacji
- `404 Not Found`: profil nie znaleziony
- `500 Internal Server Error`: błąd serwera

**Implementacja:**
```typescript
const fetchProfile = async () => {
  setIsLoading(true);
  try {
    const response = await fetch("/api/user/profile");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ProfileResponseDto = await response.json();
    setProfile(data);
  } catch (error) {
    logger.error("Failed to fetch profile", error);
    setError("Nie udało się pobrać profilu");
  } finally {
    setIsLoading(false);
  }
};
```

### 7.2. GET /api/user/works

**Cel:** Pobranie listy książek użytkownika z filtrami i paginacją.

**Request:**
- Method: `GET`
- Query params:
  - `page?: number` (min 1, default 1)
  - `status?: UserWorkStatus[]` (można podać wielokrotnie: `?status=to_read&status=in_progress`)
  - `available?: "true" | "false" | "null"` (jako string)
  - `sort?: "published_desc" | "title_asc"` (default "published_desc")
  - `author_id?: string` (UUID)
  - `search?: string` (max 200 znaków)

**Response:**
- `200 OK`: `UserWorksListResponseDto`
- `400 Bad Request`: błąd walidacji query params
- `401 Unauthorized`: brak autoryzacji
- `500 Internal Server Error`: błąd serwera

**Implementacja:**
```typescript
const fetchBooks = async () => {
  setIsLoading(true);
  setError(null);
  try {
    const params = new URLSearchParams();
    if (filters.page > 1) params.set("page", filters.page.toString());
    if (filters.status && filters.status.length > 0) {
      filters.status.forEach(s => params.append("status", s));
    }
    if (filters.available !== undefined) {
      if (filters.available === true) params.set("available", "true");
      else if (filters.available === false) params.set("available", "false");
      else params.set("available", "null");
    }
    if (filters.sort) params.set("sort", filters.sort);
    if (filters.author_id) params.set("author_id", filters.author_id);
    if (filters.search) params.set("search", filters.search);
    
    const response = await fetch(`/api/user/works?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: UserWorksListResponseDto = await response.json();
    setItems(data.items);
    setTotal(data.total);
  } catch (error) {
    logger.error("Failed to fetch books", error);
    setError("Nie udało się pobrać listy książek");
  } finally {
    setIsLoading(false);
  }
};
```

### 7.3. PATCH /api/user/works/{workId}

**Cel:** Zmiana statusu i/lub dostępności pojedynczej książki.

**Request:**
- Method: `PATCH`
- Path param: `workId` (UUID)
- Body: `UpdateUserWorkCommand`
  - `status?: UserWorkStatus`
  - `available_in_legimi?: boolean | null`
  - Co najmniej jeden z powyższych musi być podany

**Response:**
- `200 OK`: `UserWorkResponseDto`
- `400 Bad Request`: błąd walidacji (UUID, enum, brak wymaganych pól)
- `401 Unauthorized`: brak autoryzacji
- `404 Not Found`: książka nie jest przypisana do użytkownika
- `500 Internal Server Error`: błąd serwera

**Implementacja:**
```typescript
const setStatus = async (workId: string, status: UserWorkStatus) => {
  // Optymistyczna aktualizacja
  const originalItem = items.find(item => item.work.id === workId);
  if (!originalItem) return;
  
  updatingWorkIds.add(workId);
  optimisticUpdates.set(workId, { ...originalItem, status });
  setItems(items.map(item => 
    item.work.id === workId ? { ...item, status } : item
  ));
  
  try {
    const response = await fetch(`/api/user/works/${workId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        // Work nie jest już przypisany - odśwież listę
        await fetchBooks();
        toast.error("Książka nie jest już przypisana do Twojego profilu");
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: UserWorkResponseDto = await response.json();
    // Aktualizacja z danymi z API
    setItems(items.map(item => 
      item.work.id === workId ? data.work : item
    ));
    toast.success("Status zaktualizowany");
  } catch (error) {
    // Rollback
    setItems(items.map(item => 
      item.work.id === workId ? originalItem : item
    ));
    toast.error("Nie udało się zaktualizować statusu");
  } finally {
    updatingWorkIds.delete(workId);
    optimisticUpdates.delete(workId);
  }
};
```

### 7.4. POST /api/user/works/status-bulk

**Cel:** Masowa zmiana statusu i/lub dostępności wielu książek.

**Request:**
- Method: `POST`
- Body: `UpdateUserWorksBulkCommand`
  - `work_ids: string[]` (min 1, max 100, deduplikacja automatyczna)
  - `status?: UserWorkStatus`
  - `available_in_legimi?: boolean | null`
  - Co najmniej jeden z `status`/`available_in_legimi` musi być podany

**Response:**
- `200 OK`: `UserWorksBulkUpdateResponseDto`
- `400 Bad Request`: błąd walidacji (pusta lista, przekroczony limit, brak wymaganych pól)
- `401 Unauthorized`: brak autoryzacji
- `500 Internal Server Error`: błąd serwera

**Implementacja:**
```typescript
const bulkUpdateStatus = async (
  workIds: string[],
  status?: UserWorkStatus,
  available?: boolean | null
) => {
  if (workIds.length === 0) return;
  if (status === undefined && available === undefined) {
    toast.error("Wybierz status lub dostępność");
    return;
  }
  
  // Optymistyczna aktualizacja
  const originalItems = new Map<string, UserWorkItemDto>();
  workIds.forEach(workId => {
    const item = items.find(i => i.work.id === workId);
    if (item) {
      originalItems.set(workId, item);
      updatingWorkIds.add(workId);
      optimisticUpdates.set(workId, {
        ...item,
        ...(status !== undefined && { status }),
        ...(available !== undefined && { available_in_legimi: available }),
      });
    }
  });
  
  setItems(items.map(item => {
    if (workIds.includes(item.work.id)) {
      return {
        ...item,
        ...(status !== undefined && { status }),
        ...(available !== undefined && { available_in_legimi: available }),
      };
    }
    return item;
  }));
  
  try {
    const body: UpdateUserWorksBulkCommand = {
      work_ids: workIds,
      ...(status !== undefined && { status }),
      ...(available !== undefined && { available_in_legimi: available }),
    };
    
    const response = await fetch("/api/user/works/status-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: UserWorksBulkUpdateResponseDto = await response.json();
    // Aktualizacja z danymi z API (tylko zaktualizowane works)
    const updatedWorkIds = new Set(data.works.map(w => w.work.id));
    setItems(items.map(item => {
      if (updatedWorkIds.has(item.work.id)) {
        const updated = data.works.find(w => w.work.id === item.work.id);
        return updated || item;
      }
      return item;
    }));
    
    toast.success(`Zaktualizowano ${data.works.length} książek`);
    setSelectedWorkIds(new Set()); // Czyszczenie selekcji
  } catch (error) {
    // Rollback
    setItems(items.map(item => {
      const original = originalItems.get(item.work.id);
      return original || item;
    }));
    toast.error("Nie udało się zaktualizować książek");
  } finally {
    workIds.forEach(id => {
      updatingWorkIds.delete(id);
      optimisticUpdates.delete(id);
    });
  }
};
```

### 7.5. DELETE /api/user/works/{workId}

**Cel:** Usunięcie książki z profilu użytkownika (detach, nie usuwa globalnego work).

**Request:**
- Method: `DELETE`
- Path param: `workId` (UUID)

**Response:**
- `204 No Content`: sukces
- `400 Bad Request`: błąd walidacji UUID
- `401 Unauthorized`: brak autoryzacji
- `403 Forbidden`: RLS policy violation
- `404 Not Found`: książka nie jest przypisana do użytkownika
- `500 Internal Server Error`: błąd serwera

**Implementacja:**
```typescript
const deleteWork = async (workId: string) => {
  try {
    const response = await fetch(`/api/user/works/${workId}`, {
      method: "DELETE",
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        toast.error("Książka nie jest już przypisana do Twojego profilu");
        await fetchBooks(); // Odświeżenie listy
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    // Usunięcie z listy
    setItems(items.filter(item => item.work.id !== workId));
    setTotal(total - 1);
    setSelectedWorkIds(prev => {
      const next = new Set(prev);
      next.delete(workId);
      return next;
    });
    
    // Odświeżenie profilu (aktualizacja licznika)
    await fetchProfile();
    
    toast.success("Książka usunięta z profilu");
  } catch (error) {
    logger.error("Failed to delete work", error);
    toast.error("Nie udało się usunąć książki");
  }
};
```

## 8. Interakcje użytkownika

### 8.1. Zmiana filtra statusu

**Akcja użytkownika:** Zaznaczenie/odznaczenie checkboxa statusu w `StatusFilter`

**Oczekiwany wynik:**
1. Aktualizacja array `status` w URL (dodanie/usunięcie statusu)
2. Reset `page` do 1 w URL
3. Wywołanie `fetchBooks()` z nowymi filtrami
4. Aktualizacja listy książek
5. Czyszczenie selekcji (jeśli była)

**Implementacja:**
```typescript
const handleStatusChange = (statuses: UserWorkStatus[]) => {
  const newParams = new URLSearchParams(searchParams);
  if (statuses.length > 0) {
    newParams.delete("status");
    statuses.forEach(s => newParams.append("status", s));
  } else {
    newParams.delete("status");
  }
  newParams.delete("page"); // Reset do strony 1
  setSearchParams(newParams);
  setSelectedWorkIds(new Set()); // Czyszczenie selekcji
};
```

### 8.2. Zmiana filtra dostępności

**Akcja użytkownika:** Wybór opcji w `AvailableFilter` (RadioGroup)

**Oczekiwany wynik:**
1. Aktualizacja `available` w URL ("true"/"false"/"null" lub usunięcie)
2. Reset `page` do 1 w URL
3. Wywołanie `fetchBooks()` z nowymi filtrami
4. Aktualizacja listy książek
5. Czyszczenie selekcji

**Implementacja:**
```typescript
const handleAvailableChange = (available: boolean | null | undefined) => {
  const newParams = new URLSearchParams(searchParams);
  if (available === true) {
    newParams.set("available", "true");
  } else if (available === false) {
    newParams.set("available", "false");
  } else if (available === null) {
    newParams.set("available", "null");
  } else {
    newParams.delete("available");
  }
  newParams.delete("page");
  setSearchParams(newParams);
  setSelectedWorkIds(new Set());
};
```

### 8.3. Wyszukiwanie po tytule

**Akcja użytkownika:** Wpisanie tekstu w `SearchInput`

**Oczekiwany wynik:**
1. Debounce 500ms przed aktualizacją URL
2. Aktualizacja `search` w URL (lub usunięcie jeśli pusty)
3. Reset `page` do 1 w URL
4. Wywołanie `fetchBooks()` z nowymi filtrami
5. Aktualizacja listy książek
6. Czyszczenie selekcji

**Implementacja:**
```typescript
const [searchInput, setSearchInput] = useState(filters.search || "");
const debouncedSearch = useDebounce(searchInput, 500);

useEffect(() => {
  const newParams = new URLSearchParams(searchParams);
  if (debouncedSearch && debouncedSearch.trim().length > 0) {
    newParams.set("search", debouncedSearch.trim());
  } else {
    newParams.delete("search");
  }
  newParams.delete("page");
  setSearchParams(newParams);
  setSelectedWorkIds(new Set());
}, [debouncedSearch]);
```

### 8.4. Zmiana sortowania

**Akcja użytkownika:** Wybór opcji w `SortSelect`

**Oczekiwany wynik:**
1. Aktualizacja `sort` w URL
2. Reset `page` do 1 w URL
3. Wywołanie `fetchBooks()` z nowym sortowaniem
4. Aktualizacja listy książek (posortowanej)
5. Czyszczenie selekcji

**Implementacja:**
```typescript
const handleSortChange = (sort: "published_desc" | "title_asc") => {
  const newParams = new URLSearchParams(searchParams);
  newParams.set("sort", sort);
  newParams.delete("page");
  setSearchParams(newParams);
  setSelectedWorkIds(new Set());
};
```

### 8.5. Zmiana strony paginacji

**Akcja użytkownika:** Kliknięcie "Poprzednia" lub "Następna" w `BooksPagination`

**Oczekiwany wynik:**
1. Aktualizacja `page` w URL
2. Wywołanie `fetchBooks()` z nową stroną
3. Aktualizacja listy książek
4. Scroll do góry strony
5. Czyszczenie selekcji (nowa strona = nowa selekcja)

**Implementacja:**
```typescript
const handlePageChange = (page: number) => {
  const newParams = new URLSearchParams(searchParams);
  if (page > 1) {
    newParams.set("page", page.toString());
  } else {
    newParams.delete("page");
  }
  setSearchParams(newParams);
  setSelectedWorkIds(new Set()); // Czyszczenie selekcji przy zmianie strony
  window.scrollTo({ top: 0, behavior: "smooth" });
};
```

### 8.6. Zaznaczanie pojedynczej książki

**Akcja użytkownika:** Kliknięcie checkboxa przy pojedynczej książce

**Oczekiwany wynik:**
1. Dodanie/usunięcie `workId` z `selectedWorkIds`
2. Aktualizacja stanu checkboxa
3. Aktualizacja checkboxa "Zaznacz wszystkie" (indeterminate/checked/unchecked)
4. Pojawienie się/zniknięcie `BooksBulkToolbar` (jeśli `selectedCount > 0`)

**Implementacja:**
```typescript
const handleWorkToggle = (workId: string) => {
  setSelectedWorkIds(prev => {
    const next = new Set(prev);
    if (next.has(workId)) {
      next.delete(workId);
    } else {
      next.add(workId);
    }
    return next;
  });
};
```

### 8.7. Zaznaczanie wszystkich książek na stronie

**Akcja użytkownika:** Kliknięcie checkboxa "Zaznacz wszystkie" w nagłówku tabeli

**Oczekiwany wynik:**
1. Zaznaczenie wszystkich `workId` z `items` w `selectedWorkIds`
2. Aktualizacja wszystkich checkboxów w wierszach
3. Aktualizacja checkboxa "Zaznacz wszystkie" (checked)
4. Pojawienie się `BooksBulkToolbar`

**Implementacja:**
```typescript
const handleSelectAll = () => {
  if (isAllSelected) {
    setSelectedWorkIds(new Set());
  } else {
    setSelectedWorkIds(new Set(items.map(item => item.work.id)));
  }
};
```

### 8.8. Zmiana statusu pojedynczej książki

**Akcja użytkownika:** Wybór statusu w `WorkStatusControl` dla pojedynczej książki

**Oczekiwany wynik:**
1. Optymistyczna aktualizacja UI (natychmiastowa zmiana statusu)
2. Wywołanie API `PATCH /api/user/works/{workId}`
3. Po sukcesie: aktualizacja z danymi z API, toast sukcesu
4. Po błędzie: rollback do oryginalnej wartości, toast błędu
5. Jeśli 404: odświeżenie listy + komunikat

**Implementacja:**
```typescript
const handleStatusChange = async (workId: string, status: UserWorkStatus) => {
  await setStatus(workId, status);
};
```

### 8.9. Zmiana dostępności pojedynczej książki

**Akcja użytkownika:** Wybór dostępności w `WorkAvailableControl` dla pojedynczej książki

**Oczekiwany wynik:**
1. Optymistyczna aktualizacja UI (natychmiastowa zmiana dostępności)
2. Wywołanie API `PATCH /api/user/works/{workId}`
3. Po sukcesie: aktualizacja z danymi z API, toast sukcesu
4. Po błędzie: rollback do oryginalnej wartości, toast błędu
5. Jeśli 404: odświeżenie listy + komunikat

**Implementacja:**
```typescript
const handleAvailableChange = async (workId: string, available: boolean | null) => {
  // Podobna implementacja jak setStatus, ale dla available_in_legimi
};
```

### 8.10. Masowa zmiana statusu/dostępności

**Akcja użytkownika:** Wybór statusu/dostępności w `BooksBulkToolbar` i kliknięcie "Zastosuj zmiany"

**Oczekiwany wynik:**
1. Walidacja: co najmniej jeden z `status`/`available` musi być podany
2. Walidacja: `workIds.length` min 1, max 100
3. Optymistyczna aktualizacja UI dla wszystkich zaznaczonych książek
4. Wywołanie API `POST /api/user/works/status-bulk`
5. Po sukcesie: aktualizacja z danymi z API, toast z liczbą zaktualizowanych, czyszczenie selekcji
6. Po błędzie: rollback do oryginalnych wartości, toast błędu

**Implementacja:**
```typescript
const handleBulkUpdate = async () => {
  const workIds = Array.from(selectedWorkIds);
  if (workIds.length === 0) return;
  
  const status = bulkStatus; // z lokalnego stanu toolbar
  const available = bulkAvailable; // z lokalnego stanu toolbar
  
  if (status === undefined && available === undefined) {
    toast.error("Wybierz status lub dostępność");
    return;
  }
  
  await bulkUpdateStatus(workIds, status, available);
};
```

### 8.11. Usunięcie książki z profilu (pojedynczo)

**Akcja użytkownika:** Kliknięcie "Usuń z profilu" w menu akcji książki

**Oczekiwany wynik:**
1. AlertDialog potwierdzenia (opcjonalnie)
2. Wywołanie API `DELETE /api/user/works/{workId}`
3. Po sukcesie: usunięcie z listy, aktualizacja `total`, odświeżenie profilu, toast sukcesu
4. Po błędzie: toast błędu
5. Jeśli 404: odświeżenie listy + komunikat

**Implementacja:**
```typescript
const handleDelete = async (workId: string) => {
  await deleteWork(workId);
};
```

### 8.12. Masowe usunięcie książek z profilu

**Akcja użytkownika:** Kliknięcie "Usuń z profilu" w `BooksBulkToolbar`

**Oczekiwany wynik:**
1. AlertDialog potwierdzenia z liczbą zaznaczonych książek
2. Dla każdej książki: wywołanie API `DELETE /api/user/works/{workId}`
3. Po sukcesie: usunięcie z listy, aktualizacja `total`, odświeżenie profilu, toast sukcesu, czyszczenie selekcji
4. Po błędzie: toast błędu dla każdej nieudanej operacji

**Implementacja:**
```typescript
const handleBulkDelete = async (workIds: string[]) => {
  // Potwierdzenie w AlertDialog
  for (const workId of workIds) {
    try {
      await deleteWork(workId);
    } catch (error) {
      // Kontynuuj dla pozostałych
    }
  }
};
```

## 9. Warunki i walidacja

### 9.1. Walidacja parametrów URL

**Komponent:** `useBooksList` hook

**Warunki:**
- `page`: integer min 1, domyślnie 1
- `status`: array enum `["to_read", "in_progress", "read", "hidden"]`, min 1 element jeśli podane
- `available`: `"true" | "false" | "null"` (jako string w URL), konwertowane do `boolean | null`
- `search`: string max 200 znaków, trim, nie może być pusty po trim
- `author_id`: UUID format
- `sort`: enum `["published_desc", "title_asc"]`, domyślnie "published_desc"

**Walidacja:**
- Użycie `UserWorksListQuerySchema` z `@/lib/validation/user-works-list.schema`
- Błędy walidacji: wyświetlenie komunikatu błędu, fallback do domyślnych wartości

**Implementacja:**
```typescript
const [searchParams] = useUrlSearchParams();
const queryParams = {
  page: searchParams.get("page") || undefined,
  status: searchParams.getAll("status").length > 0 ? searchParams.getAll("status") : undefined,
  available: searchParams.get("available") || undefined,
  sort: searchParams.get("sort") || undefined,
  author_id: searchParams.get("author_id") || undefined,
  search: searchParams.get("search") || undefined,
};

const validation = UserWorksListQuerySchema.safeParse(queryParams);
if (!validation.success) {
  logger.warn("Invalid query params", validation.error);
  // Fallback do domyślnych wartości
  filters = getDefaultFilters();
} else {
  filters = {
    page: validation.data.page ?? 1,
    status: validation.data.status,
    available: validation.data.available,
    sort: validation.data.sort ?? "published_desc",
    author_id: validation.data.author_id,
    search: validation.data.search,
  };
}
```

### 9.2. Walidacja przed bulk operations

**Komponent:** `BooksBulkToolbar`

**Warunki:**
- `workIds.length` min 1, max 100
- Co najmniej jeden z `status` lub `available_in_legimi` musi być podany
- `status`: enum jeśli podany
- `available_in_legimi`: `boolean | null` jeśli podany

**Walidacja:**
- Użycie `UpdateUserWorksBulkCommandSchema` z `@/lib/validation/update-user-works-bulk.schema`
- Błędy walidacji: wyświetlenie toast z komunikatem, blokada wywołania API

**Implementacja:**
```typescript
const handleBulkUpdate = async () => {
  const workIds = Array.from(selectedWorkIds);
  const body = {
    work_ids: workIds,
    ...(bulkStatus !== undefined && { status: bulkStatus }),
    ...(bulkAvailable !== undefined && { available_in_legimi: bulkAvailable }),
  };
  
  const validation = UpdateUserWorksBulkCommandSchema.safeParse(body);
  if (!validation.success) {
    toast.error(validation.error.errors[0]?.message || "Błąd walidacji");
    return;
  }
  
  // Wywołanie API z validated data
  await bulkUpdateStatus(validation.data.work_ids, validation.data.status, validation.data.available_in_legimi);
};
```

### 9.3. Walidacja przed pojedynczą zmianą statusu/dostępności

**Komponent:** `WorkStatusControl`, `WorkAvailableControl`

**Warunki:**
- Co najmniej jeden z `status` lub `available_in_legimi` musi być podany
- `status`: enum jeśli podany
- `available_in_legimi`: `boolean | null` jeśli podany

**Walidacja:**
- Użycie `UpdateUserWorkCommandSchema` z `@/lib/validation/update-user-work.schema`
- Błędy walidacji: wyświetlenie toast z komunikatem, blokada wywołania API

### 9.4. Pre-check limitów

**Komponent:** `BooksBulkToolbar` (przed bulk operations)

**Warunek:**
- Sprawdzenie `profile.work_count < profile.max_works` przed bulk attach (nie dotyczy bulk update/delete)

**Walidacja:**
- Jeśli limit osiągnięty: wyświetlenie komunikatu, blokada operacji
- API zwróci `409 Conflict` jeśli limit przekroczony (obsługa w error handling)

### 9.5. Domyślny preset filtrów

**Komponent:** `useBooksList` hook

**Warunek:**
- Jeśli brak parametru `status` w URL, ustawienie domyślnego: `["to_read", "in_progress", "read"]` (bez `hidden`)
- Preset "Aktywne" jest domyślny przy pierwszym wejściu na widok

**Implementacja:**
```typescript
const getDefaultFilters = (): BooksListFilters => ({
  page: 1,
  status: ["to_read", "in_progress", "read"], // Domyślny preset "Aktywne"
  available: undefined,
  search: undefined,
  author_id: undefined,
  sort: "published_desc",
});

// W URL, jeśli status nie jest podany, dodajemy domyślny przy pierwszym fetch
useEffect(() => {
  if (!searchParams.has("status")) {
    const newParams = new URLSearchParams(searchParams);
    ["to_read", "in_progress", "read"].forEach(s => newParams.append("status", s));
    setSearchParams(newParams);
  }
}, []);
```

## 10. Obsługa błędów

### 10.1. Błąd 401 (Unauthorized)

**Scenariusz:** Sesja wygasła lub brak autoryzacji

**Obsługa:**
- Redirect do `/login` z komunikatem "Zaloguj się ponownie"
- Toast z komunikatem błędu

**Implementacja:**
```typescript
if (response.status === 401) {
  window.location.href = "/login?redirect=/app/books";
  toast.error("Sesja wygasła. Zaloguj się ponownie");
  return;
}
```

### 10.2. Błąd 400 (Bad Request)

**Scenariusz:** Błąd walidacji parametrów/body

**Obsługa:**
- Wyświetlenie komunikatu błędu z API (pierwszy błąd z `details`)
- Toast z komunikatem
- Dla query params: fallback do domyślnych wartości

**Implementacja:**
```typescript
if (response.status === 400) {
  const error = await response.json();
  toast.error(error.message || "Błąd walidacji");
  // Dla query params: reset do domyślnych
  if (isQueryParamsError) {
    setSearchParams(new URLSearchParams());
  }
}
```

### 10.3. Błąd 404 (Not Found)

**Scenariusz:** 
- Work nie jest przypisany do użytkownika (PATCH/DELETE)
- Profil nie znaleziony (GET profile)

**Obsługa:**
- Dla work: odświeżenie listy książek, toast z komunikatem "Książka nie jest już przypisana do Twojego profilu"
- Dla profilu: wyświetlenie komunikatu błędu, możliwość retry

**Implementacja:**
```typescript
if (response.status === 404) {
  if (isWorkOperation) {
    await fetchBooks(); // Odświeżenie listy
    toast.error("Książka nie jest już przypisana do Twojego profilu");
  } else {
    setError("Profil nie znaleziony");
  }
}
```

### 10.4. Błąd 403 (Forbidden)

**Scenariusz:** RLS policy violation

**Obsługa:**
- Toast z komunikatem "Brak uprawnień do wykonania tej operacji"
- Logowanie błędu dla developera

**Implementacja:**
```typescript
if (response.status === 403) {
  toast.error("Brak uprawnień do wykonania tej operacji");
  logger.error("RLS violation", { workId, operation });
}
```

### 10.5. Błąd 409 (Conflict)

**Scenariusz:** Limit książek osiągnięty (bulk attach)

**Obsługa:**
- Toast z komunikatem "Osiągnięto limit książek (5000)"
- Blokada dalszych operacji bulk attach

**Implementacja:**
```typescript
if (response.status === 409) {
  toast.error("Osiągnięto limit książek (5000)");
  // Odświeżenie profilu
  await fetchProfile();
}
```

### 10.6. Błąd 500 (Internal Server Error)

**Scenariusz:** Błąd serwera

**Obsługa:**
- Toast z komunikatem "Wystąpił błąd serwera. Spróbuj ponownie później"
- Logowanie błędu dla developera
- Możliwość retry

**Implementacja:**
```typescript
if (response.status === 500) {
  toast.error("Wystąpił błąd serwera. Spróbuj ponownie później");
  logger.error("Server error", { endpoint, error });
  setError("Błąd serwera");
}
```

### 10.7. Błąd sieci (Network Error)

**Scenariusz:** Brak połączenia z serwerem, timeout

**Obsługa:**
- Toast z komunikatem "Brak połączenia z serwerem"
- Możliwość retry
- Dla optymistycznych aktualizacji: rollback

**Implementacja:**
```typescript
catch (error) {
  if (error instanceof TypeError && error.message.includes("fetch")) {
    toast.error("Brak połączenia z serwerem");
    // Rollback dla optymistycznych aktualizacji
    rollbackOptimisticUpdate(workId);
  }
}
```

### 10.8. Błąd podczas optymistycznej aktualizacji

**Scenariusz:** Błąd API po optymistycznej aktualizacji UI

**Obsługa:**
- Rollback do oryginalnej wartości z `optimisticUpdates`
- Toast z komunikatem błędu
- Usunięcie `workId` z `updatingWorkIds`

**Implementacja:**
```typescript
catch (error) {
  // Rollback
  const original = optimisticUpdates.get(workId);
  if (original) {
    setItems(items.map(item => 
      item.work.id === workId ? original : item
    ));
    optimisticUpdates.delete(workId);
  }
  updatingWorkIds.delete(workId);
  toast.error("Nie udało się zaktualizować");
}
```

### 10.9. Obsługa częściowego sukcesu (bulk operations)

**Scenariusz:** Niektóre works nie zostały zaktualizowane (nie są przypisane do użytkownika)

**Obsługa:**
- API zwraca tylko zaktualizowane works w `UserWorksBulkUpdateResponseDto`
- Toast z komunikatem "Zaktualizowano N z M książek" (gdy `updated.length < requested.length`)
- Aktualizacja UI tylko dla zaktualizowanych works

**Implementacja:**
```typescript
const data: UserWorksBulkUpdateResponseDto = await response.json();
if (data.works.length < workIds.length) {
  toast.warning(`Zaktualizowano ${data.works.length} z ${workIds.length} książek`);
} else {
  toast.success(`Zaktualizowano ${data.works.length} książek`);
}
```

## 11. Kroki implementacji

### Krok 1: Utworzenie struktury plików

1. Utworzenie katalogu `src/components/books/`
2. Utworzenie plików:
   - `BooksListView.tsx` - główny komponent
   - `BooksFiltersBar.tsx` - pasek filtrów
   - `StatusFilter.tsx` - filtr statusu
   - `AvailableFilter.tsx` - filtr dostępności
   - `BooksTable.tsx` - tabela z książkami
   - `BooksTableRow.tsx` - wiersz tabeli
   - `WorkStatusControl.tsx` - kontrolka statusu
   - `WorkAvailableControl.tsx` - kontrolka dostępności
   - `WorkDetailsAccordion.tsx` - accordion ze szczegółami
   - `BooksPagination.tsx` - paginacja
   - `BooksBulkToolbar.tsx` - bulk toolbar
   - `BooksEmptyState.tsx` - stan pusty
   - `BooksNoResultsState.tsx` - brak wyników
   - `BooksListSkeleton.tsx` - skeleton loader
   - `hooks/useBooksList.ts` - custom hook
   - `types.ts` - typy lokalne

### Krok 2: Implementacja custom hook useBooksList

1. Utworzenie hooka z podstawowym stanem
2. Implementacja `fetchProfile()`
3. Implementacja `fetchBooks()` z obsługą filtrów z URL
4. Implementacja funkcji zmiany filtrów (synchronizacja z URL)
5. Implementacja `setStatus()` z optymistyczną aktualizacją
6. Implementacja `setAvailable()` z optymistyczną aktualizacją
7. Implementacja `bulkUpdateStatus()` z optymistyczną aktualizacją
8. Implementacja `deleteWork()`
9. Implementacja funkcji selekcji (toggle, selectAll, deselectAll)
10. Implementacja efektów (fetchProfile on mount, fetchBooks on filters change)

### Krok 3: Implementacja komponentów filtrów

1. `BooksFiltersBar` - kontener z layoutem
2. `StatusFilter` - multi-select checkboxy z presetem "Aktywne"
3. `AvailableFilter` - tri-state RadioGroup
4. Integracja z `useBooksList` hook

### Krok 4: Implementacja komponentów tabeli

1. `BooksTable` - kontener tabeli
2. `BooksTableHeader` - nagłówek z checkboxem "Zaznacz wszystkie"
3. `BooksTableRow` - wiersz z danymi książki
4. `WorkStatusControl` - kontrolka statusu (select)
5. `WorkAvailableControl` - kontrolka dostępności (select)
6. `WorkDetailsAccordion` - accordion ze szczegółami
7. Integracja z optymistycznymi aktualizacjami

### Krok 5: Implementacja komponentów pomocniczych

1. `BooksPagination` - kontrolki paginacji
2. `BooksBulkToolbar` - sticky toolbar z bulk operations
3. `BooksEmptyState` - stan pusty
4. `BooksNoResultsState` - brak wyników
5. `BooksListSkeleton` - skeleton loader
6. `PageHeader` - nagłówek z licznikiem

### Krok 6: Implementacja głównego komponentu BooksListView

1. Integracja wszystkich subkomponentów
2. Obsługa stanów (loading, error, empty, list)
3. Obsługa interakcji użytkownika
4. Integracja z toast notifications

### Krok 7: Utworzenie strony Astro

1. Utworzenie `src/pages/app/books.astro`
2. Integracja z `AppLayout`
3. Dodanie React island `BooksListView` z `client:load`
4. Testowanie routingu

### Krok 8: Implementacja obsługi błędów

1. Obsługa wszystkich kodów błędów HTTP (401, 400, 404, 403, 409, 500)
2. Obsługa błędów sieciowych
3. Rollback dla optymistycznych aktualizacji
4. Komunikaty błędów dla użytkownika

### Krok 9: Testowanie

1. Testowanie filtrów (status, available, search, sort)
2. Testowanie paginacji
3. Testowanie zmian statusu/dostępności (pojedynczo i bulk)
4. Testowanie usuwania książek
5. Testowanie selekcji i bulk operations
6. Testowanie obsługi błędów
7. Testowanie optymistycznych aktualizacji
8. Testowanie responsywności

### Krok 10: Optymalizacje i poprawki

1. Optymalizacja renderowania (React.memo gdzie potrzebne)
2. Lazy loading obrazów okładek
3. Debounce dla wyszukiwania
4. Sprawdzenie dostępności (a11y)
5. Poprawki stylów i layoutu
6. Finalne testy E2E

