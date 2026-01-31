# API Endpoint Implementation Plan: GET /api/user/works

## 1. Przegląd punktu końcowego

Endpoint `GET /api/user/works` służy do pobierania stronicowanej listy dzieł (works) przypisanych do profilu zalogowanego użytkownika z możliwością filtrowania i sortowania. Endpoint zwraca dzieła wraz z ich podstawowymi informacjami, podsumowaniem primary edition, statusem użytkownika oraz dostępnością w Legimi.

**Główne funkcjonalności:**
- Stronicowana lista dzieł przypisanych do użytkownika
- Filtrowanie po statusie (multi-select: `to_read`, `in_progress`, `read`, `hidden`)
- Filtrowanie po dostępności w Legimi (`true`, `false`, `null`)
- Filtrowanie po autorze (`author_id`)
- Wyszukiwanie po tytule dzieła (substring, case-insensitive)
- Sortowanie: `published_desc` (domyślnie) lub `title_asc`
- Zwracanie informacji o primary edition dla każdego dzieła
- Obliczanie `publish_year` jako `COALESCE(works.first_publish_year, editions.publish_year)`

**Wykorzystywane zasoby bazy danych:**
- Tabela `user_works` (relacja użytkownik-dzieło, composite PK: user_id, work_id)
- Tabela `works` (katalog dzieł z tytułem, rokiem publikacji, primary_edition_id)
- Tabela `editions` (szczegóły primary edition: tytuł, rok publikacji, okładka, ISBN, język)
- Tabela `author_works` (relacja autor-dzieło, używana do filtrowania po autorze)
- Indeksy: `user_works(user_id, status)`, `user_works(user_id, available_in_legimi)`, `works(title)`, `works(first_publish_year desc)`
- RLS (Row Level Security): użytkownik widzi tylko swoje własne relacje `user_works`

**Uwaga:** Endpoint wymaga uwierzytelnienia - zwraca tylko dzieła przypisane do zalogowanego użytkownika zgodnie z zasadami RLS.

## 2. Szczegóły żądania

**Metoda HTTP:** `GET`

**Struktura URL:** `/api/user/works`

**Nagłówki:**
- Wymagane: `Authorization: Bearer <token>` (uwierzytelnienie przez Supabase Auth)
- Opcjonalne: standardowe nagłówki HTTP

**Query Parameters:**
- `page` (opcjonalne, domyślnie `1`): Numer strony (minimum 1, integer)
- `status` (opcjonalne): Tablica statusów dzieł (`to_read`, `in_progress`, `read`, `hidden`). Może być przekazana wielokrotnie w URL jako `?status=to_read&status=in_progress` lub jako tablica w parserze
- `available` (opcjonalne): Dostępność w Legimi (`true`, `false`, `null`). Wartość `null` oznacza nieoznaczone
- `sort` (opcjonalne, domyślnie `published_desc`): Kolejność sortowania - `published_desc` (najnowsze według roku publikacji) lub `title_asc` (alfabetycznie po tytule)
- `author_id` (opcjonalne): UUID autora - zwraca tylko dzieła powiązane z tym autorem
- `search` (opcjonalne): Wyszukiwanie po tytule dzieła (substring, case-insensitive, maksymalnie 200 znaków)

**Request Body:** Brak (GET request)

**Przykłady żądań:**
- `GET /api/user/works` - wszystkie dzieła użytkownika, pierwsza strona, sortowanie domyślne
- `GET /api/user/works?page=2&status=to_read&status=in_progress` - druga strona, tylko dzieła do przeczytania i w trakcie
- `GET /api/user/works?available=true&sort=title_asc&search=harry` - dostępne w Legimi, sortowanie po tytule, wyszukiwanie "harry"
- `GET /api/user/works?author_id=123e4567-e89b-12d3-a456-426614174000&status=read` - dzieła konkretnego autora ze statusem "read"

## 3. Wykorzystywane typy

**DTO (Data Transfer Objects):**
- `UserWorksListResponseDto` - typ odpowiedzi (zdefiniowany w `src/types.ts`)
- `UserWorkItemDto` - pojedynczy element listy (zdefiniowany w `src/types.ts`)
- `WorkWithPrimaryEditionDto` - dzieło z informacją o primary edition (zdefiniowany w `src/types.ts`)
- `PrimaryEditionSummaryDto` - podsumowanie primary edition (zdefiniowany w `src/types.ts`)
- `PaginatedResponseDto<T>` - generyczny wrapper dla stronicowanych odpowiedzi (zdefiniowany w `src/types.ts`)

**Query/Command modele (dla GET):**
- `UserWorksListQueryDto` - typ parametrów zapytania (zdefiniowany w `src/types.ts`)
- `UserWorksListQueryValidated` - zwalidowane parametry zapytania (będzie wywnioskowany z Zod schema)

**Typy encji pomocniczo:**
- `UserWorkRow` - wiersz z tabeli `user_works`
- `WorkRow` - wiersz z tabeli `works`
- `EditionRow` - wiersz z tabeli `editions`
- `UserWorkStatus` - enum statusu dzieła (`to_read | in_progress | read | hidden`)

**Schemat walidacji:**
- `UserWorksListQuerySchema` - Zod schema do walidacji parametrów zapytania (do utworzenia w `src/lib/validation/user-works-list.schema.ts`)

## 4. Szczegóły odpowiedzi

**Sukces - 200 OK:**
```json
{
  "items": [
    {
      "work": {
        "id": "uuid",
        "title": "string",
        "openlibrary_id": "string | null",
        "first_publish_year": "number | null",
        "primary_edition_id": "uuid | null",
        "manual": "boolean",
        "owner_user_id": "uuid | null",
        "created_at": "string (ISO 8601)",
        "updated_at": "string (ISO 8601)",
        "primary_edition": {
          "id": "uuid",
          "title": "string",
          "openlibrary_id": "string | null",
          "publish_year": "number | null",
          "publish_date": "string (ISO date) | null",
          "publish_date_raw": "string | null",
          "isbn13": "string | null",
          "cover_url": "string | null",
          "language": "string | null"
        } | null
      },
      "status": "to_read | in_progress | read | hidden",
      "available_in_legimi": "boolean | null",
      "status_updated_at": "string (ISO 8601) | null",
      "created_at": "string (ISO 8601)",
      "updated_at": "string (ISO 8601)"
    }
  ],
  "page": 1,
  "total": 42
}
```

**Błędy:**
- `400 Bad Request`: Błąd walidacji parametrów zapytania
  ```json
  {
    "error": "Validation error",
    "message": "Page must be at least 1",
    "details": [...]
  }
  ```
- `401 Unauthorized`: Brak uwierzytelnienia lub nieprawidłowy token
  ```json
  {
    "error": "Unauthorized",
    "message": "Authentication required"
  }
  ```
- `500 Internal Server Error`: Błąd serwera podczas przetwarzania zapytania
  ```json
  {
    "error": "Internal server error",
    "message": "An unexpected error occurred"
  }
  ```

**Uwagi dotyczące odpowiedzi:**
- `items` - tablica `UserWorkItemDto`, maksymalnie 20 elementów na stronę
- `page` - aktualny numer strony (1-based)
- `total` - całkowita liczba dzieł spełniających kryteria filtrowania
- `primary_edition` - może być `null` jeśli dzieło nie ma ustawionego primary edition
- `publish_year` - nie jest bezpośrednio w odpowiedzi, ale może być obliczony jako `COALESCE(work.first_publish_year, work.primary_edition?.publish_year)`

## 5. Przepływ danych

1. **Walidacja uwierzytelnienia:**
   - Pobranie użytkownika z `locals.supabase.auth.getUser()`
   - Jeśli brak użytkownika lub błąd → zwróć `401 Unauthorized`

2. **Ekstrakcja i walidacja parametrów zapytania:**
   - Parsowanie parametrów z `request.url` (URLSearchParams)
   - Obsługa wielokrotnych wartości `status` (może być przekazane jako `?status=to_read&status=in_progress`)
   - Konwersja `page` z stringa na number z walidacją
   - Konwersja `available` z stringa na boolean lub null
   - Walidacja `author_id` jako UUID
   - Walidacja `search` (maksymalnie 200 znaków, trim)
   - Walidacja `sort` (enum: `published_desc` lub `title_asc`)
   - Jeśli walidacja nie powiedzie się → zwróć `400 Bad Request`

3. **Ustawienie wartości domyślnych:**
   - `page = 1` jeśli nie podano
   - `sort = "published_desc"` jeśli nie podano
   - `status = undefined` jeśli nie podano (zwraca wszystkie statusy)
   - `available = undefined` jeśli nie podano (zwraca wszystkie wartości)
   - `author_id = undefined` jeśli nie podano
   - `search = undefined` jeśli nie podano lub pusty string

4. **Inicjalizacja serwisu:**
   - Utworzenie instancji `WorksService` z `locals.supabase`
   - Wywołanie metody serwisu do pobrania dzieł użytkownika

5. **Zapytanie do bazy danych:**
   - Budowanie zapytania z JOIN między `user_works`, `works`, `editions` (LEFT JOIN dla primary edition)
   - Opcjonalny JOIN z `author_works` jeśli `author_id` jest podany
   - Aplikowanie filtrów:
     - `user_works.user_id = current_user_id` (RLS automatycznie)
     - `user_works.status IN (...)` jeśli `status` jest podany
     - `user_works.available_in_legimi = ...` jeśli `available` jest podany (uwaga: `null` wymaga specjalnej obsługi)
     - `works.title ILIKE '%search%'` jeśli `search` jest podany
     - `author_works.author_id = author_id` jeśli `author_id` jest podany
   - Aplikowanie sortowania:
     - `published_desc`: `ORDER BY COALESCE(works.first_publish_year, editions.publish_year) DESC NULLS LAST, works.title ASC, works.id ASC`
     - `title_asc`: `ORDER BY works.title ASC, works.id ASC`
   - Aplikowanie paginacji: `LIMIT 20 OFFSET (page - 1) * 20`
   - Pobranie całkowitej liczby wyników (COUNT(*) OVER())

6. **Transformacja danych:**
   - Mapowanie wyników zapytania na `UserWorkItemDto`
   - Budowanie `WorkWithPrimaryEditionDto` z informacją o primary edition
   - Obsługa przypadku gdy `primary_edition` jest `null`

7. **Budowanie odpowiedzi:**
   - Utworzenie `UserWorksListResponseDto` z `items`, `page`, `total`
   - Zwrócenie `200 OK` z JSON response

**Alternatywne podejście (RPC function):**
Zamiast budowania złożonego zapytania w serwisie, można utworzyć funkcję RPC w PostgreSQL (`get_user_works`) podobną do `get_author_works`, która:
- Przyjmuje parametry: `p_user_id`, `p_page`, `p_page_size`, `p_status[]`, `p_available`, `p_sort`, `p_author_id`, `p_search`
- Wykonuje złożone JOIN-y i filtrowanie
- Zwraca wyniki z `total_count` w każdym wierszu
- Jest bardziej wydajna dla złożonych zapytań z wieloma filtrami

## 6. Względy bezpieczeństwa

1. **Uwierzytelnienie:**
   - Endpoint wymaga zalogowanego użytkownika
   - Weryfikacja przez `locals.supabase.auth.getUser()`
   - Brak tokenu lub nieprawidłowy token → `401 Unauthorized`

2. **Autoryzacja (RLS):**
   - Supabase RLS automatycznie filtruje `user_works` do rekordów gdzie `user_id = auth.uid()`
   - Użytkownik widzi tylko swoje własne przypisane dzieła
   - Nie ma potrzeby dodatkowej weryfikacji autoryzacji w kodzie aplikacji

3. **Walidacja danych wejściowych:**
   - Wszystkie parametry zapytania są walidowane przez Zod schema
   - `page` - minimum 1, integer, finite
   - `status` - tablica enumów z dozwolonych wartości
   - `available` - boolean lub null
   - `sort` - enum z dozwolonych wartości
   - `author_id` - UUID format
   - `search` - maksymalnie 200 znaków, trim
   - Nieprawidłowe dane → `400 Bad Request`

4. **SQL Injection:**
   - Używanie Supabase client z parametrami zapytania eliminuje ryzyko SQL injection
   - Wszystkie wartości są przekazywane jako parametry, nie jako stringi SQL

5. **Rate Limiting:**
   - Endpoint GET nie wymaga rate limiting (tylko odczyt danych)
   - Można rozważyć dodanie rate limiting w przyszłości jeśli będzie problem z nadmiernym użyciem

6. **Dostęp do danych:**
   - Użytkownik może filtrować tylko swoje własne dzieła
   - Filtrowanie po `author_id` zwraca tylko dzieła autora, które są przypisane do użytkownika
   - Nie ma możliwości dostępu do dzieł innych użytkowników

## 7. Obsługa błędów

**Błędy walidacji (400 Bad Request):**
- Nieprawidłowy format `page` (nie integer, < 1, nie finite)
- Nieprawidłowe wartości `status` (nie z enum)
- Nieprawidłowy format `available` (nie boolean/null)
- Nieprawidłowy format `sort` (nie z enum)
- Nieprawidłowy format `author_id` (nie UUID)
- `search` przekracza 200 znaków
- Logowanie: poziom `warn` z szczegółami walidacji

**Błędy uwierzytelnienia (401 Unauthorized):**
- Brak tokenu uwierzytelniającego
- Nieprawidłowy lub wygasły token
- Błąd podczas pobierania użytkownika z Supabase Auth
- Logowanie: poziom `warn` z informacją o błędzie

**Błędy bazy danych (500 Internal Server Error):**
- Błąd podczas wykonywania zapytania do bazy danych
- Błąd podczas pobierania primary edition
- Błąd podczas transformacji danych
- Logowanie: poziom `error` z pełnym stack trace i kontekstem (userId, parametry zapytania)

**Błędy nieoczekiwane (500 Internal Server Error):**
- Wyjątki nieobsłużone w try-catch
- Błędy podczas parsowania JSON (nie powinno się zdarzyć dla GET)
- Logowanie: poziom `error` z pełnym stack trace

**Obsługa edge cases:**
- Pusta lista wyników → zwróć `{ items: [], page: 1, total: 0 }` (200 OK)
- Strona poza zakresem (np. page=100 gdy total=10) → zwróć `{ items: [], page: 100, total: 10 }` (200 OK)
- `author_id` wskazuje na autora, który nie ma przypisanych dzieł użytkownika → zwróć pustą listę (200 OK)
- `status` z wartościami, które nie pasują do żadnych dzieł → zwróć pustą listę (200 OK)
- `primary_edition_id` wskazuje na nieistniejące wydanie → `primary_edition: null` w odpowiedzi

**Struktura odpowiedzi błędów:**
Wszystkie błędy zwracają JSON w formacie:
```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "details": [...] // opcjonalnie, dla błędów walidacji
}
```

## 8. Rozważania dotyczące wydajności

1. **Indeksy bazy danych:**
   - `user_works(user_id, status)` - optymalizuje filtrowanie po statusie
   - `user_works(user_id, available_in_legimi)` - optymalizuje filtrowanie po dostępności
   - `works(title)` - optymalizuje wyszukiwanie po tytule
   - `works(first_publish_year desc)` - optymalizuje sortowanie po dacie publikacji
   - `author_works(author_id, work_id)` - optymalizuje filtrowanie po autorze

2. **Paginacja:**
   - Strona zawiera maksymalnie 20 elementów (pageSize = 20)
   - Użycie `LIMIT` i `OFFSET` w zapytaniu SQL
   - `COUNT(*) OVER()` dla total count (bardziej wydajne niż osobne zapytanie COUNT)

3. **JOIN-y:**
   - LEFT JOIN z `editions` dla primary edition (może być null)
   - JOIN z `author_works` tylko gdy `author_id` jest podany (warunkowy JOIN)
   - Unikanie niepotrzebnych JOIN-ów gdy filtry nie są używane

4. **Optymalizacja zapytania:**
   - Użycie RPC function (`get_user_works`) może być bardziej wydajne dla złożonych zapytań z wieloma filtrami
   - RPC function wykonuje się po stronie bazy danych, co redukuje transfer danych
   - RPC function może wykorzystać lepsze planowanie zapytań przez PostgreSQL

5. **Caching:**
   - Endpoint GET może być cache'owany po stronie klienta
   - Nie wymaga cache'owania po stronie serwera (dane są specyficzne dla użytkownika i często się zmieniają)

6. **Potencjalne wąskie gardła:**
   - Użytkownicy z dużą liczbą przypisanych dzieł (>1000) mogą doświadczać wolniejszych zapytań
   - Filtrowanie po `author_id` wymaga dodatkowego JOIN, co może spowolnić zapytanie
   - Wyszukiwanie po tytule (`ILIKE`) może być wolne dla długich tytułów (rozważyć full-text search w przyszłości)
   - Sortowanie po `published_desc` z `NULLS LAST` może być wolne bez odpowiedniego indeksu

7. **Rekomendacje optymalizacji:**
   - Rozważyć utworzenie composite index `user_works(user_id, status, available_in_legimi)` jeśli oba filtry są często używane razem
   - Rozważyć użycie full-text search zamiast `ILIKE` dla wyszukiwania po tytule (PostgreSQL tsvector)
   - Monitorować czas wykonania zapytań i dodawać dodatkowe indeksy w razie potrzeby
   - Rozważyć użycie materialized view dla często używanych kombinacji filtrów

## 9. Etapy wdrożenia

1. **Utworzenie schematu walidacji Zod:**
   - Utworzenie pliku `src/lib/validation/user-works-list.schema.ts`
   - Zdefiniowanie `UserWorksListQuerySchema` z walidacją wszystkich parametrów:
     - `page` - z preprocessingiem string → number, min 1, integer
     - `status` - tablica enumów (obsługa wielokrotnych wartości w URL)
     - `available` - boolean lub null (z preprocessingiem string → boolean/null)
     - `sort` - enum `["published_desc", "title_asc"]`
     - `author_id` - UUID (opcjonalne)
     - `search` - string, max 200 znaków, trim, opcjonalne
   - Eksport typu `UserWorksListQueryValidated` z inferencji Zod

2. **Rozszerzenie WorksService:**
   - Dodanie metody `findUserWorks()` do klasy `WorksService` w `src/lib/services/works.service.ts`
   - Metoda przyjmuje parametry: `userId`, `page`, `status[]`, `available`, `sort`, `authorId`, `search`
   - Implementacja zapytania z JOIN między `user_works`, `works`, `editions` (LEFT JOIN)
   - Warunkowy JOIN z `author_works` jeśli `authorId` jest podany
   - Aplikowanie wszystkich filtrów zgodnie z parametrami
   - Aplikowanie sortowania (`published_desc` lub `title_asc`)
   - Aplikowanie paginacji (pageSize = 20)
   - Pobranie total count używając `COUNT(*) OVER()`
   - Transformacja wyników na `UserWorkItemDto[]`
   - Obsługa błędów z odpowiednimi komunikatami

3. **Alternatywnie: Utworzenie RPC function w PostgreSQL:**
   - Jeśli złożoność zapytania jest zbyt duża, utworzenie funkcji `get_user_works` w migracji Supabase
   - Funkcja przyjmuje parametry: `p_user_id uuid`, `p_page int`, `p_page_size int`, `p_status user_work_status_enum[]`, `p_available boolean`, `p_sort text`, `p_author_id uuid`, `p_search text`
   - Funkcja wykonuje złożone JOIN-y i filtrowanie
   - Funkcja zwraca wyniki z `total_count` w każdym wierszu
   - Aktualizacja `WorksService.findUserWorks()` do użycia RPC zamiast bezpośredniego zapytania

4. **Utworzenie endpointu API:**
   - Utworzenie pliku `src/pages/api/user/works/index.ts`
   - Implementacja handlera `GET` zgodnie z wzorcem z `src/pages/api/user/authors/index.ts`
   - Walidacja uwierzytelnienia (pobranie użytkownika z `locals.supabase.auth.getUser()`)
   - Parsowanie parametrów zapytania z URL (obsługa wielokrotnych wartości `status`)
   - Walidacja parametrów przez `UserWorksListQuerySchema`
   - Ustawienie wartości domyślnych (`page = 1`, `sort = "published_desc"`)
   - Wywołanie `WorksService.findUserWorks()` z walidowanymi parametrami
   - Obsługa błędów z odpowiednimi kodami statusu (400, 401, 500)
   - Budowanie odpowiedzi `UserWorksListResponseDto`
   - Zwrócenie `200 OK` z JSON response
   - Logowanie błędów używając `logger` z odpowiednimi poziomami

5. **Dodanie eksportu prerender:**
   - Dodanie `export const prerender = false;` na początku pliku endpointu (wymagane dla API routes w Astro)

6. **Testowanie ręczne:**
**Plik:** `.ai/api/api-user-works-get-manual-tests.md`
   - Testowanie z różnymi kombinacjami parametrów zapytania
   - Testowanie walidacji (nieprawidłowe wartości)
   - Testowanie uwierzytelnienia (brak tokenu, nieprawidłowy token)
   - Testowanie filtrowania (status, available, author_id, search)
   - Testowanie sortowania (published_desc, title_asc)
   - Testowanie paginacji (różne strony, pusta strona)
   - Testowanie edge cases (pusta lista, brak primary edition, nieistniejący author_id)
   - Testowanie wydajności z dużą liczbą dzieł użytkownika

7. **Dokumentacja:**
   - Sprawdzenie czy typy w `src/types.ts` są zgodne z implementacją
   - Aktualizacja dokumentacji API jeśli istnieje
   - Dodanie komentarzy JSDoc do metody serwisu i endpointu

8. **Code review i refaktoryzacja:**
   - Przegląd kodu pod kątem zgodności z zasadami projektu
   - Sprawdzenie obsługi błędów i edge cases
   - Optymalizacja zapytań jeśli potrzeba
   - Upewnienie się, że kod używa `locals.supabase` zamiast bezpośredniego importu klienta
