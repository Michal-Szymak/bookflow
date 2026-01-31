# API Endpoint Implementation Plan: GET /api/authors/{authorId}

## 1. Przegląd punktu końcowego

Endpoint **GET** `/api/authors/{authorId}` służy do pobierania metadanych autora z katalogu globalnego. Endpoint zwraca pełne informacje o autorze (zarówno z katalogu globalnego OpenLibrary, jak i autorów manualnych), o ile są one widoczne dla użytkownika zgodnie z zasadami RLS (Row Level Security) w Supabase.

**Kluczowe cechy:**
- Endpoint jest publiczny (nie wymaga autoryzacji) - dostęp do danych kontrolowany przez RLS
- Zwraca metadane autora z katalogu globalnego lub manualnego
- Automatycznie obsługuje widoczność przez RLS - jeśli autor nie jest widoczny, zwraca 404
- Waliduje format UUID parametru `authorId`
- Zwraca dane w formacie `AuthorResponseDto`

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
/api/authors/{authorId}
```

### Parametry ścieżki
- **authorId** (wymagany): UUID autora w formacie standardowym (np. `550e8400-e29b-41d4-a716-446655440000`)
  - Typ: `string` (UUID)
  - Walidacja: musi być poprawnym formatem UUID v4
  - Przykład: `/api/authors/550e8400-e29b-41d4-a716-446655440000`

### Query Parameters
Brak

### Request Body
Brak (metoda GET)

### Headers
- `Authorization: Bearer <token>` (opcjonalny) - token sesji Supabase dla kontekstu RLS
- `Content-Type: application/json` (nie wymagany dla GET)

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

1. **AuthorResponseDto** (z `src/types.ts`)
   ```typescript
   export interface AuthorResponseDto {
     author: AuthorDto;
   }
   ```
   - Używany jako format odpowiedzi endpointu
   - Zawiera pojedynczy obiekt `AuthorDto`

2. **AuthorDto** (z `src/types.ts`)
   ```typescript
   export type AuthorDto = AuthorRow;
   ```
   - Bezpośrednie mapowanie z typu bazy danych `AuthorRow`
   - Zawiera wszystkie pola z tabeli `authors`:
     - `id`: UUID
     - `name`: string
     - `openlibrary_id`: string | null
     - `manual`: boolean
     - `owner_user_id`: UUID | null
     - `ol_fetched_at`: timestamptz | null
     - `ol_expires_at`: timestamptz | null
     - `created_at`: timestamptz
     - `updated_at`: timestamptz

### Command Models
Brak (endpoint GET nie przyjmuje danych wejściowych w body)

### Schematy walidacji

1. **AuthorIdParamSchema** (nowy, do utworzenia w `src/lib/validation/author-id.schema.ts`)
   ```typescript
   import { z } from "zod";
   
   export const AuthorIdParamSchema = z.object({
     authorId: z.string().uuid("authorId must be a valid UUID"),
   });
   ```
   - Waliduje format UUID parametru ścieżki
   - Używa wbudowanej walidacji UUID z Zod

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)
Zwraca metadane autora w formacie `AuthorResponseDto`:

```json
{
  "author": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "J.K. Rowling",
    "openlibrary_id": "OL23919A",
    "manual": false,
    "owner_user_id": null,
    "ol_fetched_at": "2024-01-15T10:30:00Z",
    "ol_expires_at": "2024-01-22T10:30:00Z",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**Nagłówki odpowiedzi:**
- `Content-Type: application/json`
- `Status: 200`

### Błędy

#### 400 Bad Request
**Przyczyna:** Nieprawidłowy format UUID parametru `authorId`

```json
{
  "error": "Validation error",
  "message": "authorId must be a valid UUID",
  "details": [
    {
      "path": ["authorId"],
      "message": "authorId must be a valid UUID"
    }
  ]
}
```

#### 404 Not Found
**Przyczyna:** Autor nie istnieje w bazie danych lub nie jest widoczny dla użytkownika zgodnie z zasadami RLS

```json
{
  "error": "Not found",
  "message": "Author not found or not accessible"
}
```

**Uwaga:** RLS automatycznie filtruje wyniki - jeśli autor istnieje, ale użytkownik nie ma do niego dostępu, zapytanie zwróci `null` zamiast danych, co zostanie zinterpretowane jako 404.

#### 500 Internal Server Error
**Przyczyna:** Błąd bazy danych lub inny nieoczekiwany błąd serwera

```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## 5. Przepływ danych

### Krok 1: Ekstrakcja i walidacja parametrów
1. Pobierz parametr `authorId` z `params.authorId` (z kontekstu Astro)
2. Waliduj format UUID używając `AuthorIdParamSchema`
3. Jeśli walidacja nie powiedzie się, zwróć 400 Bad Request

### Krok 2: Inicjalizacja serwisów
1. Pobierz instancję Supabase z `locals.supabase`
2. Utwórz instancję `AuthorsService` z klientem Supabase

### Krok 3: Pobranie autora z bazy danych
1. Wywołaj metodę `findById(authorId)` na `AuthorsService`
2. Metoda wykonuje zapytanie do tabeli `authors` z filtrem `id = authorId`
3. RLS automatycznie filtruje wyniki zgodnie z zasadami:
   - Globalne autorzy (`owner_user_id is null`) - widoczne dla wszystkich
   - Manualne autorzy (`owner_user_id = auth.uid()`) - widoczne tylko dla właściciela
4. Jeśli zapytanie zwróci `null` (autor nie istnieje lub nie jest widoczny), zwróć 404

### Krok 4: Przygotowanie odpowiedzi
1. Zweryfikuj, że dane autora zostały pobrane (nie są `null`)
2. Utwórz obiekt odpowiedzi typu `AuthorResponseDto`
3. Zwróć odpowiedź z kodem 200 OK

### Diagram przepływu
```
Request → Extract authorId → Validate UUID → Initialize Services
                                                      ↓
Response ← Format Response ← Fetch Author ← Query Database (with RLS)
```

## 6. Względy bezpieczeństwa

### Autoryzacja i uwierzytelnianie
- **Endpoint jest publiczny** - nie wymaga jawnej autoryzacji
- Bezpieczeństwo zapewniane przez **Row Level Security (RLS)** w Supabase
- RLS automatycznie filtruje wyniki zgodnie z zasadami:
  - Globalne autorzy (`owner_user_id is null`) - dostępne dla wszystkich użytkowników
  - Manualne autorzy (`owner_user_id = auth.uid()`) - dostępne tylko dla właściciela
- Jeśli użytkownik nie jest zalogowany, RLS pozwoli na dostęp tylko do autorów globalnych

### Walidacja danych wejściowych
- **Walidacja UUID**: Parametr `authorId` jest walidowany jako poprawny format UUID v4
- **Ochrona przed SQL Injection**: Supabase używa parametryzowanych zapytań, co eliminuje ryzyko SQL injection
- **Ochrona przed NoSQL Injection**: Nie dotyczy (używamy PostgreSQL)

### Kontrola dostępu (RLS)
Zasady RLS dla tabeli `authors`:
- **SELECT policy**: `owner_user_id is null OR owner_user_id = auth.uid()`
  - Umożliwia odczyt autorów globalnych wszystkim użytkownikom
  - Umożliwia odczyt autorów manualnych tylko właścicielowi
- Endpoint nie wymaga dodatkowej logiki autoryzacji - RLS obsługuje to automatycznie

### Bezpieczeństwo odpowiedzi
- Endpoint nie zwraca wrażliwych danych (hasła, tokeny, etc.)
- Zwracane są tylko publiczne metadane autora zgodnie z zasadami RLS
- Brak narażenia na wyciek danych - jeśli autor nie jest widoczny, zwracany jest 404

### Rate Limiting
- Endpoint GET nie wymaga rate limitingu (tylko odczyt)
- Ewentualne ograniczenia mogą być zastosowane na poziomie infrastruktury (np. przez middleware)

## 7. Obsługa błędów

### Scenariusze błędów i kody statusu

#### 1. Nieprawidłowy format UUID (400 Bad Request)
**Warunek:** Parametr `authorId` nie jest poprawnym formatem UUID

**Obsługa:**
- Walidacja przy użyciu `AuthorIdParamSchema` przed wykonaniem zapytania
- Zwróć 400 z komunikatem walidacji

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

#### 2. Autor nie znaleziony (404 Not Found)
**Warunek:** Autor nie istnieje w bazie danych lub nie jest widoczny przez RLS

**Obsługa:**
- Sprawdź wynik zapytania - jeśli `null`, zwróć 404
- Nie ujawniaj, czy autor istnieje, ale jest niedostępny (bezpieczeństwo)

**Przykład:**
```typescript
if (!author) {
  return new Response(
    JSON.stringify({
      error: "Not found",
      message: "Author not found or not accessible",
    }),
    { status: 404, headers: { "Content-Type": "application/json" } }
  );
}
```

#### 3. Błąd bazy danych (500 Internal Server Error)
**Warunek:** Błąd podczas wykonywania zapytania do bazy danych

**Obsługa:**
- Przechwyć błąd w bloku `try-catch`
- Zaloguj szczegóły błędu (bez wrażliwych danych)
- Zwróć ogólny komunikat błędu dla użytkownika

**Przykład:**
```typescript
catch (error) {
  logger.error("GET /api/authors/{authorId}: Database error", {
    authorId,
    error: error instanceof Error ? error.message : "Unknown error",
  });
  return new Response(
    JSON.stringify({
      error: "Internal server error",
      message: "An unexpected error occurred",
    }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
```

#### 4. Błąd walidacji parametrów (400 Bad Request)
**Warunek:** Brak parametru `authorId` w ścieżce

**Obsługa:**
- Sprawdź, czy `params.authorId` istnieje
- Jeśli nie, zwróć 400 z odpowiednim komunikatem

**Przykład:**
```typescript
if (!params.authorId) {
  return new Response(
    JSON.stringify({
      error: "Validation error",
      message: "authorId parameter is required",
    }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}
```

### Logowanie błędów
- Wszystkie błędy powinny być logowane z kontekstem:
  - `authorId` - identyfikator autora
  - `error` - komunikat błędu
  - `timestamp` - czas wystąpienia błędu
- Użyj `logger.error()` dla błędów serwera
- Użyj `logger.warn()` dla błędów walidacji

### Spójność komunikatów błędów
- Wszystkie odpowiedzi błędów mają strukturę:
  ```json
  {
    "error": "Error type",
    "message": "Human-readable message",
    "details": [] // opcjonalnie, dla błędów walidacji
  }
  ```

## 8. Rozważania dotyczące wydajności

### Optymalizacja zapytań
- **Indeks na `id`**: Tabela `authors` ma automatyczny indeks na kolumnie `id` (klucz główny)
- **Efektywne zapytanie**: Użycie `.select()` z jawnym listowaniem kolumn zamiast `*`
- **Single query**: Endpoint wykonuje tylko jedno zapytanie do bazy danych

### Cache
- **Brak cache na poziomie endpointu**: Endpoint zwraca dane bezpośrednio z bazy danych
- **Cache OpenLibrary**: Autorzy z OpenLibrary mają cache w bazie danych (`ol_fetched_at`, `ol_expires_at`), ale to nie wpływa na ten endpoint
- **Cache HTTP**: Można rozważyć dodanie nagłówków cache HTTP dla autorów globalnych (np. `Cache-Control: public, max-age=3600`)

### Potencjalne wąskie gardła
1. **Zapytanie do bazy danych**: 
   - Rozwiązanie: Indeks na `id` zapewnia szybkie wyszukiwanie O(log n)
   - Monitorowanie: Śledź czas wykonania zapytań

2. **RLS Policy Evaluation**:
   - Rozwiązanie: RLS jest zoptymalizowane przez Supabase, ale może dodać niewielkie opóźnienie
   - Monitorowanie: Sprawdź wpływ RLS na wydajność zapytań

### Skalowalność
- Endpoint jest stateless - nie przechowuje stanu między żądaniami
- Może być łatwo skalowany poziomo
- Brak zależności od zewnętrznych serwisów (tylko baza danych)

### Monitoring
- Śledź czas odpowiedzi endpointu
- Monitoruj liczbę błędów 404 vs 200
- Śledź błędy bazy danych (500)

## 9. Etapy wdrożenia

### Krok 1: Utworzenie schematu walidacji
**Plik:** `src/lib/validation/author-id.schema.ts`

1. Utwórz nowy plik z schematem walidacji UUID
2. Zaimplementuj `AuthorIdParamSchema` używając Zod
3. Eksportuj typ `AuthorIdParamValidated` dla TypeScript

**Szczegóły implementacji:**
```typescript
import { z } from "zod";

export const AuthorIdParamSchema = z.object({
  authorId: z.string().uuid("authorId must be a valid UUID"),
});

export type AuthorIdParamValidated = z.infer<typeof AuthorIdParamSchema>;
```

### Krok 2: Rozszerzenie AuthorsService
**Plik:** `src/lib/services/authors.service.ts`

1. Dodaj metodę `findById(authorId: string): Promise<AuthorRow | null>`
2. Metoda powinna:
   - Wykonać zapytanie `.select()` z jawnym listowaniem kolumn
   - Użyć `.eq("id", authorId)`
   - Użyć `.maybeSingle()` dla bezpiecznego zwrócenia `null` jeśli nie znaleziono
   - Obsłużyć błędy bazy danych
3. Zwrócić `AuthorRow | null`

**Szczegóły implementacji:**
```typescript
async findById(authorId: string): Promise<AuthorRow | null> {
  const { data, error } = await this.supabase
    .from("authors")
    .select("id, name, openlibrary_id, manual, owner_user_id, ol_fetched_at, ol_expires_at, created_at, updated_at")
    .eq("id", authorId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch author from database: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    owner_user_id: data.owner_user_id ?? null,
  };
}
```

### Krok 3: Utworzenie endpointu API
**Plik:** `src/pages/api/authors/[authorId].ts`

1. Utwórz nowy plik w katalogu `src/pages/api/authors/` o nazwie `[authorId].ts`
2. Zaimplementuj funkcję `GET: APIRoute`
3. Struktura endpointu:
   - Ekstrakcja `authorId` z `params.authorId`
   - Walidacja UUID przy użyciu `AuthorIdParamSchema`
   - Inicjalizacja serwisów
   - Pobranie autora przez `AuthorsService.findById()`
   - Obsługa błędów (400, 404, 500)
   - Zwrócenie odpowiedzi w formacie `AuthorResponseDto`

**Szczegóły implementacji:**
```typescript
import type { APIRoute } from "astro";
import { AuthorIdParamSchema } from "@/lib/validation/author-id.schema";
import { AuthorsService } from "@/lib/services/authors.service";
import type { AuthorResponseDto } from "@/types";
import { logger } from "@/lib/logger";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // Step 1: Extract and validate path parameter
    if (!params.authorId) {
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: "authorId parameter is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const validation = AuthorIdParamSchema.safeParse({
      authorId: params.authorId,
    });

    if (!validation.success) {
      logger.warn("GET /api/authors/{authorId}: Validation failed", {
        authorId: params.authorId,
        errors: validation.error.errors,
      });
      return new Response(
        JSON.stringify({
          error: "Validation error",
          message: validation.error.errors[0]?.message || "Invalid authorId format",
          details: validation.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { authorId } = validation.data;

    // Step 2: Initialize services
    const supabase = locals.supabase;
    const authorsService = new AuthorsService(supabase);

    // Step 3: Fetch author from database
    let author;
    try {
      author = await authorsService.findById(authorId);
    } catch (error) {
      logger.error("GET /api/authors/{authorId}: Database error", {
        authorId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: "An unexpected error occurred",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 4: Check if author exists and is accessible
    if (!author) {
      return new Response(
        JSON.stringify({
          error: "Not found",
          message: "Author not found or not accessible",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 5: Return response
    const response: AuthorResponseDto = {
      author,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("GET /api/authors/{authorId}: Unexpected error", {
      authorId: params?.authorId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
```

### Krok 4: Testy manualne
**Plik:** `.ai/api/api-authors-get-manual-tests.md`

1. **Test z poprawnym UUID autora globalnego:**
   - Wykonaj GET `/api/authors/{valid-global-author-id}`
   - Oczekiwany wynik: 200 OK z danymi autora

2. **Test z poprawnym UUID autora manualnego (jako właściciel):**
   - Zaloguj się jako właściciel
   - Wykonaj GET `/api/authors/{valid-manual-author-id}`
   - Oczekiwany wynik: 200 OK z danymi autora

3. **Test z poprawnym UUID autora manualnego (jako inny użytkownik):**
   - Zaloguj się jako inny użytkownik
   - Wykonaj GET `/api/authors/{valid-manual-author-id-owned-by-other}`
   - Oczekiwany wynik: 404 Not Found

4. **Test z nieprawidłowym formatem UUID:**
   - Wykonaj GET `/api/authors/invalid-uuid`
   - Oczekiwany wynik: 400 Bad Request

5. **Test z nieistniejącym UUID:**
   - Wykonaj GET `/api/authors/550e8400-e29b-41d4-a716-446655440000` (nieistniejący)
   - Oczekiwany wynik: 404 Not Found

### Krok 5: Code Review i optymalizacja
1. Przegląd kodu pod kątem zgodności z zasadami projektu
2. Sprawdzenie zgodności z wzorcami z innych endpointów
3. Optymalizacja zapytań do bazy danych (jeśli potrzebne)
4. Weryfikacja obsługi błędów i logowania

## 10. Uwagi dodatkowe

### Zgodność z istniejącymi endpointami
- Endpoint powinien być zgodny z wzorcami z innych endpointów API (np. `POST /api/authors`, `GET /api/authors/search`)
- Używa tych samych serwisów (`AuthorsService`) i schematów walidacji (Zod)
- Zgodny z formatem odpowiedzi (`AuthorResponseDto`)

### Zależności
- `zod` - do walidacji UUID
- `@/lib/services/authors.service` - serwis do operacji na autorach
- `@/lib/validation/author-id.schema` - schemat walidacji (nowy)
- `@/types` - typy DTO
- `@/lib/logger` - do logowania błędów

### RLS Policy (wymagana w bazie danych)
Endpoint wymaga, aby w bazie danych były skonfigurowane następujące zasady RLS dla tabeli `authors`:

```sql
-- SELECT policy dla autorów
CREATE POLICY "authors_select_global_or_owner"
ON authors
FOR SELECT
USING (
  owner_user_id IS NULL OR owner_user_id = auth.uid()
);
```

Ta zasada zapewnia, że:
- Autorzy globalni (`owner_user_id IS NULL`) są widoczni dla wszystkich
- Autorzy manualni (`owner_user_id = auth.uid()`) są widoczni tylko dla właściciela
