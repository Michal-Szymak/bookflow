# API Endpoint Implementation Plan: GET /api/user/authors

## 1. Przegląd punktu końcowego

Endpoint `GET /api/user/authors` służy do pobierania listy autorów przypisanych do profilu zalogowanego użytkownika. Endpoint obsługuje wyszukiwanie po nazwie autora, paginację oraz sortowanie wyników. Jest to endpoint wymagający autoryzacji - tylko zalogowany użytkownik może przeglądać swoich przypisanych autorów.

**Główne funkcjonalności:**
- Listowanie autorów przypisanych do użytkownika z tabeli `user_authors`
- Wyszukiwanie autorów po nazwie (case-insensitive, zawiera)
- Paginacja wyników (domyślnie strona 1)
- Sortowanie: po nazwie (asc) lub dacie utworzenia (desc)
- Zwracanie całkowitej liczby przypisanych autorów

**Wykorzystywane zasoby bazy danych:**
- Tabela `user_authors` (relacja użytkownik-autor)
- Tabela `authors` (dane autorów)
- Indeksy: `user_authors(user_id)` oraz `authors(name/title idx)`

## 2. Szczegóły żądania

**Metoda HTTP:** `GET`

**Struktura URL:** `/api/user/authors`

**Parametry zapytania (query parameters):**

- **page** (opcjonalny, domyślnie: 1)
  - Typ: liczba całkowita
  - Zakres: minimum 1
  - Opis: Numer strony wyników do pobrania

- **search** (opcjonalny)
  - Typ: string
  - Opis: Fraza do wyszukiwania w nazwie autora (case-insensitive, zawiera)
  - Walidacja: po trimowaniu nie może być pusty, maksymalna długość 200 znaków

- **sort** (opcjonalny, domyślnie: `name_asc`)
  - Typ: enum
  - Dozwolone wartości: `name_asc`, `created_desc`
  - Opis: Kolejność sortowania wyników
    - `name_asc`: Sortowanie alfabetyczne po nazwie autora (A-Z)
    - `created_desc`: Sortowanie po dacie przypisania autora do użytkownika (najnowsze pierwsze)

**Request Body:** Brak (endpoint GET)

**Wymagana autoryzacja:** Tak (Bearer token w nagłówku Authorization)

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

Wszystkie wymagane typy DTO są już zdefiniowane w `src/types.ts`:

1. **UserAuthorsListQueryDto** (linie 253-257)
   - Reprezentuje parametry zapytania
   - Pola: `page?: number`, `search?: string`, `sort?: "name_asc" | "created_desc"`

2. **UserAuthorDto** (linie 132-135)
   - Reprezentuje pojedynczego autora przypisanego do użytkownika
   - Pola: `author: AuthorDto`, `created_at: UserAuthorRow["created_at"]`

3. **UserAuthorsListResponseDto** (linie 141-144)
   - Reprezentuje odpowiedź endpointu
   - Pola: `items: UserAuthorDto[]`, `total: number`

4. **AuthorDto** (linia 26)
   - Typ alias do `AuthorRow` - pełne dane autora z bazy danych

### Command Modele

Brak - endpoint GET nie przyjmuje body.

### Schematy walidacji

Należy utworzyć nowy schemat walidacji w `src/lib/validation/user-authors-list.schema.ts`:

- **UserAuthorsListQuerySchema** - schemat Zod do walidacji parametrów zapytania
  - `page`: opcjonalny, liczba całkowita >= 1 (preprocess z stringa)
  - `search`: opcjonalny, string, po trimowaniu nie pusty, max 200 znaków
  - `sort`: opcjonalny, enum `"name_asc" | "created_desc"`

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

**Struktura odpowiedzi:**
```json
{
  "items": [
    {
      "author": {
        "id": "uuid",
        "name": "string",
        "openlibrary_id": "string | null",
        "manual": boolean,
        "owner_user_id": "uuid | null",
        "ol_fetched_at": "string | null",
        "ol_expires_at": "string | null",
        "created_at": "string",
        "updated_at": "string"
      },
      "created_at": "string"
    }
  ],
  "total": number
}
```

**Opis pól:**
- `items`: Tablica autorów przypisanych do użytkownika (zgodnie z paginacją)
- `total`: Całkowita liczba autorów przypisanych do użytkownika (niezależnie od paginacji)

**Przykładowa odpowiedź:**
```json
{
  "items": [
    {
      "author": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "J.R.R. Tolkien",
        "openlibrary_id": "OL26320A",
        "manual": false,
        "owner_user_id": null,
        "ol_fetched_at": "2025-01-20T10:00:00Z",
        "ol_expires_at": "2025-01-27T10:00:00Z",
        "created_at": "2025-01-15T08:30:00Z",
        "updated_at": "2025-01-20T10:00:00Z"
      },
      "created_at": "2025-01-20T12:00:00Z"
    }
  ],
  "total": 1
}
```

### Błędy

**400 Bad Request** - Błąd walidacji parametrów zapytania
```json
{
  "error": "Validation error",
  "message": "Page must be at least 1",
  "details": [...]
}
```

**401 Unauthorized** - Brak autoryzacji lub nieprawidłowy token
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**500 Internal Server Error** - Błąd serwera
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## 5. Przepływ danych

### Krok 1: Walidacja autoryzacji
- Middleware (`src/middleware/index.ts`) ekstraktuje token z nagłówka `Authorization`
- Tworzy klienta Supabase z tokenem użytkownika
- Jeśli token jest nieprawidłowy lub brakuje, Supabase RLS automatycznie zablokuje dostęp

### Krok 2: Ekstrakcja i walidacja parametrów zapytania
- Parsowanie parametrów z URL (`page`, `search`, `sort`)
- Walidacja przy użyciu `UserAuthorsListQuerySchema` (Zod)
- Ustawienie wartości domyślnych: `page = 1`, `sort = "name_asc"`

### Krok 3: Pobranie ID użytkownika
- Z tokena autoryzacyjnego (przez Supabase client) lub z sesji
- Weryfikacja, że użytkownik jest zalogowany

### Krok 4: Zapytanie do bazy danych
- Wywołanie metody serwisu do pobrania autorów użytkownika
- Zapytanie wykorzystuje:
  - JOIN między `user_authors` a `authors` na `author_id`
  - Filtrowanie po `user_id` (RLS automatycznie)
  - Opcjonalne filtrowanie po `name` (ILIKE dla case-insensitive search)
  - Sortowanie zgodnie z parametrem `sort`
  - Paginacja (LIMIT/OFFSET) na podstawie `page`
  - Liczenie całkowitej liczby wyników (COUNT)

### Krok 5: Mapowanie wyników
- Mapowanie wyników z bazy na `UserAuthorDto[]`
- Każdy element zawiera pełne dane autora (`AuthorDto`) oraz `created_at` z `user_authors`

### Krok 6: Zwrócenie odpowiedzi
- Konstrukcja `UserAuthorsListResponseDto` z `items` i `total`
- Zwrócenie odpowiedzi JSON z kodem 200

### Diagram przepływu:
```
Request → Middleware (auth) → Extract Query Params → Validate (Zod) 
→ Get User ID → Service Query (JOIN user_authors + authors) 
→ Map to DTOs → Return Response (200)
```

## 6. Względy bezpieczeństwa

### Autoryzacja
- **Wymagana**: Endpoint wymaga zalogowanego użytkownika
- **Mechanizm**: Bearer token w nagłówku `Authorization`
- **Weryfikacja**: Supabase RLS (Row Level Security) automatycznie filtruje wyniki do autorów przypisanych do zalogowanego użytkownika
- **Brak autoryzacji**: Zwraca 401 Unauthorized

### Autoryzacja danych
- RLS w Supabase zapewnia, że użytkownik widzi tylko swoich autorów z tabeli `user_authors`
- Zapytanie używa `user_id` z sesji/tokena, nie z parametrów zapytania
- Brak możliwości dostępu do autorów innych użytkowników

### Walidacja danych wejściowych
- Wszystkie parametry zapytania są walidowane przez Zod
- `page`: minimalna wartość 1, tylko liczby całkowite
- `search`: maksymalna długość 200 znaków, trimowanie białych znaków
- `sort`: tylko dozwolone wartości enum
- Ochrona przed SQL injection przez parametryzowane zapytania Supabase

### Rate limiting
- Endpoint nie ma specjalnych limitów rate (w przeciwieństwie do POST /api/user/authors)
- Ogólne limity API mogą być zastosowane na poziomie infrastruktury

### Logowanie
- Logowanie błędów walidacji (warn level)
- Logowanie błędów bazy danych (error level)
- Logowanie nieoczekiwanych błędów (error level)
- Brak logowania wrażliwych danych (user_id, author_id w logach tylko w trybie debug)

## 7. Obsługa błędów

### Scenariusze błędów i odpowiedzi

1. **Brak autoryzacji (401)**
   - **Przyczyna**: Brak tokena w nagłówku Authorization lub nieprawidłowy token
   - **Obsługa**: Middleware lub Supabase zwraca błąd autoryzacji
   - **Odpowiedź**: `401 Unauthorized` z komunikatem o wymaganej autoryzacji

2. **Błąd walidacji parametrów (400)**
   - **Przyczyny**:
     - `page` < 1 lub nie jest liczbą całkowitą
     - `search` przekracza 200 znaków
     - `sort` ma nieprawidłową wartość
   - **Obsługa**: Zod validation zwraca błędy walidacji
   - **Odpowiedź**: `400 Bad Request` z listą błędów walidacji

3. **Błąd bazy danych (500)**
   - **Przyczyny**:
     - Problem z połączeniem do Supabase
     - Błąd zapytania SQL
     - Timeout zapytania
   - **Obsługa**: Try-catch w serwisie, logowanie błędu
   - **Odpowiedź**: `500 Internal Server Error` z ogólnym komunikatem

4. **Nieoczekiwany błąd (500)**
   - **Przyczyny**: Błędy poza kontrolą (np. null reference, nieprawidłowy typ)
   - **Obsługa**: Globalny try-catch w handlerze endpointu
   - **Odpowiedź**: `500 Internal Server Error` z ogólnym komunikatem

### Pusta lista wyników
- **Scenariusz**: Użytkownik nie ma przypisanych autorów lub wyszukiwanie nie zwróciło wyników
- **Obsługa**: To nie jest błąd - zwracamy `200 OK` z pustą tablicą `items: []` i `total: 0`

### Strategia obsługi błędów
- Używanie early returns dla warunków błędów
- Szczegółowe logowanie błędów dla debugowania
- Ogólne komunikaty błędów dla użytkownika końcowego (bez szczegółów technicznych)
- Walidacja na początku funkcji (guard clauses)

## 8. Rozważania dotyczące wydajności

### Indeksy bazy danych
- **Wykorzystywane indeksy**:
  - `user_authors(user_id)` - szybkie filtrowanie po użytkowniku
  - `authors(name/title idx)` - efektywne wyszukiwanie po nazwie
- **Optymalizacja**: Zapytanie powinno wykorzystywać oba indeksy dla maksymalnej wydajności

### Zapytanie SQL
- JOIN między `user_authors` i `authors` jest wydajny dzięki indeksom
- Filtrowanie po `user_id` jest pierwszym filtrem (najbardziej selektywny)
- Wyszukiwanie po `name` używa ILIKE z indeksem (jeśli dostępny)
- Paginacja ogranicza liczbę zwracanych wierszy

### Potencjalne wąskie gardła
1. **Duża liczba autorów użytkownika**
   - **Rozwiązanie**: Paginacja ogranicza wyniki do rozsądnej liczby (np. 20-50 na stronę)
   - COUNT może być kosztowny dla dużych zbiorów - rozważyć przybliżone zliczanie

2. **Wyszukiwanie po nazwie (ILIKE)**
   - **Problem**: ILIKE może być wolne bez odpowiedniego indeksu
   - **Rozwiązanie**: Upewnić się, że istnieje indeks na `authors.name` (może być GIN dla full-text search)

3. **Brak cache'owania**
   - **Uwaga**: Endpoint nie cache'uje wyników (dane są dynamiczne per użytkownik)
   - Cache na poziomie aplikacji nie jest zalecany ze względu na personalizację

### Rekomendacje optymalizacji
- Użyć `LIMIT` i `OFFSET` dla paginacji (lub cursor-based pagination dla bardzo dużych zbiorów)
- Rozważyć materialized view dla często używanych zapytań (jeśli potrzeba)
- Monitorować czas wykonania zapytań w produkcji
- Rozważyć dodanie indeksu GIN na `authors.name` dla lepszej wydajności wyszukiwania

## 9. Etapy wdrożenia

### Krok 1: Utworzenie schematu walidacji
- Utworzyć plik `src/lib/validation/user-authors-list.schema.ts`
- Zdefiniować `UserAuthorsListQuerySchema` używając Zod
- Zaimplementować preprocess dla `page` (konwersja string → number)
- Dodać walidację dla `search` (trim, max length 200)
- Dodać enum dla `sort` z wartościami `"name_asc" | "created_desc"`
- Wyeksportować typ `UserAuthorsListQueryValidated` z inferencji Zod

### Krok 2: Rozszerzenie AuthorsService
- Otworzyć `src/lib/services/authors.service.ts`
- Dodać nową metodę `findUserAuthors(userId: string, page: number, search?: string, sort?: "name_asc" | "created_desc"): Promise<{ items: UserAuthorDto[], total: number }>`
- Zaimplementować zapytanie Supabase:
  - JOIN `user_authors` z `authors` na `author_id`
  - Filtrowanie po `user_authors.user_id = userId`
  - Opcjonalne filtrowanie po `authors.name ILIKE %search%` jeśli `search` jest podane
  - Sortowanie: `authors.name ASC` dla `name_asc`, `user_authors.created_at DESC` dla `created_desc`
  - Paginacja: LIMIT 20 (lub inna rozsądna wartość), OFFSET obliczony z `page`
  - COUNT dla całkowitej liczby wyników
- Mapowanie wyników do `UserAuthorDto[]` (łącznie z `created_at` z `user_authors`)
- Obsługa błędów z odpowiednimi komunikatami

### Krok 3: Utworzenie endpointu API
- Utworzyć plik `src/pages/api/user/authors/index.ts`
- Dodać `export const prerender = false`
- Zaimplementować handler `GET: APIRoute`
- W handlerze:
  - Ekstraktować parametry zapytania z URL
  - Walidować parametry używając `UserAuthorsListQuerySchema`
  - Zwrócić 400 jeśli walidacja nie powiedzie się
  - Pobrać `user_id` z Supabase client (z tokena/sesji)
  - Zwrócić 401 jeśli użytkownik nie jest zalogowany
  - Wywołać `authorsService.findUserAuthors()` z walidowanymi parametrami
  - Obsłużyć błędy z serwisu (500 dla błędów bazy danych)
  - Zbudować `UserAuthorsListResponseDto` z wynikami
  - Zwrócić odpowiedź 200 z JSON

### Krok 4: Obsługa błędów i logowanie
- Dodać logowanie błędów walidacji (logger.warn)
- Dodać logowanie błędów bazy danych (logger.error)
- Dodać globalny try-catch dla nieoczekiwanych błędów
- Upewnić się, że komunikaty błędów są przyjazne dla użytkownika

### Krok 5: Testowanie
Przygotować testy manualne według poniższych punktów. Opisać w pliku .ai/api/api-user-authors-get-manual-tests.md i przeprowadzić (zapytać o zgodę)

- Przetestować endpoint z różnymi kombinacjami parametrów:
  - Bez parametrów (domyślne wartości)
  - Z parametrem `page`
  - Z parametrem `search`
  - Z parametrem `sort`
  - Z wszystkimi parametrami jednocześnie
- Przetestować walidację:
  - Nieprawidłowe wartości `page` (< 1, nie liczba)
  - Nieprawidłowe wartości `sort`
  - Zbyt długi `search` (> 200 znaków)
- Przetestować autoryzację:
  - Request bez tokena (401)
  - Request z nieprawidłowym tokenem (401)
  - Request z prawidłowym tokenem (200)
- Przetestować edge cases:
  - Użytkownik bez przypisanych autorów (pusta lista)
  - Wyszukiwanie bez wyników (pusta lista)
  - Duża liczba autorów (paginacja)

### Krok 6: Dokumentacja i cleanup
- Sprawdzić, czy kod jest zgodny z linterem
- Upewnić się, że wszystkie typy są poprawnie zaimportowane
- Zweryfikować zgodność z zasadami projektu (early returns, guard clauses)
- Dodać komentarze JSDoc do metody serwisu (jeśli potrzebne)
