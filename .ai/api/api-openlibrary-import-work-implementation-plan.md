# API Endpoint Implementation Plan: POST /api/openlibrary/import/work

## 1. Przegląd punktu końcowego
Endpoint importuje lub odświeża dane utworu (work) z OpenLibrary i dołącza go do wskazanego autora. Operacje zapisu w katalogu globalnym muszą przejść przez RPC SECURITY DEFINER, aby obejść ograniczenia RLS dla rekordów OpenLibrary (owner_user_id = null). Odpowiedź zwraca `WorkResponseDto` z utworem i podsumowaniem primary edition.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`
- URL: `/api/openlibrary/import/work`
- Nagłówki: `Content-Type: application/json`
- Parametry:
  - Wymagane: `openlibrary_id` (string), `author_id` (uuid)
  - Opcjonalne: brak
- Body (JSON):
  - `openlibrary_id`: krótki format OpenLibrary (np. `OL123W`), max 25 znaków, bez prefiksu `/works/` i bez wiodącego `/`
  - `author_id`: UUID autora, który ma być powiązany z utworem
- Wykorzystywane typy i modele:
  - `ImportWorkCommand` (request body)
  - `ImportWorkCommandValidated` (nowy typ z Zod schema)
  - `AuthorRow["id"]`, `WorkRow["openlibrary_id"]` (walidacja typów)

## 3. Szczegóły odpowiedzi
- 200 OK:
  - `WorkResponseDto` z `work: WorkWithPrimaryEditionDto`
  - `primary_edition` może być `null`, jeśli OL nie zwrócił edycji lub nie udało się jej zmapować
- 400 Bad Request:
  - nieprawidłowy JSON lub błąd walidacji pól (`openlibrary_id`, `author_id`)
- 401 Unauthorized:
  - brak uwierzytelnienia przy próbie powiązania z autorem prywatnym (manual)
- 404 Not Found:
  - `author_id` niewidoczny z perspektywy RLS
  - utwór nie istnieje w OpenLibrary
- 502 Bad Gateway:
  - błąd komunikacji z OpenLibrary (timeout, network, 5xx)
- 500 Internal Server Error:
  - błąd RPC, błąd bazy lub nieobsłużony wyjątek

## 4. Przepływ danych
1. Parsowanie JSON i wstępna walidacja struktury body.
2. Walidacja Zod:
   - `openlibrary_id` trimmed, format krótki, długość <= 25.
   - `author_id` jako UUID.
3. Sprawdzenie widoczności autora:
   - zapytanie `authors` po `id` (RLS) w celu weryfikacji dostępu.
   - jeśli brak rekordu, zwrócić `404`.
4. Pobranie danych z OpenLibrary:
   - nowa metoda `OpenLibraryService.fetchWorkByOpenLibraryId`.
   - zmapowanie do struktury domenowej (title, first_publish_year, primary_edition_ol_id).
5. Upsert pracy w katalogu globalnym:
   - wywołanie RPC `upsert_work_from_ol` (SECURITY DEFINER) z danymi OL.
6. Import i ustawienie primary edition:
   - jeśli OL dostarcza `primary_edition`, użyć jej jako źródła.
   - jeśli OL nie dostarcza `primary_edition`, wybrać edycję z najnowszym `publish_date` spośród edycji zwróconych przez OL.
   - RPC `upsert_edition_from_ol` dla wybranej edycji głównej, wraz z ustawieniem `ol_fetched_at` i `ol_expires_at` (TTL 7 dni).
   - RPC `set_primary_edition` (lub część RPC zbiorczego), aby ustawić `primary_edition_id`.
7. Powiązanie autora i utworu:
   - RPC `link_author_work` (upewnić się, że jest idempotentny).
8. Pobranie pełnego obiektu do odpowiedzi:
   - użycie `WorksService.findByIdWithPrimaryEdition` dla `work.id`.
9. Zwrócenie `200` z `WorkResponseDto`.

## 5. Względy bezpieczeństwa
- Korzystać z `locals.supabase` (kontekst użytkownika) zgodnie z zasadami.
- Zapisy do tabel globalnych (`works`, `author_works`, `editions`) wykonywać wyłącznie przez RPC SECURITY DEFINER.
- Maskować informacje o istnieniu zasobów przez zwracanie `404` gdy autor nie jest widoczny (RLS).
- Utrzymywać walidację `openlibrary_id`, aby uniknąć manipulacji ścieżką w zapytaniach do OpenLibrary.
- Ograniczyć logowanie danych wrażliwych; logować jedynie identyfikatory i typ błędu.

## 6. Obsługa błędów
- 400:
  - `request.json()` niepoprawny
  - walidacja Zod niepowodzenie (zwrócić pierwszy błąd + `details`)
- 401:
  - brak sesji przy próbie powiązania z prywatnym autorem (manual)
- 404:
  - autor nie istnieje lub jest niewidoczny (RLS)
  - OpenLibrary zwraca 404 dla work
- 502:
  - timeout/awaria OpenLibrary
- 500:
  - RPC zwraca błąd lub nieoczekiwany wyjątek
- Rejestrowanie błędów:
  - brak dedykowanej tabeli błędów w schemacie; stosować `logger.warn/error` z kontekstem (endpoint, openlibrary_id, author_id).

## 7. Wydajność
- Preferować pojedynczy RPC (jeśli dostępny) do upsert + link + set primary edition.
- Minimalizować liczbę zapytań do OL i DB (uniknąć dodatkowych SELECT, jeśli RPC zwraca `work_id`).
- Dodać krótkoterminowy cache w pamięci procesu tylko jeśli OL jest wąskim gardłem (opcjonalne).

## 8. Kroki implementacji
1. Dodać schema walidacji `ImportWorkSchema` w `src/lib/validation/import-work.schema.ts` analogicznie do `ImportAuthorSchema`.
2. Rozszerzyć `OpenLibraryService` o metody pobierania danych work i opcjonalnie primary edition (z obsługą timeout i walidacją odpowiedzi).
3. Rozszerzyć `WorksService` o metody wywołań RPC: `upsertWorkFromOpenLibrary`, `linkAuthorWork`, `setPrimaryEdition` (lub jedna metoda agregująca).
4. Utworzyć endpoint `src/pages/api/openlibrary/import/work.ts` z `export const prerender = false` i handlerem `POST`.
5. W handlerze:
   - parsować JSON, walidować Zod,
   - weryfikować widoczność autora,
   - pobrać dane z OL,
   - wywołać RPC dla upsert/link/primary edition,
   - pobrać `WorkWithPrimaryEditionDto` i zwrócić `WorkResponseDto`.
6. Dodać spójne logowanie (`logger.debug/warn/error`) zgodnie z wzorcem importu autora.
7. Zaktualizować dokumentację / testy manualne w `.ai` (jeśli istnieją) o przypadki: cache miss, OL 404, OL timeout, autor niewidoczny.
