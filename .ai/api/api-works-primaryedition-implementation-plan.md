# API Endpoint Implementation Plan: POST /api/works/{workId}/primary-edition

## 1. Przeglad punktu koncowego

Endpoint sluzy do ustawienia lub zmiany glownego wydania (primary edition) dla wskazanej pracy (work). Operacja aktualizuje `works.primary_edition_id` poprzez RPC `set_primary_edition` i zwraca zaktualizowany obiekt pracy wraz z podsumowaniem primary edition.

## 2. Szczegoly zapytania

- Metoda HTTP: `POST`
- Struktura URL: `/api/works/{workId}/primary-edition`
- Parametry:
  - Wymagane:
    - `workId` (path): UUID pracy
  - Opcjonalne: brak
- Request Body (JSON):
  - Wymagane:
    - `edition_id`: UUID wydania
- Naglowki:
  - `Content-Type: application/json`
  - Sesja uzytkownika (Supabase) z `locals.supabase`

## 3. Wykorzystywane typy

- DTO:
  - `WorkResponseDto`
  - `WorkWithPrimaryEditionDto`
  - `PrimaryEditionSummaryDto`
- Command Model:
  - `SetPrimaryEditionCommand`
- Dodatkowe:
  - Nowy schemat walidacji `WorkIdParamSchema` (analogicznie do `AuthorIdParamSchema`)
  - Nowy schemat walidacji `SetPrimaryEditionSchema` dla body

## 4. Szczegoly odpowiedzi

- `200 OK`: `WorkResponseDto` z aktualnym stanem pracy i primary edition
- `400 Bad Request`: bledny format UUID, nieprawidlowy JSON lub `edition_id` niezgodne z `workId`
- `401 Unauthorized`: brak aktywnej sesji
- `404 Not Found`: praca lub wydanie nie istnieje albo nie jest widoczne dla uzytkownika (RLS)
- `500 Internal Server Error`: nieoczekiwany blad serwera lub bazy danych

## 5. Przeplyw danych

1. Walidacja `workId` w parametrach sciezki (Zod, UUID).
2. Weryfikacja sesji uzytkownika przez `locals.supabase.auth.getUser()`.
3. Parsowanie JSON body z obsluga bledow skladni.
4. Walidacja body przez `SetPrimaryEditionSchema` (UUID).
5. Sprawdzenie dostepnosci pracy (RLS) przez `WorksService.findByIdWithPrimaryEdition` lub dedykowana metode `findById`.
6. Sprawdzenie dostepnosci wydania oraz zgodnosci `edition.work_id` z `workId` (nowa metoda w `WorksService` lub nowy `EditionsService`).
7. Wywolanie RPC `set_primary_edition` przez `WorksService.setPrimaryEdition(workId, edition_id)`.
8. Pobranie zaktualizowanej pracy z primary edition przez `WorksService.findByIdWithPrimaryEdition`.
9. Zwrocenie `WorkResponseDto` z kodem `200`.

## 6. Wzgledy bezpieczenstwa

- Wymagaj uwierzytelnienia (sesja Supabase); w przypadku braku zwroc `401`.
- RPC `set_primary_edition` dziala jako `SECURITY DEFINER`, dlatego przed wywolaniem nalezy zweryfikowac widocznosc pracy i wydania w kontekscie uzytkownika (RLS), aby uniknac nieautoryzowanej modyfikacji danych.
- Waliduj UUID-y wejsciowe i odrzuc nieprawidlowe dane (`400`).
- Upewnij sie, ze `edition_id` nalezy do wskazanego `workId`, w przeciwnym razie zwroc `400`.

## 7. Obsluga bledow

- `400`:
  - brak `workId` w path
  - niepoprawny UUID w path lub body
  - niepoprawny JSON
  - `edition_id` nie nalezy do `workId`
- `401`:
  - brak sesji lub blad w `auth.getUser()`
- `404`:
  - praca nie istnieje lub jest niewidoczna (RLS)
  - wydanie nie istnieje lub jest niewidoczne (RLS)
- `500`:
  - wyjatki z RPC lub zapytan DB niepasujace do powyzszych przypadkow
- Logowanie:
  - uzyj `logger.warn` dla bledow walidacji i `logger.error` dla bledow DB/nieoczekiwanych
  - brak tabeli bledow w schemacie DB; rejestrowanie odbywa sie przez `logger`

## 8. Wydajnosc

- Ogranicz liczbe zapytan: minimalnie 1 sprawdzenie pracy, 1 sprawdzenie wydania, 1 RPC, 1 odczyt pracy z primary edition.
- Uzywaj selekcji tylko potrzebnych kolumn w zapytaniach (`select` z lista pol).
- Unikaj dodatkowych pobran, gdy wczesna walidacja juz wykryje blad.

## 9. Kroki implementacji

1. Dodaj walidacje `workId` w `src/lib/validation/work-id.schema.ts` (Zod UUID).
2. Dodaj walidacje body w `src/lib/validation/set-primary-edition.schema.ts` (Zod z `edition_id`).
3. Rozszerz `WorksService` o metody pomocnicze do weryfikacji istnienia pracy i wydania z poszanowaniem RLS lub utworz `EditionsService`.
4. Utworz plik endpointu `src/pages/api/works/[workId]/primary-edition.ts` z `export const prerender = false` i handlerem `POST`.
5. W handlerze zastosuj guard clauses: walidacja path, auth, JSON, walidacja body, pre-check work/edition.
6. Wywolaj `WorksService.setPrimaryEdition` i obsluz wyjatki RPC (mapowanie na `400` lub `404`).
7. Pobierz zaktualizowana prace przez `WorksService.findByIdWithPrimaryEdition`, zwroc `200` z `WorkResponseDto`.
8. Dodaj logowanie sukcesu i bledow zgodnie z istniejacym wzorcem (`logger`).
