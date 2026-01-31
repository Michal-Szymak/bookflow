# API Endpoint Implementation Plan: POST /api/authors

## 1. Przegląd punktu końcowego

Endpoint **POST `/api/authors`** umożliwia zalogowanemu użytkownikowi utworzenie ręcznego (manual) autora w katalogu globalnym. Utworzony autor jest przypisany do użytkownika (`owner_user_id`) i podlega limitowi 500 autorów na użytkownika. Endpoint wymaga autoryzacji i waliduje wszystkie ograniczenia bazy danych oraz reguły biznesowe przed utworzeniem rekordu.

**Kluczowe funkcjonalności:**

- Tworzenie ręcznego autora z przypisaniem do aktualnego użytkownika
- Walidacja limitu autorów na użytkownika (≤500)
- Wymuszanie ograniczeń bazy danych (`authors_manual_owner`, `authors_manual_or_ol`)
- Obsługa konfliktów unikalności (409)
- Zwracanie utworzonego autora w odpowiedzi (201)

## 2. Szczegóły żądania

### Metoda HTTP

**POST**

### Struktura URL

```
/api/authors
```

### Wymagana autoryzacja

- Endpoint wymaga zalogowanego użytkownika
- Sesja Supabase musi być aktywna (Authorization header lub cookie)
- Brak autoryzacji zwraca `401 Unauthorized`

### Request Body

```typescript
{
  "name": string,        // Wymagane, niepuste, max 500 znaków
  "manual": true,        // Wymagane, musi być true
  "openlibrary_id": null // Opcjonalne, jeśli podane musi być null
}
```

**Szczegóły pól:**

- `name` (wymagane): Nazwa autora, string niepusty po trimowaniu, maksymalnie 500 znaków
- `manual` (wymagane): Musi być `true` dla ręcznych autorów
- `openlibrary_id` (opcjonalne): Jeśli podane, musi być `null` (dla ręcznych autorów)

**Przykład żądania:**

```json
{
  "name": "John Doe",
  "manual": true
}
```

### Parametry zapytania

Brak

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

**Request DTO:**

- `CreateAuthorCommand` (z `src/types.ts`):
  ```typescript
  type CreateAuthorCommand = Pick<AuthorRow, "name"> & {
    manual: true;
    openlibrary_id?: null;
  };
  ```

**Response DTO:**

- `AuthorResponseDto` (z `src/types.ts`):
  ```typescript
  interface AuthorResponseDto {
    author: AuthorDto; // AuthorRow
  }
  ```

**Entity Types:**

- `AuthorRow` - typ wiersza z tabeli `authors`
- `ProfileRow` - typ wiersza z tabeli `profiles` (dla sprawdzenia limitów)

### Command Model

- `CreateAuthorCommand` - reprezentuje walidowane dane wejściowe

## 4. Szczegóły odpowiedzi

### Sukces (201 Created)

Zwraca utworzony autor w formacie `AuthorResponseDto`.

**Struktura odpowiedzi:**

```json
{
  "author": {
    "id": "uuid",
    "name": "John Doe",
    "openlibrary_id": null,
    "manual": true,
    "owner_user_id": "uuid",
    "ol_fetched_at": null,
    "ol_expires_at": null,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Nagłówki:**

- `Content-Type: application/json`
- `Location: /api/authors/{authorId}` (opcjonalnie)

### Błędy

#### 400 Bad Request

Walidacja danych wejściowych nie powiodła się.

**Przykłady:**

```json
{
  "error": "Validation error",
  "message": "Name is required",
  "details": [
    {
      "path": ["name"],
      "message": "Name is required"
    }
  ]
}
```

**Scenariusze:**

- `name` jest puste lub nieprawidłowe
- `manual` nie jest `true`
- `openlibrary_id` jest podane i nie jest `null`
- Brak wymaganych pól

#### 401 Unauthorized

Użytkownik nie jest zalogowany lub sesja jest nieprawidłowa.

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

#### 403 Forbidden

Próba utworzenia autora z `manual=true` bez przypisania do aktualnego użytkownika (teoretycznie nie powinno wystąpić, ale może być wynikiem naruszenia RLS).

```json
{
  "error": "Forbidden",
  "message": "Cannot create manual author without ownership"
}
```

#### 409 Conflict

Konflikt unikalności lub naruszenie ograniczeń bazy danych.

**Scenariusze:**

- Naruszenie ograniczenia `authors_manual_owner` (próba ustawienia `manual=false` z `owner_user_id`)
- Naruszenie ograniczenia `authors_manual_or_ol` (próba utworzenia autora bez `manual=true` i bez `openlibrary_id`)
- Przekroczenie limitu autorów (author_count >= max_authors)

```json
{
  "error": "Conflict",
  "message": "Author limit reached (500 authors per user)"
}
```

lub

```json
{
  "error": "Conflict",
  "message": "Database constraint violation",
  "details": "authors_manual_owner constraint failed"
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

### Krok 1: Walidacja autoryzacji

1. Pobierz sesję użytkownika z Supabase (`supabase.auth.getUser()`)
2. Jeśli brak sesji → zwróć `401 Unauthorized`
3. Pobierz `user.id` z sesji

### Krok 2: Walidacja danych wejściowych

1. Parsuj i waliduj body żądania używając Zod schema
2. Sprawdź:
   - `name` jest niepustym stringiem (po trimowaniu, max 500 znaków)
   - `manual` jest `true`
   - `openlibrary_id` jest `null` lub nieobecne
3. Jeśli walidacja nie powiodła się → zwróć `400 Bad Request` z szczegółami

### Krok 3: Sprawdzenie limitu użytkownika

1. Pobierz profil użytkownika z tabeli `profiles`:
   ```sql
   SELECT author_count, max_authors
   FROM profiles
   WHERE user_id = $1
   ```
2. Jeśli `author_count >= max_authors` → zwróć `409 Conflict`
3. Jeśli profil nie istnieje → utwórz go (z domyślnymi wartościami) lub zwróć błąd

### Krok 4: Przygotowanie danych do wstawienia

1. Przygotuj obiekt autora:
   ```typescript
   {
     name: validatedData.name.trim(),
     manual: true,
     owner_user_id: userId,
     openlibrary_id: null,
     ol_fetched_at: null,
     ol_expires_at: null
   }
   ```

### Krok 5: Wstawienie do bazy danych

1. Wykonaj INSERT do tabeli `authors`:
   ```sql
   INSERT INTO authors (name, manual, owner_user_id, openlibrary_id)
   VALUES ($1, $2, $3, $4)
   RETURNING *
   ```
2. Obsłuż możliwe błędy:
   - **Constraint violation** → zwróć `409 Conflict` z odpowiednim komunikatem
   - **RLS policy violation** → zwróć `403 Forbidden`
   - **Inne błędy DB** → zaloguj i zwróć `500 Internal Server Error`

### Krok 6: Zwrócenie odpowiedzi

1. Zwróć utworzony autor w formacie `AuthorResponseDto`
2. Status: `201 Created`
3. Content-Type: `application/json`

### Diagram przepływu

```
Request → Auth Check → Validation → Limit Check → DB Insert → Response
   ↓           ↓            ↓            ↓            ↓          ↓
  401        400         409/400       409         201/409/500
```

## 6. Względy bezpieczeństwa

### Autoryzacja

- **Wymagana**: Endpoint wymaga aktywnej sesji Supabase
- **Implementacja**: Użyj `supabase.auth.getUser()` w middleware lub w route handlerze
- **RLS**: Row Level Security w Supabase zapewnia, że użytkownik może tworzyć tylko autorów z `owner_user_id = auth.uid()`

### Walidacja danych wejściowych

- **Sanityzacja**: Trimowanie `name` przed zapisem
- **Długość**: Maksymalna długość `name` to 500 znaków (zgodnie z typem bazy danych)
- **Typy**: Walidacja typu dla wszystkich pól (Zod schema)
- **Ograniczenia biznesowe**: Wymuszanie `manual=true` i `openlibrary_id=null` dla ręcznych autorów

### Ochrona przed nadużyciami

- **Limity użytkownika**: Sprawdzenie `author_count < max_authors` przed wstawieniem
- **RLS Policies**: Baza danych automatycznie wymusza, że `owner_user_id = auth.uid()` dla manual authors
- **Database Constraints**: Ograniczenia `authors_manual_owner` i `authors_manual_or_ol` zapewniają spójność danych

### Bezpieczeństwo bazy danych

- **SQL Injection**: Użycie Supabase client (parametryzowane zapytania)
- **RLS**: Wszystkie operacje są filtrowane przez Row Level Security
- **Cascade Deletes**: Usunięcie użytkownika automatycznie usuwa jego autorów (ON DELETE CASCADE)

### Logowanie

- Loguj wszystkie błędy walidacji i bazy danych
- Nie loguj wrażliwych danych (np. pełnych obiektów użytkownika)
- Używaj strukturalnego logowania dla łatwiejszej analizy

## 7. Obsługa błędów

### Kategorie błędów

#### Błędy walidacji (400)

- **Przyczyna**: Nieprawidłowe dane wejściowe
- **Obsługa**: Zwróć szczegółowe komunikaty z Zod validation errors
- **Przykład**: Puste `name`, `manual !== true`, `openlibrary_id !== null`

#### Błędy autoryzacji (401)

- **Przyczyna**: Brak sesji lub nieprawidłowy token
- **Obsługa**: Zwróć ogólny komunikat (nie ujawniaj szczegółów bezpieczeństwa)
- **Implementacja**: Sprawdź `supabase.auth.getUser()` na początku handlera

#### Błędy autoryzacji (403)

- **Przyczyna**: Naruszenie RLS policy (próba utworzenia autora bez ownership)
- **Obsługa**: Zwróć komunikat o braku uprawnień
- **Uwaga**: Teoretycznie nie powinno wystąpić, jeśli `owner_user_id` jest ustawione poprawnie

#### Błędy konfliktów (409)

- **Przyczyna 1**: Przekroczenie limitu autorów
  - Sprawdzenie: `author_count >= max_authors`
  - Komunikat: "Author limit reached (500 authors per user)"
- **Przyczyna 2**: Naruszenie constraint `authors_manual_owner`
  - Sprawdzenie: Database constraint violation
  - Komunikat: "Database constraint violation: authors_manual_owner"
- **Przyczyna 3**: Naruszenie constraint `authors_manual_or_ol`
  - Sprawdzenie: Database constraint violation
  - Komunikat: "Database constraint violation: authors_manual_or_ol"

#### Błędy serwera (500)

- **Przyczyna**: Nieoczekiwane błędy bazy danych lub aplikacji
- **Obsługa**:
  - Zaloguj pełny błąd (dla debugowania)
  - Zwróć ogólny komunikat użytkownikowi
  - Nie ujawniaj szczegółów implementacji

### Strategia obsługi błędów

1. **Early Returns**: Używaj guard clauses na początku funkcji
2. **Try-Catch**: Owinij operacje bazy danych w try-catch
3. **Error Mapping**: Mapuj błędy bazy danych na odpowiednie kody HTTP
4. **Structured Logging**: Loguj błędy ze strukturą (error, context, userId)
5. **User-Friendly Messages**: Zwracaj zrozumiałe komunikaty dla użytkownika

### Przykładowa obsługa błędów

```typescript
try {
  // Operacja bazy danych
} catch (error) {
  if (error.code === "23505") {
    // Unique violation
    return new Response(/* 409 */);
  }
  if (error.code === "23514") {
    // Check constraint violation
    return new Response(/* 409 */);
  }
  if (error.code === "42501") {
    // Insufficient privilege (RLS)
    return new Response(/* 403 */);
  }
  console.error("Unexpected error:", error);
  return new Response(/* 500 */);
}
```

## 8. Rozważania dotyczące wydajności

### Optymalizacje zapytań

1. **Sprawdzenie limitu**:
   - Użyj pojedynczego zapytania do `profiles` z SELECT tylko potrzebnych kolumn
   - Rozważ cache profilu użytkownika (jeśli często używane)
   - Indeks na `profiles(user_id)` jest kluczowy (PK)

2. **Wstawienie autora**:
   - INSERT z RETURNING jest wydajny (jeden round-trip)
   - Brak potrzeby dodatkowych zapytań po wstawieniu

### Potencjalne wąskie gardła

1. **Sprawdzenie limitu**:
   - Jeśli profil nie istnieje, może wymagać INSERT (rzadko)
   - Rozwiązanie: Upewnij się, że profil jest tworzony podczas rejestracji

2. **RLS Policy Evaluation**:
   - Supabase automatycznie ocenia RLS policies
   - Wpływ: Minimalny, ale warto monitorować

3. **Database Constraints**:
   - Sprawdzanie constraint `authors_manual_owner` i `authors_manual_or_ol`
   - Wpływ: Minimalny (indeksy są automatycznie używane)

### Strategie optymalizacji

1. **Batch Operations**: Nie dotyczy (pojedynczy autor)
2. **Connection Pooling**: Supabase client zarządza pulą połączeń

## 9. Etapy wdrożenia

### Krok 1: Utworzenie schematu walidacji Zod

**Plik**: `src/lib/validation/create-author.schema.ts`

1. Utwórz schemat Zod dla `CreateAuthorCommand`:
   - `name`: string, min 1, max 500, trim
   - `manual`: literal `true`
   - `openlibrary_id`: optional, nullable, must be null if provided
2. Eksportuj typ `CreateAuthorCommandValidated` z `z.infer`
3. Dodaj odpowiednie komunikaty błędów

**Kryteria akceptacji:**

- Schema waliduje wszystkie wymagane pola
- Komunikaty błędów są czytelne
- Typ jest zgodny z `CreateAuthorCommand` z `src/types.ts`

### Krok 2: Rozszerzenie AuthorsService

**Plik**: `src/lib/services/authors.service.ts`

1. Dodaj metodę `createManualAuthor(userId: string, name: string): Promise<AuthorRow>`
   - Przygotowuje dane autora
   - Wykonuje INSERT z RETURNING
   - Obsługuje błędy constraint violations
   - Rzuca odpowiednie wyjątki

2. Dodaj metodę `checkUserAuthorLimit(userId: string): Promise<{ authorCount: number; maxAuthors: number }>`
   - Pobiera profil użytkownika
   - Zwraca `author_count` i `max_authors`
   - Obsługuje przypadek braku profilu (opcjonalnie tworzy)

**Kryteria akceptacji:**

- Metody używają Supabase client z kontekstu
- Obsługa błędów jest kompletna
- Metody są testowalne (dependency injection)

### Krok 3: Utworzenie endpointu API

**Plik**: `src/pages/api/authors/index.ts`

1. Utwórz handler `POST`:
   - Eksportuj `export const prerender = false`
   - Pobierz sesję użytkownika (`supabase.auth.getUser()`)
   - Jeśli brak sesji → zwróć 401
   - Parsuj i waliduj body (Zod schema)
   - Sprawdź limit użytkownika (AuthorsService)
   - Utwórz autora (AuthorsService)
   - Zwróć 201 z utworzonym autorem

2. Obsługa błędów:
   - 400: Błędy walidacji Zod
   - 401: Brak autoryzacji
   - 403: RLS violation (opcjonalnie)
   - 409: Limit przekroczony lub constraint violation
   - 500: Nieoczekiwane błędy

**Kryteria akceptacji:**

- Wszystkie scenariusze błędów są obsłużone
- Odpowiedzi mają poprawne kody HTTP
- Logowanie błędów jest strukturalne
- Kod jest czytelny i zgodny z zasadami projektu

### Krok 4: Testy manualne

**Plik**: `.ai/api/api-authors-post-manual-tests.md` (opcjonalnie)

1. Przygotuj scenariusze testowe:
   - Pomyślne utworzenie autora
   - Walidacja: puste name
   - Walidacja: manual !== true
   - Limit przekroczony (409)
   - Brak autoryzacji (401)

2. Wykonaj testy używając curl/Postman/Thunder Client

**Kryteria akceptacji:**

- Wszystkie scenariusze są przetestowane
- Odpowiedzi są zgodne ze specyfikacją
- Błędy są obsłużone poprawnie

### Krok 5: Code Review i Refaktoryzacja

1. Przejrzyj kod pod kątem:
   - Zgodności z zasadami projektu
   - Czytelności i maintainability
   - Obsługi błędów
   - Wydajności

2. Wprowadź poprawki na podstawie feedbacku

**Kryteria akceptacji:**

- Kod jest zgodny z zasadami projektu
- Wszystkie linter errors są naprawione
- Code review jest pozytywne

## 10. Uwagi dodatkowe

### Zależności

- `zod` - walidacja danych wejściowych
- `@supabase/supabase-js` - klient Supabase
- `src/types.ts` - typy DTO i Command Models
- `src/lib/services/authors.service.ts` - logika biznesowa

### Ograniczenia

- Limit 500 autorów na użytkownika jest sztywny (można zmienić w `profiles.max_authors`)
- Ręczni autorzy nie mogą mieć `openlibrary_id` (zgodnie z constraint)
- Usunięcie użytkownika usuwa wszystkie jego autorów (CASCADE)

### Przyszłe rozszerzenia

- Rate limiting (10 autorów/min) - obecnie nie wymagane dla tego endpointu
- Bulk creation - możliwość utworzenia wielu autorów jednocześnie
- Weryfikacja duplikatów nazw (opcjonalnie)

### Zgodność z zasadami projektu

- ✅ Używa Supabase z `context.locals`
- ✅ Używa Zod do walidacji
- ✅ Ekstrakcja logiki do service layer
- ✅ Obsługa błędów na początku funkcji (early returns)
- ✅ Używa prawidłowych kodów HTTP
- ✅ TypeScript z pełnym typowaniem
- ✅ Zgodność z strukturą projektu
