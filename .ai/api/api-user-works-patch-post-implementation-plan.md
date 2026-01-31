# API Endpoint Implementation Plan: PATCH /api/user/works/{workId} & POST /api/user/works/status-bulk

## 1. Przegląd punktu końcowego

### PATCH /api/user/works/{workId}

Endpoint służy do aktualizacji statusu i/lub dostępności w Legimi dla pojedynczego dzieła przypisanego do profilu zalogowanego użytkownika. Endpoint aktualizuje rekord w tabeli `user_works` i automatycznie aktualizuje pole `status_updated_at` przez trigger bazy danych, gdy status ulega zmianie.

**Główne funkcjonalności:**

- Aktualizacja statusu dzieła (enum: `to_read`, `in_progress`, `read`, `hidden`)
- Aktualizacja dostępności w Legimi (boolean lub null)
- Automatyczna aktualizacja `status_updated_at` przy zmianie statusu (trigger bazy danych)
- Automatyczna aktualizacja `updated_at` (trigger bazy danych)
- Weryfikacja, że dzieło jest przypisane do użytkownika (404 jeśli nie)

### POST /api/user/works/status-bulk

Endpoint służy do masowej aktualizacji statusu i/lub dostępności w Legimi dla wielu dzieł przypisanych do profilu zalogowanego użytkownika w jednej operacji. Endpoint aktualizuje wiele rekordów w tabeli `user_works` jednocześnie.

**Główne funkcjonalności:**

- Masowa aktualizacja statusu dla wielu dzieł jednocześnie
- Masowa aktualizacja dostępności w Legimi dla wielu dzieł jednocześnie
- Automatyczna aktualizacja `status_updated_at` przy zmianie statusu (trigger bazy danych)
- Automatyczna aktualizacja `updated_at` (trigger bazy danych)
- Weryfikacja, że wszystkie dzieła są przypisane do użytkownika (pominięcie nieprzypisanych)
- Zwracanie listy zaktualizowanych dzieł z pełnymi danymi

**Wykorzystywane zasoby bazy danych:**

- Tabela `user_works` (relacja użytkownik-dzieło, composite PK: user_id, work_id)
- Tabela `works` (katalog dzieł, dołączany w odpowiedzi)
- Tabela `editions` (edycje dzieł, dołączane w odpowiedzi dla primary_edition)
- Trigger `user_works_set_updated_at` (automatyczna aktualizacja `updated_at` i `status_updated_at`)
- Indeksy: `user_works(user_id, work_id)`, `user_works(user_id, status)`, `works(id)`

**Uwaga:** Oba endpointy aktualizują tylko istniejące przypisania dzieł do użytkownika. Nie tworzą nowych przypisań - do tego służy endpoint `POST /api/user/works/bulk`.

## 2. Szczegóły żądania

### PATCH /api/user/works/{workId}

**Metoda HTTP:** `PATCH`

**Struktura URL:** `/api/user/works/{workId}`

**Path Parameters:**

- `workId` (wymagany): UUID dzieła w standardowym formacie (np. "550e8400-e29b-41d4-a716-446655440000")

**Nagłówki:**

- `Content-Type: application/json` (wymagany)
- `Authorization: Bearer <access_token>` lub sesja cookie (wymagany)

**Request Body:**

```json
{
  "status"?: "to_read" | "in_progress" | "read" | "hidden",
  "available_in_legimi"?: boolean | null
}
```

**Parametry body:**

- `status` (opcjonalny): Nowy status dzieła. Musi być jednym z wartości enum: `to_read`, `in_progress`, `read`, `hidden`. Jeśli nie podano, status nie jest aktualizowany.
- `available_in_legimi` (opcjonalny): Dostępność dzieła w Legimi. Może być `true`, `false` lub `null`. Jeśli nie podano, wartość nie jest aktualizowana.

**Uwagi:**

- Co najmniej jeden z parametrów (`status` lub `available_in_legimi`) musi być podany w body.
- Jeśli podano tylko `status`, aktualizowany jest tylko status.
- Jeśli podano tylko `available_in_legimi`, aktualizowana jest tylko dostępność.
- Jeśli podano oba parametry, aktualizowane są oba pola.

### POST /api/user/works/status-bulk

**Metoda HTTP:** `POST`

**Struktura URL:** `/api/user/works/status-bulk`

**Nagłówki:**

- `Content-Type: application/json` (wymagany)
- `Authorization: Bearer <access_token>` lub sesja cookie (wymagany)

**Request Body:**

```json
{
  "work_ids": ["uuid1", "uuid2", ...],
  "status"?: "to_read" | "in_progress" | "read" | "hidden",
  "available_in_legimi"?: boolean | null
}
```

**Parametry body:**

- `work_ids` (wymagany): Tablica UUID dzieł do aktualizacji. Musi zawierać co najmniej 1 element i maksymalnie 100 elementów. Duplikaty są automatycznie usuwane podczas walidacji.
- `status` (opcjonalny): Nowy status dla wszystkich dzieł w tablicy. Musi być jednym z wartości enum: `to_read`, `in_progress`, `read`, `hidden`. Jeśli nie podano, status nie jest aktualizowany.
- `available_in_legimi` (opcjonalny): Dostępność w Legimi dla wszystkich dzieł w tablicy. Może być `true`, `false` lub `null`. Jeśli nie podano, wartość nie jest aktualizowana.

**Uwagi:**

- Co najmniej jeden z parametrów (`status` lub `available_in_legimi`) musi być podany w body.
- Wszystkie dzieła w tablicy `work_ids` otrzymują te same wartości `status` i `available_in_legimi`.
- Dzieła, które nie są przypisane do użytkownika, są pomijane (nie powodują błędu).
- Maksymalny rozmiar tablicy `work_ids` wynosi 100 elementów (limit zapobiegający przeciążeniu systemu).

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

**UpdateUserWorkCommand** (już istnieje w `src/types.ts`):

```typescript
interface UpdateUserWorkCommand {
  status?: UserWorkStatus;
  available_in_legimi?: boolean | null;
}
```

**UpdateUserWorksBulkCommand** (już istnieje w `src/types.ts`):

```typescript
type UpdateUserWorksBulkCommand = UpdateUserWorkCommand & {
  work_ids: WorkRow["id"][];
};
```

**UserWorkResponseDto** (już istnieje w `src/types.ts`):

```typescript
interface UserWorkResponseDto {
  work: UserWorkItemDto;
}
```

**UserWorksBulkUpdateResponseDto** (już istnieje w `src/types.ts`):

```typescript
interface UserWorksBulkUpdateResponseDto {
  works: UserWorkItemDto[];
}
```

**UserWorkItemDto** (już istnieje w `src/types.ts`):

```typescript
interface UserWorkItemDto {
  work: WorkWithPrimaryEditionDto;
  status: UserWorkRow["status"];
  available_in_legimi: UserWorkRow["available_in_legimi"];
  status_updated_at: UserWorkRow["status_updated_at"];
  created_at: UserWorkRow["created_at"];
  updated_at: UserWorkRow["updated_at"];
}
```

### Schematy walidacji (do utworzenia)

**UpdateUserWorkCommandSchema** (`src/lib/validation/update-user-work.schema.ts`):

- Walidacja UUID dla `workId` w path parameter
- Walidacja body: co najmniej jeden z `status` lub `available_in_legimi` musi być podany
- Walidacja `status`: enum `["to_read", "in_progress", "read", "hidden"]`
- Walidacja `available_in_legimi`: `boolean | null`

**UpdateUserWorksBulkCommandSchema** (`src/lib/validation/update-user-works-bulk.schema.ts`):

- Walidacja `work_ids`: tablica UUID, min 1 element, max 100 elementów, deduplikacja
- Walidacja: co najmniej jeden z `status` lub `available_in_legimi` musi być podany
- Walidacja `status`: enum `["to_read", "in_progress", "read", "hidden"]`
- Walidacja `available_in_legimi`: `boolean | null`

**WorkIdParamSchema** (możliwe, że już istnieje w `src/lib/validation/work-id.schema.ts`):

- Walidacja UUID dla `workId` w path parameter

## 4. Szczegóły odpowiedzi

### PATCH /api/user/works/{workId}

**Sukces (200 OK):**

```json
{
  "work": {
    "work": {
      "id": "uuid",
      "title": "string",
      "openlibrary_id": "string | null",
      "first_publish_year": number | null,
      "primary_edition_id": "uuid | null",
      "manual": boolean,
      "owner_user_id": "uuid | null",
      "created_at": "string",
      "updated_at": "string",
      "primary_edition": {
        "id": "uuid",
        "title": "string",
        "openlibrary_id": "string | null",
        "publish_year": number | null,
        "publish_date": "string | null",
        "publish_date_raw": "string | null",
        "isbn13": "string | null",
        "cover_url": "string | null",
        "language": "string | null"
      } | null
    },
    "status": "to_read" | "in_progress" | "read" | "hidden",
    "available_in_legimi": boolean | null,
    "status_updated_at": "string | null",
    "created_at": "string",
    "updated_at": "string"
  }
}
```

**Błędy:**

- `400 Bad Request`: Błąd walidacji (nieprawidłowy UUID, nieprawidłowy enum status, brak wymaganych pól w body)
- `401 Unauthorized`: Brak autoryzacji (niezalogowany użytkownik)
- `404 Not Found`: Dzieło nie jest przypisane do użytkownika lub nie istnieje
- `500 Internal Server Error`: Nieoczekiwany błąd serwera

### POST /api/user/works/status-bulk

**Sukces (200 OK):**

```json
{
  "works": [
    {
      "work": {
        "id": "uuid",
        "title": "string",
        "openlibrary_id": "string | null",
        "first_publish_year": number | null,
        "primary_edition_id": "uuid | null",
        "manual": boolean,
        "owner_user_id": "uuid | null",
        "created_at": "string",
        "updated_at": "string",
        "primary_edition": {
          "id": "uuid",
          "title": "string",
          "openlibrary_id": "string | null",
          "publish_year": number | null,
          "publish_date": "string | null",
          "publish_date_raw": "string | null",
          "isbn13": "string | null",
          "cover_url": "string | null",
          "language": "string | null"
        } | null
      },
      "status": "to_read" | "in_progress" | "read" | "hidden",
      "available_in_legimi": boolean | null,
      "status_updated_at": "string | null",
      "created_at": "string",
      "updated_at": "string"
    },
    ...
  ]
}
```

**Uwaga:** Tablica `works` zawiera tylko dzieła, które zostały pomyślnie zaktualizowane (były przypisane do użytkownika). Dzieła, które nie były przypisane, są pomijane bez zwracania błędu.

**Błędy:**

- `400 Bad Request`: Błąd walidacji (pusta tablica work_ids, nieprawidłowe UUID, nieprawidłowy enum status, brak wymaganych pól w body, przekroczony limit 100 elementów)
- `401 Unauthorized`: Brak autoryzacji (niezalogowany użytkownik)
- `500 Internal Server Error`: Nieoczekiwany błąd serwera

## 5. Przepływ danych

### PATCH /api/user/works/{workId}

1. **Weryfikacja autoryzacji**: Sprawdzenie, czy użytkownik jest zalogowany (Supabase Auth)
2. **Walidacja path parameter**: Sprawdzenie, czy `workId` jest prawidłowym UUID
3. **Walidacja request body**: Sprawdzenie, czy body zawiera co najmniej jeden z parametrów (`status` lub `available_in_legimi`) i czy wartości są prawidłowe
4. **Weryfikacja przypisania**: Sprawdzenie, czy dzieło o podanym `workId` jest przypisane do użytkownika (tabela `user_works`)
5. **Aktualizacja rekordu**: Aktualizacja rekordu w tabeli `user_works` z nowymi wartościami `status` i/lub `available_in_legimi`
6. **Trigger bazy danych**: Automatyczna aktualizacja `updated_at` i `status_updated_at` (jeśli status się zmienił) przez trigger `user_works_set_updated_at`
7. **Pobranie zaktualizowanych danych**: Pobranie zaktualizowanego rekordu `user_works` wraz z danymi dzieła (`works`) i primary edition (`editions`)
8. **Budowa odpowiedzi**: Utworzenie obiektu `UserWorkResponseDto` z pełnymi danymi
9. **Zwrócenie odpowiedzi**: Zwrócenie odpowiedzi 200 OK z danymi

### POST /api/user/works/status-bulk

1. **Weryfikacja autoryzacji**: Sprawdzenie, czy użytkownik jest zalogowany (Supabase Auth)
2. **Walidacja request body**: Sprawdzenie, czy body zawiera `work_ids` (tablica UUID, min 1, max 100), deduplikacja, oraz czy zawiera co najmniej jeden z parametrów (`status` lub `available_in_legimi`)
3. **Weryfikacja przypisań**: Sprawdzenie, które dzieła z tablicy `work_ids` są przypisane do użytkownika (tabela `user_works`)
4. **Aktualizacja rekordów**: Masowa aktualizacja rekordów w tabeli `user_works` dla przypisanych dzieł z nowymi wartościami `status` i/lub `available_in_legimi`
5. **Trigger bazy danych**: Automatyczna aktualizacja `updated_at` i `status_updated_at` (jeśli status się zmienił) przez trigger `user_works_set_updated_at` dla każdego zaktualizowanego rekordu
6. **Pobranie zaktualizowanych danych**: Pobranie zaktualizowanych rekordów `user_works` wraz z danymi dzieł (`works`) i primary editions (`editions`) dla wszystkich zaktualizowanych dzieł
7. **Budowa odpowiedzi**: Utworzenie obiektu `UserWorksBulkUpdateResponseDto` z tablicą `UserWorkItemDto` dla wszystkich zaktualizowanych dzieł
8. **Zwrócenie odpowiedzi**: Zwrócenie odpowiedzi 200 OK z danymi

**Uwaga:** W przypadku endpointu bulk, dzieła, które nie są przypisane do użytkownika, są po prostu pomijane (nie powodują błędu 404). Odpowiedź zawiera tylko dzieła, które zostały pomyślnie zaktualizowane.

## 6. Względy bezpieczeństwa

### Autoryzacja i uwierzytelnianie

- **Wymagana autoryzacja**: Oba endpointy wymagają zalogowanego użytkownika (Supabase Auth)
- **Weryfikacja sesji**: Middleware Astro weryfikuje sesję użytkownika przed przetworzeniem żądania
- **RLS (Row Level Security)**: Polityki RLS w bazie danych zapewniają, że użytkownik może aktualizować tylko swoje własne rekordy w tabeli `user_works`
- **Izolacja danych**: Użytkownik może aktualizować tylko dzieła przypisane do jego profilu (composite PK: user_id, work_id)

### Walidacja danych wejściowych

- **UUID validation**: Wszystkie identyfikatory UUID są walidowane przed użyciem (path parameter i body)
- **Enum validation**: Status jest walidowany jako enum z dozwolonymi wartościami
- **Type validation**: `available_in_legimi` jest walidowane jako `boolean | null`
- **Array size limits**: Tablica `work_ids` w bulk endpoint jest ograniczona do maksymalnie 100 elementów
- **Required fields**: Co najmniej jeden z parametrów (`status` lub `available_in_legimi`) musi być podany w body

### Ochrona przed atakami

- **SQL Injection**: Używanie Supabase Client zapewnia parametryzowane zapytania
- **Mass assignment**: Walidacja schematów Zod zapobiega nieoczekiwanym polom w body
- **Rate limiting**: Rozważenie dodania rate limitingu dla bulk endpoint (np. maksymalnie 10 żądań na minutę na użytkownika)
- **Input sanitization**: UUID są walidowane przed użyciem w zapytaniach

### Bezpieczeństwo bazy danych

- **RLS policies**: Polityki RLS zapewniają, że użytkownik może aktualizować tylko swoje własne rekordy
- **Trigger security**: Trigger `user_works_set_updated_at` działa jako `SECURITY DEFINER`, ale aktualizuje tylko pola `updated_at` i `status_updated_at` (nie modyfikuje innych danych)
- **Transaction safety**: W przypadku bulk update, wszystkie aktualizacje są wykonywane w jednej operacji (Supabase automatycznie zarządza transakcjami)

## 7. Obsługa błędów

### PATCH /api/user/works/{workId}

**400 Bad Request - Błąd walidacji:**

- Nieprawidłowy format UUID w path parameter `workId`
- Brak wymaganych pól w body (brak zarówno `status`, jak i `available_in_legimi`)
- Nieprawidłowa wartość enum dla `status` (nie jest jedną z dozwolonych wartości)
- Nieprawidłowy typ dla `available_in_legimi` (nie jest boolean ani null)
- Nieoczekiwane pola w body (strict validation)

**401 Unauthorized:**

- Brak tokena autoryzacyjnego lub nieprawidłowa sesja
- Wygaśnięta sesja użytkownika
- Nieprawidłowy token autoryzacyjny

**404 Not Found:**

- Dzieło o podanym `workId` nie jest przypisane do użytkownika (nie istnieje rekord w `user_works` dla tego użytkownika i dzieła)
- Dzieło o podanym `workId` nie istnieje w bazie danych (nie jest widoczne przez RLS)

**500 Internal Server Error:**

- Błąd bazy danych podczas aktualizacji rekordu
- Błąd podczas pobierania zaktualizowanych danych
- Nieoczekiwany błąd w kodzie

### POST /api/user/works/status-bulk

**400 Bad Request - Błąd walidacji:**

- Pusta tablica `work_ids` (min 1 element)
- Przekroczony limit rozmiaru tablicy `work_ids` (max 100 elementów)
- Nieprawidłowe UUID w tablicy `work_ids`
- Brak wymaganych pól w body (brak zarówno `status`, jak i `available_in_legimi`)
- Nieprawidłowa wartość enum dla `status`
- Nieprawidłowy typ dla `available_in_legimi`
- Nieoczekiwane pola w body (strict validation)

**401 Unauthorized:**

- Brak tokena autoryzacyjnego lub nieprawidłowa sesja
- Wygaśnięta sesja użytkownika
- Nieprawidłowy token autoryzacyjny

**500 Internal Server Error:**

- Błąd bazy danych podczas masowej aktualizacji rekordów
- Błąd podczas pobierania zaktualizowanych danych
- Nieoczekiwany błąd w kodzie

**Uwaga:** W przypadku bulk endpoint, dzieła, które nie są przypisane do użytkownika, nie powodują błędu 404. Są po prostu pomijane, a odpowiedź zawiera tylko dzieła, które zostały pomyślnie zaktualizowane.

### Logowanie błędów

- Wszystkie błędy są logowane przez `logger` z odpowiednimi kontekstami (userId, workId, error message, stack trace)
- Błędy walidacji są logowane na poziomie `warn`
- Błędy bazy danych i nieoczekiwane błędy są logowane na poziomie `error`
- Logi zawierają informacje potrzebne do debugowania, ale nie zawierają wrażliwych danych użytkownika

## 8. Rozważania dotyczące wydajności

### PATCH /api/user/works/{workId}

**Optymalizacje:**

- **Indeksy bazy danych**: Indeks `user_works(user_id, work_id)` zapewnia szybkie wyszukiwanie rekordu do aktualizacji
- **Pojedyncze zapytanie UPDATE**: Aktualizacja rekordu w `user_works` jest wykonywana w jednym zapytaniu
- **Efektywne pobieranie danych**: Po aktualizacji, dane są pobierane z użyciem JOIN lub RPC, aby zminimalizować liczbę zapytań
- **Trigger performance**: Trigger `user_works_set_updated_at` jest zoptymalizowany i wykonuje się szybko

**Potencjalne wąskie gardła:**

- **RLS policy evaluation**: Polityki RLS są oceniane dla każdego zapytania, ale są zoptymalizowane przez Supabase
- **JOIN z works i editions**: Pobieranie danych dzieła i primary edition wymaga JOIN, ale jest to niezbędne dla pełnej odpowiedzi

### POST /api/user/works/status-bulk

**Optymalizacje:**

- **Batch update**: Masowa aktualizacja wielu rekordów w jednym zapytaniu UPDATE z klauzulą WHERE IN
- **Deduplikacja work_ids**: Duplikaty są usuwane przed walidacją, aby uniknąć niepotrzebnych aktualizacji
- **Filtrowanie przypisanych dzieł**: Tylko dzieła przypisane do użytkownika są aktualizowane (filtrowanie przez RLS)
- **Efektywne pobieranie danych**: Po aktualizacji, dane są pobierane z użyciem RPC lub batch query z JOIN

**Potencjalne wąskie gardła:**

- **Rozmiar batch**: Duże tablice `work_ids` (do 100 elementów) mogą wymagać więcej czasu na przetworzenie
- **RLS policy evaluation**: Polityki RLS są oceniane dla każdego rekordu w batch update
- **Trigger execution**: Trigger `user_works_set_updated_at` jest wykonywany dla każdego zaktualizowanego rekordu

**Rekomendacje:**

- Rozważyć dodanie rate limitingu dla bulk endpoint (np. maksymalnie 10 żądań na minutę na użytkownika)
- Monitorować czas wykonania dla dużych batch updates
- Rozważyć użycie RPC function w bazie danych dla bulk update, jeśli wydajność stanie się problemem

## 9. Etapy wdrożenia

### Krok 1: Utworzenie schematów walidacji

1. Utworzenie pliku `src/lib/validation/update-user-work.schema.ts` z schematem `UpdateUserWorkCommandSchema`
   - Walidacja: co najmniej jeden z `status` lub `available_in_legimi` musi być podany
   - Walidacja `status`: enum z dozwolonymi wartościami
   - Walidacja `available_in_legimi`: boolean | null
2. Utworzenie pliku `src/lib/validation/update-user-works-bulk.schema.ts` z schematem `UpdateUserWorksBulkCommandSchema`
   - Walidacja `work_ids`: tablica UUID, min 1, max 100, deduplikacja
   - Walidacja: co najmniej jeden z `status` lub `available_in_legimi` musi być podany
   - Walidacja `status` i `available_in_legimi` (jak wyżej)
3. Sprawdzenie, czy istnieje `src/lib/validation/work-id.schema.ts` z `WorkIdParamSchema` - jeśli nie, utworzenie go

### Krok 2: Rozszerzenie WorksService

1. Dodanie metody `updateUserWork` w `WorksService`:
   - Parametry: `userId`, `workId`, `data: UpdateUserWorkCommand`
   - Weryfikacja, czy dzieło jest przypisane do użytkownika (sprawdzenie w `user_works`)
   - Aktualizacja rekordu w `user_works` z nowymi wartościami (tylko podane pola)
   - Pobranie zaktualizowanego rekordu wraz z danymi dzieła i primary edition
   - Zwrócenie `UserWorkItemDto` lub null (jeśli nie przypisane)
   - Obsługa błędów RLS i bazy danych
2. Dodanie metody `bulkUpdateUserWorks` w `WorksService`:
   - Parametry: `userId`, `workIds: string[]`, `data: UpdateUserWorkCommand`
   - Weryfikacja, które dzieła są przypisane do użytkownika (batch query)
   - Masowa aktualizacja rekordów w `user_works` dla przypisanych dzieł
   - Pobranie zaktualizowanych rekordów wraz z danymi dzieł i primary editions
   - Zwrócenie tablicy `UserWorkItemDto[]` (tylko zaktualizowane dzieła)
   - Obsługa błędów RLS i bazy danych

### Krok 3: Implementacja endpointu PATCH /api/user/works/{workId}

1. Utworzenie pliku `src/pages/api/user/works/[workId].ts`
2. Implementacja handlera `PATCH`:
   - Weryfikacja autoryzacji (Supabase Auth)
   - Walidacja path parameter `workId` (WorkIdParamSchema)
   - Parsowanie i walidacja request body (UpdateUserWorkCommandSchema)
   - Wywołanie `worksService.updateUserWork`
   - Obsługa błędów (400, 401, 404, 500)
   - Budowa odpowiedzi `UserWorkResponseDto`
   - Zwrócenie odpowiedzi 200 OK
3. Dodanie dokumentacji JSDoc dla endpointu
4. Dodanie `export const prerender = false`

### Krok 4: Implementacja endpointu POST /api/user/works/status-bulk

1. Utworzenie pliku `src/pages/api/user/works/status-bulk.ts`
2. Implementacja handlera `POST`:
   - Weryfikacja autoryzacji (Supabase Auth)
   - Parsowanie i walidacja request body (UpdateUserWorksBulkCommandSchema)
   - Wywołanie `worksService.bulkUpdateUserWorks`
   - Obsługa błędów (400, 401, 500)
   - Budowa odpowiedzi `UserWorksBulkUpdateResponseDto`
   - Zwrócenie odpowiedzi 200 OK
3. Dodanie dokumentacji JSDoc dla endpointu
4. Dodanie `export const prerender = false`

### Krok 5: Testowanie i walidacja

1. Testowanie endpointu PATCH:
   - Test sukcesu: aktualizacja statusu
   - Test sukcesu: aktualizacja available_in_legimi
   - Test sukcesu: aktualizacja obu pól
   - Test błędu 400: nieprawidłowy UUID
   - Test błędu 400: brak wymaganych pól w body
   - Test błędu 400: nieprawidłowy enum status
   - Test błędu 401: brak autoryzacji
   - Test błędu 404: dzieło nie przypisane do użytkownika
   - Test triggera: weryfikacja, że `status_updated_at` jest aktualizowane przy zmianie statusu
2. Testowanie endpointu POST bulk:
   - Test sukcesu: aktualizacja wielu dzieł
   - Test sukcesu: pominięcie nieprzypisanych dzieł (bez błędu 404)
   - Test błędu 400: pusta tablica work_ids
   - Test błędu 400: przekroczony limit 100 elementów
   - Test błędu 400: nieprawidłowe UUID w tablicy
   - Test błędu 401: brak autoryzacji
   - Test deduplikacji: usunięcie duplikatów z tablicy work_ids
   - Test triggera: weryfikacja, że `status_updated_at` jest aktualizowane dla wszystkich zaktualizowanych rekordów
3. Testowanie wydajności:
   - Test bulk update z maksymalną liczbą elementów (100)
   - Monitorowanie czasu wykonania

### Krok 6: Dokumentacja i czyszczenie

1. Aktualizacja dokumentacji API (jeśli istnieje)
2. Sprawdzenie, czy wszystkie typy są poprawnie eksportowane z `src/types.ts`
3. Sprawdzenie linter errors i ich naprawa
4. Weryfikacja zgodności z zasadami kodowania projektu
5. Code review i refaktoryzacja (jeśli potrzebna)
