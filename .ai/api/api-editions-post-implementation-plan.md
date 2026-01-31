# API Endpoint Implementation Plan: POST /api/editions

## 1. Przegląd punktu końcowego

Endpoint służy do tworzenia manualnej edycji (edition) przypisanej do istniejącego dzieła (work). Wymaga uwierzytelnienia użytkownika i zapisu rekordu w tabeli `editions` z `manual=true`, `owner_user_id` ustawionym na użytkownika oraz bez `openlibrary_id`.

## 2. Szczegóły żądania

- Metoda HTTP: `POST`
- Struktura URL: `/api/editions`
- Parametry:
  - Wymagane (body):
    - `work_id`: UUID dzieła, do którego przypisana będzie edycja
    - `title`: string, nazwa edycji
    - `manual`: `true`
  - Opcjonalne (body):
    - `publish_year`: smallint (np. 1500–2100)
    - `publish_date`: date (ISO `YYYY-MM-DD`)
    - `publish_date_raw`: string
    - `isbn13`: string (13 cyfr)
    - `cover_url`: string (URL)
    - `language`: string (np. kod języka)
- Request Body:
  ```json
  {
    "work_id": "uuid",
    "title": "string",
    "manual": true,
    "publish_year": 2001,
    "publish_date": "2001-01-01",
    "publish_date_raw": "January 2001",
    "isbn13": "9781234567890",
    "cover_url": "https://...",
    "language": "en"
  }
  ```
- Powiązane typy:
  - `CreateEditionCommand` (request body)
  - `EditionResponseDto` (response)

## 3. Szczegóły odpowiedzi

- `201 Created`:
  - Body: `{ "edition": EditionDto }`
  - Nagłówek `Location: /api/editions/{editionId}` (spójnie z innymi endpointami)
- `400 Bad Request`:
  - Niepoprawne dane wejściowe, nieprawidłowy JSON, błędny format pól (np. data, isbn13)
- `401 Unauthorized`:
  - Brak aktywnej sesji użytkownika
- `404 Not Found`:
  - `work_id` nie istnieje lub nie jest dostępny (RLS)
- `409 Conflict`:
  - Konflikt unikalności `isbn13` lub naruszenie ograniczeń logicznych
- `500 Internal Server Error`:
  - Nieoczekiwany błąd po stronie serwera

## 4. Przepływ danych

1. Endpoint (`src/pages/api/editions/index.ts`) pobiera `supabase` z `locals`.
2. Weryfikacja sesji użytkownika (`supabase.auth.getUser()`).
3. Parsowanie JSON body i walidacja Zod (`CreateEditionSchema`).
4. Weryfikacja istnienia `work_id` (np. `WorksService.findById`, respektuje RLS).
5. (Opcjonalnie) pre-check `isbn13` jeśli podano, by zwrócić czytelny `409` przed insertem.
6. Utworzenie manualnej edycji w nowym serwisie `EditionsService` lub rozszerzonym `WorksService`.
7. Zwrócenie `EditionResponseDto` z kodem `201`.

## 5. Względy bezpieczeństwa

- Wymagana autoryzacja: brak sesji → `401`.
- RLS: dostęp do `works` i `editions` realizowany przez Supabase; `work_id` niewidoczny dla użytkownika → `404`.
- Walidacja wejścia Zod: wymuszenie `manual: true`, poprawnych typów i formatów.
- Ochrona przed podszywaniem się: `owner_user_id` ustawiany wyłącznie po stronie serwera na `user.id`.
- Sanitizacja danych: `title` trimowany; blokada pustych wartości po trimie.

## 6. Obsługa błędów

- `400`: nieprawidłowy JSON, błędy walidacji, niepoprawne pola (np. `publish_date`, `isbn13`, `cover_url`).
- `401`: brak `user` lub błąd `auth`.
- `404`: brak dostępu do `work_id` (RLS) lub rekord nie istnieje.
- `409`: naruszenie unikalności `isbn13` (kod `23505`) lub ograniczeń `editions_manual_owner` / `editions_manual_or_ol` (kod `23514`).
- `500`: błędy bazy lub nieoczekiwane wyjątki.
- Logowanie: użycie `logger.warn/error` analogicznie do `POST /api/authors` i `POST /api/works`. Brak dedykowanej tabeli błędów → logowanie aplikacyjne.

## 7. Wydajność

- Minimalizacja zapytań:
  - Jedno zapytanie sprawdzające `work_id`.
  - Jedno zapytanie insertujące edycję.
  - Opcjonalny pre-check `isbn13` tylko gdy pole podane.
- Stosowanie `select("id")` w walidacjach zamiast pełnych rekordów.
- Unikanie dodatkowych fetchy po insercie: użycie `.select().single()` w insert, tak jak w istniejących serwisach.

## 8. Kroki implementacji

1. Dodaj nowy schemat Zod `CreateEditionSchema` w `src/lib/validation/create-edition.schema.ts` (pattern jak `CreateWorkSchema`).
2. Utwórz/rozszerz serwis:
   - Opcja A: nowy `src/lib/services/editions.service.ts` z metodą `createManualEdition`.
   - Opcja B: metoda `createManualEdition` w `WorksService` (zachowując spójność importów).
3. W serwisie:
   - Trimuj `title`, ustaw `manual=true`, `owner_user_id=userId`, `openlibrary_id=null`.
   - Obsłuż błędy DB (`23505`, `23514`, `42501`) i mapuj na komunikaty domenowe.
4. Dodaj endpoint `src/pages/api/editions/index.ts`:
   - `export const prerender = false`.
   - Autoryzacja (`supabase.auth.getUser()`).
   - Parsowanie JSON + Zod validation.
   - Sprawdzenie `work_id` przez `WorksService.findById`.
   - Opcjonalny pre-check `isbn13`.
   - Wywołanie serwisu i zwrot `EditionResponseDto` z `201` + `Location`.
5. Dodaj testy manualne (w analogii do istniejących plików `.ai/*-manual-tests.md`):
   - poprawne utworzenie,
   - brak sesji,
   - nieprawidłowe dane,
   - `work_id` nieistniejący,
   - konflikt `isbn13`.
6. Upewnij się, że logowanie i komunikaty błędów są spójne z `POST /api/authors` i `POST /api/works`.
