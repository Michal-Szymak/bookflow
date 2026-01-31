# API Endpoint Implementation Plan: GET /api/works/{workId}/editions

## 1. Przegląd punktu końcowego
Celem endpointu jest zwrócenie listy wydań (editions) dla wskazanego worka, posortowanych malejąco po `publish_year`. Endpoint zwraca dane w formacie `EditionsListResponseDto` i korzysta z Supabase oraz RLS do kontroli dostępu.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`
- Struktura URL: `/api/works/{workId}/editions`
- Parametry:
  - Wymagane: `workId` (UUID, path param)
  - Opcjonalne: brak
- Request Body: brak
- Walidacja:
  - `WorkIdParamSchema` (UUID v4) z `src/lib/validation/work-id.schema.ts`
  - Guard clause dla braku `workId` w `params`
- Wykorzystywane typy:
  - DTO: `EditionsListResponseDto`, `EditionDto`
  - Command modele: brak (endpoint tylko do odczytu)

## 3. Szczegóły odpowiedzi
- `200 OK`: `{ items: EditionDto[] }` posortowane `publish_year desc`
- `400 Bad Request`: nieprawidłowy `workId` (błąd walidacji)
- `404 Not Found`: work nie istnieje lub nie jest dostępny (RLS)
- `500 Internal Server Error`: błąd bazy danych lub nieoczekiwany błąd serwera

## 4. Przepływ danych
1. Odczytaj `workId` z `params`.
2. Zweryfikuj `workId` przez `WorkIdParamSchema`; przy błędzie zwróć `400`.
3. Zainicjalizuj `supabase` z `locals` (zgodnie z zasadami backend).
4. Sprawdź istnienie i dostępność worka (np. `WorksService.findById(workId)`).
5. Jeśli work nie istnieje lub RLS go ukrywa → `404`.
6. Pobierz listę wydań z tabeli `editions` (nowa metoda w `EditionsService` lub `WorksService`):
   - Filtr: `work_id = workId`
   - Sortowanie: `publish_year desc` (z opcją `nullsLast`)
   - Zwróć pola zgodne z `EditionDto`
7. Zwróć `200` z `{ items }`.

## 5. Względy bezpieczeństwa
- Używaj `locals.supabase` (zgodnie z zasadami backend) i polegaj na RLS.
- Nie ujawniaj danych spoza zakresu `EditionDto`.
- Waliduj `workId` (UUID) przed zapytaniem do bazy.
- Loguj tylko niezbędne metadane (bez danych wrażliwych).

## 6. Obsługa błędów
- `400`: brak `workId` lub niepoprawny UUID (Zod).
- `404`: work nie istnieje lub niedostępny przez RLS.
- `500`: błędy zapytań do Supabase lub nieoczekiwany wyjątek.
- Logowanie błędów przez `logger` (brak dedykowanej tabeli błędów w specyfikacji).

## 7. Wydajność
- Indeks na `editions.work_id` wspiera filtrowanie.
- Sortowanie po `publish_year` może wymagać indeksu wielokolumnowego przy dużych zbiorach (opcjonalnie do rozważenia).
- Selekcja tylko potrzebnych pól ogranicza payload.
- Brak paginacji zgodnie ze specyfikacją — monitorować rozmiar odpowiedzi.

## 8. Kroki implementacji
1. Utworzyć plik endpointu `src/pages/api/works/[workId]/editions.ts` i ustawić `export const prerender = false`.
2. Dodać walidację `workId` przez `WorkIdParamSchema` oraz obsługę braku parametru.
3. Zainicjalizować `supabase` z `locals`.
4. Dodać/wykorzystać metodę serwisową:
   - `WorksService.findById(workId)` do potwierdzenia istnienia worka.
   - Nowa metoda np. `EditionsService.listByWorkId(workId)` zwracająca `EditionDto[]` posortowane `publish_year desc`.
5. Zaimplementować obsługę błędów i logowanie analogicznie do istniejących endpointów GET.
6. Zwrócić `EditionsListResponseDto` z kodem `200`.
7. Opisać testy manualne (np. przypadki: poprawny `workId`, niepoprawny UUID, brak worka) w pliku .ai/api/api-works-editions-get-manual-tests.md
