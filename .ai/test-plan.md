# Plan Testów - BookFlow

## 1. Wprowadzenie i Cele Testowania

### 1.1. Cel Dokumentu

Niniejszy dokument stanowi kompleksowy plan testów dla aplikacji **BookFlow** - systemu zarządzania biblioteką książek dla zaawansowanych użytkowników Legimi. Plan testów definiuje strategię, zakres, metody i narzędzia testowania, które zapewnią wysoką jakość oprogramowania przed wdrożeniem produkcyjnym.

### 1.2. Cele Testowania

Główne cele procesu testowania:

- **Zapewnienie funkcjonalności**: Weryfikacja, że wszystkie funkcjonalności MVP działają zgodnie z wymaganiami
- **Bezpieczeństwo danych**: Potwierdzenie, że Row Level Security (RLS) poprawnie chroni dane użytkowników
- **Niezawodność integracji**: Weryfikacja stabilności integracji z Supabase i OpenLibrary API
- **Wydajność**: Sprawdzenie, że aplikacja obsługuje oczekiwane obciążenia (500 autorów, 5000 dzieł na użytkownika)
- **Jakość kodu**: Zapewnienie, że kod jest testowalny, utrzymywalny i zgodny z najlepszymi praktykami
- **Doświadczenie użytkownika**: Weryfikacja, że interfejs użytkownika działa poprawnie i jest intuicyjny

### 1.3. Zakres Dokumentu

Plan testów obejmuje:

- Testy jednostkowe (Unit Tests)
- Testy integracyjne (Integration Tests)
- Testy end-to-end (E2E Tests)
- Testy bezpieczeństwa (Security Tests)
- Testy wydajnościowe (Performance Tests)
- Testy interfejsu użytkownika (UI Tests)

## 2. Zakres Testów

### 2.1. Komponenty Podlegające Testowaniu

#### 2.1.1. Warstwa API (Backend)

**Endpoints autentykacji:**

- `POST /api/auth/register` - Rejestracja użytkownika
- `POST /api/auth/login` - Logowanie użytkownika
- `POST /api/auth/logout` - Wylogowanie użytkownika
- `POST /api/auth/forgot-password` - Reset hasła (żądanie)
- `POST /api/auth/reset-password` - Reset hasła (wykonanie)
- `POST /api/auth/verify` - Weryfikacja tokena
- `DELETE /api/user/account` - Usunięcie konta użytkownika

**Endpoints autorów:**

- `GET /api/authors/search` - Wyszukiwanie autorów w OpenLibrary
- `POST /api/authors` - Tworzenie ręcznego autora
- `GET /api/authors/{authorId}` - Pobieranie szczegółów autora
- `GET /api/authors/{authorId}/works` - Lista dzieł autora
- `POST /api/openlibrary/import/author` - Import autora z OpenLibrary

**Endpoints dzieł (works):**

- `POST /api/works` - Tworzenie ręcznego dzieła
- `GET /api/works/{workId}` - Pobieranie szczegółów dzieła
- `GET /api/works/{workId}/editions` - Lista wydań dzieła
- `POST /api/works/{workId}/primary-edition` - Ustawienie głównego wydania
- `POST /api/openlibrary/import/work` - Import dzieła z OpenLibrary

**Endpoints wydań (editions):**

- `POST /api/editions` - Tworzenie ręcznego wydania
- `POST /api/openlibrary/import/edition` - Import wydania z OpenLibrary

**Endpoints użytkownika:**

- `GET /api/user/profile` - Pobieranie profilu użytkownika
- `GET /api/user/authors` - Lista autorów użytkownika
- `POST /api/user/authors` - Dodanie autora do profilu
- `DELETE /api/user/authors/{authorId}` - Usunięcie autora z profilu
- `GET /api/user/works` - Lista dzieł użytkownika (z filtrowaniem)
- `POST /api/user/works/bulk` - Masowe dodanie dzieł
- `PATCH /api/user/works/{workId}` - Aktualizacja statusu dzieła
- `POST /api/user/works/status-bulk` - Masowa aktualizacja statusów
- `DELETE /api/user/works/{workId}` - Usunięcie dzieła z profilu

#### 2.1.2. Warstwa Serwisów (Services)

**Serwisy biznesowe:**

- `ProfileService` - Zarządzanie profilem użytkownika
- `AuthorsService` - Operacje na autorach
- `WorksService` - Operacje na dziełach
- `EditionsService` - Operacje na wydaniach
- `OpenLibraryService` - Integracja z OpenLibrary API
- `RateLimitService` - Kontrola limitów zapytań
- `AccountService` - Zarządzanie kontem użytkownika

#### 2.1.3. Warstwa Walidacji (Validation)

**Schematy walidacji Zod:**

- Walidacja autentykacji (login, register, forgot-password, reset-password)
- Walidacja autorów (create-author, import-author, author-search)
- Walidacja dzieł (create-work, import-work, update-user-work)
- Walidacja wydań (create-edition, import-edition)
- Walidacja parametrów zapytań (pagination, sorting, filtering)

#### 2.1.4. Warstwa Middleware

- `src/middleware/index.ts` - Middleware autoryzacji i przekierowań
- Obsługa sesji Supabase
- Ochrona tras wymagających autoryzacji
- Przekierowania dla zalogowanych użytkowników

#### 2.1.5. Komponenty React (Frontend)

**Komponenty autentykacji:**

- `LoginForm` - Formularz logowania
- `RegisterForm` - Formularz rejestracji
- `ForgotPasswordForm` - Formularz resetu hasła
- `ResetPasswordForm` - Formularz ustawienia nowego hasła
- `LogoutButton` - Przycisk wylogowania
- `AccountSettings` - Ustawienia konta
- `DeleteAccountDialog` - Dialog usunięcia konta

**Komponenty autorów:**

- `AuthorsListView` - Główny widok listy autorów
- `AuthorsTable` - Tabela autorów
- `AddAuthorModal` - Modal dodawania autora
- `AuthorSearchTab` - Wyszukiwanie autorów w OpenLibrary
- `ManualAuthorTab` - Ręczne dodawanie autora
- `DeleteAuthorDialog` - Dialog usuwania autora
- `AuthorWorksView` - Widok dzieł autora

**Komponenty książek:**

- `BooksListView` - Główny widok listy książek
- `BooksTable` - Tabela książek
- `WorkStatusControl` - Kontrolka statusu czytania
- `WorkAvailableControl` - Kontrolka dostępności w Legimi
- `BooksBulkToolbar` - Toolbar masowych operacji
- `BooksFiltersBar` - Pasek filtrów

**Komponenty UI (Shadcn/ui):**

- Komponenty bazowe (Button, Input, Select, Checkbox, etc.)
- Komponenty złożone (Accordion, Alert Dialog, Badge, etc.)

#### 2.1.6. Integracje Zewnętrzne

- **Supabase**: Autentykacja, baza danych, RLS
- **OpenLibrary API**: Wyszukiwanie autorów, import danych
- **OpenRouter.ai**: (Przyszłość) Integracja z modelami AI

### 2.2. Komponenty Wyłączone z Testowania

- Pliki konfiguracyjne (astro.config.mjs, tsconfig.json, etc.)
- Pliki migracji bazy danych (testowane osobno w środowisku deweloperskim)
- Dokumentacja (README, pliki .md)
- Pliki buildowe (dist/)

## 3. Typy Testów do Przeprowadzenia

### 3.1. Testy Jednostkowe (Unit Tests)

**Cel**: Weryfikacja działania pojedynczych funkcji, metod i komponentów w izolacji.

**Narzędzia**:

- **Vitest** (zalecane dla Astro/TypeScript)
- **@testing-library/react** dla komponentów React
- **@testing-library/user-event** dla symulacji interakcji użytkownika

**Zakres testów jednostkowych:**

#### 3.1.1. Serwisy Biznesowe

**ProfileService:**

- ✅ Pobieranie profilu użytkownika
- ✅ Aktualizacja liczników autorów i dzieł
- ✅ Sprawdzanie limitów (max_authors, max_works)
- ✅ Obsługa błędów (brak profilu, błąd bazy danych)

**AuthorsService:**

- ✅ Tworzenie ręcznego autora
- ✅ Import autora z OpenLibrary
- ✅ Pobieranie autora po ID
- ✅ Wyszukiwanie autorów w bazie
- ✅ Walidacja constraintów (manual_owner, manual_or_ol)
- ✅ Obsługa cache OpenLibrary (ol_fetched_at, ol_expires_at)

**WorksService:**

- ✅ Tworzenie ręcznego dzieła
- ✅ Import dzieła z OpenLibrary
- ✅ Pobieranie dzieła po ID
- ✅ Ustawianie primary_edition
- ✅ Tworzenie powiązań author_works
- ✅ Walidacja constraintów

**EditionsService:**

- ✅ Tworzenie ręcznego wydania
- ✅ Import wydania z OpenLibrary
- ✅ Pobieranie wydań dla dzieła
- ✅ Walidacja constraintów

**OpenLibraryService:**

- ✅ Wyszukiwanie autorów w OpenLibrary
- ✅ Pobieranie szczegółów autora
- ✅ Pobieranie listy dzieł autora
- ✅ Pobieranie szczegółów dzieła
- ✅ Pobieranie szczegółów wydania
- ✅ Obsługa timeoutów (10s)
- ✅ Obsługa błędów sieciowych
- ✅ Parsowanie odpowiedzi API
- ✅ Konwersja OpenLibrary ID (short/long format)

**RateLimitService:**

- ✅ Sprawdzanie limitu zapytań
- ✅ Rejestrowanie zapytań
- ✅ Czyszczenie starych wpisów
- ✅ Obliczanie pozostałych zapytań
- ✅ Obsługa wielu użytkowników jednocześnie

**AccountService:**

- ✅ Usuwanie konta użytkownika
- ✅ Kasowanie powiązanych danych (cascade)
- ✅ Usuwanie z Supabase Auth

#### 3.1.2. Walidacja (Zod Schemas)

**Testy schematów walidacji:**

- ✅ Poprawne dane wejściowe
- ✅ Nieprawidłowe typy danych
- ✅ Brakujące wymagane pola
- ✅ Nieprawidłowe formaty (email, UUID, dates)
- ✅ Wartości poza zakresem (np. publish_year: 1500-2100)
- ✅ Zbyt długie stringi (max length)
- ✅ Puste tablice (gdy wymagane)
- ✅ Komunikaty błędów w języku polskim

**Przykładowe schematy do testowania:**

- `LoginSchema`, `RegisterSchema`
- `CreateAuthorSchema`, `ImportAuthorSchema`
- `CreateWorkSchema`, `ImportWorkSchema`
- `CreateEditionSchema`, `ImportEditionSchema`
- `UpdateUserWorkSchema`, `BulkAttachUserWorksSchema`
- Query parameter schemas (pagination, sorting, filtering)

#### 3.1.3. Komponenty React

**Komponenty formularzy:**

- ✅ Renderowanie formularzy
- ✅ Walidacja pól formularzy
- ✅ Obsługa błędów walidacji
- ✅ Wyświetlanie komunikatów błędów
- ✅ Submit formularzy
- ✅ Reset formularzy
- ✅ Disabled state podczas submit

**Komponenty list:**

- ✅ Renderowanie pustych list
- ✅ Renderowanie list z danymi
- ✅ Paginacja
- ✅ Sortowanie
- ✅ Filtrowanie
- ✅ Wyszukiwanie
- ✅ Loading states
- ✅ Error states

**Komponenty interaktywne:**

- ✅ Otwieranie/zamykanie modali
- ✅ Wybór opcji w selectach
- ✅ Zaznaczanie checkboxów
- ✅ Kliknięcia przycisków
- ✅ Obsługa keyboard navigation (gdzie dotyczy)

**Hooks:**

- ✅ `useAuthorsList` - zarządzanie stanem listy autorów
- ✅ `useAuthorSearch` - wyszukiwanie autorów
- ✅ `useBooksList` - zarządzanie stanem listy książek
- ✅ `useDebounce` - opóźnienie wywołań
- ✅ `useUrlSearchParams` - synchronizacja z URL

#### 3.1.4. Utilities i Helpers

- ✅ Funkcje pomocnicze w `src/lib/utils.ts`
- ✅ Logger (`src/lib/logger.ts`)
- ✅ Funkcje formatowania danych
- ✅ Funkcje konwersji typów

### 3.2. Testy Integracyjne (Integration Tests)

**Cel**: Weryfikacja współdziałania wielu komponentów systemu.

**Narzędzia**:

- **Vitest** z możliwością testowania API routes
- **@supabase/supabase-js** (mock lub testowa instancja)
- **MSW (Mock Service Worker)** do mockowania zewnętrznych API

**Zakres testów integracyjnych:**

#### 3.2.1. Integracja API z Bazą Danych

**Endpoints autentykacji:**

- ✅ Rejestracja → utworzenie profilu w `profiles`
- ✅ Logowanie → ustawienie sesji
- ✅ Reset hasła → wysłanie emaila → weryfikacja tokena
- ✅ Usunięcie konta → kasowanie wszystkich powiązanych danych

**Endpoints autorów:**

- ✅ Tworzenie autora → aktualizacja `author_count` w profilu
- ✅ Import autora z OpenLibrary → cache w bazie
- ✅ Pobieranie dzieł autora → wywołanie RPC `author_works_list`
- ✅ Usunięcie autora → aktualizacja liczników

**Endpoints dzieł:**

- ✅ Tworzenie dzieła → powiązanie z autorami (`author_works`)
- ✅ Import dzieła → powiązanie z autorem
- ✅ Ustawienie primary_edition → walidacja przynależności
- ✅ Pobieranie wydań → sortowanie po publish_year

**Endpoints użytkownika:**

- ✅ Dodanie autora → aktualizacja `user_authors` i `author_count`
- ✅ Masowe dodanie dzieł → deduplikacja, aktualizacja `work_count`
- ✅ Aktualizacja statusu → aktualizacja `status_updated_at`
- ✅ Masowa aktualizacja statusów → transakcja
- ✅ Filtrowanie i sortowanie → zapytania SQL z RLS

#### 3.2.2. Integracja z OpenLibrary API

**Scenariusze testowe:**

- ✅ Wyszukiwanie autorów → parsowanie odpowiedzi → zwrócenie wyników
- ✅ Import autora → pobranie szczegółów → zapis w bazie z cache
- ✅ Pobieranie dzieł autora → parsowanie → zapis w bazie
- ✅ Import dzieła → pobranie szczegółów → powiązanie z autorem
- ✅ Import wydania → pobranie szczegółów → powiązanie z dziełem
- ✅ Obsługa timeoutów (10s) → zwrócenie błędu
- ✅ Obsługa błędów sieciowych → retry lub zwrócenie błędu
- ✅ Wykorzystanie cache (ol_expires_at) → brak wywołania API
- ✅ Odświeżanie cache (forceRefresh) → wywołanie API mimo cache

#### 3.2.3. Integracja Middleware z API

- ✅ Middleware → weryfikacja autoryzacji → przekierowanie do login
- ✅ Middleware → przekierowanie zalogowanych użytkowników z /login
- ✅ Middleware → obsługa reset-password z tokenem
- ✅ Middleware → przekazanie `locals.supabase` do endpointów

#### 3.2.4. Integracja Rate Limiting

- ✅ Rate limiting → blokowanie zapytań po przekroczeniu limitu
- ✅ Rate limiting → zwracanie 429 Too Many Requests
- ✅ Rate limiting → reset okna czasowego
- ✅ Rate limiting → różne limity dla różnych endpointów

### 3.3. Testy End-to-End (E2E Tests)

**Cel**: Weryfikacja pełnych przepływów użytkownika od początku do końca.

**Narzędzia**:

- **Playwright** (zalecane)
- Testowa instancja Supabase
- Mock OpenLibrary API (lub testowa instancja)

**Zakres testów E2E:**

#### 3.3.1. Przepływ Autentykacji

**TC-E2E-001: Rejestracja i pierwsze logowanie**

1. Użytkownik otwiera stronę główną
2. Przechodzi do /register
3. Wypełnia formularz rejestracji (email, hasło)
4. Wysyła formularz
5. Weryfikuje przekierowanie do /app/authors
6. Weryfikuje utworzenie profilu (GET /api/user/profile)

**TC-E2E-002: Logowanie istniejącego użytkownika**

1. Użytkownik otwiera /login
2. Wypełnia formularz logowania
3. Wysyła formularz
4. Weryfikuje przekierowanie do /app/authors
5. Weryfikuje wyświetlenie danych użytkownika

**TC-E2E-003: Reset hasła**

1. Użytkownik otwiera /forgot-password
2. Wprowadza email
3. Wysyła formularz
4. Otrzymuje email z tokenem (mock)
5. Otwiera link reset-password z tokenem
6. Ustawia nowe hasło
7. Loguje się nowym hasłem

**TC-E2E-004: Wylogowanie**

1. Zalogowany użytkownik klika "Wyloguj"
2. Weryfikuje przekierowanie do /login
3. Weryfikuje, że nie może uzyskać dostępu do /app/\*

#### 3.3.2. Przepływ Zarządzania Autorami

**TC-E2E-005: Dodanie autora z OpenLibrary (główny przepływ MVP)**

1. Zalogowany użytkownik otwiera /app/authors
2. Klika "Dodaj autora"
3. Wybiera zakładkę "Wyszukaj w OpenLibrary"
4. Wprowadza nazwę autora (np. "Tolkien")
5. Weryfikuje wyświetlenie wyników wyszukiwania
6. Wybiera autora z listy
7. Weryfikuje import autora i jego dzieł
8. Weryfikuje wyświetlenie autora na liście
9. Weryfikuje aktualizację licznika autorów

**TC-E2E-006: Ręczne dodanie autora**

1. Zalogowany użytkownik otwiera /app/authors
2. Klika "Dodaj autora"
3. Wybiera zakładkę "Dodaj ręcznie"
4. Wprowadza nazwę autora
5. Zapisuje
6. Weryfikuje wyświetlenie autora na liście

**TC-E2E-007: Przeglądanie dzieł autora**

1. Zalogowany użytkownik otwiera /app/authors
2. Klika na autora w tabeli
3. Weryfikuje przejście do /app/authors/{authorId}
4. Weryfikuje wyświetlenie listy dzieł autora
5. Weryfikuje paginację (jeśli >30 dzieł)
6. Weryfikuje sortowanie (published_desc, title_asc)

**TC-E2E-008: Usunięcie autora**

1. Zalogowany użytkownik otwiera /app/authors
2. Klika przycisk usuwania przy autorze
3. Potwierdza usunięcie w dialogu
4. Weryfikuje usunięcie autora z listy
5. Weryfikuje aktualizację licznika autorów

#### 3.3.3. Przepływ Zarządzania Książkami

**TC-E2E-009: Masowe dodanie książek do biblioteki**

1. Zalogowany użytkownik otwiera /app/authors/{authorId}
2. Zaznacza wiele dzieł (checkbox)
3. Klika "Dodaj do biblioteki"
4. Weryfikuje dodanie dzieł do /app/books
5. Weryfikuje aktualizację licznika dzieł

**TC-E2E-010: Zmiana statusu czytania**

1. Zalogowany użytkownik otwiera /app/books
2. Wybiera książkę z listy
3. Zmienia status (np. "To read" → "In progress")
4. Weryfikuje aktualizację statusu w interfejsie
5. Odświeża stronę i weryfikuje zachowanie statusu

**TC-E2E-011: Masowa zmiana statusów**

1. Zalogowany użytkownik otwiera /app/books
2. Zaznacza wiele książek
3. Wybiera nowy status z dropdown
4. Klika "Zastosuj"
5. Weryfikuje aktualizację statusów wszystkich zaznaczonych książek

**TC-E2E-012: Filtrowanie i sortowanie książek**

1. Zalogowany użytkownik otwiera /app/books
2. Wybiera filtr statusu (np. "Read")
3. Weryfikuje wyświetlenie tylko książek z tym statusem
4. Wybiera sortowanie "Tytuł A-Z"
5. Weryfikuje posortowanie listy
6. Weryfikuje synchronizację filtrów z URL

**TC-E2E-013: Oznaczenie dostępności w Legimi**

1. Zalogowany użytkownik otwiera /app/books
2. Wybiera książkę
3. Oznacza jako dostępną w Legimi
4. Weryfikuje aktualizację flagi
5. Filtruje po dostępności w Legimi
6. Weryfikuje wyświetlenie książki w wynikach

#### 3.3.4. Przepływ Usuwania Konta

**TC-E2E-014: Usunięcie konta użytkownika**

1. Zalogowany użytkownik otwiera /app/settings
2. Klika "Usuń konto"
3. Potwierdza usunięcie w dialogu
4. Weryfikuje przekierowanie do /login
5. Weryfikuje, że nie może się zalogować tym samym emailem
6. Weryfikuje usunięcie wszystkich danych użytkownika z bazy

### 3.4. Testy Bezpieczeństwa (Security Tests)

**Cel**: Weryfikacja zabezpieczeń aplikacji przed atakami i nieautoryzowanym dostępem.

**Zakres testów bezpieczeństwa:**

#### 3.4.1. Autoryzacja i Uwierzytelnienie

- ✅ Próba dostępu do chronionych endpointów bez tokena → 401
- ✅ Próba dostępu z nieprawidłowym tokenem → 401
- ✅ Próba dostępu z wygasłym tokenem → 401
- ✅ Próba dostępu do danych innego użytkownika → 403/404
- ✅ Próba modyfikacji danych innego użytkownika → 403
- ✅ Próba obejścia middleware → przekierowanie do login

#### 3.4.2. Row Level Security (RLS)

**Testy RLS w bazie danych:**

- ✅ Użytkownik widzi tylko swoje `user_authors`
- ✅ Użytkownik widzi tylko swoje `user_works`
- ✅ Użytkownik nie może modyfikować danych innego użytkownika
- ✅ Użytkownik nie może usuwać danych innego użytkownika
- ✅ Użytkownik może czytać globalne dane (authors, works z owner_user_id = null)
- ✅ Użytkownik nie może modyfikować globalnych danych (tylko przez RPC)
- ✅ Użytkownik może modyfikować tylko swoje ręczne rekordy (owner_user_id)

#### 3.4.3. Walidacja Wejścia

- ✅ SQL Injection → walidacja i parametryzowane zapytania
- ✅ XSS (Cross-Site Scripting) → escapowanie danych w UI
- ✅ CSRF (Cross-Site Request Forgery) → weryfikacja tokenów
- ✅ Nieprawidłowe typy danych → walidacja Zod
- ✅ Zbyt długie stringi → walidacja max length
- ✅ Nieprawidłowe UUID → walidacja formatu
- ✅ Nieprawidłowe enum values → walidacja dozwolonych wartości

#### 3.4.4. Rate Limiting

- ✅ Przekroczenie limitu zapytań → 429 Too Many Requests
- ✅ Różne limity dla różnych endpointów
- ✅ Reset limitu po upływie okna czasowego
- ✅ Ochrona przed brute force (logowanie)

#### 3.4.5. Bezpieczeństwo Hasła

- ✅ Minimum 6 znaków → walidacja
- ✅ Hashowanie haseł (Supabase Auth)
- ✅ Reset hasła wymaga tokena
- ✅ Token resetu wygasa po określonym czasie

#### 3.4.6. Bezpieczeństwo Sesji

- ✅ Sesja wygasa po określonym czasie
- ✅ Wylogowanie niszczy sesję
- ✅ Sesja nie jest dostępna po stronie klienta (httpOnly cookies)

### 3.5. Testy Wydajnościowe (Performance Tests)

**Cel**: Weryfikacja, że aplikacja obsługuje oczekiwane obciążenia.

**Narzędzia**:

- **k6** lub **Artillery** do testów obciążeniowych
- **Lighthouse** do testów wydajności frontendu

**Zakres testów wydajnościowych:**

#### 3.5.1. Wydajność API

**Testy obciążeniowe:**

- ✅ 100 równoczesnych użytkowników → czas odpowiedzi < 2s
- ✅ 500 równoczesnych zapytań do /api/user/works → czas odpowiedzi < 3s
- ✅ Masowe dodanie 100 dzieł → czas odpowiedzi < 5s
- ✅ Wyszukiwanie autorów w OpenLibrary → timeout 10s
- ✅ Import autora z wieloma dziełami (>100) → czas odpowiedzi < 30s

**Testy wydajności zapytań SQL:**

- ✅ Lista autorów użytkownika (500 autorów) → czas < 500ms
- ✅ Lista dzieł użytkownika (5000 dzieł) z filtrowaniem → czas < 1s
- ✅ Lista dzieł autora (100+ dzieł) → czas < 500ms
- ✅ Sprawdzenie limitów użytkownika → czas < 100ms

**Optymalizacje do weryfikacji:**

- ✅ Indeksy na kolumnach używanych w WHERE i ORDER BY
- ✅ Paginacja (30 elementów na stronę)
- ✅ Brak N+1 queries
- ✅ Wykorzystanie cache OpenLibrary (ol_expires_at)

#### 3.5.2. Wydajność Frontendu

**Testy Lighthouse:**

- ✅ Performance Score > 80
- ✅ First Contentful Paint (FCP) < 1.8s
- ✅ Largest Contentful Paint (LCP) < 2.5s
- ✅ Time to Interactive (TTI) < 3.8s
- ✅ Cumulative Layout Shift (CLS) < 0.1

**Testy renderowania:**

- ✅ Renderowanie listy 30 autorów → czas < 100ms
- ✅ Renderowanie listy 30 książek → czas < 200ms
- ✅ Przełączanie między stronami → czas < 500ms
- ✅ Otwieranie modali → czas < 200ms

#### 3.5.3. Wydajność Integracji

- ✅ Timeout OpenLibrary API → 10s
- ✅ Retry przy błędach sieciowych → max 3 próby
- ✅ Cache OpenLibrary → brak wywołań API przy ważnym cache

### 3.6. Testy Interfejsu Użytkownika (UI Tests)

**Cel**: Weryfikacja, że interfejs użytkownika działa poprawnie i jest intuicyjny.

**Narzędzia**:

- **Playwright** lub **Cypress** do testów wizualnych
- **@axe-core/playwright** do testów dostępności

**Zakres testów UI:**

#### 3.6.1. Responsywność

- ✅ Desktop (1920x1080) → wszystkie elementy widoczne
- ✅ Laptop (1366x768) → wszystkie elementy widoczne
- ✅ Tablet (768x1024) → układ dostosowany
- ✅ Mobile (375x667) → układ dostosowany (jeśli dotyczy)

#### 3.6.2. Dostępność (A11y)

- ✅ Kontrast kolorów (WCAG AA)
- ✅ Nawigacja klawiaturą (Tab, Enter, Escape)
- ✅ Etykiety formularzy (aria-label)
- ✅ Komunikaty błędów (aria-live)
- ✅ Focus indicators
- ✅ Alt text dla obrazów (jeśli dotyczy)

#### 3.6.3. Stany UI

- ✅ Loading states → wyświetlenie skeleton/loader
- ✅ Error states → wyświetlenie komunikatu błędu
- ✅ Empty states → wyświetlenie komunikatu "Brak wyników"
- ✅ Success states → wyświetlenie komunikatu sukcesu (toast)

#### 3.6.4. Interakcje

- ✅ Kliknięcia przycisków → odpowiednia akcja
- ✅ Wypełnianie formularzy → walidacja w czasie rzeczywistym
- ✅ Wybór opcji w selectach → aktualizacja UI
- ✅ Zaznaczanie checkboxów → aktualizacja stanu
- ✅ Otwieranie/zamykanie modali → animacje i focus trap
- ✅ Paginacja → przejście między stronami
- ✅ Sortowanie → aktualizacja listy
- ✅ Filtrowanie → aktualizacja listy

## 4. Scenariusze Testowe dla Kluczowych Funkcjonalności

### 4.1. Autentykacja

#### TC-AUTH-001: Rejestracja użytkownika

**Warunki wstępne**: Brak konta użytkownika
**Kroki**:

1. Użytkownik otwiera /register
2. Wypełnia email i hasło (min. 6 znaków)
3. Wysyła formularz
   **Oczekiwany rezultat**:

- Utworzenie konta w Supabase Auth
- Utworzenie profilu w tabeli `profiles` (author_count=0, work_count=0)
- Przekierowanie do /app/authors
- Sesja użytkownika aktywna

#### TC-AUTH-002: Logowanie użytkownika

**Warunki wstępne**: Istniejące konto użytkownika
**Kroki**:

1. Użytkownik otwiera /login
2. Wprowadza email i hasło
3. Wysyła formularz
   **Oczekiwany rezultat**:

- Uwierzytelnienie w Supabase Auth
- Przekierowanie do /app/authors
- Sesja użytkownika aktywna

#### TC-AUTH-003: Nieprawidłowe dane logowania

**Kroki**:

1. Użytkownik wprowadza nieprawidłowy email lub hasło
2. Wysyła formularz
   **Oczekiwany rezultat**:

- Komunikat błędu: "Nieprawidłowy email lub hasło"
- Status 401
- Brak przekierowania

#### TC-AUTH-004: Reset hasła

**Kroki**:

1. Użytkownik otwiera /forgot-password
2. Wprowadza email
3. Wysyła formularz
4. Otrzymuje email z tokenem (mock)
5. Otwiera /reset-password?token=...
6. Wprowadza nowe hasło
7. Wysyła formularz
   **Oczekiwany rezultat**:

- Wysłanie emaila z tokenem resetu
- Możliwość ustawienia nowego hasła
- Możliwość logowania nowym hasłem

### 4.2. Zarządzanie Autorami

#### TC-AUTHORS-001: Wyszukiwanie autora w OpenLibrary

**Kroki**:

1. Zalogowany użytkownik otwiera /app/authors
2. Klika "Dodaj autora"
3. Wybiera zakładkę "Wyszukaj w OpenLibrary"
4. Wprowadza "Tolkien"
5. Klika "Szukaj"
   **Oczekiwany rezultat**:

- Wyświetlenie listy autorów z OpenLibrary
- Każdy wynik zawiera: name, openlibrary_id
- Możliwość wyboru autora z listy

#### TC-AUTHORS-002: Import autora z OpenLibrary

**Kroki**:

1. Użytkownik wyszukuje autora (TC-AUTHORS-001)
2. Wybiera autora z listy
3. Klika "Importuj"
   **Oczekiwany rezultat**:

- Import autora do bazy danych
- Import wszystkich dzieł autora z OpenLibrary
- Wyświetlenie autora na liście /app/authors
- Aktualizacja licznika autorów w profilu
- Cache OpenLibrary (ol_fetched_at, ol_expires_at = +7 dni)

#### TC-AUTHORS-003: Ręczne dodanie autora

**Kroki**:

1. Zalogowany użytkownik otwiera /app/authors
2. Klika "Dodaj autora"
3. Wybiera zakładkę "Dodaj ręcznie"
4. Wprowadza nazwę autora
5. Zapisuje
   **Oczekiwany rezultat**:

- Utworzenie autora w bazie (manual=true, owner_user_id=user.id)
- Wyświetlenie autora na liście
- Aktualizacja licznika autorów

#### TC-AUTHORS-004: Przeglądanie dzieł autora

**Kroki**:

1. Zalogowany użytkownik otwiera /app/authors
2. Klika na autora w tabeli
   **Oczekiwany rezultat**:

- Przejście do /app/authors/{authorId}
- Wyświetlenie listy dzieł autora (max 30 na stronę)
- Sortowanie domyślne: published_desc
- Możliwość zmiany sortowania (title_asc)
- Paginacja (jeśli >30 dzieł)

#### TC-AUTHORS-005: Usunięcie autora

**Kroki**:

1. Zalogowany użytkownik otwiera /app/authors
2. Klika przycisk usuwania przy autorze
3. Potwierdza w dialogu
   **Oczekiwany rezultat**:

- Usunięcie powiązania user_author
- Aktualizacja licznika autorów (author_count--)
- Autor znika z listy
- Globalny autor (z OpenLibrary) pozostaje w bazie

### 4.3. Zarządzanie Książkami

#### TC-BOOKS-001: Masowe dodanie książek do biblioteki

**Kroki**:

1. Zalogowany użytkownik otwiera /app/authors/{authorId}
2. Zaznacza wiele dzieł (checkbox)
3. Klika "Dodaj do biblioteki"
   **Oczekiwany rezultat**:

- Dodanie dzieł do user_works
- Status domyślny: "to_read"
- Aktualizacja licznika dzieł (work_count += liczba dodanych)
- Wyświetlenie dodanych książek w /app/books
- Deduplikacja (pominięcie już istniejących)

#### TC-BOOKS-002: Zmiana statusu czytania

**Kroki**:

1. Zalogowany użytkownik otwiera /app/books
2. Wybiera książkę
3. Zmienia status (np. "to_read" → "in_progress")
   **Oczekiwany rezultat**:

- Aktualizacja statusu w bazie
- Aktualizacja status_updated_at
- Wyświetlenie zaktualizowanego statusu w UI

#### TC-BOOKS-003: Masowa zmiana statusów

**Kroki**:

1. Zalogowany użytkownik otwiera /app/books
2. Zaznacza wiele książek
3. Wybiera status z dropdown
4. Klika "Zastosuj"
   **Oczekiwany rezultat**:

- Aktualizacja statusu wszystkich zaznaczonych książek
- Aktualizacja status_updated_at dla każdej książki
- Wyświetlenie zaktualizowanych statusów w UI

#### TC-BOOKS-004: Filtrowanie książek

**Kroki**:

1. Zalogowany użytkownik otwiera /app/books
2. Wybiera filtr statusu: "Read"
3. Wybiera filtr dostępności: "Available in Legimi"
   **Oczekiwany rezultat**:

- Wyświetlenie tylko książek ze statusem "Read" i available_in_legimi=true
- Aktualizacja URL z parametrami zapytania
- Możliwość wyczyszczenia filtrów

#### TC-BOOKS-005: Sortowanie książek

**Kroki**:

1. Zalogowany użytkownik otwiera /app/books
2. Wybiera sortowanie "Tytuł A-Z"
   **Oczekiwany rezultat**:

- Wyświetlenie książek posortowanych alfabetycznie po tytule
- Aktualizacja URL z parametrem sort
- Możliwość zmiany na "Published (newest first)"

### 4.4. Limity Użytkownika

#### TC-LIMITS-001: Przekroczenie limitu autorów

**Warunki wstępne**: Użytkownik ma 500 autorów (max_authors)
**Kroki**:

1. Użytkownik próbuje dodać kolejnego autora
   **Oczekiwany rezultat**:

- Błąd 409 Conflict
- Komunikat: "Limit autorów osiągnięty (500 autorów na użytkownika)"
- Autor nie zostaje dodany

#### TC-LIMITS-002: Przekroczenie limitu dzieł

**Warunki wstępne**: Użytkownik ma 5000 dzieł (max_works)
**Kroki**:

1. Użytkownik próbuje dodać kolejne dzieło
   **Oczekiwany rezultat**:

- Błąd 409 Conflict
- Komunikat: "Limit dzieł osiągnięty (5000 dzieł na użytkownika)"
- Dzieło nie zostaje dodane

#### TC-LIMITS-003: Wyświetlanie limitów w UI

**Kroki**:

1. Zalogowany użytkownik otwiera /app/authors lub /app/books
   **Oczekiwany rezultat**:

- Wyświetlenie wskaźnika limitów (np. "450/500 autorów")
- Wizualne oznaczenie przy zbliżaniu się do limitu

### 4.5. Integracja z OpenLibrary

#### TC-OL-001: Timeout OpenLibrary API

**Kroki**:

1. Użytkownik wyszukuje autora
2. OpenLibrary API nie odpowiada w ciągu 10s
   **Oczekiwany rezultat**:

- Timeout po 10s
- Komunikat błędu: "Timeout podczas pobierania danych z OpenLibrary"
- Status 504 Gateway Timeout

#### TC-OL-002: Wykorzystanie cache OpenLibrary

**Warunki wstępne**: Autor został zaimportowany wcześniej (cache ważny)
**Kroki**:

1. Użytkownik ponownie importuje tego samego autora
   **Oczekiwany rezultat**:

- Brak wywołania OpenLibrary API
- Zwrócenie danych z cache
- Szybsza odpowiedź

#### TC-OL-003: Odświeżanie cache OpenLibrary

**Warunki wstępne**: Autor został zaimportowany wcześniej (cache ważny)
**Kroki**:

1. Użytkownik importuje autora z parametrem forceRefresh=true
   **Oczekiwany rezultat**:

- Wywołanie OpenLibrary API mimo ważnego cache
- Aktualizacja cache (ol_fetched_at, ol_expires_at)
- Zwrócenie świeżych danych

## 5. Środowisko Testowe

### 5.1. Środowiska Testowe

#### 5.1.1. Środowisko Lokalne (Development)

- **Baza danych**: Lokalna instancja Supabase (Docker)
- **OpenLibrary API**: Mock Service Worker (MSW) lub rzeczywiste API
- **Node.js**: 22.14.0
- **Przeznaczenie**: Testy jednostkowe, integracyjne, szybkie iteracje

#### 5.1.2. Środowisko Testowe (Staging)

- **Baza danych**: Dedykowana instancja Supabase (testowa)
- **OpenLibrary API**: Rzeczywiste API (z ograniczeniami)
- **Hosting**: DigitalOcean (testowa instancja)
- **Przeznaczenie**: Testy E2E, testy wydajnościowe, testy bezpieczeństwa

#### 5.1.3. Środowisko Produkcyjne

- **Baza danych**: Produkcyjna instancja Supabase
- **OpenLibrary API**: Rzeczywiste API
- **Hosting**: DigitalOcean (produkcyjna instancja)
- **Przeznaczenie**: Testy smoke, testy regresji przed release

### 5.2. Konfiguracja Środowiska Testowego

#### 5.2.1. Zmienne Środowiskowe

**Lokalne:**

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=test_anon_key
SUPABASE_SERVICE_ROLE_KEY=test_service_role_key
OPENLIBRARY_API_URL=https://openlibrary.org
NODE_ENV=test
```

**Staging:**

```env
SUPABASE_URL=https://test-project.supabase.co
SUPABASE_ANON_KEY=staging_anon_key
SUPABASE_SERVICE_ROLE_KEY=staging_service_role_key
OPENLIBRARY_API_URL=https://openlibrary.org
NODE_ENV=staging
```

#### 5.2.2. Dane Testowe

**Użytkownicy testowi:**

- `test-user-1@example.com` - użytkownik z danymi testowymi
- `test-user-2@example.com` - użytkownik bez danych
- `test-admin@example.com` - (jeśli potrzebne)

**Dane testowe w bazie:**

- 10 autorów testowych (mix OpenLibrary i ręcznych)
- 100 dzieł testowych
- 200 wydań testowych
- Powiązania user_authors i user_works

### 5.3. Przygotowanie Środowiska Testowego

#### 5.3.1. Setup Lokalny

```bash
# 1. Instalacja zależności
npm install

# 2. Uruchomienie lokalnej instancji Supabase
npx supabase start

# 3. Uruchomienie migracji
npx supabase db reset

# 4. Seed danych testowych (jeśli potrzebne)
npm run test:seed

# 5. Uruchomienie testów
npm run test
```

#### 5.3.2. Cleanup Po Testach

- Czyszczenie danych testowych po każdym teście (jeśli dotyczy)
- Reset bazy danych przed testami E2E
- Czyszczenie cache OpenLibrary (jeśli mockowany)

## 6. Narzędzia do Testowania

### 6.1. Frameworki Testowe

#### 6.1.1. Testy Jednostkowe i Integracyjne

- **Vitest** (zalecane) - szybki, kompatybilny z Vite/Astro
- Alternatywa: **Jest** - bardziej dojrzały, większa społeczność

**Instalacja:**

```bash
npm install -D vitest @vitest/ui
```

**Konfiguracja (vitest.config.ts):**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

#### 6.1.2. Testy Komponentów React

- **@testing-library/react** - testowanie komponentów React
- **@testing-library/user-event** - symulacja interakcji użytkownika
- **@testing-library/jest-dom** - dodatkowe matchery

**Instalacja:**

```bash
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

#### 6.1.3. Testy E2E

- **Playwright** (zalecane) - szybki, wsparcie dla wielu przeglądarek
- Alternatywa: **Cypress** - bardziej dojrzały, lepsze narzędzia deweloperskie

**Instalacja:**

```bash
npm install -D @playwright/test
npx playwright install
```

**Konfiguracja (playwright.config.ts):**

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

### 6.2. Narzędzia Pomocnicze

#### 6.2.1. Mockowanie

- **MSW (Mock Service Worker)** - mockowanie HTTP requests
- **@mswjs/data** - generowanie danych testowych

**Instalacja:**

```bash
npm install -D msw @mswjs/data
```

#### 6.2.2. Testy Wydajnościowe

- **k6** - testy obciążeniowe API
- **Lighthouse** - testy wydajności frontendu

**Instalacja:**

```bash
npm install -D @lhci/cli
# k6 - instalacja osobna (https://k6.io/docs/getting-started/installation/)
```

#### 6.2.3. Testy Dostępności

- **@axe-core/playwright** - testy dostępności w Playwright

**Instalacja:**

```bash
npm install -D @axe-core/playwright
```

#### 6.2.4. Coverage

- **@vitest/coverage-v8** - pokrycie kodu testami

**Instalacja:**

```bash
npm install -D @vitest/coverage-v8
```

### 6.3. Konfiguracja Package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:performance": "k6 run e2e/performance/load-test.js",
    "test:lighthouse": "lhci autorun",
    "test:all": "npm run test && npm run test:e2e"
  }
}
```

## 7. Harmonogram Testów

### 7.1. Fazy Testowania

#### Faza 1: Testy Jednostkowe (Tydzień 1-2)

- **Cel**: Pokrycie testami jednostkowymi wszystkich serwisów i funkcji pomocniczych
- **Zakres**:
  - Serwisy biznesowe (ProfileService, AuthorsService, WorksService, etc.)
  - Schematy walidacji Zod
  - Funkcje pomocnicze
- **Kryterium zakończenia**: 80% pokrycia kodu serwisów i walidacji

#### Faza 2: Testy Integracyjne (Tydzień 2-3)

- **Cel**: Weryfikacja współdziałania komponentów
- **Zakres**:
  - Integracja API z bazą danych
  - Integracja z OpenLibrary API
  - Integracja middleware z API
- **Kryterium zakończenia**: Wszystkie endpointy API przetestowane

#### Faza 3: Testy Komponentów React (Tydzień 3-4)

- **Cel**: Weryfikacja działania komponentów UI
- **Zakres**:
  - Komponenty formularzy
  - Komponenty list
  - Komponenty interaktywne
  - Hooks
- **Kryterium zakończenia**: Wszystkie komponenty przetestowane

#### Faza 4: Testy E2E (Tydzień 4-5)

- **Cel**: Weryfikacja pełnych przepływów użytkownika
- **Zakres**:
  - Przepływ autentykacji
  - Przepływ zarządzania autorami
  - Przepływ zarządzania książkami
  - Przepływ usuwania konta
- **Kryterium zakończenia**: Wszystkie scenariusze E2E przetestowane

#### Faza 5: Testy Bezpieczeństwa (Tydzień 5)

- **Cel**: Weryfikacja zabezpieczeń aplikacji
- **Zakres**:
  - Testy autoryzacji
  - Testy RLS
  - Testy walidacji wejścia
  - Testy rate limiting
- **Kryterium zakończenia**: Wszystkie testy bezpieczeństwa przetestowane

#### Faza 6: Testy Wydajnościowe (Tydzień 6)

- **Cel**: Weryfikacja wydajności aplikacji
- **Zakres**:
  - Testy obciążeniowe API
  - Testy wydajności frontendu
  - Testy integracji z OpenLibrary
- **Kryterium zakończenia**: Wszystkie metryki wydajności spełnione

#### Faza 7: Testy Regresji (Tydzień 7)

- **Cel**: Weryfikacja, że nowe zmiany nie zepsuły istniejących funkcjonalności
- **Zakres**: Wszystkie testy z poprzednich faz
- **Kryterium zakończenia**: Wszystkie testy przechodzą

### 7.2. Harmonogram Codzienny

**Poniedziałek-Piątek:**

- **Rano (9:00-12:00)**: Rozwój nowych funkcjonalności
- **Po południu (13:00-16:00)**: Pisanie testów dla nowych funkcjonalności
- **Wieczór (16:00-17:00)**: Uruchomienie testów, naprawa błędów

**Codziennie:**

- Uruchomienie testów jednostkowych przed commit (pre-commit hook)
- Uruchomienie testów integracyjnych w CI/CD
- Uruchomienie testów E2E przed merge do main

### 7.3. Testy w CI/CD

**GitHub Actions Workflow:**

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "22.14.0"
      - run: npm ci
      - run: npm run test
      - run: npm run test:coverage

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "22.14.0"
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

## 8. Kryteria Akceptacji Testów

### 8.1. Kryteria Ogólne

- ✅ **Pokrycie kodu**: Minimum 80% dla serwisów i logiki biznesowej
- ✅ **Wszystkie testy przechodzą**: 100% testów jednostkowych i integracyjnych
- ✅ **Brak regresji**: Wszystkie istniejące testy przechodzą po nowych zmianach
- ✅ **Czytelność testów**: Testy są czytelne i łatwe do utrzymania
- ✅ **Szybkość testów**: Testy jednostkowe < 5s, testy integracyjne < 30s

### 8.2. Kryteria dla Poszczególnych Typów Testów

#### 8.2.1. Testy Jednostkowe

- ✅ Każda funkcja/metoda ma przynajmniej jeden test
- ✅ Testy pokrywają happy path i edge cases
- ✅ Testy są izolowane (nie zależą od innych testów)
- ✅ Testy są deterministyczne (zawsze ten sam wynik)

#### 8.2.2. Testy Integracyjne

- ✅ Wszystkie endpointy API przetestowane
- ✅ Integracja z bazą danych działa poprawnie
- ✅ Integracja z OpenLibrary API działa poprawnie (lub mockowana)
- ✅ Obsługa błędów działa poprawnie

#### 8.2.3. Testy E2E

- ✅ Główny przepływ MVP przetestowany (TC-E2E-005)
- ✅ Wszystkie krytyczne przepływy użytkownika przetestowane
- ✅ Testy są stabilne (flakiness < 5%)

#### 8.2.4. Testy Bezpieczeństwa

- ✅ Wszystkie testy autoryzacji przechodzą
- ✅ RLS działa poprawnie
- ✅ Walidacja wejścia działa poprawnie
- ✅ Rate limiting działa poprawnie

#### 8.2.5. Testy Wydajnościowe

- ✅ API: czas odpowiedzi < 2s dla 100 równoczesnych użytkowników
- ✅ Frontend: Lighthouse Performance Score > 80
- ✅ Integracja: timeout OpenLibrary 10s

### 8.3. Definicja "Gotowe" (Definition of Done)

Funkcjonalność jest uznana za "gotową" gdy:

- ✅ Kod został napisany i zreviewowany
- ✅ Testy jednostkowe napisane i przechodzą
- ✅ Testy integracyjne napisane i przechodzą
- ✅ Testy E2E napisane i przechodzą (jeśli dotyczy)
- ✅ Dokumentacja zaktualizowana (jeśli dotyczy)
- ✅ Linter przechodzi bez błędów
- ✅ Code coverage >= 80% dla nowego kodu

## 9. Role i Odpowiedzialności w Procesie Testowania

### 9.1. Role

#### 9.1.1. Developer (Programista)

- **Odpowiedzialności**:
  - Pisanie testów jednostkowych dla nowego kodu
  - Uruchamianie testów lokalnie przed commit
  - Naprawa błędów wykrytych przez testy
  - Utrzymanie pokrycia kodu testami >= 80%
- **Narzędzia**: Vitest, lokalne środowisko testowe

#### 9.1.2. QA Engineer (Inżynier QA)

- **Odpowiedzialności**:
  - Tworzenie i utrzymanie planu testów
  - Pisanie testów E2E
  - Wykonywanie testów ręcznych (jeśli potrzebne)
  - Raportowanie błędów
  - Weryfikacja kryteriów akceptacji
- **Narzędzia**: Playwright, narzędzia do testów ręcznych

#### 9.1.3. Tech Lead / Senior Developer

- **Odpowiedzialności**:
  - Code review testów
  - Weryfikacja jakości testów
  - Decyzje dotyczące strategii testowania
  - Optymalizacja testów
- **Narzędzia**: Wszystkie narzędzia testowe

#### 9.1.4. DevOps Engineer

- **Odpowiedzialności**:
  - Konfiguracja CI/CD pipeline
  - Utrzymanie środowisk testowych
  - Monitorowanie wydajności testów
  - Optymalizacja czasu wykonania testów
- **Narzędzia**: GitHub Actions, Docker, infrastruktura

### 9.2. Proces Code Review

1. **Developer** tworzy Pull Request z nowym kodem i testami
2. **QA Engineer** weryfikuje testy i wykonuje testy E2E
3. **Tech Lead** wykonuje code review
4. **Developer** wprowadza poprawki (jeśli potrzebne)
5. **Tech Lead** zatwierdza PR
6. **DevOps** weryfikuje, że testy w CI/CD przechodzą

### 9.3. Komunikacja

- **Daily Standup**: Raportowanie postępów w testach
- **Sprint Planning**: Planowanie testów dla nowych funkcjonalności
- **Sprint Retrospective**: Omówienie problemów z testami
- **Bug Triage**: Priorytetyzacja błędów wykrytych przez testy

## 10. Procedury Raportowania Błędów

### 10.1. Szablon Raportu Błędu

**Tytuł**: Krótki, opisowy tytuł błędu

**Priorytet**:

- **P0 (Krytyczny)**: Blokuje główne funkcjonalności, bezpieczeństwo
- **P1 (Wysoki)**: Wpływa na główne funkcjonalności
- **P2 (Średni)**: Wpływa na mniej ważne funkcjonalności
- **P3 (Niski)**: Kosmetyczne, nie wpływa na funkcjonalność

**Kroki do odtworzenia**:

1. Krok 1
2. Krok 2
3. ...

**Oczekiwane zachowanie**: Opis tego, co powinno się wydarzyć

**Rzeczywiste zachowanie**: Opis tego, co się faktycznie wydarzyło

**Środowisko**:

- System operacyjny: Windows 10
- Przeglądarka: Chrome 120
- Wersja aplikacji: 0.0.1
- Środowisko: Development/Staging/Production

**Logi**:

- Logi z konsoli przeglądarki
- Logi z serwera
- Screenshoty (jeśli dotyczy)

**Dodatkowe informacje**:

- Czy błąd jest reprodukowalny? Tak/Nie
- Częstotliwość występowania: Zawsze/Czasami/Rzadko
- Czy występuje w innych przeglądarkach? Tak/Nie

### 10.2. Narzędzia do Raportowania

- **GitHub Issues**: Do śledzenia błędów i zadań
- **GitHub Projects**: Do zarządzania backlogiem
- **Slack/Teams**: Do komunikacji o krytycznych błędach

### 10.3. Proces Naprawy Błędów

1. **Raportowanie**: QA Engineer lub Developer raportuje błąd
2. **Priorytetyzacja**: Tech Lead przypisuje priorytet
3. **Przypisanie**: Błąd przypisany do Developera
4. **Naprawa**: Developer naprawia błąd i pisze testy
5. **Weryfikacja**: QA Engineer weryfikuje naprawę
6. **Zamknięcie**: Błąd oznaczony jako zamknięty

### 10.4. Metryki Błędów

- **Liczba błędów wykrytych przez testy**: Śledzenie skuteczności testów
- **Czas naprawy błędów**: Średni czas od wykrycia do naprawy
- **Wskaźnik regresji**: Liczba błędów wprowadzonych przez nowe zmiany
- **Pokrycie testami**: Procent kodu pokrytego testami

## 11. Załączniki

### 11.1. Przykładowe Testy

#### Przykład Testu Jednostkowego (Vitest)

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { AuthorsService } from "@/lib/services/authors.service";
import { createSupabaseTestClient } from "@/test/utils/supabase";

describe("AuthorsService", () => {
  let service: AuthorsService;
  let supabase: ReturnType<typeof createSupabaseTestClient>;

  beforeEach(() => {
    supabase = createSupabaseTestClient();
    service = new AuthorsService(supabase);
  });

  describe("createManualAuthor", () => {
    it("should create a manual author with correct owner", async () => {
      const userId = "test-user-id";
      const authorData = {
        name: "Test Author",
        manual: true as const,
      };

      const author = await service.createManualAuthor(userId, authorData);

      expect(author).toBeDefined();
      expect(author.name).toBe("Test Author");
      expect(author.manual).toBe(true);
      expect(author.owner_user_id).toBe(userId);
      expect(author.openlibrary_id).toBeNull();
    });

    it("should throw error if manual author has openlibrary_id", async () => {
      const userId = "test-user-id";
      const authorData = {
        name: "Test Author",
        manual: true as const,
        openlibrary_id: "OL123A",
      };

      await expect(service.createManualAuthor(userId, authorData)).rejects.toThrow(
        "Manual author cannot have openlibrary_id"
      );
    });
  });
});
```

#### Przykład Testu Integracyjnego (Vitest)

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST } from "@/pages/api/authors/index";
import { createTestUser, deleteTestUser } from "@/test/utils/auth";

describe("POST /api/authors", () => {
  let testUser: { id: string; email: string };

  beforeAll(async () => {
    testUser = await createTestUser();
  });

  afterAll(async () => {
    await deleteTestUser(testUser.id);
  });

  it("should create a manual author", async () => {
    const request = new Request("http://localhost/api/authors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testUser.token}`,
      },
      body: JSON.stringify({
        name: "Test Author",
        manual: true,
      }),
    });

    const response = await POST({
      request,
      locals: { supabase: createSupabaseTestClient(testUser.token) },
    } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.author).toBeDefined();
    expect(data.author.name).toBe("Test Author");
  });
});
```

#### Przykład Testu E2E (Playwright)

```typescript
import { test, expect } from "@playwright/test";

test.describe("Authors Management", () => {
  test.beforeEach(async ({ page }) => {
    // Logowanie użytkownika testowego
    await page.goto("/login");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/app/authors");
  });

  test("should add author from OpenLibrary", async ({ page }) => {
    // Otwarcie modala dodawania autora
    await page.click('button:has-text("Dodaj autora")');

    // Wybór zakładki wyszukiwania
    await page.click('button:has-text("Wyszukaj w OpenLibrary")');

    // Wyszukiwanie autora
    await page.fill('input[placeholder*="Szukaj"]', "Tolkien");
    await page.click('button:has-text("Szukaj")');

    // Oczekiwanie na wyniki
    await page.waitForSelector('[data-testid="author-search-result"]');

    // Wybór pierwszego wyniku
    await page.click('[data-testid="author-search-result"]:first-child');

    // Import autora
    await page.click('button:has-text("Importuj")');

    // Weryfikacja dodania autora
    await expect(page.locator("text=Tolkien")).toBeVisible();
  });
});
```

### 11.2. Checklist Testów

#### Checklist przed Release

- [ ] Wszystkie testy jednostkowe przechodzą
- [ ] Wszystkie testy integracyjne przechodzą
- [ ] Wszystkie testy E2E przechodzą
- [ ] Testy bezpieczeństwa przechodzą
- [ ] Testy wydajnościowe spełniają kryteria
- [ ] Code coverage >= 80%
- [ ] Brak znanych krytycznych błędów
- [ ] Dokumentacja zaktualizowana
- [ ] Changelog zaktualizowany

### 11.3. Słownik Terminów

- **Unit Test**: Test pojedynczej funkcji/metody w izolacji
- **Integration Test**: Test współdziałania wielu komponentów
- **E2E Test**: Test pełnego przepływu użytkownika
- **Mock**: Symulacja zewnętrznego serwisu/API
- **Stub**: Uproszczona implementacja komponentu
- **Fixture**: Dane testowe używane w testach
- **Coverage**: Procent kodu pokrytego testami
- **Flakiness**: Nieprzewidywalność testów (czasem przechodzą, czasem nie)

---

**Wersja dokumentu**: 1.0  
**Data utworzenia**: 2025-01-XX  
**Ostatnia aktualizacja**: 2025-01-XX  
**Autor**: QA Engineer  
**Status**: Draft / Final
