# API Endpoint Implementation Plan: POST /api/openlibrary/import/edition

## 1. Przegląd punktu końcowego
Endpoint importuje lub odświeża wydanie (edition) z OpenLibrary i wiąże je z istniejącym dziełem (`work_id`). Operacja korzysta z RPC `SECURITY DEFINER` do zapisu w globalnym katalogu (`manual = false`, `owner_user_id = null`) i aktualizuje metadane cache (`ol_fetched_at`, `ol_expires_at`) zgodnie ze specyfikacją. Odpowiedź zwraca `EditionResponseDto`.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`
- Struktura URL: `/api/openlibrary/import/edition`
- Autoryzacja: wymagana (session token)
- Parametry:
  - Wymagane:
    - `openlibrary_id` (string, short format, np. `OL123M`, max 25 znaków)
    - `work_id` (UUID)
  - Opcjonalne: brak
- Request Body:
  - `{ "openlibrary_id": string, "work_id": uuid }`
- Wykorzystywane typy:
  - `ImportEditionCommand` (command model) z `src/types.ts`
  - `ImportEditionCommandValidated` (typ inferowany z Zod)
- Walidacja:
  - Zod schema `ImportEditionSchema` w `src/lib/validation/import-edition.schema.ts`
  - Reguły: `openlibrary_id` nie może zaczynać się od `/books/` ani `/`, musi być przycięty i niepusty; `work_id` musi być poprawnym UUID.

## 3. Szczegóły odpowiedzi
- Sukces:
  - `200 OK` z `EditionResponseDto` (`{ edition: EditionDto }`)
  - Zwracamy `200` niezależnie od tego, czy rekord został utworzony czy tylko odświeżony (operacja idempotentna).
- Błędy (JSON z polami `error`, `message`, opcjonalnie `details`):
  - `400` – nieprawidłowy JSON lub błędne dane wejściowe
  - `401` – brak autoryzacji
  - `404` – brak dostępu do `work_id` lub wydanie nie istnieje w OpenLibrary
  - `500` – błąd wewnętrzny serwera
  - `502` – błąd po stronie OpenLibrary (timeout/5xx)

## 4. Przepływ danych
1. Uwierzytelnienie użytkownika przez `locals.supabase.auth.getUser()`; brak sesji → `401`.
2. Parsowanie JSON body, walidacja `ImportEditionSchema`; błędy → `400`.
3. Sprawdzenie istnienia i dostępności `work_id` (RLS) przez `WorksService.findById`; brak → `404`.
4. Sprawdzenie cache: wyszukanie wydania po `openlibrary_id` (nowa metoda serwisowa). Jeśli `ol_expires_at` jest w przyszłości, zwróć rekord z cache (`200`).
5. Pobranie danych z OpenLibrary przez nową metodę `OpenLibraryService.fetchEditionByOpenLibraryId` (endpoint `/books/{id}.json`) i mapowanie do `OpenLibraryEdition`.
6. Upsert wydania przez `WorksService.upsertEditionFromOpenLibrary` (RPC `upsert_edition_from_ol`) z `work_id` z requestu.
7. Ustawienie `ol_fetched_at` i `ol_expires_at` (np. TTL 7 dni, spójnie z importem autora) poprzez:
   - rozszerzenie RPC `upsert_edition_from_ol` o pola cache **lub**
   - dodatkowy update po upsercie.
8. Zwrócenie `EditionResponseDto` z rekordem z bazy.

## 5. Względy bezpieczeństwa
- Wymagana autoryzacja (jak w imporcie dzieła), aby ograniczyć operację do użytkownika mającego dostęp do wskazanego `work_id`.
- Wykorzystanie `locals.supabase` i RLS; brak dostępu do `work_id` zwraca `404` (bez ujawniania istnienia zasobu).
- Stosowanie RPC `SECURITY DEFINER` do zapisu w globalnym katalogu.
- Walidacja formatu `openlibrary_id` (short format) ogranicza ryzyko nadużyć i błędnych requestów.
- Logowanie błędów przez `logger` bez ujawniania wrażliwych danych w odpowiedziach.

## 6. Obsługa błędów
- `400` – invalid JSON; walidacja Zod; puste lub złe `openlibrary_id`; niepoprawny `work_id`.
- `401` – brak sesji użytkownika.
- `404` – `work_id` nie istnieje lub nie jest dostępne; OpenLibrary zwraca 404 dla wydania.
- `500` – błędy DB, RPC, lub niespodziewane wyjątki.
- `502` – timeout lub błąd sieci/5xx z OpenLibrary.
- Rejestrowanie błędów: brak osobnej tabeli błędów w schemacie; użyć `logger` z kontekstem (userId, workId, openlibrary_id).

## 7. Wydajność
- Cache po `openlibrary_id` z TTL (`ol_expires_at`) ogranicza liczbę wywołań OpenLibrary.
- RPC `upsert_edition_from_ol` jest idempotentny i minimalizuje liczbę round-tripów do DB.
- Indeksy unikalne na `openlibrary_id` i `isbn13` ograniczają duplikaty i przyspieszają lookup.
- Unikać pobierania zbędnych pól; zwracać tylko niezbędne dane w `EditionResponseDto`.

## 8. Kroki implementacji
1. Dodaj walidację: `src/lib/validation/import-edition.schema.ts` (wzorzec jak `import-work.schema.ts`) oraz typ `ImportEditionCommandValidated`.
2. Rozszerz `OpenLibraryService` o `fetchEditionByOpenLibraryId` oraz parser odpowiedzi `/books/{id}.json` do `OpenLibraryEdition`.
3. Dodaj metodę serwisową do wyszukiwania wydania po `openlibrary_id` (np. w `WorksService` lub nowym `EditionsService`), uwzględniając `ol_expires_at`.
4. Zweryfikuj schemat DB: jeśli `editions` nie ma `ol_fetched_at` i `ol_expires_at`, zaplanuj migrację oraz aktualizację `database.types.ts`.
5. Zaktualizuj RPC `upsert_edition_from_ol` tak, aby ustawiało `ol_fetched_at` i `ol_expires_at` zgodnie ze specyfikacją (lub dodaj osobny update po upsercie).
6. Utwórz endpoint `src/pages/api/openlibrary/import/edition.ts` zgodny z patternem z `import/author.ts` i `import/work.ts` (auth, walidacja, cache, OL fetch, upsert, response).
7. Dodaj spójne logowanie (`logger`) i jednolite komunikaty błędów/odpowiedzi JSON.
8. Uzupełnij dokumentację i testy manualne dla nowego endpointu. Opis testów manualnych w pliku .ai/openlibrary-import-edition-manual-tests.md
