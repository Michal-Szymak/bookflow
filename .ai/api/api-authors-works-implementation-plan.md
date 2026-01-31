# API Endpoint Implementation Plan: GET /api/authors/{authorId}/works

## 1. Przeglad punktu koncowego
Endpoint zwraca stronicowana liste prac (works) powiazanych z autorem. Kazdy element zawiera podsumowanie primary edition oraz wyliczony `publish_year` jako `COALESCE(works.first_publish_year, editions.publish_year)`. Opcjonalny `forceRefresh` pozwala odswiezyc dane autora z OpenLibrary, jesli autor pochodzi z OL i jest to dozwolone.

## 2. Szczegoly zadania
- Metoda HTTP: GET
- Struktura URL: `/api/authors/{authorId}/works`
- Parametry:
  - Wymagane:
    - `authorId` (UUID w path)
  - Opcjonalne (query):
    - `page` (domyslnie 1, min 1)
    - `sort` (`published_desc` domyslnie, `title_asc`)
    - `forceRefresh` (boolean; dotyczy tylko autorow z `openlibrary_id`)
- Request Body: brak

## 3. Wykorzystywane typy
- DTO:
  - `AuthorWorksListResponseDto`
  - `WorkListItemDto`
  - `WorkWithPrimaryEditionDto`
  - `PrimaryEditionSummaryDto`
  - `PaginatedResponseDto<T>`
- Query/Command modele (dla GET):
  - `AuthorWorksListQueryDto`
- Typy encji pomocniczo:
  - `AuthorRow`, `WorkRow`, `EditionRow`

## 4. Szczegoly odpowiedzi
- `200 OK`: `{ items, page, total }`
  - `items`: lista `WorkListItemDto` z `primary_edition` (lub `null`) i `publish_year`
  - `page`: numer strony
  - `total`: liczba wszystkich wynikow dla autora

## 5. Przeplyw danych
1. Odczyt i walidacja `authorId` (path).
2. Odczyt i walidacja query (`page`, `sort`, `forceRefresh`), ustawienie domyslnych wartosci.
3. Uzycie `locals.supabase` (nie importowac klienta bezposrednio).
4. Sprawdzenie istnienia i dostepu do autora przez `AuthorsService.findById`:
   - brak dostepu / brak autora => 404.
5. Jesli `forceRefresh === true` i autor ma `openlibrary_id`:
   - pobranie danych z OpenLibrary przez `OpenLibraryService`;
   - aktualizacja cache w DB przez `AuthorsService.upsertAuthorFromOpenLibrary` (TTL 7 dni);
   - bledy OL logowane jako warning i kontynuacja z danymi cache.
6. Pobranie listy prac dla autora:
   - uzyc istniejacego `WorksService.findWorksByAuthorId(authorId, page, sort)`;
   - zapytanie przez `author_works` z dolaczeniem `works` i `primary_edition`;
   - paginacja przez `range`, z `count: "exact"`;
   - wyliczenie `publish_year`.
7. Zbudowanie odpowiedzi `AuthorWorksListResponseDto` i zwrot `200`.

## 6. Wzgledy bezpieczenstwa
- RLS: widocznosc rekordow kontrolowana przez `owner_user_id is null OR owner_user_id = auth.uid()`.
- Autoryzacja: korzystac z `locals.supabase`, aby RLS dzialal na sesji uzytkownika.
- `forceRefresh`:
  - wykonywac tylko dla autorow z `openlibrary_id`;
  - rozwazyc ograniczenie naduzyc (np. rate limit lub ignorowanie bez uprawnien).
- Walidacja danych wejsciowych (Zod) zapobiega param tampering.
- Ochrona przed enumeracja ID: brak ujawniania, czy autor istnieje poza RLS (404 zamiast 403).

## 7. Obsluga bledow
- `400`: nieprawidlowy `authorId` lub query (`page`, `sort`, `forceRefresh`).
- `401`: brak uprawnien, jesli endpoint zostanie zabezpieczony lub `forceRefresh` wymaga autoryzacji.
- `404`: autor nie istnieje lub jest niewidoczny przez RLS.
- `500`: bledy DB, nieoczekiwane wyjatki.
- Rejestrowanie:
  - Uzyc `logger` do `warn` (validation, forceRefresh) i `error` (DB).
  - Brak zdefiniowanej tabeli bledow w DB planie; jesli pojawi sie `error_logs`, dodac zapis w serwisie.

## 8. Rozwazania dotyczace wydajnosci
- Indeksy: `author_works(author_id)`, `works(title)`, `works(first_publish_year)`, `editions(work_id)`.
- Stronicowanie z limitem strony (np. 20) i `range` na zapytaniu.
- `count: "exact"` moze byc kosztowny; rozwazyc cache lub `estimated` przy duzej skali.
- `forceRefresh` powinien byc rzadki (cache TTL 7 dni); w razie potrzeby limitowac czestotliwosc.

## 9. Etapy wdrozenia
1. Zidentyfikowac lub dodac schematy Zod:
   - `AuthorIdParamSchema` dla `authorId`;
   - `AuthorWorksListQuerySchema` dla query.
2. Utworzyc/uzupelnic endpoint `src/pages/api/authors/[authorId]/works.ts`:
   - `export const prerender = false`;
   - walidacja parametrow i ustawienie domyslnych wartosci.
3. Zaimplementowac logike `forceRefresh`:
   - tylko dla autorow z `openlibrary_id`;
   - bledy OL nie przerywaja odpowiedzi (log warning).
4. Dodac/wykorzystac metode w `WorksService` do pobrania prac po autorze z paginacja i sortowaniem.
5. Zbudowac odpowiedz `AuthorWorksListResponseDto` z `publish_year` i `primary_edition`.
6. Dodac obsluge bledow zgodnie z kodami: 400, 401, 404, 500.
7. Upewnic sie, ze korzystamy z `locals.supabase` oraz RLS.
8. dopisac (w pliku .ai/api/api-authors-works-manual-tests.md) testy manualne dla:
   - poprawnych wynikow stronicowania i sortowania,
   - 400 dla blednych parametrow,
   - 404 dla niewidocznego autora,
   - zachowania `forceRefresh`.
