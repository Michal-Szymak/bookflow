# Plan implementacji widoku: Modal dodawania autora

## 1. Przegląd

Modal dodawania autora to dialogowy widok umożliwiający użytkownikowi dodanie autora do swojego profilu na dwa sposoby:
1. **Wyszukiwanie w OpenLibrary** - wyszukiwanie autora po imieniu/nazwisku w katalogu OpenLibrary i wybór kanonicznego autora do dodania
2. **Ręczne dodanie** - utworzenie autora ręcznie, gdy nie jest dostępny w OpenLibrary

Widok jest dostępny kontekstowo z widoku `/app/authors` i realizuje wymagania z historyjek użytkownika US-004 (Dodanie autora z OpenLibrary), US-011 (Ręczne dodanie autora) oraz US-016 (Obsługa błędów i komunikaty).

Modal implementuje inteligentną obsługę błędów z fallbackiem do ręcznego dodania, walidację danych wejściowych oraz integrację z API do wyszukiwania, importowania i dołączania autorów.

## 2. Routing widoku

Modal nie posiada własnej ścieżki routingu. Jest renderowany jako komponent dialogowy w kontekście widoku `/app/authors` i kontrolowany przez stan lokalny komponentu nadrzędnego (`AuthorsListView`).

**Lokalizacja w kodzie:**
- Komponent główny: `src/components/authors/AddAuthorModal.tsx`
- Użycie: `src/components/authors/AuthorsListView.tsx`

**Warunki wyświetlenia:**
- Modal jest otwierany przez kliknięcie przycisku "Dodaj autora" w `AuthorsListView`
- Modal jest zamykany przez: kliknięcie backdrop, przycisk X, klawisz ESC, lub po pomyślnym dodaniu autora

## 3. Struktura komponentów

```
AddAuthorModal (główny kontener)
├── Header (tytuł + przycisk zamknięcia)
├── Tabs (przełącznik trybów: Search | Manual)
└── TabContent
    ├── AuthorSearchTab (tryb wyszukiwania OL)
    │   ├── SearchInput (input z debounce)
    │   ├── SearchResultsList (lista wyników)
    │   │   └── AuthorResultItem (pojedynczy wynik)
    │   ├── LoadingState (stan ładowania)
    │   ├── ErrorState (stan błędu z fallbackiem)
    │   └── EmptyState (brak wyników)
    └── ManualAuthorTab (tryb ręcznego dodania)
        ├── InfoMessage (informacja o manual)
        ├── NameInput (pole nazwy autora)
        ├── ValidationError (komunikat walidacji)
        └── SubmitButton (przycisk dodania)
```

## 4. Szczegóły komponentów

### AddAuthorModal

**Opis komponentu:**
Główny kontener modala odpowiedzialny za zarządzanie stanem otwarcia/zamknięcia, przełączanie między trybami (wyszukiwanie OL / ręczne dodanie) oraz obsługę zdarzeń klawiatury i scroll lock.

**Główne elementy:**
- Backdrop (`div` z `onClick` handler) - zamyka modal przy kliknięciu
- Modal container (`div` z `max-w-2xl`, `max-h-[90vh]`) - responsywny kontener
- Header (`div` z tytułem i przyciskiem X) - nagłówek modala
- Tabs (`div` z przyciskami przełączania) - przełącznik między trybami
- TabContent (`div` z warunkowym renderowaniem) - zawartość aktywnej zakładki

**Obsługiwane zdarzenia:**
- `onClose` - zamyka modal (wywoływane przez backdrop, X, ESC)
- `onAuthorAdded` - callback po pomyślnym dodaniu autora (zamyka modal i odświeża listę)

**Obsługiwana walidacja:**
- Brak walidacji na poziomie głównego komponentu (walidacja w komponentach dzieci)

**Typy:**
- `AddAuthorModalProps`:
  ```typescript
  interface AddAuthorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAuthorAdded: () => void;
  }
  ```
- Wewnętrzny stan:
  ```typescript
  type TabType = "search" | "manual";
  const [activeTab, setActiveTab] = useState<TabType>("search");
  ```

**Props:**
- `isOpen: boolean` - kontroluje widoczność modala
- `onClose: () => void` - callback zamykający modal
- `onAuthorAdded: () => void` - callback wywoływany po pomyślnym dodaniu autora

### AuthorSearchTab

**Opis komponentu:**
Zakładka odpowiedzialna za wyszukiwanie autorów w OpenLibrary. Zawiera pole wyszukiwania z debounce, listę wyników oraz obsługę stanów: loading, error, empty, results.

**Główne elementy:**
- `SearchInput` - input tekstowy z ikoną wyszukiwania, maxLength 200
- `SearchResultsList` - kontener z listą wyników lub stanami
- `AuthorResultItem` - pojedynczy wynik z nazwą autora i przyciskiem "Dodaj"
- `LoadingState` - spinner z tekstem "Wyszukiwanie..."
- `ErrorState` - komunikat błędu z sugestią ręcznego dodania
- `EmptyState` - komunikat o braku wyników

**Obsługiwane zdarzenia:**
- `onQueryChange` - zmiana wartości inputu (obsługiwane przez hook `useAuthorSearch`)
- `onAddAuthor` - kliknięcie przycisku "Dodaj" przy wyniku (wywołuje `addAuthor` z hooka)

**Obsługiwana walidacja:**
- Query minimum 2 znaki (walidacja w hooku przed wykonaniem zapytania)
- Query maksimum 200 znaków (ograniczenie przez `maxLength` na input)

**Typy:**
- `AuthorSearchTabProps`:
  ```typescript
  interface AuthorSearchTabProps {
    onAuthorAdded: () => void;
  }
  ```
- Używa typów z hooka `useAuthorSearch`:
  ```typescript
  {
    query: string;
    setQuery: (value: string) => void;
    results: AuthorSearchResultDto[];
    isSearching: boolean;
    searchError: string | null;
    isAdding: boolean;
    addError: string | null;
    addAuthor: (author: AuthorSearchResultDto) => Promise<void>;
  }
  ```

**Props:**
- `onAuthorAdded: () => void` - callback wywoływany po pomyślnym dodaniu autora

### ManualAuthorTab

**Opis komponentu:**
Zakładka odpowiedzialna za ręczne utworzenie autora. Zawiera formularz z polem nazwy autora, walidacją oraz przyciskiem submit.

**Główne elementy:**
- `InfoMessage` - informacja o tym, że autor będzie ręczny (bez połączenia z OL)
- `NameInput` - input tekstowy dla nazwy autora, maxLength 500
- `ValidationError` - komunikat błędu walidacji (wyświetlany pod inputem)
- `CreateError` - komunikat błędu z API (wyświetlany pod inputem)
- `CharacterCount` - licznik znaków (wyświetlany gdy > 400)
- `SubmitButton` - przycisk "Dodaj autora" z loading state

**Obsługiwane zdarzenia:**
- `onSubmit` - submit formularza (obsługiwane przez `handleSubmit`)
- `onNameChange` - zmiana wartości inputu (obsługiwane przez hook `useManualAuthor`)

**Obsługiwana walidacja:**
- Nazwa autora: wymagana (nie może być pusta po trim)
- Nazwa autora: minimum 1 znak (po trim)
- Nazwa autora: maksimum 500 znaków
- Nazwa autora: automatycznie trimowana przed walidacją i wysłaniem

**Typy:**
- `ManualAuthorTabProps`:
  ```typescript
  interface ManualAuthorTabProps {
    onAuthorAdded: () => void;
  }
  ```
- Używa typów z hooka `useManualAuthor`:
  ```typescript
  {
    name: string;
    setName: (value: string) => void;
    isCreating: boolean;
    createError: string | null;
    createManualAuthor: () => Promise<void>;
    validateName: (value: string) => string | null;
    resetForm: () => void;
  }
  ```

**Props:**
- `onAuthorAdded: () => void` - callback wywoływany po pomyślnym dodaniu autora

### useAuthorSearch (custom hook)

**Opis hooka:**
Hook zarządzający stanem wyszukiwania autorów w OpenLibrary. Obsługuje debounced search, wyświetlanie wyników, import autora z OL oraz dołączanie do profilu użytkownika.

**Stan zarządzany:**
- `query: string` - aktualne zapytanie wyszukiwania
- `results: AuthorSearchResultDto[]` - lista wyników wyszukiwania
- `isSearching: boolean` - stan ładowania wyszukiwania
- `searchError: string | null` - błąd wyszukiwania
- `isAdding: boolean` - stan dodawania autora
- `addError: string | null` - błąd dodawania autora

**Funkcje:**
- `setQuery(value: string)` - ustawia zapytanie wyszukiwania
- `addAuthor(author: AuthorSearchResultDto)` - dodaje autora (import + attach)
- `resetSearch()` - resetuje stan wyszukiwania

**Efekty:**
- Automatyczne wyszukiwanie po zmianie `debouncedQuery` (debounce 300ms)
- Wyszukiwanie tylko gdy query >= 2 znaki

### useManualAuthor (custom hook)

**Opis hooka:**
Hook zarządzający stanem ręcznego tworzenia autora. Obsługuje formularz, walidację oraz tworzenie autora i dołączanie do profilu.

**Stan zarządzany:**
- `name: string` - nazwa autora z formularza
- `isCreating: boolean` - stan tworzenia autora
- `createError: string | null` - błąd tworzenia autora

**Funkcje:**
- `setName(value: string)` - ustawia nazwę autora
- `createManualAuthor()` - tworzy autora ręcznego i dołącza do profilu
- `validateName(value: string)` - waliduje nazwę autora
- `resetForm()` - resetuje formularz

**Walidacja:**
- Nazwa: wymagana, 1-500 znaków (po trim)

## 5. Typy

### Typy DTO z API

**AuthorSearchResultDto:**
```typescript
interface AuthorSearchResultDto {
  id?: AuthorRow["id"]; // Opcjonalne - może nie być w DB jeszcze
  openlibrary_id: NonNullable<AuthorRow["openlibrary_id"]>; // Wymagane
  name: AuthorRow["name"]; // Wymagane
  ol_fetched_at: AuthorRow["ol_fetched_at"]; // ISO string
  ol_expires_at: AuthorRow["ol_expires_at"]; // ISO string
}
```

**AuthorSearchResponseDto:**
```typescript
interface AuthorSearchResponseDto {
  authors: AuthorSearchResultDto[];
}
```

**AuthorResponseDto:**
```typescript
interface AuthorResponseDto {
  author: AuthorDto; // AuthorRow z bazy danych
}
```

**AuthorDto (AuthorRow):**
```typescript
type AuthorDto = AuthorRow; // Typ z Supabase database.types
// Zawiera: id, name, openlibrary_id, manual, owner_user_id, ol_fetched_at, ol_expires_at, created_at, updated_at
```

### Typy Command (request body)

**ImportAuthorCommand:**
```typescript
interface ImportAuthorCommand {
  openlibrary_id: NonNullable<AuthorRow["openlibrary_id"]>; // Format: "OL23919A" (max 25 chars)
}
```

**CreateAuthorCommand:**
```typescript
type CreateAuthorCommand = Pick<AuthorRow, "name"> & {
  manual: true; // Wymagane true
  openlibrary_id?: null; // Musi być null lub undefined
};
```

**AttachUserAuthorCommand:**
```typescript
interface AttachUserAuthorCommand {
  author_id: AuthorRow["id"]; // UUID autora
}
```

### Typy ViewModel (dla komponentów)

**AuthorResultViewModel:**
```typescript
// Używa bezpośrednio AuthorSearchResultDto - brak transformacji
type AuthorResultViewModel = AuthorSearchResultDto;
```

**ManualAuthorFormViewModel:**
```typescript
// Wewnętrzny stan formularza - nie wymaga osobnego typu
// Używa bezpośrednio string dla name
```

### Typy błędów API

**ErrorResponse:**
```typescript
interface ErrorResponse {
  error: string; // Typ błędu (np. "Validation error", "Conflict")
  message: string; // Komunikat błędu dla użytkownika
  details?: ValidationError[]; // Opcjonalne szczegóły walidacji
}
```

**ValidationError:**
```typescript
interface ValidationError {
  path: (string | number)[];
  message: string;
}
```

## 6. Zarządzanie stanem

### Stan lokalny w AddAuthorModal

Modal zarządza następującym stanem lokalnym:
- `activeTab: TabType` - aktualnie aktywna zakładka ("search" | "manual")
- Stan jest resetowany do "search" przy zamknięciu modala

### Stan w custom hooks

**useAuthorSearch:**
- Stan wyszukiwania: `query`, `results`, `isSearching`, `searchError`
- Stan dodawania: `isAdding`, `addError`
- Debounced query: `debouncedQuery` (300ms delay) - używany do triggerowania wyszukiwania
- Efekt automatycznego wyszukiwania: uruchamiany gdy `debouncedQuery.length >= 2`

**useManualAuthor:**
- Stan formularza: `name`
- Stan tworzenia: `isCreating`, `createError`
- Walidacja: wykonywana inline przy każdej zmianie `name` oraz przed submitem

### Reset stanu

- **AddAuthorModal**: Reset `activeTab` do "search" przy zamknięciu (`useEffect` na `isOpen`)
- **useAuthorSearch**: Funkcja `resetSearch()` wywoływana przez komponent nadrzędny przy zamknięciu modala
- **useManualAuthor**: Funkcja `resetForm()` wywoływana przez komponent nadrzędny przy zamknięciu modala

### Synchronizacja z komponentem nadrzędnym

Modal komunikuje się z `AuthorsListView` przez callback `onAuthorAdded`, który:
1. Zamyka modal
2. Odświeża listę autorów
3. Wyświetla toast z komunikatem sukcesu

## 7. Integracja API

### GET /api/authors/search

**Opis:** Wyszukuje autorów w OpenLibrary z cache 7 dni.

**Request:**
- Method: `GET`
- Query parameters:
  - `q: string` (required) - zapytanie wyszukiwania (1-200 znaków)
  - `limit?: number` (optional) - maksymalna liczba wyników (1-50, default: 10)

**Response (200 OK):**
```typescript
{
  authors: AuthorSearchResultDto[];
}
```

**Response (400 Bad Request):**
```typescript
{
  error: "Validation error";
  message: string;
  details: ValidationError[];
}
```

**Response (502 Bad Gateway):**
```typescript
{
  error: "External service error";
  message: "Could not connect to OpenLibrary. Please try again later.";
}
```

**Implementacja w hooku:**
```typescript
const response = await fetch(`/api/authors/search?q=${encodeURIComponent(debouncedQuery)}&limit=10`);
const data: AuthorSearchResponseDto = await response.json();
```

### POST /api/openlibrary/import/author

**Opis:** Importuje lub odświeża autora z OpenLibrary do katalogu globalnego (cache TTL 7d).

**Request:**
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body:
```typescript
{
  openlibrary_id: string; // Format: "OL23919A" (max 25 chars)
}
```

**Response (200 OK):**
```typescript
{
  author: AuthorDto;
}
```

**Response (400 Bad Request):**
```typescript
{
  error: "Validation error";
  message: string;
  details: ValidationError[];
}
```

**Response (404 Not Found):**
```typescript
{
  error: "Author not found";
  message: string;
}
```

**Response (502 Bad Gateway):**
```typescript
{
  error: "External service error";
  message: "Could not connect to OpenLibrary. Please try again later.";
}
```

**Implementacja w hooku:**
```typescript
const importCommand: ImportAuthorCommand = {
  openlibrary_id: author.openlibrary_id,
};
const importResponse = await fetch("/api/openlibrary/import/author", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(importCommand),
});
const importData: AuthorResponseDto = await importResponse.json();
```

### POST /api/authors

**Opis:** Tworzy ręcznego autora należącego do zalogowanego użytkownika.

**Request:**
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body:
```typescript
{
  name: string; // 1-500 znaków (trimmed)
  manual: true; // Wymagane
  openlibrary_id?: null; // Musi być null lub undefined
}
```

**Response (201 Created):**
```typescript
{
  author: AuthorDto;
}
```
Headers: `Location: /api/authors/{authorId}`

**Response (400 Bad Request):**
```typescript
{
  error: "Validation error";
  message: string;
  details: ValidationError[];
}
```

**Response (401 Unauthorized):**
```typescript
{
  error: "Unauthorized";
  message: "Authentication required";
}
```

**Response (403 Forbidden):**
```typescript
{
  error: "Forbidden";
  message: "Cannot create manual author without ownership";
}
```

**Response (409 Conflict):**
```typescript
{
  error: "Conflict";
  message: string; // "Author limit reached (500 authors per user)" lub "Database constraint violation"
  details?: string;
}
```

**Implementacja w hooku:**
```typescript
const createCommand: CreateAuthorCommand = {
  name: trimmedName,
  manual: true,
};
const createResponse = await fetch("/api/authors", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(createCommand),
});
const createData: AuthorResponseDto = await createResponse.json();
```

### POST /api/user/authors

**Opis:** Dołącza autora do profilu użytkownika (zlicza się do limitu 500 autorów).

**Request:**
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body:
```typescript
{
  author_id: string; // UUID autora
}
```

**Response (201 Created):**
```typescript
{
  author_id: string;
  created_at: string; // ISO string
}
```
Headers: `Location: /api/user/authors/{authorId}`

**Response (400 Bad Request):**
```typescript
{
  error: "Validation error";
  message: string;
  details: ValidationError[];
}
```

**Response (401 Unauthorized):**
```typescript
{
  error: "Unauthorized";
  message: "Authentication required";
}
```

**Response (404 Not Found):**
```typescript
{
  error: "Not Found";
  message: "Author not found or not accessible";
}
```

**Response (409 Conflict):**
```typescript
{
  error: "Conflict";
  message: string; // "Author limit reached (500 authors per user)" lub "Author is already attached to your profile"
}
```

**Response (429 Too Many Requests):**
```typescript
{
  error: "Too Many Requests";
  message: "Rate limit exceeded: maximum 10 author additions per minute";
}
```
Headers: `Retry-After: 60`

**Implementacja w hooku:**
```typescript
const attachCommand: AttachUserAuthorCommand = {
  author_id: authorId,
};
const attachResponse = await fetch("/api/user/authors", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(attachCommand),
});
```

### Flow dodawania autora z OpenLibrary

1. Użytkownik wpisuje zapytanie w `SearchInput`
2. Po 300ms debounce, hook wykonuje `GET /api/authors/search`
3. Wyniki są wyświetlane w `SearchResultsList`
4. Użytkownik klika "Dodaj" przy wybranym autorze
5. Hook sprawdza czy autor ma `id`:
   - Jeśli NIE: wykonuje `POST /api/openlibrary/import/author` → otrzymuje `author.id`
   - Jeśli TAK: używa istniejącego `author.id`
6. Hook wykonuje `POST /api/user/authors` z `author_id`
7. Po sukcesie: wywołuje `onAuthorAdded()` → modal się zamyka, lista się odświeża

### Flow ręcznego dodawania autora

1. Użytkownik przełącza się na zakładkę "Dodaj ręcznie"
2. Użytkownik wpisuje nazwę autora w `NameInput`
3. Walidacja inline: sprawdza długość (1-500 znaków)
4. Użytkownik klika "Dodaj autora"
5. Hook wykonuje `POST /api/authors` z `{ name, manual: true }`
6. Po sukcesie: hook otrzymuje `author.id`
7. Hook wykonuje `POST /api/user/authors` z `author_id`
8. Po sukcesie: wywołuje `onAuthorAdded()` → modal się zamyka, lista się odświeża

## 8. Interakcje użytkownika

### Otwieranie modala

**Akcja:** Kliknięcie przycisku "Dodaj autora" w `AuthorsListView`

**Rezultat:**
- Modal się otwiera (`isOpen = true`)
- Domyślnie aktywna zakładka "Szukaj w OpenLibrary"
- Focus na input wyszukiwania (opcjonalnie, dla a11y)
- Body scroll jest zablokowany

### Zamykanie modala

**Akcje zamykające:**
1. Kliknięcie backdrop (ciemne tło)
2. Kliknięcie przycisku X w headerze
3. Naciśnięcie klawisza ESC
4. Pomyślne dodanie autora (automatyczne zamknięcie)

**Rezultat:**
- Modal się zamyka (`isOpen = false`)
- Stan jest resetowany (query, results, name, errors)
- Body scroll jest odblokowany
- Aktywna zakładka resetuje się do "search"

### Przełączanie zakładek

**Akcja:** Kliknięcie zakładki "Szukaj w OpenLibrary" lub "Dodaj ręcznie"

**Rezultat:**
- Aktywna zakładka się zmienia (`activeTab` aktualizuje się)
- Zawartość modala się zmienia (renderowany odpowiedni komponent)
- Stan poprzedniej zakładki jest zachowany (można wrócić)

### Wyszukiwanie autorów (tryb OpenLibrary)

**Akcja:** Wpisanie tekstu w `SearchInput`

**Rezultat:**
- Tekst jest wyświetlany w input (max 200 znaków)
- Po 300ms bez zmian, automatycznie uruchamia się wyszukiwanie
- Stan loading jest wyświetlany (`isSearching = true`)
- Po otrzymaniu wyników: lista wyników jest wyświetlana
- Jeśli błąd: komunikat błędu z sugestią ręcznego dodania

**Akcja:** Kliknięcie "Dodaj" przy wyniku

**Rezultat:**
- Przycisk jest disabled (`isAdding = true`)
- Jeśli autor nie ma `id`: wykonuje się import z OL
- Następnie wykonuje się attach do profilu
- Po sukcesie: modal się zamyka, lista się odświeża, toast sukcesu
- Po błędzie: komunikat błędu w UI (inline lub toast)

### Ręczne dodawanie autora

**Akcja:** Wpisanie nazwy autora w `NameInput`

**Rezultat:**
- Tekst jest wyświetlany w input (max 500 znaków)
- Walidacja inline: komunikat błędu jeśli < 1 lub > 500 znaków
- Licznik znaków wyświetlany gdy > 400 znaków
- Przycisk "Dodaj autora" jest disabled jeśli walidacja nie przechodzi

**Akcja:** Kliknięcie "Dodaj autora"

**Rezultat:**
- Formularz jest submitowany
- Przycisk jest disabled (`isCreating = true`)
- Wykonuje się `POST /api/authors` (tworzenie ręcznego autora)
- Następnie wykonuje się `POST /api/user/authors` (attach do profilu)
- Po sukcesie: modal się zamyka, lista się odświeża, toast sukcesu
- Po błędzie: komunikat błędu pod inputem

### Obsługa błędów wyszukiwania

**Akcja:** Błąd 502 (OpenLibrary niedostępne)

**Rezultat:**
- Komunikat błędu: "OpenLibrary jest obecnie niedostępne. Spróbuj ponownie później lub dodaj autora ręcznie."
- Sugestia przełączenia na zakładkę "Dodaj ręcznie" (opcjonalnie automatyczne przełączenie)

**Akcja:** Błąd 400 (walidacja)

**Rezultat:**
- Komunikat błędu z szczegółami walidacji
- Lista wyników jest czyszczona

### Obsługa błędów dodawania

**Akcja:** Błąd 409 (limit osiągnięty)

**Rezultat:**
- Toast: "Osiągnięto limit 500 autorów"
- Modal pozostaje otwarty (użytkownik może spróbować innego autora)

**Akcja:** Błąd 409 (autor już dodany)

**Rezultat:**
- Toast: "Autor jest już w Twoim profilu"
- Modal pozostaje otwarty

**Akcja:** Błąd 429 (rate limit)

**Rezultat:**
- Toast: "Dodano zbyt wielu autorów. Odczekaj 60 sekund."
- Modal pozostaje otwarty

**Akcja:** Błąd 502 (OpenLibrary niedostępne przy import)

**Rezultat:**
- Toast: "OpenLibrary jest niedostępne. Spróbuj ponownie później."
- Modal pozostaje otwarty

## 9. Warunki i walidacja

### Walidacja wyszukiwania (AuthorSearchTab)

**Warunek:** Query minimum 2 znaki
- **Gdzie:** W hooku `useAuthorSearch`, przed wykonaniem zapytania API
- **Walidacja:** `if (debouncedQuery.length < 2) return;`
- **Wpływ na UI:** Wyszukiwanie nie jest wykonywane, wyniki są czyszczone
- **Komunikat:** "Wpisz co najmniej 2 znaki, aby wyszukać" (wyświetlany w UI)

**Warunek:** Query maksimum 200 znaków
- **Gdzie:** Na input `SearchInput` przez atrybut `maxLength={200}`
- **Walidacja:** Browser natywnie blokuje wpisanie > 200 znaków
- **Wpływ na UI:** Input nie przyjmuje więcej niż 200 znaków

**Warunek:** Query nie może być puste przy wyszukiwaniu
- **Gdzie:** W hooku `useAuthorSearch`, w efekcie wyszukiwania
- **Walidacja:** `if (debouncedQuery.length < 2) { setResults([]); return; }`
- **Wpływ na UI:** Jeśli query < 2 znaki, wyniki są czyszczone

### Walidacja ręcznego dodawania (ManualAuthorTab)

**Warunek:** Nazwa autora jest wymagana
- **Gdzie:** W hooku `useManualAuthor`, funkcja `validateName`
- **Walidacja:** `if (trimmed.length === 0) return "Nazwa autora jest wymagana";`
- **Wpływ na UI:** Komunikat błędu pod inputem, przycisk "Dodaj autora" disabled
- **Komunikat:** "Nazwa autora jest wymagana"

**Warunek:** Nazwa autora minimum 1 znak (po trim)
- **Gdzie:** W hooku `useManualAuthor`, funkcja `validateName`
- **Walidacja:** `if (trimmed.length === 0) return "Nazwa autora jest wymagana";`
- **Wpływ na UI:** Komunikat błędu pod inputem, przycisk disabled
- **Komunikat:** "Nazwa autora jest wymagana"

**Warunek:** Nazwa autora maksimum 500 znaków
- **Gdzie:** Na input `NameInput` przez atrybut `maxLength={500}` oraz w hooku `validateName`
- **Walidacja:** `if (trimmed.length > 500) return "Nazwa autora nie może przekraczać 500 znaków";`
- **Wpływ na UI:** Input nie przyjmuje > 500 znaków, komunikat błędu jeśli > 500 (po trim)
- **Komunikat:** "Nazwa autora nie może przekraczać 500 znaków"

**Warunek:** Nazwa autora jest automatycznie trimowana
- **Gdzie:** W hooku `useManualAuthor`, przed walidacją i przed wysłaniem do API
- **Walidacja:** `const trimmed = value.trim();` (w `validateName` i `createManualAuthor`)
- **Wpływ na UI:** Spacje na początku/końcu są usuwane przed walidacją

**Warunek:** Formularz nie może być submitowany jeśli walidacja nie przechodzi
- **Gdzie:** W komponencie `ManualAuthorTab`, przed wywołaniem `createManualAuthor`
- **Walidacja:** `const canSubmit = name.trim().length > 0 && !validationError && !isCreating;`
- **Wpływ na UI:** Przycisk "Dodaj autora" jest disabled jeśli `!canSubmit`

### Walidacja po stronie API

**GET /api/authors/search:**
- `q`: wymagane, 1-200 znaków (walidacja w `AuthorSearchQuerySchema`)
- `limit`: opcjonalne, 1-50, default 10 (walidacja w `AuthorSearchQuerySchema`)

**POST /api/openlibrary/import/author:**
- `openlibrary_id`: wymagane, max 25 znaków, format "OL..." (walidacja w `ImportAuthorSchema`)

**POST /api/authors:**
- `name`: wymagane, 1-500 znaków (trimmed) (walidacja w `CreateAuthorSchema`)
- `manual`: wymagane `true` (walidacja w `CreateAuthorSchema`)
- `openlibrary_id`: musi być `null` lub undefined (walidacja w `CreateAuthorSchema`)

**POST /api/user/authors:**
- `author_id`: wymagane, UUID format (walidacja w `AttachUserAuthorCommandSchema`)

### Warunki biznesowe

**Limit autorów:** Maksymalnie 500 autorów na użytkownika
- **Weryfikacja:** API zwraca 409 Conflict z komunikatem "Author limit reached"
- **Obsługa w UI:** Toast z komunikatem, modal pozostaje otwarty

**Rate limit:** Maksymalnie 10 dodawań autorów na minutę
- **Weryfikacja:** API zwraca 429 Too Many Requests z headerem `Retry-After: 60`
- **Obsługa w UI:** Toast z komunikatem, modal pozostaje otwarty

**Duplikat autora:** Autor nie może być dodany dwa razy
- **Weryfikacja:** API zwraca 409 Conflict z komunikatem "Author is already attached"
- **Obsługa w UI:** Toast z komunikatem, modal pozostaje otwarty

## 10. Obsługa błędów

### Błędy wyszukiwania (GET /api/authors/search)

**502 Bad Gateway (OpenLibrary niedostępne):**
- **Przyczyna:** OpenLibrary API jest niedostępne lub zwraca błąd
- **Obsługa:**
  - Komunikat: "OpenLibrary jest obecnie niedostępne. Spróbuj ponownie później lub dodaj autora ręcznie."
  - Wyświetlany w: `ErrorState` w `AuthorSearchTab`
  - Sugestia: Przełączenie na zakładkę "Dodaj ręcznie" (opcjonalnie automatyczne)
- **UX:** Nie blokuje całej aplikacji, modal ma własny stan błędu

**400 Bad Request (walidacja):**
- **Przyczyna:** Nieprawidłowe parametry zapytania (np. query > 200 znaków)
- **Obsługa:**
  - Komunikat z `error.message` z API
  - Wyświetlany w: `ErrorState` w `AuthorSearchTab`
- **UX:** Komunikat błędu, możliwość poprawy zapytania

**500 Internal Server Error:**
- **Przyczyna:** Błąd serwera
- **Obsługa:**
  - Komunikat: "Nie udało się wyszukać autorów"
  - Wyświetlany w: `ErrorState` w `AuthorSearchTab`
- **UX:** Komunikat błędu, możliwość ponowienia próby

### Błędy importu autora (POST /api/openlibrary/import/author)

**502 Bad Gateway:**
- **Przyczyna:** OpenLibrary API niedostępne
- **Obsługa:**
  - Komunikat: "OpenLibrary jest niedostępne. Spróbuj ponownie później."
  - Wyświetlany w: Toast (przez hook `useAuthorSearch`)
- **UX:** Toast, modal pozostaje otwarty, możliwość ręcznego dodania

**404 Not Found:**
- **Przyczyna:** Autor nie znaleziony w OpenLibrary
- **Obsługa:**
  - Komunikat: "Autor nie został znaleziony w OpenLibrary"
  - Wyświetlany w: Toast
- **UX:** Toast, modal pozostaje otwarty, sugestia ręcznego dodania

**400 Bad Request:**
- **Przyczyna:** Nieprawidłowy format `openlibrary_id`
- **Obsługa:**
  - Komunikat z `error.message` z API
  - Wyświetlany w: Toast
- **UX:** Toast, modal pozostaje otwarty

### Błędy tworzenia ręcznego autora (POST /api/authors)

**400 Bad Request:**
- **Przyczyna:** Nieprawidłowa walidacja (np. nazwa > 500 znaków)
- **Obsługa:**
  - Komunikat z `error.message` z API
  - Wyświetlany w: `createError` pod inputem w `ManualAuthorTab`
- **UX:** Komunikat błędu inline, możliwość poprawy

**401 Unauthorized:**
- **Przyczyna:** Brak sesji użytkownika
- **Obsługa:**
  - Redirect do `/login` (obsługiwane przez middleware lub hook)
  - Komunikat: "Zaloguj się ponownie"
- **UX:** Automatyczny redirect, toast z komunikatem

**403 Forbidden:**
- **Przyczyna:** RLS odmówił dostępu
- **Obsługa:**
  - Komunikat: "Brak uprawnień do utworzenia autora"
  - Wyświetlany w: Toast
- **UX:** Toast, modal pozostaje otwarty

**409 Conflict (limit):**
- **Przyczyna:** Osiągnięto limit 500 autorów
- **Obsługa:**
  - Komunikat: "Osiągnięto limit 500 autorów"
  - Wyświetlany w: Toast
- **UX:** Toast, modal pozostaje otwarty

**409 Conflict (constraint):**
- **Przyczyna:** Naruszenie constraint (np. duplikat nazwy)
- **Obsługa:**
  - Komunikat z `error.message` z API
  - Wyświetlany w: `createError` pod inputem
- **UX:** Komunikat błędu inline

### Błędy dołączania autora (POST /api/user/authors)

**400 Bad Request:**
- **Przyczyna:** Nieprawidłowy format `author_id` (nie UUID)
- **Obsługa:**
  - Komunikat: "Nieprawidłowy identyfikator autora"
  - Wyświetlany w: Toast
- **UX:** Toast, modal pozostaje otwarty

**401 Unauthorized:**
- **Przyczyna:** Brak sesji użytkownika
- **Obsługa:**
  - Redirect do `/login` (obsługiwane przez middleware)
- **UX:** Automatyczny redirect

**404 Not Found:**
- **Przyczyna:** Autor nie istnieje lub nie jest dostępny (RLS)
- **Obsługa:**
  - Komunikat: "Autor nie został znaleziony lub nie jest dostępny"
  - Wyświetlany w: Toast
- **UX:** Toast, modal pozostaje otwarty

**409 Conflict (limit):**
- **Przyczyna:** Osiągnięto limit 500 autorów
- **Obsługa:**
  - Komunikat: "Osiągnięto limit 500 autorów"
  - Wyświetlany w: Toast
- **UX:** Toast, modal pozostaje otwarty

**409 Conflict (duplikat):**
- **Przyczyna:** Autor jest już dołączony do profilu
- **Obsługa:**
  - Komunikat: "Autor jest już w Twoim profilu"
  - Wyświetlany w: Toast
- **UX:** Toast, modal pozostaje otwarty

**429 Too Many Requests:**
- **Przyczyna:** Przekroczono limit 10 dodawań/minutę
- **Obsługa:**
  - Komunikat: "Dodano zbyt wielu autorów. Odczekaj 60 sekund."
  - Wyświetlany w: Toast
  - Opcjonalnie: countdown timer w UI (future enhancement)
- **UX:** Toast, modal pozostaje otwarty, przycisk "Dodaj" może być disabled na 60s

**500 Internal Server Error:**
- **Przyczyna:** Błąd serwera
- **Obsługa:**
  - Komunikat: "Nie udało się dodać autora"
  - Wyświetlany w: Toast
- **UX:** Toast, modal pozostaje otwarty, możliwość ponowienia próby

### Błędy sieciowe

**Network Error (brak połączenia):**
- **Przyczyna:** Brak połączenia z internetem lub timeout
- **Obsługa:**
  - Komunikat: "Brak połączenia z internetem. Sprawdź połączenie i spróbuj ponownie."
  - Wyświetlany w: Toast lub `ErrorState`
- **UX:** Komunikat błędu, możliwość ponowienia próby po przywróceniu połączenia

**Timeout:**
- **Przyczyna:** Zapytanie przekroczyło limit czasu
- **Obsługa:**
  - Komunikat: "Zapytanie przekroczyło limit czasu. Spróbuj ponownie."
  - Wyświetlany w: Toast
- **UX:** Toast, możliwość ponowienia próby

### Strategia wyświetlania błędów

**Toast notifications (Sonner):**
- **Kiedy:** Błędy operacji (dodawanie, import) oraz sukcesy
- **Typy:**
  - Success: "Autor został dodany do profilu"
  - Error: Wszystkie błędy API (409, 429, 500, 502)
- **Pozycja:** Top-right (konfiguracja w `AppLayout`)
- **Auto-dismiss:** 5s dla success, 10s dla error

**Inline errors:**
- **Kiedy:** Błędy walidacji formularzy, błędy wyszukiwania w modalu
- **Gdzie:** Pod inputem/formularzem w którym wystąpił błąd
- **Przykłady:**
  - `validationError` pod `NameInput` w `ManualAuthorTab`
  - `searchError` w `ErrorState` w `AuthorSearchTab`
  - `createError` pod `NameInput` w `ManualAuthorTab`

**Error states:**
- **Kiedy:** Błędy krytyczne wymagające akcji użytkownika
- **Gdzie:** W miejsce zawartości (np. lista wyników)
- **Przykłady:**
  - `ErrorState` w `AuthorSearchTab` z sugestią ręcznego dodania
  - `EmptyState` z komunikatem błędu

## 11. Kroki implementacji

### Krok 1: Przygotowanie struktury komponentów

1. Utwórz plik `src/components/authors/AddAuthorModal.tsx`
2. Utwórz plik `src/components/authors/AuthorSearchTab.tsx`
3. Utwórz plik `src/components/authors/ManualAuthorTab.tsx`
4. Utwórz katalog `src/components/authors/hooks/`
5. Utwórz plik `src/components/authors/hooks/useAuthorSearch.ts`
6. Utwórz plik `src/components/authors/hooks/useManualAuthor.ts`

### Krok 2: Implementacja custom hooks

1. **useAuthorSearch:**
   - Zaimplementuj stan: `query`, `results`, `isSearching`, `searchError`, `isAdding`, `addError`
   - Zaimplementuj debounce query (300ms) używając `useDebounce` hooka
   - Zaimplementuj efekt automatycznego wyszukiwania (tylko gdy query >= 2 znaki)
   - Zaimplementuj funkcję `addAuthor` z flow: import (jeśli potrzebne) → attach
   - Zaimplementuj funkcję `resetSearch` do czyszczenia stanu
   - Dodaj obsługę błędów: 502, 400, 500, network errors

2. **useManualAuthor:**
   - Zaimplementuj stan: `name`, `isCreating`, `createError`
   - Zaimplementuj funkcję `validateName` (1-500 znaków, required)
   - Zaimplementuj funkcję `createManualAuthor` z flow: create → attach
   - Zaimplementuj funkcję `resetForm` do czyszczenia stanu
   - Dodaj obsługę błędów: 400, 401, 403, 409, 429, 500

### Krok 3: Implementacja komponentów tabów

1. **AuthorSearchTab:**
   - Zaimplementuj `SearchInput` z ikoną i placeholder
   - Zaimplementuj `SearchResultsList` z warunkowym renderowaniem:
     - Empty state (brak query)
     - Loading state (isSearching)
     - Error state (searchError)
     - No results state (results.length === 0)
     - Results list (results.map)
   - Zaimplementuj `AuthorResultItem` z nazwą autora i przyciskiem "Dodaj"
   - Dodaj obsługę kliknięcia "Dodaj" z wywołaniem `addAuthor`
   - Dodaj disabled state dla przycisku podczas `isAdding`

2. **ManualAuthorTab:**
   - Zaimplementuj `InfoMessage` z informacją o ręcznym autorze
   - Zaimplementuj `NameInput` z label, placeholder, maxLength 500
   - Zaimplementuj `ValidationError` wyświetlany pod inputem
   - Zaimplementuj `CreateError` wyświetlany pod inputem
   - Zaimplementuj `CharacterCount` (wyświetlany gdy name.length > 400)
   - Zaimplementuj `SubmitButton` z loading state
   - Dodaj obsługę submit formularza z walidacją przed wysłaniem
   - Dodaj disabled state dla przycisku gdy walidacja nie przechodzi

### Krok 4: Implementacja głównego komponentu modala

1. **AddAuthorModal:**
   - Zaimplementuj backdrop z `onClick={onClose}`
   - Zaimplementuj modal container z responsywnymi klasami (max-w-2xl, max-h-[90vh])
   - Zaimplementuj header z tytułem i przyciskiem X
   - Zaimplementuj tabs z przełączaniem między "search" i "manual"
   - Zaimplementuj tab content z warunkowym renderowaniem `AuthorSearchTab` lub `ManualAuthorTab`
   - Dodaj obsługę klawisza ESC (useEffect z event listener)
   - Dodaj lock body scroll gdy modal jest otwarty (useEffect)
   - Dodaj reset activeTab do "search" gdy modal się zamyka (useEffect)

### Krok 5: Integracja z komponentem nadrzędnym

1. W `AuthorsListView.tsx`:
   - Dodaj stan `isAddModalOpen: boolean`
   - Dodaj funkcję `handleOpenAddModal` ustawiającą `isAddModalOpen = true`
   - Dodaj funkcję `handleCloseAddModal` ustawiającą `isAddModalOpen = false`
   - Dodaj funkcję `handleAuthorAdded` wywołującą:
     - `handleCloseAddModal()`
     - `fetchAuthors()` (odświeżenie listy)
     - `toast.success("Autor został dodany do profilu")` (jeśli Sonner zainstalowany)
   - Dodaj przycisk "Dodaj autora" wywołujący `handleOpenAddModal`
   - Renderuj `<AddAuthorModal>` z odpowiednimi props

### Krok 6: Obsługa błędów i toastów

1. Zainstaluj Sonner (jeśli nie zainstalowany):
   ```bash
   npm install sonner
   ```

2. W `AppLayout.astro` dodaj `<Toaster />`:
   ```astro
   import { Toaster } from "sonner";
   <Toaster position="top-right" richColors />
   ```

3. W hookach dodaj toasty dla błędów:
   - `useAuthorSearch`: toast.error dla błędów addAuthor
   - `useManualAuthor`: toast.error dla błędów createManualAuthor

4. W `AuthorsListView` dodaj toasty dla sukcesów:
   - `handleAuthorAdded`: toast.success("Autor został dodany do profilu")

### Krok 7: Walidacja i testy

1. Przetestuj walidację wyszukiwania:
   - Query < 2 znaki: nie wykonuje wyszukiwania
   - Query > 200 znaków: input blokuje wpisanie
   - Query = 2+ znaki: wykonuje wyszukiwanie po 300ms

2. Przetestuj walidację ręcznego dodawania:
   - Nazwa pusta: komunikat błędu, przycisk disabled
   - Nazwa > 500 znaków: komunikat błędu, przycisk disabled
   - Nazwa z spacjami: automatycznie trimowana
   - Nazwa 1-500 znaków: przycisk enabled

3. Przetestuj flow dodawania z OpenLibrary:
   - Wyszukiwanie → wybór autora → import (jeśli potrzebne) → attach → sukces
   - Wyszukiwanie → wybór autora → błąd 502 → komunikat z fallbackiem
   - Wyszukiwanie → wybór autora → błąd 409 (limit) → toast z komunikatem

4. Przetestuj flow ręcznego dodawania:
   - Wpisanie nazwy → create → attach → sukces
   - Wpisanie nazwy → create → błąd 409 (limit) → toast z komunikatem
   - Wpisanie nazwy → create → błąd 429 (rate limit) → toast z komunikatem

5. Przetestuj obsługę błędów:
   - 502: komunikat z sugestią ręcznego dodania
   - 409: toast z odpowiednim komunikatem (limit vs duplikat)
   - 429: toast z komunikatem o rate limit
   - 401: redirect do /login
   - Network error: komunikat o braku połączenia

### Krok 8: Accessibility i UX

1. Dodaj ARIA labels:
   - Modal: `aria-modal="true"`, `aria-labelledby="modal-title"`
   - Input search: `aria-label="Wyszukaj autora"`
   - Input name: `aria-label="Nazwa autora"`
   - Przyciski: `aria-label` dla akcji

2. Dodaj keyboard navigation:
   - ESC zamyka modal
   - Tab przechodzi przez elementy w kolejności logicznej
   - Enter w formularzu ręcznego dodawania submituje formularz

3. Dodaj focus management:
   - Focus na input wyszukiwania przy otwarciu modala (opcjonalnie)
   - Focus trap w modalu (focus nie wychodzi poza modal)

4. Dodaj loading states:
   - Spinner podczas wyszukiwania
   - Spinner podczas dodawania autora
   - Disabled state dla przycisków podczas operacji

5. Dodaj empty states:
   - Brak query: "Wprowadź nazwę autora, aby rozpocząć wyszukiwanie"
   - Brak wyników: "Nie znaleziono autorów pasujących do zapytania"
   - Query za krótkie: "Wpisz co najmniej 2 znaki, aby wyszukać"

### Krok 9: Responsywność

1. Przetestuj na mobile:
   - Modal full-width na małych ekranach
   - Tabs scrollują się poziomo jeśli potrzeba
   - Input i przyciski są łatwe do kliknięcia (min 44x44px)

2. Przetestuj na tablet:
   - Modal ma max-width i jest wyśrodkowany
   - Tabs są widoczne bez scrollowania

3. Przetestuj na desktop:
   - Modal ma max-width 2xl
   - Wszystkie elementy są czytelne i dostępne

### Krok 10: Dokumentacja i cleanup

1. Dodaj JSDoc komentarze do wszystkich funkcji i komponentów
2. Dodaj komentarze do złożonych logik (np. flow import → attach)
3. Usuń nieużywane importy
4. Sprawdź zgodność z linterem (ESLint)
5. Sprawdź typy TypeScript (brak błędów)
6. Zaktualizuj README w `src/components/authors/` z dokumentacją modala
