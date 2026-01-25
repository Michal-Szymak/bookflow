# API Endpoint Implementation Plan: GET /api/authors/search

## 1. Przegląd punktu końcowego

Endpoint umożliwia wyszukiwanie autorów w katalogu OpenLibrary z inteligentnym mechanizmem cache'owania wyników przez 7 dni. Endpoint zwraca listę autorów z bazy danych (jeśli są już cache'owani) lub pobiera świeże dane z OpenLibrary API. Jest to endpoint publiczny, nie wymaga uwierzytelnienia, i służy do eksploracji autorów przed ich dodaniem do systemu.

**Główne cechy:**
- Przeszukiwanie OpenLibrary API po nazwisku autora
- 7-dniowy cache na poziomie pojedynczego autora
- Mieszane wyniki (część z cache, część świeża z OL)
- Zwraca opcjonalne `id` z bazy danych jeśli autor jest już w systemie

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
/api/authors/search?q={searchQuery}&limit={maxResults}
```

### Parametry Query

#### Wymagane:
- **q** (string)
  - Zapytanie wyszukiwania (nazwisko autora)
  - Minimalna długość: 1 znak
  - Maksymalna długość: 200 znaków
  - Przykład: `q=Stephen King`

#### Opcjonalne:
- **limit** (number)
  - Maksymalna liczba wyników do zwrócenia
  - Wartość domyślna: 10
  - Zakres: 1-50
  - Przykład: `limit=20`

### Request Body
Brak (GET request)

### Przykładowe żądanie
```
GET /api/authors/search?q=tolkien&limit=5
```

## 3. Wykorzystywane typy

### DTOs (src/types.ts)

**AuthorSearchQueryDto** - Walidacja parametrów query
```typescript
export interface AuthorSearchQueryDto {
  q: string;
  limit?: number;
}
```

**AuthorSearchResultDto** - Pojedynczy wynik wyszukiwania
```typescript
export interface AuthorSearchResultDto {
  id?: AuthorRow["id"];                                    // UUID z DB jeśli cache'owany
  openlibrary_id: NonNullable<AuthorRow["openlibrary_id"]>; // OL ID (np. "OL23919A")
  name: AuthorRow["name"];                                  // Nazwisko autora
  ol_fetched_at: AuthorRow["ol_fetched_at"];               // Kiedy pobrano z OL
  ol_expires_at: AuthorRow["ol_expires_at"];               // Kiedy cache wygasa
}
```

**AuthorSearchResponseDto** - Odpowiedź endpoint
```typescript
export interface AuthorSearchResponseDto {
  authors: AuthorSearchResultDto[];
}
```

### Database Types

**AuthorRow** (z database.types.ts) - pola wykorzystywane w cache:
- `id` (uuid)
- `name` (text)
- `openlibrary_id` (text)
- `ol_fetched_at` (timestamptz)
- `ol_expires_at` (timestamptz)

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

```typescript
{
  "authors": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",  // opcjonalne, jeśli w DB
      "openlibrary_id": "OL23919A",
      "name": "J.R.R. Tolkien",
      "ol_fetched_at": "2026-01-18T10:00:00Z",
      "ol_expires_at": "2026-01-25T10:00:00Z"
    },
    {
      "openlibrary_id": "OL34184A",                   // brak id - nie w DB
      "name": "Christopher Tolkien",
      "ol_fetched_at": "2026-01-18T10:00:00Z",
      "ol_expires_at": "2026-01-25T10:00:00Z"
    }
  ]
}
```

### Błąd walidacji (400 Bad Request)

```typescript
{
  "error": "Validation error",
  "message": "Query parameter 'q' is required and must be between 1-200 characters",
  "details": { /* szczegóły walidacji Zod */ }
}
```

### Błąd OpenLibrary API (502 Bad Gateway)

```typescript
{
  "error": "External service error",
  "message": "Could not connect to OpenLibrary. Please try again later."
}
```

### Błąd serwera (500 Internal Server Error)

```typescript
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## 5. Przepływ danych

### Diagram przepływu

```
1. Request → Endpoint Handler
   ↓
2. Validate query params (Zod)
   ↓
3. AuthorsService.searchCachedAuthors(openlibrary_ids)
   ↓
4. OpenLibraryService.searchAuthors(query, limit)
   ↓
5. Check cache expiry for each OL result
   ↓
6. For expired/missing: fetch fresh data from OL
   ↓
7. Merge DB data (id) with OL data
   ↓
8. Update cache in DB (upsert)
   ↓
9. Return AuthorSearchResponseDto
```

### Szczegółowy przepływ

#### Krok 1: Walidacja parametrów
```typescript
// Endpoint: src/pages/api/authors/search.ts
const queryParams = new URL(request.url).searchParams;
const validation = AuthorSearchQuerySchema.safeParse({
  q: queryParams.get('q'),
  limit: queryParams.get('limit') ? Number(queryParams.get('limit')) : 10
});
```

#### Krok 2: Wywołanie OpenLibrary API
```typescript
// Service: src/lib/services/openlibrary.service.ts
const olResults = await openLibraryService.searchAuthors(
  validatedQuery.q,
  validatedQuery.limit
);
// Zwraca: { openlibrary_id, name }[]
```

#### Krok 3: Sprawdzenie cache w bazie danych
```typescript
// Service: src/lib/services/authors.service.ts
const cachedAuthors = await authorsService.findByOpenLibraryIds(
  olResults.map(r => r.openlibrary_id)
);
// Zwraca: Map<openlibrary_id, AuthorRow>
```

#### Krok 4: Merge i weryfikacja cache
```typescript
const now = new Date();
const results = olResults.map(olAuthor => {
  const cached = cachedAuthors.get(olAuthor.openlibrary_id);
  
  if (cached && cached.ol_expires_at && new Date(cached.ol_expires_at) > now) {
    // Cache valid - use DB data
    return {
      id: cached.id,
      openlibrary_id: cached.openlibrary_id,
      name: cached.name,
      ol_fetched_at: cached.ol_fetched_at,
      ol_expires_at: cached.ol_expires_at
    };
  }
  
  // Cache expired or missing - prepare new data
  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
  
  return {
    id: cached?.id, // Include existing id if found
    openlibrary_id: olAuthor.openlibrary_id,
    name: olAuthor.name,
    ol_fetched_at: fetchedAt.toISOString(),
    ol_expires_at: expiresAt.toISOString()
  };
});
```

#### Krok 5: Aktualizacja cache (background)
```typescript
// Asynchronously update cache for expired entries
// Use upsert to handle existing records
await authorsService.upsertAuthorsCache(resultsToCache);
```

### Interakcja z zewnętrznymi serwisami

**OpenLibrary Search API:**
- Endpoint: `https://openlibrary.org/search/authors.json`
- Query params: `q={query}&limit={limit}`
- Response format: JSON z listą autorów
- Timeout: 10 sekund
- Rate limit: Brak oficjalnego limitu, ale należy być ostrożnym

**Supabase (PostgreSQL):**
- Tabela: `authors`
- Operacje: SELECT (lookup), UPSERT (cache update)
- Index na: `openlibrary_id` dla szybkiego wyszukiwania

## 6. Względy bezpieczeństwa

### Uwierzytelnienie i autoryzacja
- **Endpoint publiczny** - brak wymaganej autentykacji
- Użytkownicy mogą wyszukiwać autorów bez logowania
- Nie ujawnia danych użytkowników, tylko publiczne dane OL

### Walidacja danych wejściowych

#### Zod Schema
```typescript
// src/lib/validation/author-search.schema.ts
import { z } from 'zod';

export const AuthorSearchQuerySchema = z.object({
  q: z.string()
    .min(1, 'Search query is required')
    .max(200, 'Search query too long')
    .trim()
    .refine(
      (val) => val.length > 0,
      'Search query cannot be empty after trimming'
    ),
  limit: z.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(50, 'Limit cannot exceed 50')
    .default(10)
    .optional()
});
```

### Sanityzacja danych
- Trim białych znaków z query
- Walidacja długości zapobiega DoS attacks
- Escapowanie znaków specjalnych przed przekazaniem do OL API
- Walidacja struktury odpowiedzi z OpenLibrary przed przetworzeniem

### Rate Limiting
- Implementacja middleware z limitem:
  - 30 requests/minute per IP dla endpointu search
  - 100 requests/hour per IP
- Można dodać w przyszłości używając Supabase Edge Functions lub zewnętrznego middleware

### Ochrona przed atakami
- **SQL Injection:** Używanie parametryzowanych zapytań Supabase SDK
- **XSS:** Dane z OL są tylko do odczytu, nie są renderowane w HTML bez escapowania
- **DoS:** Limit długości query, timeout na OL API, rate limiting

## 7. Obsługa błędów

### Scenariusze błędów i odpowiedzi

#### 1. Brak wymaganego parametru 'q' (400)
```typescript
// Warunek: q jest null, undefined lub pusty string
return new Response(
  JSON.stringify({
    error: 'Validation error',
    message: "Query parameter 'q' is required"
  }),
  { status: 400, headers: { 'Content-Type': 'application/json' } }
);
```

#### 2. Nieprawidłowa wartość limit (400)
```typescript
// Warunek: limit < 1 lub limit > 50 lub nie jest liczbą
return new Response(
  JSON.stringify({
    error: 'Validation error',
    message: 'Parameter limit must be between 1 and 50'
  }),
  { status: 400, headers: { 'Content-Type': 'application/json' } }
);
```

#### 3. Query zbyt długie (400)
```typescript
// Warunek: q.length > 200
return new Response(
  JSON.stringify({
    error: 'Validation error',
    message: 'Search query cannot exceed 200 characters'
  }),
  { status: 400, headers: { 'Content-Type': 'application/json' } }
);
```

#### 4. OpenLibrary API niedostępne (502)
```typescript
// Warunek: fetch do OL timeout lub network error
console.error('OpenLibrary API error:', error);

return new Response(
  JSON.stringify({
    error: 'External service error',
    message: 'Could not connect to OpenLibrary. Please try again later.'
  }),
  { status: 502, headers: { 'Content-Type': 'application/json' } }
);
```

#### 5. OpenLibrary zwraca błąd (502)
```typescript
// Warunek: OL response status !== 200
console.error('OpenLibrary API returned error:', response.status);

return new Response(
  JSON.stringify({
    error: 'External service error',
    message: 'OpenLibrary service is temporarily unavailable.'
  }),
  { status: 502, headers: { 'Content-Type': 'application/json' } }
);
```

#### 6. Błąd bazy danych (500)
```typescript
// Warunek: Supabase query error
console.error('Database error during cache lookup:', error);

return new Response(
  JSON.stringify({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  }),
  { status: 500, headers: { 'Content-Type': 'application/json' } }
);
```

#### 7. Nieprzewidziany błąd (500)
```typescript
// Warunek: Catch-all dla innych błędów
console.error('Unexpected error in /api/authors/search:', error);

return new Response(
  JSON.stringify({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  }),
  { status: 500, headers: { 'Content-Type': 'application/json' } }
);
```

### Strategia logowania

```typescript
// Struktura logów dla debugging
interface SearchErrorLog {
  endpoint: '/api/authors/search';
  timestamp: string;
  query: string;
  limit: number;
  error: {
    type: 'validation' | 'openlibrary' | 'database' | 'unknown';
    message: string;
    stack?: string;
  };
  requestId?: string;
}
```

### Graceful Degradation

W przypadku błędów cache DB (ale OL działa):
- Zwróć wyniki z OpenLibrary bez pola `id`
- Zaloguj błąd cache, ale nie przerywaj operacji
- Client może nadal używać `openlibrary_id` do importu

```typescript
try {
  cachedAuthors = await authorsService.findByOpenLibraryIds(ids);
} catch (dbError) {
  console.error('Cache lookup failed, proceeding without cache:', dbError);
  cachedAuthors = new Map(); // Empty map, all results will be fresh
}
```

## 8. Rozważania dotyczące wydajności

### Potencjalne wąskie gardła

#### 1. OpenLibrary API Latency
- **Problem:** Zewnętrzne API może mieć opóźnienia 500ms-2s
- **Mitigation:**
  - Timeout 10s dla OL requests
  - Cache wyników przez 7 dni redukuje liczbę wywołań OL
  - Rozważyć implementację background refresh przed wygaśnięciem cache

#### 2. Database Cache Lookups
- **Problem:** Lookup wielu openlibrary_id może być wolny
- **Mitigation:**
  - Index na `authors.openlibrary_id` (już unique constraint)
  - Użyj `WHERE openlibrary_id = ANY($1)` dla batch lookup
  - Limit 50 wyników zapobiega zbyt dużym queries

#### 3. N+1 Problem przy update cache
- **Problem:** Update każdego autora osobno
- **Mitigation:**
  - Użyj bulk upsert (INSERT ... ON CONFLICT)
  - Background update (nie blokuj response)

### Strategie optymalizacji

#### 1. Database Query Optimization

**Batch Lookup:**
```sql
SELECT id, name, openlibrary_id, ol_fetched_at, ol_expires_at
FROM authors
WHERE openlibrary_id = ANY($1::text[])
  AND openlibrary_id IS NOT NULL;
```

**Bulk Upsert:**
```sql
INSERT INTO authors (openlibrary_id, name, ol_fetched_at, ol_expires_at, manual)
VALUES 
  ($1, $2, $3, $4, false),
  ($5, $6, $7, $8, false)
ON CONFLICT (openlibrary_id) 
WHERE openlibrary_id IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  ol_fetched_at = EXCLUDED.ol_fetched_at,
  ol_expires_at = EXCLUDED.ol_expires_at,
  updated_at = now();
```

#### 2. Caching Strategy

**7-day Cache:**
- Redukuje ~99% wywołań do OL dla popularnych autorów
- Użytkownicy rzadko widzą stare dane (max 7 dni)

**Cache warming (future enhancement):**
- Background job odświeżający popularnych autorów przed wygaśnięciem

#### 3. Response Time Target

- **Target:** < 500ms dla cached results
- **Target:** < 2s dla fresh OL fetch
- **Timeout:** 10s dla OL API

### Monitoring i Metryki

Warto śledzić:
- Średni czas response endpoint
- Cache hit rate (% wyników z cache vs OL)
- OpenLibrary API error rate
- Database query duration
- Częstotliwość zapytań per IP (dla rate limiting)

## 9. Etapy wdrożenia

### Krok 1: Utworzenie Zod Schema dla walidacji
**Plik:** `src/lib/validation/author-search.schema.ts`

```typescript
import { z } from 'zod';

export const AuthorSearchQuerySchema = z.object({
  q: z.string()
    .min(1, 'Search query is required')
    .max(200, 'Search query too long')
    .trim(),
  limit: z.number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .optional()
});

export type AuthorSearchQueryValidated = z.infer<typeof AuthorSearchQuerySchema>;
```

### Krok 2: Utworzenie OpenLibrary Service
**Plik:** `src/lib/services/openlibrary.service.ts`

**Odpowiedzialności:**
- Wywołanie OpenLibrary Search API
- Obsługa timeout i errors
- Parsowanie i walidacja odpowiedzi OL
- Transformacja do wewnętrznego formatu

**Metody:**
```typescript
export class OpenLibraryService {
  private readonly baseUrl = 'https://openlibrary.org';
  private readonly timeout = 10000; // 10s

  async searchAuthors(query: string, limit: number): Promise<OpenLibraryAuthor[]> {
    // Implementation
  }

  private parseAuthorResponse(data: unknown): OpenLibraryAuthor[] {
    // Validate and transform OL response
  }
}

interface OpenLibraryAuthor {
  openlibrary_id: string;  // e.g., "OL23919A"
  name: string;
}
```

### Krok 3: Utworzenie/Rozszerzenie Authors Service
**Plik:** `src/lib/services/authors.service.ts`

**Odpowiedzialności:**
- Lookup autorów po openlibrary_id (batch)
- Upsert autorów do cache (bulk)
- Walidacja cache expiry

**Metody:**
```typescript
export class AuthorsService {
  constructor(private supabase: SupabaseClient) {}

  async findByOpenLibraryIds(
    openlibraryIds: string[]
  ): Promise<Map<string, AuthorRow>> {
    // Batch lookup with index
  }

  async upsertAuthorsCache(
    authors: Array<{
      openlibrary_id: string;
      name: string;
      ol_fetched_at: string;
      ol_expires_at: string;
    }>
  ): Promise<void> {
    // Bulk upsert with ON CONFLICT
  }
}
```

### Krok 4: Implementacja Route Handler
**Plik:** `src/pages/api/authors/search.ts`

```typescript
import type { APIRoute } from 'astro';
import { AuthorSearchQuerySchema } from '@/lib/validation/author-search.schema';
import { OpenLibraryService } from '@/lib/services/openlibrary.service';
import { AuthorsService } from '@/lib/services/authors.service';
import type { AuthorSearchResponseDto } from '@/types';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Parse and validate query params
    const url = new URL(request.url);
    const queryParams = {
      q: url.searchParams.get('q'),
      limit: url.searchParams.get('limit') 
        ? Number(url.searchParams.get('limit')) 
        : undefined
    };

    const validation = AuthorSearchQuerySchema.safeParse(queryParams);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation error',
          message: validation.error.errors[0].message,
          details: validation.error.errors
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { q, limit } = validation.data;

    // 2. Initialize services
    const supabase = locals.supabase;
    const olService = new OpenLibraryService();
    const authorsService = new AuthorsService(supabase);

    // 3. Search OpenLibrary
    let olResults;
    try {
      olResults = await olService.searchAuthors(q, limit ?? 10);
    } catch (error) {
      console.error('OpenLibrary API error:', error);
      return new Response(
        JSON.stringify({
          error: 'External service error',
          message: 'Could not connect to OpenLibrary. Please try again later.'
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check cache in database
    let cachedAuthors: Map<string, AuthorRow>;
    try {
      const olIds = olResults.map(r => r.openlibrary_id);
      cachedAuthors = await authorsService.findByOpenLibraryIds(olIds);
    } catch (error) {
      console.error('Cache lookup failed, proceeding without cache:', error);
      cachedAuthors = new Map();
    }

    // 5. Merge results and check cache expiry
    const now = new Date();
    const results: AuthorSearchResultDto[] = [];
    const toCache: Array<{
      openlibrary_id: string;
      name: string;
      ol_fetched_at: string;
      ol_expires_at: string;
    }> = [];

    for (const olAuthor of olResults) {
      const cached = cachedAuthors.get(olAuthor.openlibrary_id);
      
      if (cached?.ol_expires_at && new Date(cached.ol_expires_at) > now) {
        // Cache valid
        results.push({
          id: cached.id,
          openlibrary_id: cached.openlibrary_id!,
          name: cached.name,
          ol_fetched_at: cached.ol_fetched_at,
          ol_expires_at: cached.ol_expires_at
        });
      } else {
        // Cache expired or missing
        const fetchedAt = new Date();
        const expiresAt = new Date(fetchedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        results.push({
          id: cached?.id,
          openlibrary_id: olAuthor.openlibrary_id,
          name: olAuthor.name,
          ol_fetched_at: fetchedAt.toISOString(),
          ol_expires_at: expiresAt.toISOString()
        });

        toCache.push({
          openlibrary_id: olAuthor.openlibrary_id,
          name: olAuthor.name,
          ol_fetched_at: fetchedAt.toISOString(),
          ol_expires_at: expiresAt.toISOString()
        });
      }
    }

    // 6. Update cache (don't await - background operation)
    if (toCache.length > 0) {
      authorsService.upsertAuthorsCache(toCache).catch(error => {
        console.error('Failed to update authors cache:', error);
      });
    }

    // 7. Return response
    const response: AuthorSearchResponseDto = {
      authors: results
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in /api/authors/search:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

### Krok 5: Dodanie testów jednostkowych (opcjonalne, ale zalecane)

**Testy dla OpenLibraryService:**
- Mock fetch API
- Test successful search
- Test timeout handling
- Test malformed response
- Test network error

**Testy dla AuthorsService:**
- Mock Supabase client
- Test batch lookup
- Test bulk upsert
- Test empty results

**Testy dla endpoint:**
- Test valid query
- Test missing 'q' parameter
- Test invalid limit
- Test OL API error
- Test cache hit vs miss

### Krok 6: Weryfikacja typów TypeScript

```bash
npm run build
# lub
npx astro check
```

Upewnić się, że nie ma błędów typowania.

### Krok 7: Testowanie manualne

**Test case 1: Basic search**
```bash
curl "http://localhost:3000/api/authors/search?q=tolkien&limit=5"
```
Oczekiwany: 200, lista autorów

**Test case 2: Missing query**
```bash
curl "http://localhost:3000/api/authors/search"
```
Oczekiwany: 400, validation error

**Test case 3: Invalid limit**
```bash
curl "http://localhost:3000/api/authors/search?q=test&limit=100"
```
Oczekiwany: 400, limit validation error

**Test case 4: Cache behavior**
```bash
# First request - should fetch from OL
curl "http://localhost:3000/api/authors/search?q=asimov&limit=1"
# Second request - should use cache (has 'id' field)
curl "http://localhost:3000/api/authors/search?q=asimov&limit=1"
```

### Krok 8: Code Review Checklist

- [ ] Walidacja Zod zgodna ze specyfikacją
- [ ] Proper error handling (400, 502, 500)
- [ ] Logging błędów z odpowiednim kontekstem
- [ ] Export `prerender = false` w pliku route
- [ ] Użycie `locals.supabase` zamiast direct import
- [ ] Typy DTO zgodne z `src/types.ts`
- [ ] Bulk operations dla DB (nie N+1)
- [ ] Background cache update (no await)
- [ ] Timeout dla OL API
- [ ] Friendly error messages dla użytkownika
- [ ] Kod zgodny z guidelines (early returns, guard clauses)

### Krok 9: Monitoring i Observability (post-launch)

Po wdrożeniu, dodać:
- Metryki endpoint response time
- Alert na wysoką error rate
- Dashboard z cache hit rate
- OpenLibrary API health check

### Krok 10: Dokumentacja

Zaktualizować:
- API documentation (jeśli istnieje)
- README z przykładami użycia
- Changelog z nowym endpointem

---

## Podsumowanie

Endpoint `/api/authors/search` jest kluczowym punktem wejścia dla użytkowników eksplorujących autorów z OpenLibrary. Implementacja musi zapewnić:

1. **Niezawodność:** Graceful handling błędów OpenLibrary API
2. **Wydajność:** 7-dniowy cache redukujący wywołania zewnętrzne
3. **Bezpieczeństwo:** Walidacja input, rate limiting (future)
4. **Użyteczność:** Clear error messages, sensible defaults

Następne kroki po implementacji tego endpointa:
- POST /api/openlibrary/import/author (import autora do systemu)
- GET /api/authors/{authorId}/works (lista dzieł autora)

