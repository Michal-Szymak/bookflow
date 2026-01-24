# API Endpoint Implementation Plan: POST /api/works

## 1. Przegląd punktu końcowego

Endpoint `POST /api/works` służy do tworzenia ręcznego dzieła (work) przez uwierzytelnionego użytkownika i powiązania go z jednym lub wieloma autorami. Utworzone dzieło jest własnością użytkownika (`owner_user_id`) i jest oznaczone jako ręczne (`manual = true`). Endpoint automatycznie tworzy powiązania między dziełem a autorami poprzez tabelę `author_works`.

**Kluczowe funkcjonalności:**
- Tworzenie ręcznego dzieła z tytułem i opcjonalnymi metadanymi (rok pierwszego wydania, główne wydanie)
- Powiązanie dzieła z jednym lub wieloma autorami poprzez tabelę `author_works`
- Walidacja ograniczeń bazy danych (`works_manual_owner`, `works_manual_or_ol`)
- Sprawdzanie limitów użytkownika (maksymalnie 5000 dzieł na użytkownika)
- Weryfikacja istnienia i dostępności autorów przed utworzeniem powiązań
- Walidacja, że `primary_edition_id` (jeśli podane) należy do utworzonego dzieła

**Kontekst biznesowy:**
Endpoint jest częścią systemu zarządzania dziełami, który pozwala użytkownikom tworzyć własne ręczne wpisy dzieł, które nie są dostępne w katalogu OpenLibrary. Użytkownicy mogą powiązać te dzieła z istniejącymi autorami (zarówno ręcznymi, jak i z OpenLibrary) w celu organizacji swojej biblioteki.

## 2. Szczegóły żądania

### Metoda HTTP
`POST`

### Struktura URL
```
/api/works
```

### Request Body
```typescript
{
  "title": string,                    // Wymagane, 1-500 znaków po przycięciu
  "manual": true,                      // Wymagane, musi być true
  "author_ids": uuid[],                // Wymagane, niepusta tablica UUID autorów
  "first_publish_year"?: number,       // Opcjonalne, smallint (4-cyfrowy rok)
  "primary_edition_id"?: uuid          // Opcjonalne, UUID wydania należącego do dzieła
}
```

**Parametry:**
- `title` (wymagane): Tytuł dzieła. Musi być niepustym stringiem po przycięciu, maksymalnie 500 znaków.
- `manual` (wymagane): Musi być `true` dla ręcznych dzieł. Wartość jest automatycznie ustawiana przez endpoint.
- `author_ids` (wymagane): Tablica UUID autorów, z którymi dzieło ma być powiązane. Musi zawierać co najmniej jeden element. Wszyscy autorzy muszą istnieć i być dostępni dla użytkownika (zgodnie z RLS).
- `first_publish_year` (opcjonalne): Rok pierwszego wydania dzieła jako 4-cyfrowa liczba (smallint). Musi być w zakresie 1500-2100.
- `primary_edition_id` (opcjonalne): UUID wydania, które ma być ustawione jako główne wydanie dzieła. Wydanie musi istnieć i należeć do utworzonego dzieła (walidacja po utworzeniu dzieła).

**Przykładowe żądanie:**
```json
{
  "title": "Moja pierwsza książka",
  "manual": true,
  "author_ids": ["550e8400-e29b-41d4-a716-446655440000"],
  "first_publish_year": 2024
}
```

### Headers
- `Content-Type: application/json` (wymagane)
- `Authorization: Bearer <access_token>` (wymagane dla uwierzytelnionych użytkowników)

## 3. Wykorzystywane typy

### Command Model (Request Body)
```typescript
// src/types.ts
export type CreateWorkCommand = Pick<WorkRow, "title" | "first_publish_year" | "primary_edition_id"> & {
  manual: true;
  author_ids: AuthorRow["id"][];
};
```

### Response DTO
```typescript
// src/types.ts
export interface WorkResponseDto {
  work: WorkWithPrimaryEditionDto;
}

export type WorkWithPrimaryEditionDto = WorkDto & {
  primary_edition: PrimaryEditionSummaryDto | null;
};

export type PrimaryEditionSummaryDto = Pick<
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

### Typy pomocnicze
```typescript
// src/types.ts
export type WorkDto = WorkRow;
export type WorkRow = Tables<"works">;
export type AuthorRow = Tables<"authors">;
export type EditionRow = Tables<"editions">;
```

### Validation Schema
```typescript
// src/lib/validation/create-work.schema.ts (do utworzenia)
export const CreateWorkSchema = z.object({
  title: z.string().min(1).max(500).trim(),
  manual: z.literal(true),
  author_ids: z.array(z.string().uuid()).min(1, "At least one author is required"),
  first_publish_year: z.number().int().min(1500).max(2100).optional(),
  primary_edition_id: z.string().uuid().optional(),
});
```

## 4. Szczegóły odpowiedzi

### Sukces (201 Created)
Zwraca utworzone dzieło wraz z informacjami o głównym wydaniu (jeśli zostało ustawione).

**Struktura odpowiedzi:**
```json
{
  "work": {
    "id": "uuid",
    "title": "string",
    "openlibrary_id": null,
    "first_publish_year": 2024,
    "primary_edition_id": "uuid" | null,
    "manual": true,
    "owner_user_id": "uuid",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z",
    "primary_edition": {
      "id": "uuid",
      "title": "string",
      "openlibrary_id": null,
      "publish_year": 2024,
      "publish_date": "2024-01-15",
      "publish_date_raw": null,
      "isbn13": null,
      "cover_url": null,
      "language": null
    } | null
  }
}
```

**Headers odpowiedzi:**
- `Content-Type: application/json`
- `Location: /api/works/{workId}` (wskazuje na utworzone dzieło)

### Błędy

#### 400 Bad Request - Błąd walidacji
Zwracany, gdy dane wejściowe są nieprawidłowe.

```json
{
  "error": "Validation error",
  "message": "Invalid input",
  "details": [
    {
      "path": ["title"],
      "message": "Title cannot be empty"
    }
  ]
}
```

**Możliwe przyczyny:**
- Brak lub puste `title`
- `title` przekracza 500 znaków
- `manual` nie jest `true`
- `author_ids` jest pustą tablicą
- `author_ids` zawiera nieprawidłowe UUID
- `first_publish_year` jest poza zakresem 1500-2100
- `primary_edition_id` ma nieprawidłowy format UUID
- Nieprawidłowy format JSON w body

#### 401 Unauthorized - Brak uwierzytelnienia
Zwracany, gdy użytkownik nie jest uwierzytelniony.

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

#### 403 Forbidden - Brak uprawnień
Zwracany, gdy użytkownik próbuje utworzyć dzieło bez odpowiednich uprawnień (np. naruszenie RLS).

```json
{
  "error": "Forbidden",
  "message": "Cannot create manual work without ownership"
}
```

#### 404 Not Found - Autor nie znaleziony
Zwracany, gdy jeden lub więcej autorów z `author_ids` nie istnieje lub nie jest dostępny dla użytkownika.

```json
{
  "error": "Not Found",
  "message": "One or more authors not found or not accessible",
  "details": ["author_id_1", "author_id_2"]
}
```

#### 409 Conflict - Konflikt lub limit przekroczony
Zwracany w dwóch przypadkach:

**1. Limit dzieł użytkownika przekroczony:**
```json
{
  "error": "Conflict",
  "message": "Work limit reached (5000 works per user)"
}
```

**2. Naruszenie ograniczeń bazy danych:**
```json
{
  "error": "Conflict",
  "message": "Database constraint violation",
  "details": "works_manual_owner or works_manual_or_ol constraint violation"
}
```

#### 500 Internal Server Error - Błąd serwera
Zwracany, gdy wystąpił nieoczekiwany błąd po stronie serwera.

```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## 5. Przepływ danych

### Krok 1: Walidacja uwierzytelnienia
- Endpoint sprawdza obecność ważnej sesji użytkownika poprzez `locals.supabase.auth.getUser()`
- Jeśli użytkownik nie jest uwierzytelniony, zwracany jest błąd 401

### Krok 2: Parsowanie i walidacja request body
- Parsowanie JSON z request body
- Walidacja danych wejściowych przy użyciu Zod schema (`CreateWorkSchema`)
- Sprawdzenie, czy `manual` jest `true`
- Sprawdzenie, czy `author_ids` jest niepustą tablicą prawidłowych UUID
- Walidacja `title` (niepusty, max 500 znaków po przycięciu)
- Walidacja `first_publish_year` (jeśli podane: zakres 1500-2100)
- Walidacja formatu `primary_edition_id` (jeśli podane: prawidłowy UUID)

### Krok 3: Sprawdzenie limitów użytkownika
- Pobranie profilu użytkownika z tabeli `profiles`
- Sprawdzenie, czy `work_count < max_works` (domyślnie 5000)
- Jeśli limit został przekroczony, zwracany jest błąd 409

### Krok 4: Weryfikacja istnienia autorów
- Dla każdego `author_id` z `author_ids`:
  - Sprawdzenie, czy autor istnieje w bazie danych
  - Sprawdzenie, czy autor jest dostępny dla użytkownika (zgodnie z RLS)
- Jeśli którykolwiek autor nie istnieje lub nie jest dostępny, zwracany jest błąd 404 z listą nieprawidłowych `author_id`

### Krok 5: Utworzenie dzieła
- Utworzenie rekordu w tabeli `works` z następującymi wartościami:
  - `title`: przycięty tytuł z request body
  - `manual`: `true`
  - `owner_user_id`: `user.id` (z sesji)
  - `openlibrary_id`: `null`
  - `first_publish_year`: wartość z request body (jeśli podana) lub `null`
  - `primary_edition_id`: `null` (zostanie ustawione później, jeśli podane)
- Operacja jest wykonywana w transakcji, aby zapewnić spójność danych

### Krok 6: Utworzenie powiązań z autorami
- Dla każdego `author_id` z `author_ids`:
  - Utworzenie rekordu w tabeli `author_works` z `author_id` i `work_id`
- Wszystkie powiązania są tworzone w tej samej transakcji co dzieło

### Krok 7: Walidacja i ustawienie primary_edition_id (jeśli podane)
- Jeśli `primary_edition_id` zostało podane w request body:
  - Sprawdzenie, czy wydanie istnieje
  - Sprawdzenie, czy wydanie należy do utworzonego dzieła (`edition.work_id = work.id`)
  - Jeśli walidacja się powiedzie, aktualizacja `works.primary_edition_id`
  - Jeśli walidacja się nie powiedzie, zwracany jest błąd 400

### Krok 8: Pobranie utworzonego dzieła z głównym wydaniem
- Pobranie utworzonego dzieła z bazy danych
- Jeśli `primary_edition_id` jest ustawione, pobranie informacji o głównym wydaniu
- Zbudowanie odpowiedzi `WorkResponseDto` z `WorkWithPrimaryEditionDto`

### Krok 9: Zwrócenie odpowiedzi
- Zwrócenie odpowiedzi 201 Created z danymi dzieła
- Dodanie nagłówka `Location` wskazującego na utworzone dzieło

### Diagram przepływu danych
```
[Request] 
  ↓
[Auth Check] → 401 if unauthorized
  ↓
[Parse & Validate Body] → 400 if invalid
  ↓
[Check User Limits] → 409 if limit exceeded
  ↓
[Verify Authors Exist] → 404 if not found
  ↓
[Create Work] → 409 if constraint violation, 403 if RLS violation
  ↓
[Create Author-Work Links]
  ↓
[Validate & Set Primary Edition] → 400 if invalid
  ↓
[Fetch Work with Primary Edition]
  ↓
[Response 201 Created]
```

## 6. Względy bezpieczeństwa

### Uwierzytelnianie
- Endpoint wymaga uwierzytelnionego użytkownika
- Użycie `locals.supabase` z kontekstu Astro zapewnia bezpieczne zarządzanie sesją
- Weryfikacja użytkownika odbywa się na początku każdego żądania

### Autoryzacja (RLS)
- Row Level Security (RLS) jest włączone na tabeli `works`
- Polityka RLS dla `works`:
  - **SELECT**: Użytkownik może odczytać dzieła, gdzie `owner_user_id IS NULL` (globalne) lub `owner_user_id = auth.uid()` (własne)
  - **INSERT**: Użytkownik może tworzyć tylko dzieła z `owner_user_id = auth.uid()` (własne ręczne dzieła)
  - **UPDATE/DELETE**: Użytkownik może modyfikować tylko własne ręczne dzieła (`owner_user_id = auth.uid()`)
- Endpoint automatycznie ustawia `owner_user_id` na `auth.uid()`, co zapewnia zgodność z RLS

### Walidacja danych wejściowych
- Wszystkie dane wejściowe są walidowane przy użyciu Zod schema
- `title` jest przycinany i ograniczony do 500 znaków
- `author_ids` jest walidowane jako tablica niepustych UUID
- `first_publish_year` jest walidowane jako liczba całkowita w zakresie 1500-2100
- `primary_edition_id` jest walidowane jako prawidłowy UUID

### Ochrona przed atakami
- **SQL Injection**: Użycie Supabase Client zapewnia parametryzowane zapytania
- **XSS**: Dane wejściowe są walidowane, ale nie są renderowane bezpośrednio w HTML (to endpoint API)
- **CSRF**: Astro automatycznie obsługuje ochronę CSRF dla endpointów API
- **Rate Limiting**: Rozważenie implementacji rate limitingu dla tego endpointu (np. 10 żądań/min na użytkownika)

### Ograniczenia użytkownika
- Sprawdzanie limitów użytkownika przed utworzeniem dzieła zapobiega nadużyciom
- Limit 5000 dzieł na użytkownika jest egzekwowany zarówno w API, jak i w bazie danych (triggery)

### Weryfikacja relacji
- Weryfikacja, że wszyscy autorzy istnieją i są dostępni dla użytkownika przed utworzeniem powiązań
- Weryfikacja, że `primary_edition_id` (jeśli podane) należy do utworzonego dzieła

## 7. Obsługa błędów

### Kategorie błędów

#### Błędy walidacji (400 Bad Request)
- **Nieprawidłowy format JSON**: Zwracany, gdy request body nie jest prawidłowym JSON
- **Brakujące wymagane pola**: `title`, `manual`, `author_ids`
- **Nieprawidłowe wartości**: `title` puste lub za długie, `manual` nie jest `true`, `author_ids` puste
- **Nieprawidłowe typy**: `first_publish_year` nie jest liczbą, `author_ids` nie jest tablicą
- **Nieprawidłowy format UUID**: Elementy `author_ids` lub `primary_edition_id` nie są prawidłowymi UUID
- **Nieprawidłowy zakres**: `first_publish_year` poza zakresem 1500-2100
- **Nieprawidłowe primary_edition_id**: Wydanie nie istnieje lub nie należy do utworzonego dzieła

**Obsługa:**
- Logowanie ostrzeżenia z szczegółami walidacji
- Zwrócenie szczegółowego komunikatu błędu z listą błędów walidacji

#### Błędy uwierzytelniania (401 Unauthorized)
- **Brak sesji**: Użytkownik nie jest uwierzytelniony
- **Nieprawidłowy token**: Token dostępu jest nieprawidłowy lub wygasł

**Obsługa:**
- Logowanie ostrzeżenia (bez wrażliwych danych)
- Zwrócenie ogólnego komunikatu błędu

#### Błędy autoryzacji (403 Forbidden)
- **Naruszenie RLS**: Próba utworzenia dzieła bez odpowiednich uprawnień

**Obsługa:**
- Logowanie ostrzeżenia z `userId`
- Zwrócenie komunikatu błędu wskazującego na problem z uprawnieniami

#### Błędy nie znalezionych zasobów (404 Not Found)
- **Autor nie istnieje**: Jeden lub więcej autorów z `author_ids` nie istnieje w bazie danych
- **Autor niedostępny**: Autor istnieje, ale nie jest dostępny dla użytkownika (RLS)

**Obsługa:**
- Logowanie ostrzeżenia z listą nieprawidłowych `author_id`
- Zwrócenie komunikatu błędu z listą nieprawidłowych `author_id`

#### Błędy konfliktów (409 Conflict)
- **Limit przekroczony**: Użytkownik osiągnął limit 5000 dzieł
- **Naruszenie ograniczeń bazy danych**: Naruszenie `works_manual_owner` lub `works_manual_or_ol`

**Obsługa:**
- Logowanie ostrzeżenia z `userId` i szczegółami limitu
- Zwrócenie komunikatu błędu z informacją o limicie lub szczegółami naruszenia ograniczeń

#### Błędy serwera (500 Internal Server Error)
- **Błąd bazy danych**: Nieoczekiwany błąd podczas operacji na bazie danych
- **Błąd serwisu**: Błąd w WorksService lub AuthorsService
- **Nieoczekiwany błąd**: Wszystkie inne nieobsłużone błędy

**Obsługa:**
- Logowanie błędu z pełnymi szczegółami (w tym stack trace)
- Zwrócenie ogólnego komunikatu błędu (bez wrażliwych szczegółów)

### Strategia obsługi błędów

#### Wczesne zwracanie (Early Returns)
- Użycie wzorca early return dla wszystkich warunków błędów
- Unikanie zagnieżdżonych if-else poprzez wczesne zwracanie błędów

#### Logowanie
- **Ostrzeżenia (warn)**: Dla błędów walidacji, autoryzacji, limitów
- **Błędy (error)**: Dla błędów serwera i nieoczekiwanych błędów
- Logowanie zawiera kontekst (userId, authorIds, workId) bez wrażliwych danych

#### Komunikaty błędów
- Komunikaty błędów są przyjazne dla użytkownika
- Szczegółowe komunikaty dla błędów walidacji (lista błędów)
- Ogólne komunikaty dla błędów serwera (bez ujawniania wewnętrznych szczegółów)

#### Transakcje
- Użycie transakcji bazy danych dla operacji tworzenia dzieła i powiązań
- Rollback w przypadku błędów, aby zapewnić spójność danych

## 8. Rozważania dotyczące wydajności

### Potencjalne wąskie gardła

#### 1. Weryfikacja wielu autorów
- **Problem**: Jeśli `author_ids` zawiera wiele elementów, wykonanie wielu zapytań do bazy danych może być wolne
- **Rozwiązanie**: Użycie jednego zapytania z `IN` clause do weryfikacji wszystkich autorów jednocześnie
- **Optymalizacja**: Indeks na `authors.id` (PK) zapewnia szybkie wyszukiwanie

#### 2. Tworzenie wielu powiązań author_works
- **Problem**: Tworzenie wielu rekordów w `author_works` może być wolne
- **Rozwiązanie**: Użycie batch insert (jedno zapytanie z wieloma wartościami) zamiast wielu pojedynczych insertów
- **Optymalizacja**: Indeks na `author_works(author_id, work_id)` (PK) zapewnia szybkie wstawianie

#### 3. Sprawdzanie limitów użytkownika
- **Problem**: Zapytanie do `profiles` dla każdego żądania
- **Rozwiązanie**: Indeks na `profiles.user_id` (PK) zapewnia szybkie wyszukiwanie
- **Optymalizacja**: Rozważenie cache'owania limitów użytkownika (opcjonalne, jeśli wydajność jest problemem)

#### 4. Pobieranie głównego wydania
- **Problem**: Dodatkowe zapytanie do `editions` dla `primary_edition`
- **Rozwiązanie**: Użycie JOIN w zapytaniu do pobrania dzieła z głównym wydaniem w jednym zapytaniu
- **Optymalizacja**: Indeks na `editions.id` (PK) i `editions.work_id` zapewnia szybkie wyszukiwanie

### Strategie optymalizacji

#### Indeksy bazy danych
Następujące indeksy są już zdefiniowane w schemacie bazy danych:
- `works.id` (PK) - szybkie wyszukiwanie dzieła
- `authors.id` (PK) - szybkie wyszukiwanie autorów
- `author_works(author_id, work_id)` (PK) - szybkie wstawianie i wyszukiwanie powiązań
- `editions.id` (PK) - szybkie wyszukiwanie wydań
- `editions.work_id` - szybkie wyszukiwanie wydań dla dzieła
- `profiles.user_id` (PK) - szybkie wyszukiwanie profilu użytkownika

#### Transakcje
- Użycie transakcji bazy danych dla operacji tworzenia dzieła i powiązań
- Zapewnia spójność danych i może poprawić wydajność poprzez zmniejszenie liczby round-tripów do bazy danych

#### Batch Operations
- Użycie batch insert dla `author_works` zamiast wielu pojedynczych insertów
- Zmniejsza liczbę zapytań do bazy danych

#### Query Optimization
- Użycie JOIN do pobrania dzieła z głównym wydaniem w jednym zapytaniu
- Unikanie N+1 problem poprzez batch weryfikację autorów

### Monitoring wydajności
- Rozważenie dodania metryk czasu wykonania dla kluczowych operacji:
  - Czas weryfikacji autorów
  - Czas tworzenia dzieła
  - Czas tworzenia powiązań
  - Całkowity czas odpowiedzi endpointu

## 9. Etapy wdrożenia

### Krok 1: Utworzenie schematu walidacji Zod
- Utworzenie pliku `src/lib/validation/create-work.schema.ts`
- Zdefiniowanie `CreateWorkSchema` z walidacją wszystkich pól:
  - `title`: string, min 1, max 500, trim
  - `manual`: literal true
  - `author_ids`: array of UUID, min 1 element
  - `first_publish_year`: optional number, int, min 1500, max 2100
  - `primary_edition_id`: optional UUID
- Eksport typu `CreateWorkValidated` z inferencji Zod

### Krok 2: Utworzenie lub rozszerzenie WorksService
- Utworzenie pliku `src/lib/services/works.service.ts` (jeśli nie istnieje)
- Implementacja metody `checkUserWorkLimit(userId: string)`:
  - Pobranie profilu użytkownika z `profiles`
  - Zwrócenie `{ workCount, maxWorks }`
  - Obsługa błędów (profil nie znaleziony, błąd bazy danych)
- Implementacja metody `verifyAuthorsExist(authorIds: string[], userId: string)`:
  - Batch weryfikacja autorów przy użyciu `IN` clause
  - Sprawdzenie dostępności autorów zgodnie z RLS
  - Zwrócenie listy nieprawidłowych `author_id` (jeśli istnieją)
- Implementacja metody `createManualWork(userId: string, data: CreateWorkCommand)`:
  - Utworzenie dzieła w tabeli `works` z `manual = true`, `owner_user_id = userId`
  - Utworzenie powiązań w `author_works` (batch insert)
  - Walidacja i ustawienie `primary_edition_id` (jeśli podane)
  - Zwrócenie utworzonego dzieła
  - Obsługa błędów (constraint violations, RLS violations)
- Implementacja metody `findByIdWithPrimaryEdition(workId: string)`:
  - Pobranie dzieła z głównym wydaniem (jeśli ustawione) przy użyciu JOIN
  - Zwrócenie `WorkWithPrimaryEditionDto`
  - Obsługa błędów (dzieło nie znalezione)

### Krok 3: Utworzenie endpointu API
- Utworzenie pliku `src/pages/api/works/index.ts`
- Implementacja funkcji `POST` zgodnie z przepływem danych:
  1. Walidacja uwierzytelnienia
  2. Parsowanie i walidacja request body
  3. Sprawdzenie limitów użytkownika
  4. Weryfikacja istnienia autorów
  5. Utworzenie dzieła i powiązań
  6. Walidacja i ustawienie primary_edition_id
  7. Pobranie utworzonego dzieła z głównym wydaniem
  8. Zwrócenie odpowiedzi 201 Created
- Implementacja obsługi błędów dla wszystkich scenariuszy:
  - 400: Błędy walidacji
  - 401: Brak uwierzytelnienia
  - 403: Brak uprawnień (RLS)
  - 404: Autorzy nie znalezieni
  - 409: Limit przekroczony lub naruszenie ograniczeń
  - 500: Błędy serwera
- Dodanie `export const prerender = false`
- Dodanie komentarzy JSDoc z dokumentacją endpointu

### Krok 4: Implementacja logowania
- Użycie `logger` z `src/lib/logger.ts` do logowania:
  - Ostrzeżenia dla błędów walidacji, autoryzacji, limitów
  - Błędy dla błędów serwera
- Logowanie kontekstu (userId, authorIds, workId) bez wrażliwych danych

### Krok 5: Testy manualne
**Plik:** `.ai/api-works-create-manual-tests.md`
Przygotowanie przewodnika testów manualnych zawierającego scenariusze testowe do weryfikacji działania endpointu.

### Krok 6: Dokumentacja
- Aktualizacja dokumentacji API (jeśli istnieje)
- Dodanie przykładów użycia endpointu
- Dokumentacja wszystkich możliwych kodów odpowiedzi

### Krok 7: Code Review i Refaktoryzacja
- Przegląd kodu pod kątem:
  - Zgodności z zasadami kodowania (early returns, error handling)
  - Spójności z innymi endpointami (POST /api/authors jako wzorzec)
  - Wydajności (batch operations, optymalizacja zapytań)
  - Bezpieczeństwa (walidacja, RLS, autoryzacja)
- Refaktoryzacja w razie potrzeby
