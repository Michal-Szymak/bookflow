# API Endpoint Implementation Plan: GET /api/works/{workId}

## 1. Przeglad punktu koncowego
Endpoint zwraca szczegoly pojedynczego work wraz z podsumowaniem primary edition. Zwraca `404`, gdy work nie istnieje lub nie jest widoczny (RLS).

## 2. Szczegoly zadania
- Metoda HTTP: GET
- Struktura URL: `/api/works/{workId}`
- Parametry:
  - Wymagane: `workId` (UUID v4)
  - Opcjonalne: brak
- Request Body: brak
- Walidacja wejscia:
  - Zod: `WorkIdParamSchema` z `src/lib/validation/work-id.schema.ts`
  - Odrzucenie brakujacego lub niepoprawnego `workId` z kodem `400`

## 3. Szczegoly odpowiedzi
- 200 OK: `WorkResponseDto` z `src/types.ts`
  - `work: WorkWithPrimaryEditionDto`
  - `primary_edition: PrimaryEditionSummaryDto | null`
- 404 Not Found: work nie istnieje lub niewidoczny (RLS)
- 400 Bad Request: bledny `workId`
- 401 Unauthorized: brak uprawnien, jesli endpoint wymaga autoryzacji na poziomie middleware
- 500 Internal Server Error: blad bazy lub nieoczekiwany blad serwera

## 4. Przeplyw danych
1. Handler `GET` w `src/pages/api/works/[workId]/index.ts` (Astro API Route, `export const prerender = false`).
2. Walidacja `workId` przez `WorkIdParamSchema`.
3. Inicjalizacja `supabase` z `context.locals` i `WorksService`.
4. Wywolanie `worksService.findByIdWithPrimaryEdition(workId)` (RLS filtruje dostep).
5. Jezeli brak rekordu: zwroc `404`.
6. Sukces: mapowanie do `WorkResponseDto` i zwrot `200`.
7. Logowanie ostrzezen/bladow przez `logger`.

## 5. Wzgledy bezpieczenstwa
- Korzystaj z `locals.supabase` (kontekst uzytkownika, RLS).
- Nie ujawniaj istnienia prywatnych rekordow: uzyj `404` dla "not visible".
- Jezeli polityki wymagaja autoryzacji, sprawdz stan sesji i zwroc `401`.
- Walidacja UUID zapobiega nieprawidlowym zapytaniom i logowaniu bledow.

## 6. Obsluga bledow
- 400: brak `workId` lub niepoprawny UUID (Zod).
- 401: wymagane logowanie, brak sesji.
- 404: brak rekordu lub odfiltrowany przez RLS.
- 500: blad Supabase (np. bledna odpowiedz z DB) lub nieoczekiwany exception.
- Logowanie:
  - `logger.warn` dla walidacji i 404
  - `logger.error` dla bledow DB
  - Brak dedykowanej tabeli bledow w DB planie, wiec logowanie tylko przez logger

## 7. Wydajnosc
- Jedno zapytanie po work + jedno zapytanie po primary edition (minimalny zakres pol).
- Wykorzystanie indeksow PK (`works.id`, `editions.id`).
- Brak pagination; odpowiedz ograniczona do pojedynczego rekordu.
- Ewentualnie rozważyć optymalizacje (jedno zapytanie z join) jesli potrzebne.

## 8. Kroki implementacji
1. Utworz plik endpointu `src/pages/api/works/[workId]/index.ts` (jesli nie istnieje) z `export const prerender = false`.
2. Zaimplementuj handler `GET` zgodnie ze stylem innych endpointow (np. walidacja, logger, Response z JSON).
3. Dodaj walidacje sciezki przez `WorkIdParamSchema`.
4. Zainicjalizuj `WorksService` z `locals.supabase`.
5. Wywolaj `findByIdWithPrimaryEdition` i obsluz `null` jako `404`.
6. Zwracaj `WorkResponseDto` z `200` przy sukcesie.
7. Upewnij sie, ze bledy DB zwracaja `500` i sa logowane.
8. Przygotuj listę testów manualnych i zapisz w pliku .ai/api/api-works-get-manual-tests.md
