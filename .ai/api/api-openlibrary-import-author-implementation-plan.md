# API Endpoint Implementation Plan: POST /api/openlibrary/import/author

## 1. Przegląd punktu końcowego

Endpoint `POST /api/openlibrary/import/author` służy do importowania lub odświeżania autora z katalogu OpenLibrary do wspólnego katalogu aplikacji. Endpoint implementuje mechanizm cache z czasem wygaśnięcia (TTL) wynoszącym 7 dni, co oznacza, że dane autora są przechowywane lokalnie i odświeżane tylko wtedy, gdy cache wygasł lub autor nie istnieje w bazie danych.

**Kluczowe funkcjonalności:**

- Import autora z OpenLibrary na podstawie `openlibrary_id`
- Automatyczne odświeżanie cache, jeśli dane wygasły (sprawdzenie `ol_expires_at`)
- Zapis do wspólnego katalogu (global catalog) z `owner_user_id = null` i `manual = false`
- Użycie SECURITY DEFINER RPC do obejścia polityk RLS dla wpisów globalnego katalogu
- Obsługa błędów zewnętrznego API OpenLibrary

**Kontekst biznesowy:**
Endpoint jest częścią systemu zarządzania autorami, który pozwala użytkownikom importować autorów z zewnętrznego źródła (OpenLibrary) do wspólnego katalogu, który może być wykorzystywany przez wszystkich użytkowników aplikacji.

## 2. Szczegóły żądania

### Metoda HTTP

`POST`

### Struktura URL

```
/api/openlibrary/import/author
```

### Request Body

```typescript
{
  "openlibrary_id": string  // Wymagane, format: "OL23919A"
}
```

**Parametry:**

- `openlibrary_id` (wymagane): Identyfikator autora w systemie OpenLibrary w formacie skróconym (`OL23919A`). Powinien być znormalizowany przed użyciem.

**Przykładowe żądanie:**

```json
{
  "openlibrary_id": "/authors/OL23919A"
}
```

### Headers

- `Content-Type: application/json` (wymagane)
- `Authorization: Bearer <access_token>` (opcjonalne, ale zalecane dla lepszego logowania)

## 3. Wykorzystywane typy

### Command Model (Request Body)

```typescript
// src/types.ts
export interface ImportAuthorCommand {
  openlibrary_id: NonNullable<AuthorRow["openlibrary_id"]>;
}
```

### Response DTO

```typescript
// src/types.ts
export interface AuthorResponseDto {
  author: AuthorDto; // AuthorDto = AuthorRow
}
```

### Typy pomocnicze

```typescript
// src/types.ts
export type AuthorDto = AuthorRow;
export type AuthorRow = Tables<"authors">;
```

### Typy z OpenLibrary Service

```typescript
// src/lib/services/openlibrary.service.ts
export interface OpenLibraryAuthor {
  openlibrary_id: string;
  name: string;
}
```

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

Zwraca zaktualizowany lub nowo utworzony rekord autora.

**Struktura odpowiedzi:**

```json
{
  "author": {
    "id": "uuid",
    "name": "string",
    "openlibrary_id": "string",
    "manual": false,
    "owner_user_id": null,
    "ol_fetched_at": "2024-01-15T10:30:00.000Z",
    "ol_expires_at": "2024-01-22T10:30:00.000Z",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Błędy

#### 400 Bad Request

Nieprawidłowa struktura żądania lub walidacja nie powiodła się.

```json
{
  "error": "Validation error",
  "message": "openlibrary_id is required",
  "details": [
    {
      "path": ["openlibrary_id"],
      "message": "Required"
    }
  ]
}
```

#### 404 Not Found

Autor o podanym `openlibrary_id` nie został znaleziony w OpenLibrary.

```json
{
  "error": "Author not found",
  "message": "Author with openlibrary_id '/authors/OL23919A' not found in OpenLibrary"
}
```

#### 502 Bad Gateway

OpenLibrary API jest niedostępne lub zwróciło błąd.

```json
{
  "error": "External service error",
  "message": "Could not connect to OpenLibrary. Please try again later."
}
```

#### 500 Internal Server Error

Nieoczekiwany błąd serwera.

```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## 5. Przepływ danych

### Diagram przepływu

```
1. Request → 2. Walidacja (Zod) → 3. Normalizacja openlibrary_id
                                      ↓
4. Sprawdzenie cache w DB (AuthorsService.findByOpenLibraryId)
                                      ↓
5. Jeśli cache ważny → Zwróć z cache
   Jeśli cache wygasł lub brak → 6. Pobierz z OpenLibrary API
                                      ↓
7. Upsert do DB (RPC upsert_author_from_ol lub upsert_authors_cache)
                                      ↓
8. Zwróć AuthorResponseDto
```

### Szczegółowy przepływ

1. **Odbieranie żądania**
   - Endpoint odbiera POST request z body zawierającym `openlibrary_id`
   - Middleware zapewnia dostęp do `locals.supabase` z kontekstem użytkownika

2. **Walidacja danych wejściowych**
   - Użycie schematu Zod do walidacji `ImportAuthorCommand`
   - Sprawdzenie, czy `openlibrary_id` jest niepustym stringiem
   - Normalizacja formatu `openlibrary_id` (usunięcie prefiksu `/authors/` jeśli występuje)

3. **Sprawdzenie cache w bazie danych**
   - Wywołanie `AuthorsService.findByOpenLibraryId(openlibrary_id)` lub podobnej metody
   - Sprawdzenie, czy autor istnieje i czy `ol_expires_at > now()`
   - Jeśli cache jest ważny, zwróć dane z bazy bez wywołania OpenLibrary API

4. **Pobieranie danych z OpenLibrary (jeśli potrzebne)**
   - Wywołanie `OpenLibraryService.fetchAuthorByOpenLibraryId(openlibrary_id)`
   - Obsługa timeout (10 sekund)
   - Parsowanie i walidacja odpowiedzi z OpenLibrary
   - Jeśli autor nie istnieje w OpenLibrary, zwróć 404

5. **Upsert do bazy danych**
   - Przygotowanie danych z `ol_fetched_at = now()` i `ol_expires_at = now() + 7 days`
   - Wywołanie RPC `upsert_author_from_ol` (SECURITY DEFINER) lub użycie istniejącego `upsert_authors_cache` z pojedynczym elementem
   - RPC ustawia `manual = false`, `owner_user_id = null`
   - RPC aktualizuje cache tylko jeśli `ol_expires_at` wygasł lub autor nie istnieje

6. **Zwrócenie odpowiedzi**
   - Pobranie zaktualizowanego rekordu z bazy danych
   - Mapowanie do `AuthorResponseDto`
   - Zwrócenie odpowiedzi 200 OK z danymi autora

### Interakcje z zewnętrznymi serwisami

**OpenLibrary API:**

- Endpoint: `https://openlibrary.org/authors/{openlibrary_id}.json`
- Metoda: GET
- Timeout: 10 sekund
- Obsługa błędów: 404 (autor nie znaleziony), timeout, błędy sieciowe

**Supabase Database:**

- Tabela: `authors`
- RPC: `upsert_author_from_ol` (do utworzenia) lub `upsert_authors_cache` (istniejące)
- Polityki RLS: RPC używa SECURITY DEFINER do obejścia RLS dla wpisów globalnego katalogu

## 6. Względy bezpieczeństwa

### Uwierzytelnianie

- Endpoint nie wymaga uwierzytelniania (anonimowy dostęp), ale zalecane jest logowanie dla lepszego śledzenia użycia
- Middleware zapewnia dostęp do `locals.supabase` z kontekstem sesji (jeśli dostępna)

### Autoryzacja

- Endpoint modyfikuje tylko wpisy globalnego katalogu (`owner_user_id = null`)
- RPC SECURITY DEFINER zapewnia, że tylko autoryzowane operacje mogą modyfikować globalny katalog
- RLS blokuje bezpośrednie modyfikacje wpisów globalnego katalogu przez użytkowników

### Walidacja danych wejściowych

- **Zod schema**: Walidacja typu i formatu `openlibrary_id`
- **Normalizacja**: Usunięcie potencjalnie niebezpiecznych znaków i normalizacja formatu
- **Sanityzacja**: Sprawdzenie długości i formatu przed wysłaniem do OpenLibrary API

### Ochrona przed atakami

**SQL Injection:**

- Użycie parametrówzowanych zapytań przez Supabase Client
- RPC funkcje używają typowanych parametrów JSONB

**DoS (Denial of Service):**

- Timeout na wywołania OpenLibrary API (10 sekund)
- Cache zmniejsza obciążenie zewnętrznego API
- Rate limiting może być dodany w przyszłości (obecnie nie jest wymagany w specyfikacji)

**Data Validation:**

- Walidacja formatu `openlibrary_id` przed wysłaniem do OpenLibrary
- Obsługa nieprawidłowych odpowiedzi z OpenLibrary API

### Logowanie i monitoring

- Logowanie wszystkich wywołań endpointu (debug level)
- Logowanie błędów OpenLibrary API (error level)
- Logowanie nieudanych operacji bazy danych (error level)
- Unikanie logowania wrażliwych danych (np. pełnych tokenów)

## 7. Obsługa błędów

### Scenariusze błędów i odpowiedzi

#### 1. Nieprawidłowe dane wejściowe (400 Bad Request)

**Przyczyna:** Brak `openlibrary_id` lub nieprawidłowy format.

**Obsługa:**

- Walidacja przez Zod schema
- Zwrócenie szczegółowego komunikatu błędu z informacją o polu, które nie przeszło walidacji

**Przykład:**

```typescript
if (!validation.success) {
  return new Response(
    JSON.stringify({
      error: "Validation error",
      message: validation.error.errors[0].message,
      details: validation.error.errors,
    }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}
```

#### 2. Autor nie znaleziony w OpenLibrary (404 Not Found)

**Przyczyna:** OpenLibrary API zwróciło 404 lub autor nie istnieje w odpowiedzi.

**Obsługa:**

- Sprawdzenie statusu odpowiedzi z OpenLibrary API
- Sprawdzenie, czy odpowiedź zawiera wymagane pola (`name`, `key`)
- Zwrócenie przyjaznego komunikatu błędu

**Przykład:**

```typescript
if (response.status === 404) {
  return new Response(
    JSON.stringify({
      error: "Author not found",
      message: `Author with openlibrary_id '${openlibrary_id}' not found in OpenLibrary`,
    }),
    { status: 404, headers: { "Content-Type": "application/json" } }
  );
}
```

#### 3. OpenLibrary API niedostępne (502 Bad Gateway)

**Przyczyna:** Timeout, błąd sieciowy, lub OpenLibrary API zwróciło błąd 5xx.

**Obsługa:**

- Przechwycenie wyjątków z `OpenLibraryService`
- Rozróżnienie między timeout a innymi błędami
- Zwrócenie przyjaznego komunikatu dla użytkownika
- Logowanie szczegółów błędu dla debugowania

**Przykład:**

```typescript
try {
  olAuthor = await olService.fetchAuthorByOpenLibraryId(openlibrary_id);
} catch (error) {
  logger.error("OpenLibrary API error:", error);
  return new Response(
    JSON.stringify({
      error: "External service error",
      message: "Could not connect to OpenLibrary. Please try again later.",
    }),
    { status: 502, headers: { "Content-Type": "application/json" } }
  );
}
```

#### 4. Błąd bazy danych (500 Internal Server Error)

**Przyczyna:** Błąd podczas upsertu do bazy danych, problem z RPC, lub naruszenie constraintów.

**Obsługa:**

- Przechwycenie błędów z `AuthorsService` lub RPC
- Sprawdzenie kodów błędów PostgreSQL (np. constraint violations)
- Logowanie szczegółów błędu
- Zwrócenie ogólnego komunikatu błędu (nie ujawnianie szczegółów implementacji)

**Przykład:**

```typescript
try {
  await authorsService.upsertAuthorFromOpenLibrary(olAuthor, fetchedAt, expiresAt);
} catch (error) {
  logger.error("Database error:", error);
  return new Response(
    JSON.stringify({
      error: "Internal server error",
      message: "An unexpected error occurred",
    }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
```

#### 5. Nieoczekiwany błąd (500 Internal Server Error)

**Przyczyna:** Nieprzewidziany wyjątek w kodzie.

**Obsługa:**

- Try-catch na najwyższym poziomie handlera
- Logowanie pełnego stack trace
- Zwrócenie ogólnego komunikatu błędu

### Strategia obsługi błędów

1. **Early returns**: Sprawdzanie błędów na początku funkcji i natychmiastowe zwracanie odpowiedzi
2. **Guard clauses**: Walidacja preconditions przed wykonaniem głównej logiki
3. **Error logging**: Wszystkie błędy są logowane z odpowiednim poziomem (error, warn, debug)
4. **User-friendly messages**: Komunikaty błędów są zrozumiałe dla użytkownika końcowego
5. **No sensitive data**: Unikanie ujawniania szczegółów implementacji w odpowiedziach błędów

## 8. Rozważania dotyczące wydajności

### Cache i TTL

- **7-dniowy TTL**: Dane autora są cache'owane na 7 dni, co zmniejsza obciążenie OpenLibrary API
- **Sprawdzenie cache przed wywołaniem API**: Jeśli cache jest ważny, pomijamy wywołanie do OpenLibrary
- **Background refresh**: Możliwość odświeżania cache w tle (obecnie nie jest wymagane w specyfikacji)

### Optymalizacje bazy danych

- **Indeks na `openlibrary_id`**: Częściowy unikalny indeks na `authors.openlibrary_id WHERE openlibrary_id IS NOT NULL` zapewnia szybkie wyszukiwanie
- **Batch operations**: Użycie RPC do batch upsert (obecnie używamy pojedynczego elementu, ale RPC wspiera batch)
- **RLS policies**: Polityki RLS są zoptymalizowane dla odczytu globalnego katalogu

### Optymalizacje API

- **Timeout handling**: 10-sekundowy timeout zapobiega długim oczekiwaniom
- **AbortController**: Użycie AbortController do anulowania długotrwałych żądań
- **Connection pooling**: Supabase Client zarządza pulą połączeń automatycznie

### Potencjalne wąskie gardła

1. **OpenLibrary API latency**
   - **Problem**: OpenLibrary API może być wolne lub niedostępne
   - **Rozwiązanie**: Timeout 10 sekund, cache zmniejsza liczbę wywołań
   - **Monitoring**: Logowanie czasu odpowiedzi OpenLibrary API

2. **Database contention**
   - **Problem**: Wiele równoczesnych importów tego samego autora
   - **Rozwiązanie**: RPC używa `ON CONFLICT` do bezpiecznego upsertu
   - **Monitoring**: Monitorowanie czasu wykonania RPC

3. **Memory usage**
   - **Problem**: Duże odpowiedzi z OpenLibrary API
   - **Rozwiązanie**: Parsowanie strumieniowe (jeśli potrzebne) lub limitowanie rozmiaru odpowiedzi
   - **Monitoring**: Monitorowanie rozmiaru odpowiedzi

### Metryki do monitorowania

- Czas odpowiedzi endpointu (p50, p95, p99)
- Czas odpowiedzi OpenLibrary API
- Czas wykonania RPC
- Współczynnik trafień cache (cache hit rate)
- Liczba błędów 502 (OpenLibrary niedostępne)
- Liczba błędów 500 (błędy serwera)

## 9. Etapy wdrożenia

### Krok 1: Utworzenie schematu walidacji Zod

**Plik:** `src/lib/validation/import-author.schema.ts`

- Utworzenie schematu `ImportAuthorSchema` z walidacją `openlibrary_id`
- Walidacja: string, niepusty, maksymalna długość (np. 200 znaków)
- Eksport typu `ImportAuthorCommandValidated` z `z.infer`

### Krok 2: Rozszerzenie OpenLibraryService

**Plik:** `src/lib/services/openlibrary.service.ts`

- Dodanie metody `fetchAuthorByOpenLibraryId(openlibrary_id: string): Promise<OpenLibraryAuthor>`
- Implementacja wywołania do `https://openlibrary.org/authors/{openlibrary_id}.json`
- Obsługa timeout (10 sekund) i błędów
- Parsowanie odpowiedzi OpenLibrary (struktura może różnić się od search API)
- Normalizacja `openlibrary_id` (usunięcie prefiksu `/authors/` jeśli występuje)
- Walidacja wymaganych pól w odpowiedzi (`name`, `key`)

### Krok 3: Rozszerzenie AuthorsService

**Plik:** `src/lib/services/authors.service.ts`

- Dodanie metody `findByOpenLibraryId(openlibrary_id: string): Promise<AuthorRow | null>`
  - Pobranie pojedynczego autora po `openlibrary_id`
  - Zwrócenie `null` jeśli nie znaleziono
- Dodanie metody `upsertAuthorFromOpenLibrary(author: OpenLibraryAuthor, fetchedAt: Date, expiresAt: Date): Promise<AuthorRow>`
  - Przygotowanie danych do upsertu
  - Wywołanie RPC `upsert_author_from_ol` (jeśli istnieje) lub `upsert_authors_cache` z pojedynczym elementem
  - Pobranie zaktualizowanego rekordu z bazy
  - Obsługa błędów bazy danych

### Krok 4: Utworzenie migracji bazy danych (jeśli potrzebne)

**Plik:** `supabase/migrations/YYYYMMDDHHMMSS_add_upsert_author_from_ol_rpc.sql`

- Sprawdzenie, czy istnieje RPC `upsert_author_from_ol`
- Jeśli nie istnieje, utworzenie RPC funkcji:
  - Przyjmuje parametry: `p_openlibrary_id text`, `p_name text`, `p_ol_fetched_at timestamptz`, `p_ol_expires_at timestamptz`
  - SECURITY DEFINER
  - Upsert z `ON CONFLICT (openlibrary_id)`
  - Ustawia `manual = false`, `owner_user_id = null`
  - Aktualizuje tylko jeśli cache wygasł lub autor nie istnieje
- Jeśli użyjemy istniejącego `upsert_authors_cache`, pomijamy ten krok

### Krok 5: Utworzenie endpointu API

**Plik:** `src/pages/api/openlibrary/import/author.ts`

- Import wymaganych zależności (types, services, validation, logger)
- Eksport `export const prerender = false`
- Implementacja handlera `POST: APIRoute`:
  1. Parsowanie i walidacja body (Zod)
  2. Normalizacja `openlibrary_id`
  3. Inicjalizacja serwisów (OpenLibraryService, AuthorsService)
  4. Sprawdzenie cache w bazie danych
  5. Jeśli cache ważny → zwróć z cache
  6. Jeśli cache wygasł lub brak → pobierz z OpenLibrary
  7. Upsert do bazy danych
  8. Zwróć `AuthorResponseDto` z statusem 200
- Obsługa błędów z odpowiednimi kodami statusu (400, 404, 502, 500)
- Logowanie błędów i operacji

### Krok 6: Testy manualne

**Plik:** `.ai/api/api-openlibrary-import-author-manual-tests.md`

Przygotowanie szczegółowego przewodnika testów manualnych zawierającego scenariusze testowe do weryfikacji działania endpointu. Plik powinien zawierać:

**Struktura pliku:**

1. **Prerequisites** - Wymagania wstępne (uruchomiony dev server, skonfigurowane zmienne środowiskowe, dostęp do bazy danych)
2. **Authentication Setup** (jeśli wymagane) - Instrukcje dotyczące uwierzytelniania (endpoint jest anonimowy, ale może być przydatne do logowania)
3. **Test Cases** - Szczegółowe scenariusze testowe:
   - **Test 1: Successful Author Import (Happy Path)** - Import autora z ważnym `openlibrary_id`
     - Sprawdzenie odpowiedzi 200 OK
     - Weryfikacja struktury odpowiedzi (`AuthorResponseDto`)
     - Sprawdzenie, czy autor został zapisany w bazie z poprawnymi wartościami (`manual = false`, `owner_user_id = null`)
     - Weryfikacja cache TTL (`ol_fetched_at`, `ol_expires_at` = +7 dni)
   - **Test 2: Import with Valid Cache** - Import autora, który już istnieje w bazie z ważnym cache
     - Sprawdzenie, że nie wykonano wywołania do OpenLibrary API (cache hit)
     - Zwrócenie danych z cache
   - **Test 3: Import with Expired Cache** - Import autora z wygasłym cache
     - Sprawdzenie, że wykonano wywołanie do OpenLibrary API
     - Weryfikacja odświeżenia cache w bazie danych
   - **Test 4: Validation Error - Missing openlibrary_id** - Brak wymaganego pola
     - Sprawdzenie odpowiedzi 400 Bad Request
     - Weryfikacja struktury błędu walidacji
   - **Test 5: Validation Error - Invalid openlibrary_id Format** - Nieprawidłowy format `openlibrary_id`
     - Sprawdzenie odpowiedzi 400 Bad Request
   - **Test 6: Author Not Found in OpenLibrary** - Autor nie istnieje w OpenLibrary
     - Sprawdzenie odpowiedzi 404 Not Found
     - Weryfikacja komunikatu błędu
   - **Test 7: OpenLibrary API Unavailable** - OpenLibrary API zwraca błąd lub timeout
     - Symulacja błędu 502 Bad Gateway
     - Weryfikacja komunikatu błędu
   - **Test 8: Normalization of openlibrary_id** - Test normalizacji formatu
     - Import z `openlibrary_id` w formacie `/authors/OL23919A`
     - Import z `openlibrary_id` w formacie `OL23919A`
     - Weryfikacja, że oba formaty są obsługiwane poprawnie
   - **Test 9: Concurrent Imports** - Równoczesne importy tego samego autora
     - Sprawdzenie, że RPC bezpiecznie obsługuje konflikty
     - Weryfikacja braku duplikatów w bazie danych

**Format każdego test case:**

- **Description** - Opis scenariusza
- **Request** - Przykładowe żądanie (curl, Postman, lub inny format)
- **Expected Response** - Oczekiwana odpowiedź (status code, body)
- **Verification Steps** - Kroki weryfikacji (sprawdzenie w bazie danych, logów, itp.)
- **Notes** - Dodatkowe uwagi lub edge cases

**Narzędzia do testowania:**

- curl commands dla każdego scenariusza
- Instrukcje dotyczące sprawdzania bazy danych (Supabase dashboard lub SQL queries)

### Krok 7: Dokumentacja i code review

- Aktualizacja dokumentacji API (jeśli istnieje)
- Code review zgodnie z zasadami projektu
- Sprawdzenie zgodności z regułami implementacji
- Sprawdzenie obsługi błędów i logowania

### Zależności między krokami

1. Krok 1 (Zod schema) → niezależny, można zacząć od razu
2. Krok 2 (OpenLibraryService) → niezależny, można zacząć równolegle z krokiem 1
3. Krok 3 (AuthorsService) → może wymagać kroku 4 (RPC), jeśli używamy nowego RPC
4. Krok 4 (RPC migration) → niezależny, ale wymagany przed krokiem 3, jeśli tworzymy nowy RPC
5. Krok 5 (Endpoint) → wymaga kroków 1, 2, 3
6. Krok 6 (Testy manualne) → wymaga ukończenia kroku 5 (endpoint musi być zaimplementowany)
7. Krok 7 (Dokumentacja i code review) → wymaga ukończenia kroków 1-6

### Uwagi implementacyjne

- Użycie istniejącego `upsert_authors_cache` z pojedynczym elementem może być prostsze niż tworzenie nowego RPC
- Normalizacja `openlibrary_id` powinna być spójna z innymi endpointami (sprawdź `search.ts`)
- Logowanie powinno używać `logger` z `@/lib/logger` zgodnie z istniejącym kodem
- Obsługa błędów powinna być spójna z `search.ts` endpointem
