# API Endpoint Implementation Plan: POST /api/user/works/bulk

## 1. Przegląd punktu końcowego

Endpoint `POST /api/user/works/bulk` służy do masowego przypisywania dzieł (works) do profilu zalogowanego użytkownika z możliwością ustawienia początkowego statusu. Endpoint tworzy relacje w tabeli `user_works` z automatycznym zwiększaniem licznika `work_count` w profilu użytkownika poprzez triggery bazy danych. Operacja deduplikuje istniejące przypisania i weryfikuje dostępność dzieł zgodnie z zasadami RLS (Row Level Security).

**Główne funkcjonalności:**

- Masowe przypisywanie wielu dzieł do profilu użytkownika w jednej operacji
- Automatyczna deduplikacja - pomija dzieła już przypisane do użytkownika
- Weryfikacja limitu użytkownika (maksymalnie 5000 dzieł na użytkownika)
- Weryfikacja dostępności dzieł zgodnie z RLS (tylko dzieła widoczne dla użytkownika)
- Ustawienie początkowego statusu dla nowo przypisanych dzieł (domyślnie "to_read")
- Zwracanie listy dodanych i pominiętych identyfikatorów dzieł

**Wykorzystywane zasoby bazy danych:**

- Tabela `user_works` (relacja użytkownik-dzieło, composite PK: user_id, work_id)
- Tabela `works` (katalog dzieł, weryfikacja istnienia i dostępności)
- Tabela `profiles` (licznik `work_count` i limit `max_works`, aktualizowane przez triggery)
- Trigger `user_works_increment_count` (automatyczne zwiększanie licznika dzieł)
- Trigger `user_works_status_updated_at` (aktualizacja `status_updated_at` przy zmianie statusu)
- Indeksy: `user_works(user_id, work_id)`, `user_works(user_id, status)`, `works(id)`

**Uwaga:** Endpoint nie tworzy nowych dzieł w bazie danych, tylko przypisuje istniejące dzieła do użytkownika. Dzieła muszą istnieć w katalogu globalnym (tabela `works`) i być dostępne dla użytkownika zgodnie z zasadami RLS.

## 2. Szczegóły żądania

**Metoda HTTP:** `POST`

**Struktura URL:** `/api/user/works/bulk`

**Nagłówki:**

- `Content-Type: application/json` (wymagany)
- `Authorization: Bearer <token>` (wymagany dla uwierzytelnionych użytkowników)

**Request Body:**

```typescript
{
  work_ids: string[];  // Wymagany: tablica UUID dzieł do przypisania (min 1 element, max 100)
  status?: "to_read" | "in_progress" | "read" | "hidden";  // Opcjonalny: początkowy status (domyślnie "to_read")
}
```

**Parametry:**

- **work_ids** (wymagany)
  - Typ: `string[]` (tablica UUID)
  - Walidacja:
    - Tablica nie może być pusta (minimum 1 element)
    - Każdy element musi być poprawnym UUID
    - Maksymalna liczba elementów powinna być ograniczona do 100 aby uniknąć przeciążenia
    - Duplikaty w tablicy powinny być zignorowane przed przetwarzaniem
- **status** (opcjonalny)
  - Typ: `"to_read" | "in_progress" | "read" | "hidden"`
  - Domyślna wartość: `"to_read"`
  - Walidacja: Musi być jednym z dozwolonych wartości enum `user_work_status_enum`

**Przykładowe żądanie:**

```json
{
  "work_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ],
  "status": "to_read"
}
```

## 3. Wykorzystywane typy

### Command Model (Request Body)

**BulkAttachUserWorksCommand** (zdefiniowany w `src/types.ts`):

```typescript
interface BulkAttachUserWorksCommand {
  work_ids: WorkRow["id"][];
  status?: UserWorkStatus;
}
```

**Schema walidacji** (do utworzenia w `src/lib/validation/user-works-bulk-attach.schema.ts`):

- Używa Zod do walidacji
- Weryfikuje format UUID dla każdego elementu w `work_ids`
- Weryfikuje, że tablica nie jest pusta
- Weryfikuje, że tablica nie przekracza maksymalnego rozmiaru (100 elementów)
- Weryfikuje enum statusu (jeśli podany)

### Response DTO

**BulkAttachUserWorksResponseDto** (zdefiniowany w `src/types.ts`):

```typescript
interface BulkAttachUserWorksResponseDto {
  added: WorkRow["id"][]; // Lista UUID dzieł, które zostały pomyślnie dodane
  skipped: WorkRow["id"][]; // Lista UUID dzieł, które zostały pominięte (już istniały lub nie są dostępne)
}
```

## 4. Szczegóły odpowiedzi

### Sukces (201 Created)

**Status Code:** `201`

**Response Body:**

```json
{
  "added": ["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001"],
  "skipped": ["550e8400-e29b-41d4-a716-446655440002"]
}
```

**Nagłówki:**

- `Content-Type: application/json`

**Uwagi:**

- `added` zawiera wszystkie dzieła, które zostały pomyślnie dodane do profilu użytkownika
- `skipped` zawiera dzieła, które zostały pominięte z powodu:
  - Dzieło jest już przypisane do użytkownika (duplikat)
  - Dzieło nie istnieje w bazie danych
  - Dzieło nie jest dostępne dla użytkownika (RLS policy)

### Błędy walidacji (400 Bad Request)

**Status Code:** `400`

**Response Body:**

```json
{
  "error": "Validation error",
  "message": "work_ids must contain at least 1 element",
  "details": [
    {
      "path": ["work_ids"],
      "message": "work_ids must contain at least 1 element"
    }
  ]
}
```

**Scenariusze:**

- Pusta tablica `work_ids`
- Nieprawidłowy format UUID w `work_ids`
- Nieprawidłowa wartość enum dla `status`
- Przekroczony maksymalny rozmiar tablicy `work_ids`
- Nieprawidłowy format JSON w body

### Brak autoryzacji (401 Unauthorized)

**Status Code:** `401`

**Response Body:**

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**Scenariusz:** Użytkownik nie jest zalogowany lub token autoryzacyjny jest nieprawidłowy.

### Przekroczony limit (409 Conflict)

**Status Code:** `409`

**Response Body:**

```json
{
  "error": "Conflict",
  "message": "Work limit reached (5000 works per user)"
}
```

**Scenariusz:** Próba dodania dzieł spowodowałaby przekroczenie limitu `max_works` (domyślnie 5000) dla użytkownika.

**Uwaga:** Limit jest sprawdzany przed wstawieniem, ale może również być wykryty przez trigger bazy danych podczas wstawiania. Oba scenariusze powinny być obsłużone.

### Błąd serwera (500 Internal Server Error)

**Status Code:** `500`

**Response Body:**

```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

**Scenariusz:** Wystąpił nieoczekiwany błąd bazy danych lub inny błąd po stronie serwera.

## 5. Przepływ danych

### Krok 1: Weryfikacja autoryzacji

1. Pobierz użytkownika z kontekstu Supabase (`locals.supabase.auth.getUser()`)
2. Jeśli użytkownik nie istnieje lub wystąpił błąd autoryzacji, zwróć `401 Unauthorized`

### Krok 2: Parsowanie i walidacja request body

1. Parsuj JSON z request body
2. Jeśli parsowanie się nie powiedzie, zwróć `400 Bad Request` z komunikatem o nieprawidłowym formacie JSON
3. Waliduj dane za pomocą schematu Zod (`BulkAttachUserWorksCommandSchema`)
4. Jeśli walidacja się nie powiedzie, zwróć `400 Bad Request` z szczegółami błędów walidacji
5. Usuń duplikaty z tablicy `work_ids` (przed dalszym przetwarzaniem)

### Krok 3: Sprawdzenie limitu użytkownika

1. Użyj `WorksService.checkUserWorkLimit(userId)` do pobrania aktualnego `work_count` i `max_works`
2. Oblicz, ile nowych dzieł można dodać: `availableSlots = max_works - work_count`
3. Jeśli `availableSlots <= 0`, zwróć `409 Conflict` z komunikatem o przekroczonym limicie
4. Jeśli liczba unikalnych `work_ids` przekracza `availableSlots`, zwróć `409 Conflict`

### Krok 4: Weryfikacja istnienia i dostępności dzieł

1. Użyj `WorksService.verifyWorksExist(work_ids)` do weryfikacji, które dzieła istnieją i są dostępne (RLS)
2. Metoda powinna wykonać batch query do tabeli `works` z filtrem `IN (work_ids)`
3. RLS automatycznie odfiltruje dzieła niedostępne dla użytkownika
4. Zwróć listę dostępnych dzieł i listę niedostępnych/nienależących dzieł

### Krok 5: Sprawdzenie duplikatów (już przypisane dzieła)

1. Wykonaj query do tabeli `user_works` z filtrem `user_id = userId AND work_id IN (available_work_ids)`
2. Zwróć listę już przypisanych dzieł (duplikaty) i listę nowych dzieł do dodania

### Krok 6: Weryfikacja limitu po deduplikacji

1. Oblicz liczbę nowych dzieł do dodania: `newWorksCount = available_work_ids.length - duplicate_work_ids.length`
2. Jeśli `work_count + newWorksCount > max_works`, zwróć `409 Conflict`
3. Uwaga: Ta weryfikacja jest dodatkową warstwą bezpieczeństwa, ale trigger bazy danych również powinien to sprawdzić

### Krok 7: Wstawienie nowych relacji

1. Przygotuj dane do wstawienia dla każdego nowego dzieła:
   ```typescript
   {
     user_id: userId,
     work_id: workId,
     status: status || "to_read",
     available_in_legimi: null  // Domyślnie null (nieoznaczone)
   }
   ```
2. Wykonaj batch insert do tabeli `user_works` używając `supabase.from("user_works").insert(records)`
3. Trigger automatycznie zwiększy `work_count` w profilu użytkownika
4. Trigger automatycznie ustawi `status_updated_at` jeśli status jest inny niż domyślny

### Krok 8: Obsługa błędów wstawiania

1. Jeśli wystąpi błąd unique constraint violation (kod `23505`), oznacza to race condition - dzieło zostało dodane między sprawdzeniem a wstawieniem
2. W takim przypadku traktuj to dzieło jako pominięte (duplikat)
3. Jeśli wystąpi błąd trigger (limit przekroczony), zwróć `409 Conflict`
4. Jeśli wystąpi błąd RLS (kod `42501`), zwróć `403 Forbidden`
5. W przypadku innych błędów bazy danych, zwróć `500 Internal Server Error`

### Krok 9: Przygotowanie odpowiedzi

1. Zbierz listę `added` - dzieła, które zostały pomyślnie wstawione
2. Zbierz listę `skipped` - dzieła pominięte z powodu:
   - Duplikaty (już przypisane)
   - Nie istnieją lub nie są dostępne (RLS)
   - Race condition podczas wstawiania
3. Zwróć odpowiedź `201 Created` z obiektem `BulkAttachUserWorksResponseDto`

## 6. Względy bezpieczeństwa

### Uwierzytelnianie

- Endpoint wymaga zalogowanego użytkownika
- Użyj `locals.supabase.auth.getUser()` do weryfikacji sesji
- Zwróć `401 Unauthorized` jeśli użytkownik nie jest zalogowany

### Autoryzacja (RLS)

- Tabela `user_works` ma RLS policy: `user_id = auth.uid()`
- Użytkownik może przypisywać tylko do swojego własnego profilu
- Tabela `works` ma RLS policy: `owner_user_id IS NULL OR owner_user_id = auth.uid()`
- Użytkownik może przypisywać tylko dzieła z katalogu globalnego lub własne dzieła manualne
- Supabase automatycznie filtruje wyniki zgodnie z RLS, więc nie trzeba dodatkowo weryfikować uprawnień

### Walidacja danych wejściowych

- Wszystkie UUID w `work_ids` muszą być poprawnie sformatowane
- Tablica `work_ids` nie może być pusta
- Tablica `work_ids` powinna mieć rozsądny limit (np. maksymalnie 500 elementów) aby uniknąć przeciążenia
- Status musi być jednym z dozwolonych wartości enum
- Usuń duplikaty z tablicy przed przetwarzaniem

### Ochrona przed nadużyciami

- Limit użytkownika (5000 dzieł) jest egzekwowany zarówno w kodzie, jak i przez trigger bazy danych
- Maksymalny rozmiar tablicy `work_ids` ogranicza możliwość przeciążenia systemu
- Wszystkie operacje są logowane dla audytu

### Bezpieczeństwo danych

- Nie ujawniaj szczegółów błędów bazy danych użytkownikowi (tylko ogólne komunikaty)
- Loguj szczegółowe informacje o błędach na serwerze dla debugowania
- Nie zwracaj informacji o dziełach niedostępnych dla użytkownika (traktuj je jako "skipped")

## 7. Obsługa błędów

### Błędy walidacji (400 Bad Request)

**Scenariusz 1: Pusta tablica work_ids**

- **Warunek:** `work_ids.length === 0`
- **Odpowiedź:** `400` z komunikatem "work_ids must contain at least 1 element"
- **Logowanie:** `warn` z informacją o pustej tablicy

**Scenariusz 2: Nieprawidłowy format UUID**

- **Warunek:** Jeden z elementów w `work_ids` nie jest poprawnym UUID
- **Odpowiedź:** `400` z komunikatem walidacji Zod wskazującym nieprawidłowe UUID
- **Logowanie:** `warn` z informacją o nieprawidłowych UUID

**Scenariusz 3: Nieprawidłowa wartość status**

- **Warunek:** `status` nie jest jednym z dozwolonych wartości enum
- **Odpowiedź:** `400` z komunikatem walidacji Zod
- **Logowanie:** `warn` z informacją o nieprawidłowym statusie

**Scenariusz 4: Przekroczony maksymalny rozmiar tablicy**

- **Warunek:** `work_ids.length > MAX_BATCH_SIZE` (100)
- **Odpowiedź:** `400` z komunikatem "work_ids array exceeds maximum size"
- **Logowanie:** `warn` z informacją o przekroczonym limicie

**Scenariusz 5: Nieprawidłowy format JSON**

- **Warunek:** Nie można sparsować request body jako JSON
- **Odpowiedź:** `400` z komunikatem "Invalid JSON in request body"
- **Logowanie:** `warn` z informacją o błędzie parsowania

### Błędy autoryzacji (401 Unauthorized)

**Scenariusz: Użytkownik nie jest zalogowany**

- **Warunek:** `authError !== null || user === null`
- **Odpowiedź:** `401` z komunikatem "Authentication required"
- **Logowanie:** `warn` z informacją o nieudanej autoryzacji

### Błędy limitu (409 Conflict)

**Scenariusz 1: Limit przekroczony przed wstawieniem**

- **Warunek:** `work_count >= max_works` lub `work_count + newWorksCount > max_works`
- **Odpowiedź:** `409` z komunikatem "Work limit reached (5000 works per user)"
- **Logowanie:** `warn` z informacją o przekroczonym limicie

**Scenariusz 2: Limit przekroczony przez trigger**

- **Warunek:** Błąd bazy danych podczas insert zawiera komunikat o limicie
- **Odpowiedź:** `409` z komunikatem "Work limit reached (5000 works per user)"
- **Logowanie:** `warn` z informacją o błędzie triggera

### Błędy autoryzacji RLS (403 Forbidden)

**Scenariusz: Naruszenie RLS policy**

- **Warunek:** Błąd bazy danych z kodem `42501` (insufficient privileges)
- **Odpowiedź:** `403` z komunikatem "Cannot attach works: insufficient permissions"
- **Logowanie:** `warn` z informacją o naruszeniu RLS

### Błędy serwera (500 Internal Server Error)

**Scenariusz 1: Błąd podczas sprawdzania limitu**

- **Warunek:** `WorksService.checkUserWorkLimit()` rzuca wyjątek
- **Odpowiedź:** `500` z ogólnym komunikatem błędu
- **Logowanie:** `error` z pełnym stack trace

**Scenariusz 2: Błąd podczas weryfikacji dzieł**

- **Warunek:** `WorksService.verifyWorksExist()` rzuca wyjątek
- **Odpowiedź:** `500` z ogólnym komunikatem błędu
- **Logowanie:** `error` z pełnym stack trace

**Scenariusz 3: Błąd podczas sprawdzania duplikatów**

- **Warunek:** Query do `user_works` rzuca wyjątek
- **Odpowiedź:** `500` z ogólnym komunikatem błędu
- **Logowanie:** `error` z pełnym stack trace

**Scenariusz 4: Błąd podczas wstawiania**

- **Warunek:** Insert do `user_works` rzuca nieoczekiwany błąd (nie unique constraint, nie limit, nie RLS)
- **Odpowiedź:** `500` z ogólnym komunikatem błędu
- **Logowanie:** `error` z pełnym stack trace i szczegółami błędu bazy danych

**Scenariusz 5: Nieoczekiwany błąd**

- **Warunek:** Wystąpił wyjątek poza obsługą błędów
- **Odpowiedź:** `500` z ogólnym komunikatem błędu
- **Logowanie:** `error` z pełnym stack trace

### Obsługa race conditions

**Scenariusz: Duplikat wykryty podczas wstawiania**

- **Warunek:** Unique constraint violation (kod `23505`) podczas insert
- **Akcja:** Traktuj to dzieło jako pominięte (duplikat) i kontynuuj z pozostałymi dziełami
- **Logowanie:** `warn` z informacją o race condition

## 8. Rozważania dotyczące wydajności

### Optymalizacja zapytań

1. **Batch verification works:**
   - Użyj jednego zapytania `SELECT id FROM works WHERE id IN (work_ids)` zamiast wielu pojedynczych zapytań
   - RLS automatycznie odfiltruje niedostępne dzieła
   - Zapytanie powinno używać indeksu `works(id)` (primary key)

2. **Batch check duplicates:**
   - Użyj jednego zapytania `SELECT work_id FROM user_works WHERE user_id = $1 AND work_id IN (work_ids)` zamiast wielu pojedynczych zapytań
   - Zapytanie powinno używać indeksu `user_works(user_id, work_id)` (composite primary key)

3. **Batch insert:**
   - Użyj jednego zapytania `INSERT INTO user_works (...) VALUES (...), (...), ...` zamiast wielu pojedynczych insertów
   - Supabase automatycznie obsługuje batch inserts przez `.insert(array)`

4. **Deduplikacja przed przetwarzaniem:**
   - Usuń duplikaty z tablicy `work_ids` przed wykonaniem jakichkolwiek zapytań do bazy danych
   - Zmniejszy to liczbę przetwarzanych elementów i poprawi wydajność

### Potencjalne wąskie gardła

1. **Duża liczba work_ids:**
   - Jeśli użytkownik próbuje dodać bardzo dużo dzieł naraz, operacja może zająć więcej czasu
   - W przypadku większych operacji, rozważ podział na mniejsze batch'e

2. **Blokowanie transakcji:**
   - Batch insert może blokować wiersze podczas wstawiania
   - W przypadku bardzo dużej liczby rekordów może to wpłynąć na wydajność
   - Trigger aktualizujący licznik może dodać niewielkie opóźnienie

3. **Aktualizacja liczników:**
   - Trigger `user_works_increment_count` aktualizuje `work_count` w profilu użytkownika
   - W przypadku batch insert, trigger jest wywoływany dla każdego wiersza
   - Może to spowodować wiele aktualizacji tego samego wiersza w `profiles`
   - Rozważ optymalizację triggera lub użycie `ON CONFLICT` w triggerze

### Strategie optymalizacji

1. **Limit rozmiaru batch:**
   - Ogranicz maksymalny rozmiar tablicy `work_ids` (100 elementów)
   - Jeśli użytkownik potrzebuje dodać więcej, może wykonać wiele żądań

2. **Efektywne zapytania:**
   - Użyj batch queries zamiast wielu pojedynczych zapytań
   - Wykorzystaj indeksy bazy danych dla szybkiego wyszukiwania

3. **Cache limitu użytkownika:**
   - Rozważ cache'owanie `work_count` w pamięci (z krótkim TTL)
   - Zmniejszy to liczbę zapytań do bazy danych
   - Uwaga: Cache może być nieaktualny w przypadku równoległych żądań

## 9. Etapy wdrożenia

### Krok 1: Utworzenie schematu walidacji Zod

1. Utwórz plik `src/lib/validation/user-works-bulk-attach.schema.ts`
2. Zdefiniuj schemat `BulkAttachUserWorksCommandSchema` używając Zod:
   - `work_ids`: tablica UUID (min 1 element, max 100 elementów)
   - `status`: opcjonalny enum z wartościami `"to_read" | "in_progress" | "read" | "hidden"`
3. Dodaj deduplikację UUID w schemacie (użyj `.transform()` do usunięcia duplikatów)
4. Eksportuj typ `BulkAttachUserWorksCommandValidated` z inferencji Zod

### Krok 2: Rozszerzenie WorksService o metody bulk

1. Otwórz plik `src/lib/services/works.service.ts`
2. Dodaj metodę `verifyWorksExist(workIds: string[]): Promise<string[]>`:
   - Wykonuje batch query do tabeli `works` z filtrem `IN (workIds)`
   - Zwraca listę dostępnych work IDs (przefiltrowane przez RLS)
   - Zwraca pustą tablicę, jeśli wszystkie są dostępne
   - Rzuca wyjątek w przypadku błędu bazy danych
3. Dodaj metodę `findExistingUserWorks(userId: string, workIds: string[]): Promise<string[]>`:
   - Wykonuje batch query do tabeli `user_works` z filtrem `user_id = userId AND work_id IN (workIds)`
   - Zwraca listę work IDs, które już są przypisane do użytkownika
   - Zwraca pustą tablicę, jeśli żadne nie są przypisane
   - Rzuca wyjątek w przypadku błędu bazy danych
4. Dodaj metodę `bulkAttachUserWorks(userId: string, workIds: string[], status: UserWorkStatus): Promise<{ added: string[]; skipped: string[] }>`:
   - Wykonuje pełną logikę bulk attach (weryfikacja limitu, deduplikacja, wstawianie)
   - Zwraca obiekt z listami `added` i `skipped`
   - Rzuca wyjątki z odpowiednimi komunikatami dla różnych scenariuszy błędów
   - Używa istniejącej metody `checkUserWorkLimit()` do weryfikacji limitu

### Krok 3: Utworzenie endpointu API

1. Utwórz plik `src/pages/api/user/works/bulk.ts`
2. Dodaj `export const prerender = false;`
3. Zaimplementuj handler `POST`:
   - Krok 1: Weryfikacja autoryzacji użytkownika
   - Krok 2: Parsowanie i walidacja request body używając schematu Zod
   - Krok 3: Inicjalizacja `WorksService` z `locals.supabase`
   - Krok 4: Wywołanie `bulkAttachUserWorks()` z walidowanymi danymi
   - Krok 5: Obsługa błędów i zwracanie odpowiednich kodów statusu
   - Krok 6: Zwrócenie odpowiedzi `201 Created` z `BulkAttachUserWorksResponseDto`
4. Dodaj obsługę błędów dla wszystkich scenariuszy (400, 401, 403, 409, 500)
5. Dodaj logowanie używając `logger` z `@/lib/logger`:
   - `warn` dla błędów walidacji, autoryzacji, limitów
   - `error` dla błędów serwera z pełnym stack trace

### Krok 4: Testy manualne

**Plik:** `.ai/api/api-user-works-post-manual-tests.md`

1. **Testy jednostkowe (opcjonalne, ale zalecane):**
   - Test schematu walidacji Zod (prawidłowe i nieprawidłowe dane)
   - Test metod `WorksService` (mock Supabase client)
   - Test handlera API (mock request i locals)
   - Weryfikacja przypisania dzieł do użytkownika
   - Weryfikacja deduplikacji (próba dodania już istniejących dzieł)
   - Weryfikacja limitu (próba przekroczenia 5000 dzieł)
   - Weryfikacja RLS (próba dodania niedostępnych dzieł)
   - Weryfikacja odpowiedzi (struktura `added` i `skipped`)

### Krok 5: Dokumentacja i code review

1. Dodaj komentarze JSDoc do wszystkich metod i funkcji
2. Zweryfikuj zgodność z zasadami kodowania projektu
3. Upewnij się, że wszystkie błędy są odpowiednio logowane
4. Sprawdź, że wszystkie kody statusu HTTP są prawidłowe
5. Zweryfikuj, że endpoint jest zgodny z ogólnym planem API (`api-plan.md`)
