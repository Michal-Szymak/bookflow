## Architektura UI dla BookFlow

## 1. Przegląd struktury UI

BookFlow to responsywna aplikacja web (PL) do zarządzania dużą biblioteką użytkownika (autorzy + książki), oparta o:

- **Routing i kompozycję widoków**: strony Astro jako “shell” routingu i SSR (odczyt parametrów URL), z wyspami React dla interakcji (tabele, modale, selekcje, toolbary, toasty).
- **Nawigację top‑level**: trzy główne sekcje aplikacji po zalogowaniu:
  - **Autorzy**: `/app/authors` (+ szczegóły autora `/app/authors/:authorId`)
  - **Książki**: `/app/books`
  - **Ustawienia**: `/app/settings`
- **Źródła danych**:
  - OpenLibrary (pośrednio przez API): wyszukiwanie autorów i lista works z cache/TTL 7 dni.
  - Dane użytkownika (profile, user_authors, user_works) przez REST API.
- **Zarządzanie stanem**:
  - **URL jako jedyne źródło prawdy** dla filtrów/sortu/paginacji list (parametry query).
  - **Stan lokalny React** tylko dla UI interaktywnego (selekcje checkboxów, otwarte modale, debounced input).
- **UX** skoncentrowany na głównym flow: szybkie dodanie autora → masowe dodanie książek → masowe zarządzanie statusami i dostępnością w Legimi.
- **Dostępność (MVP)**: semantyczne formularze, poprawne role dla dialogów, widoczne stany focus, komunikaty błędów dostępne dla czytników.
- **Bezpieczeństwo**: UI nigdy nie używa kluczy admin/service role; usuwanie konta zawsze przez `DELETE /api/user/account`. Widoki wymagające autoryzacji zabezpieczone redirectem do logowania.

## 2. Lista widoków

Poniżej komplet wymaganych widoków wynikający z PRD + planu API + notatek.

### 2.1. Rejestracja

- **Nazwa widoku**: Rejestracja
- **Ścieżka widoku**: `/register`
- **Główny cel**: utworzenie konta e‑mail/hasło (US‑001).
- **Kluczowe informacje do wyświetlenia**:
  - Formularz: e‑mail, hasło, potwierdzenie hasła (opcjonalnie).
  - Link do `/login`.
  - Informacje o polityce prywatności/bezpieczeństwie (krótko).
- **Kluczowe komponenty widoku**:
  - Formularz (Input + walidacje klienta: format e‑mail, min długość hasła).
  - Inline error przy polach + komunikat globalny dla błędów serwera.
  - Przycisk “Załóż konto”.
- **UX, dostępność i względy bezpieczeństwa**:
  - Brak ujawniania szczegółów (np. “czy konto istnieje”) w komunikatach błędów.
  - Blokada wielokrotnego wysyłania (disabled podczas submit).
  - Czytelne etykiety, `aria-describedby` dla błędów pól.

### 2.2. Logowanie

- **Nazwa widoku**: Logowanie
- **Ścieżka widoku**: `/login`
- **Główny cel**: logowanie do aplikacji (US‑002).
- **Kluczowe informacje do wyświetlenia**:
  - Formularz: e‑mail, hasło.
  - Link do `/register`.
- **Kluczowe komponenty widoku**:
  - Formularz logowania.
  - Komunikaty błędów (np. nieprawidłowe dane, sesja wygasła).
- **UX, dostępność i względy bezpieczeństwa**:
  - Brak autouzupełniania hasła tylko jeśli wymagane polityką; w przeciwnym razie wspierać menedżery haseł.
  - Po zalogowaniu redirect do `/app/authors` (pierwszy ekran pracy).

### 2.3. Powłoka aplikacji (layout po zalogowaniu)

- **Nazwa widoku**: App Layout
- **Ścieżka widoku**: `/app/*`
- **Główny cel**: zapewnienie spójnej nawigacji i globalnych usług UI.
- **Kluczowe informacje do wyświetlenia**:
  - Prosta nawigacja (linki) + aktywny link.
- **Kluczowe komponenty widoku**:
  - `<nav>` z linkami: Autorzy, Książki, Ustawienia.
  - Globalny “toast host” (Sonner).
- **UX, dostępność i względy bezpieczeństwa**:
  - Brak zagnieżdżonych nawigacji w modalu.
  - Nie pokazywać liczników globalnie (liczniki tylko na listach, zgodnie z notatkami).
  - Guard autoryzacji: próba wejścia na `/app/*` bez sesji → redirect do `/login`.

### 2.4. Lista autorów użytkownika

- **Nazwa widoku**: Autorzy – lista
- **Ścieżka widoku**: `/app/authors`
- **Główny cel**: przegląd i zarządzanie listą autorów użytkownika (US‑014), rozpoczęcie flow dodawania autora (US‑004).
- **Kluczowe informacje do wyświetlenia**:
  - Lista autorów (nazwa, data dodania opcjonalnie).
  - Licznik limitu: `author_count/max_authors` (z profilu).
  - Wyszukiwanie i sortowanie listy autorów.
- **Kluczowe komponenty widoku**:
  - Pasek narzędzi filtrów (formularz `GET`):
    - `search` (po nazwie autora)
    - `sort` (`name_asc` domyślnie, `created_desc`)
  - Lista/rows autorów (link do szczegółów).
  - Paginacja: “Poprzednia / Następna” + “Strona X z Y”.
  - CTA “Dodaj autora” → otwiera modal wyszukiwania/dodania.
  - EmptyState (brak autorów) z CTA “Dodaj pierwszego autora”.
- **UX, dostępność i względy bezpieczeństwa**:
  - Przy osiągnięciu limitu 500: disable CTA + komunikat/tooltip; obsługa `409` z API.
  - Obsługa `429` (rate limit dodawania autorów): komunikat i opcjonalny cooldown w UI.
  - Usuwanie autora z profilu (detach) wymaga potwierdzenia (AlertDialog) i jest odwracalne przez ponowne dodanie.

### 2.5. Modal: dodawanie autora (wyszukiwanie OL + ręczne dodanie)

- **Nazwa widoku**: Dodaj autora (modal)
- **Ścieżka widoku**: kontekstowo w `/app/authors` (Dialog)
- **Główny cel**: dodać autora do profilu poprzez OpenLibrary lub ręcznie (US‑004, US‑011, US‑016).
- **Kluczowe informacje do wyświetlenia**:
  - Tryb: “Szukaj w OpenLibrary” | “Dodaj ręcznie”.
  - Wyniki OL: nazwa autora + identyfikator OL (lub metadane potrzebne do rozróżnienia).
- **Kluczowe komponenty widoku**:
  - Dialog (responsywny: full na mobile, max‑width na desktop).
  - Input z debounce (~300ms).
  - Lista wyników (Command) ze stanami: loading / empty / error.
  - Akcja wyboru wyniku: “Dodaj autora”.
  - Sekcja ręcznego dodania: formularz `name`.
- **UX, dostępność i względy bezpieczeństwa**:
  - Błędy OL (`502`): inline Alert w modalu + CTA “Spróbuj ponownie” i przełączenie na ręczne dodanie.
  - `409`/`429`/`401`: czytelne komunikaty (toast + ewentualnie inline).
  - Nie blokować całej aplikacji przy błędzie OL; modal ma własny stan błędu.

### 2.6. Szczegóły autora: lista works

- **Nazwa widoku**: Autor – works
- **Ścieżka widoku**: `/app/authors/:authorId`
- **Główny cel**: pokazać pełną listę works autora (z cache/TTL) i umożliwić bulk dodanie do profilu (US‑005, US‑006).
- **Kluczowe informacje do wyświetlenia**:
  - Nazwa autora.
  - Lista works z danymi z “primary edition” (tytuł, okładka, język, ISBN, rok).
  - Informacja czy dana książka jest już w profilu użytkownika (np. status / badge “Dodane”).
  - Sort i paginacja.
- **Kluczowe komponenty widoku**:
  - Pasek filtrów (formularz `GET`): `sort` (`published_desc` domyślnie, `title_asc`), `page`.
  - Tabela (Table) z checkboxami:
    - Checkbox w nagłówku: zaznacz/odznacz **bieżącą stronę**.
    - Checkboxy w wierszach: selekcja `Set<workId>`.
  - Wiersz listy jako “stacked row” (responsywnie), z detalami w Accordion.
  - Sticky bulk toolbar na dole (tylko gdy `selectedCount > 0`):
    - licznik zaznaczonych,
    - akcja “Dodaj zaznaczone” (domyślnie status `to_read`),
    - opcjonalnie wybór statusu początkowego.
  - EmptyState (brak works) + fallback ręcznego dodania książki (jeśli wspierane w MVP UI).
- **UX, dostępność i względy bezpieczeństwa**:
  - Błędy OL/listy works: `502` → widok błędu z akcją “Spróbuj ponownie” + “Dodaj ręcznie”.
  - Limit 5000 książek: pre‑check z profilu + obsługa `409` z bulk endpointu.
  - Selekcje nie “przeskakują” między stronami przypadkiem: zachowanie selekcji per strona (z możliwością utrzymania w sessionStorage według notatek).

### 2.7. Książki użytkownika (główne centrum zarządzania)

- **Nazwa widoku**: Książki – lista
- **Ścieżka widoku**: `/app/books`
- **Główny cel**: przeglądać i zarządzać statusami oraz dostępnością w Legimi (US‑007..US‑010, US‑013, US‑014).
- **Kluczowe informacje do wyświetlenia**:
  - Lista książek użytkownika z aktualnym statusem i dostępnością.
  - Licznik limitu: `work_count/max_works`.
  - Filtry, sort, paginacja.
- **Kluczowe komponenty widoku**:
  - Pasek filtrów (formularz `GET`, URL jako źródło prawdy):
    - `status` (multi) z domyślnym presetem “Aktywne” (wyklucza `hidden`),
    - `available` tri‑state (`true | false | null`) jako RadioGroup,
    - `search` (tytuł),
    - `author_id` (opcjonalnie: filtr po autorze),
    - `sort` (`published_desc` domyślnie, `title_asc`),
    - `page` z resetem do 1 przy zmianie filtrów.
  - Lista/tabela książek:
    - checkboxy + selekcja (Set),
    - status jako kontrolka zmiany (pojedynczo),
    - dostępność w Legimi jako kontrolka zmiany (pojedynczo),
    - szczegóły w Accordion (okładka lazy + placeholder, metadane jako `<dl>`).
  - Sticky bulk toolbar:
    - zmiana statusu dla zaznaczonych,
    - zmiana `available_in_legimi` z opcją “Nie zmieniaj” (undefined),
    - opcjonalnie akcja usunięcia z profilu.
  - EmptyState:
    - “Nie masz jeszcze książek” (bez filtrów) + CTA “Dodaj autora”.
    - “Brak wyników dla filtrów” + CTA “Wyczyść filtry”.
- **UX, dostępność i względy bezpieczeństwa**:
  - Zmiany statusu/dostępności: optymistyczne UI + rollback przy błędzie.
  - Status `hidden`: domyślnie niewidoczny, ale dostępny przez filtr; wspiera “przywracanie” (US‑013).
  - Obsługa `404` (work nie jest już podpięty) jako łagodne odświeżenie listy + komunikat.

### 2.8. Ustawienia konta

- **Nazwa widoku**: Ustawienia
- **Ścieżka widoku**: `/app/settings`
- **Główny cel**: zarządzanie sesją i lifecycle konta (US‑002, US‑003).
- **Kluczowe informacje do wyświetlenia**:
  - Sekcja “Konto”.
  - Akcje: wylogowanie, usunięcie konta.
- **Kluczowe komponenty widoku**:
  - Przycisk “Wyloguj”.
  - Sekcja “Usuń konto” + AlertDialog:
    - ostrzeżenie o nieodwracalności,
    - potwierdzenie akcji.
- **UX, dostępność i względy bezpieczeństwa**:
  - Usuwanie konta: tylko `DELETE /api/user/account`; po sukcesie redirect do `/login` + toast.
  - Przed wysłaniem: dodatkowe potwierdzenie (np. checkbox “Rozumiem” lub wpisanie słowa) — opcjonalne, zależnie od poziomu ryzyka.
  - Przy `401`: wyświetlić informację o wygaśnięciu sesji i odesłać do logowania.

### 2.9. Widoki stanów globalnych

- **Nazwa widoku**: Not found / Error
- **Ścieżka widoku**: `/404` (lub fallback Astro) + kontekstowe błędy na listach
- **Główny cel**: czytelne prowadzenie użytkownika w razie błędów routingu i awarii API.
- **Kluczowe informacje do wyświetlenia**:
  - Komunikat + akcja powrotu do głównej sekcji.
- **Kluczowe komponenty widoku**:
  - Strona 404 z CTA “Wróć do Autorów/Książek”.
  - Wzorzec “inline error” w widokach list (np. błędy OL).
- **UX, dostępność i względy bezpieczeństwa**:
  - Nie wyświetlać technicznych stack trace’ów; logowanie techniczne po stronie serwera.

## 3. Mapa podróży użytkownika

### 3.1. Główny przypadek użycia (Dodaj autora → dodaj książki → zarządzaj statusem)

1. **Logowanie**: użytkownik wchodzi na `/login`, loguje się, przechodzi do `/app/authors`.
2. **Lista autorów**: na `/app/authors` widzi licznik `X/500` i CTA “Dodaj autora”.
3. **Wyszukiwanie w modalu**:
   - Otwiera Dialog, wpisuje nazwę, widzi wyniki z `GET /api/authors/search`.
   - Jeśli OL niedostępne (`502`): widzi fallback “Dodaj ręcznie”.
4. **Dodanie autora do profilu**:
   - (Jeśli OL) import autora `POST /api/openlibrary/import/author` (jeśli potrzebne) i attach `POST /api/user/authors`.
   - (Jeśli manual) tworzy autora `POST /api/authors`, następnie attach `POST /api/user/authors`.
   - Po sukcesie: toast + autor pojawia się na liście, licznik aktualizuje się po `GET /api/user/profile`.
5. **Wejście w szczegóły autora**: klik w autora → `/app/authors/:authorId`.
6. **Przegląd works**:
   - Lista z `GET /api/authors/{authorId}/works` (sort/paginacja w URL).
   - Użytkownik zaznacza pozycje (checkboxy).
7. **Bulk dodanie**:
   - Sticky toolbar: “Dodaj zaznaczone”.
   - UI wywołuje `POST /api/user/works/bulk` (z domyślnym statusem `to_read`).
   - Po sukcesie: toast (“Dodano N, pominięto M”), wiersze oznaczone jako dodane.
8. **Zarządzanie biblioteką**:
   - Użytkownik przechodzi do `/app/books` (lub link “Zobacz w Książkach” z `author_id` w URL).
   - Filtruje, sortuje, zmienia statusy pojedynczo (PATCH) lub hurtowo (status-bulk).
   - Oznacza dostępność w Legimi ręcznie (`available_in_legimi`).

### 3.2. Przypadki poboczne (kluczowe ścieżki)

- **Usuwanie autora z profilu** (US‑012): `/app/authors` → akcja “Usuń z profilu” → AlertDialog → `DELETE /api/user/authors/{authorId}` → odświeżenie licznika i list.
- **Ukrywanie i przywracanie tytułów** (US‑013): `/app/books` → status `hidden` (pojedynczo lub bulk) → domyślny widok bez hidden → filtr statusu umożliwia podgląd i przywrócenie.
- **Usuwanie konta** (US‑003): `/app/settings` → AlertDialog → `DELETE /api/user/account` → redirect `/login` + toast.

## 4. Układ i struktura nawigacji

- **Top‑level (po zalogowaniu)**:
  - `/app/authors` (domyślny start po logowaniu)
  - `/app/books`
  - `/app/settings`
- **Nawigacja kontekstowa**:
  - Z `/app/authors` do `/app/authors/:authorId` (klik w wiersz autora).
  - Z `/app/authors/:authorId` do `/app/books?author_id=:authorId` (“Zobacz w Książkach”).
- **Parametry URL jako state**:
  - Każda lista obsługuje `page`, `sort`, oraz kontekstowe filtry (np. `status`, `available`, `search`, `author_id`).
  - Filtry zmieniane przez `<form method="get">`, co zapewnia działanie back/forward i linkowalność.
- **Zasady paginacji**:
  - Kontrolki: “Poprzednia / Następna” i “Strona X z Y”.
  - Reset paginacji do 1 przy zmianie filtrów/sortu (brak `page` lub `page=1`).

## 5. Kluczowe komponenty

Komponenty współdzielone (na poziomie architektury, bez implementacji):

- **AppLayout + Nav**: wspólna powłoka `/app/*` z prostą nawigacją i miejscem na toasty.
- **EmptyState**: ujednolicony komponent pustych stanów z opcjonalną akcją główną.
- **FiltersBar (GET Form)**: pasek filtrów oparty o formularze `method="get"` (bez ręcznej synchronizacji React↔URL).
- **PaginationSimple**: “Poprzednia/Następna” + “Strona X z Y”.
- **WorksTable / BooksTable (stacked rows)**:
  - checkboxy, selekcja w `Set`,
  - responsywne ukrywanie/pokazywanie detali,
  - wiersz z Accordion dla szczegółów.
- **BulkToolbar (sticky)**: toolbar renderowany tylko przy `selectedCount > 0`; akcje bulk zależne od kontekstu (dodanie, zmiana statusu, dostępność).
- **AuthorSearchDialog**: Dialog z trybami “search/manual”, Command list, loading/empty/error, debounce inputu.
- **CoverImage**: okładka z `loading="lazy"`, placeholder `/placeholder-book.svg`, obsługa `onError`.
- **ApiErrorMapper**: centralne mapowanie kodów HTTP + `error_code` na komunikaty (toast/inline) oraz sugerowane akcje.

## 6. Mapowanie endpointów API → widoki (zgodność z API planem)

- **Profil/liczniki**:
  - `GET /api/user/profile` → `/app/authors` i `/app/books` (liczniki limitów, gating CTA).
- **Autorzy (wyszukiwanie/import/attach/detach)**:
  - `GET /api/authors/search` → modal “Dodaj autora”.
  - `POST /api/openlibrary/import/author` → modal (import do katalogu, gdy potrzebne).
  - `POST /api/authors` → modal (ręczne dodanie autora).
  - `POST /api/user/authors` → modal (faktyczne dodanie autora do profilu; limity i 429).
  - `GET /api/user/authors` → `/app/authors` (lista użytkownika).
  - `DELETE /api/user/authors/{authorId}` → `/app/authors` (usunięcie z profilu).
- **Works i książki użytkownika**:
  - `GET /api/authors/{authorId}/works` → `/app/authors/:authorId` (tabela works).
  - `POST /api/user/works/bulk` → `/app/authors/:authorId` (bulk dodanie zaznaczonych).
  - `GET /api/user/works` → `/app/books` (lista z filtrami/sortem).
  - `PATCH /api/user/works/{workId}` → `/app/books` (pojedyncze zmiany status/dostępność).
  - `POST /api/user/works/status-bulk` → `/app/books` (bulk zmiany).
  - `DELETE /api/user/works/{workId}` → `/app/books` (usunięcie z profilu).
- **Konto**:
  - `DELETE /api/user/account` → `/app/settings` (usunięcie konta).

## 7. Edge cases, błędy i stany (co widzi użytkownik)

- **401 (brak sesji / sesja wygasła)**:
  - Na `/app/*`: redirect do `/login` + toast “Zaloguj się ponownie”.
- **409 (limity/konflikty)**:
  - `/app/authors`: “Osiągnięto limit autorów (500)”.
  - `/app/authors/:authorId` bulk: “Osiągnięto limit książek (5000)”.
  - Manual create: komunikat o konflikcie (np. duplikat), bez ujawniania szczegółów technicznych.
- **429 (rate limit dodawania autorów)**:
  - Modal: inline komunikat + sugestia odczekania.
- **502 (OpenLibrary niedostępne)**:
  - Modal wyszukiwania: fallback do ręcznego dodania.
  - Widok works autora: ekran błędu z retry + opcją ręczną.
- **404 (nie znaleziono / RLS odmówił widoczności)**:
  - Widok szczegółów autora: “Nie znaleziono autora” + powrót do listy.
  - Operacje na work: jeśli już odłączone, UI odświeża listę i czyści selekcje.
- **Stany list (loading/empty)**:
  - Skeleton dla tabel.
  - Spójny EmptyState zależny od kontekstu (brak danych vs brak wyników filtrów).
- **Selekcje i bulk**:
  - “Zaznacz wszystko” zawsze dotyczy tylko bieżącej strony.
  - Po zmianie filtrów: selekcje czyszczone (zapobiega bulk na nieaktualnym zbiorze).

## 8. Mapowanie historyjek użytkownika (PRD) → elementy architektury UI

- **US‑001 Rejestracja** → widok `/register` (formularz, walidacje, błędy).
- **US‑002 Logowanie/wylogowanie** → `/login` + akcja “Wyloguj” w `/app/settings`.
- **US‑003 Usunięcie konta** → `/app/settings` + AlertDialog + `DELETE /api/user/account`.
- **US‑004 Dodanie autora z OpenLibrary** → modal “Dodaj autora” (search + wybór + attach).
- **US‑005 Pobranie i sortowanie works** → `/app/authors/:authorId` (sort, paginacja, rok jako prezentacja daty).
- **US‑006 Bulk dodanie książek** → checkboxy + sticky bulk toolbar + `POST /api/user/works/bulk`.
- **US‑007 Zmiana statusu pojedynczo** → kontrolka statusu w wierszu na `/app/books`.
- **US‑008 Bulk status** → bulk toolbar na `/app/books` + `POST /api/user/works/status-bulk`.
- **US‑009 Filtry i sortowanie** → FiltersBar (GET form) na `/app/books` + URL params.
- **US‑010 Dostępność w Legimi ręcznie** → tri‑state kontrolki (pojedynczo + bulk) na `/app/books`.
- **US‑011 Ręczne dodanie autora/książki** → tryb “manual” w modalu autora; dla książki: fallback (architektonicznie przewidziany) w kontekście autora/książek.
- **US‑012 Usuwanie autora i jego książek z profilu** → akcja “Usuń z profilu” na `/app/authors` (AlertDialog).
- **US‑013 Ukrywanie/przywracanie** → status `hidden`, domyślny filtr “Aktywne”, możliwość filtrowania po hidden i zmiany statusu.
- **US‑014 Paginacja i limity** → paginacja 30/strona na listach + liczniki limitów z profilu + komunikaty 409.
- **US‑015 Rate limit dodawania autorów** → obsługa `429` w modalu + jasny komunikat.
- **US‑016 Obsługa błędów OL** → inline error + fallback manual + retry (502).
- **US‑017 Analityka zdarzeń** → brak osobnych eventów w UI; UI zapewnia stabilny przepływ, który serwer może mierzyć (zdarzenia emitowane po sukcesie operacji).

## 9. Mapowanie wymagań → elementy UI (skrót)

- **Limity (500/5000)** → liczniki na `/app/authors` i `/app/books` + blokady CTA + komunikaty `409`.
- **Cache OL 7 dni** → transparentne dla użytkownika; UI opcjonalnie oferuje “Odśwież” tylko jeśli wspierane parametrem `forceRefresh`.
- **Paginacja 30/strona** → prosta paginacja bez numerów stron.
- **Sorty (data/tytuł)** → select sortowania na listach; data jako rok.
- **Statusy i bulk** → checkboxy + sticky bulk toolbar; optymistyczne aktualizacje.
- **Dostępność w Legimi (manual)** → tri‑state UI + filtr i bulk.
- **Bezpieczeństwo i prywatność** → brak admin API w kliencie; usuwanie konta tylko przez endpoint; ochrona `/app/*`.
