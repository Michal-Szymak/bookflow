# API Endpoint Implementation Plan: GET /api/user/profile

## 1. Przegląd punktu końcowego

Endpoint `GET /api/user/profile` służy do pobierania danych profilu zalogowanego użytkownika, w szczególności liczników autorów i dzieł oraz limitów maksymalnych. Endpoint jest przeznaczony do wyświetlania informacji o profilu użytkownika w interfejsie użytkownika (np. w globalnym nagłówku). Jest to prosty endpoint odczytowy, który nie przyjmuje żadnych parametrów i zwraca podstawowe statystyki profilu użytkownika.

**Główne funkcjonalności:**

- Pobieranie danych profilu użytkownika z tabeli `profiles`
- Zwracanie liczników: `author_count`, `work_count`
- Zwracanie limitów: `max_authors` (domyślnie 500), `max_works` (domyślnie 5000)
- Weryfikacja autoryzacji użytkownika
- Obsługa przypadku braku profilu (404)

**Wykorzystywane zasoby bazy danych:**

- Tabela `profiles` (PK: `user_id` uuid, FK do `auth.users`)
- RLS policy: `profiles_select_authenticated` (user_id = auth.uid())
- Indeks: `profiles(user_id)` (primary key)

## 2. Szczegóły żądania

**Metoda HTTP:** `GET`

**Struktura URL:** `/api/user/profile`

**Parametry zapytania (query parameters):** Brak

**Request Body:** Brak (endpoint GET)

**Wymagana autoryzacja:** Tak (Bearer token w nagłówku Authorization)

**Przykładowe żądanie:**

```http
GET /api/user/profile HTTP/1.1
Host: example.com
Authorization: Bearer <access_token>
```

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

Należy rozważyć dodanie nowych typów DTO w `src/types.ts`:

1. **ProfileResponseDto** (nowy typ)
   - Reprezentuje odpowiedź endpointu
   - Pola: `author_count: number`, `work_count: number`, `max_authors: number`, `max_works: number`
   - Alternatywnie: można użyć istniejącego `ProfileDto` (alias do `ProfileRow`), ale zalecane jest utworzenie dedykowanego DTO zawierającego tylko pola zwracane przez endpoint

2. **ProfileDto** (istniejący, linia 25 w `src/types.ts`)
   - Typ alias do `ProfileRow` - pełne dane profilu z bazy danych
   - Zawiera wszystkie pola: `user_id`, `author_count`, `work_count`, `max_authors`, `max_works`, `created_at`, `updated_at`
   - Może być użyty wewnętrznie w serwisie, ale odpowiedź API powinna zawierać tylko wymagane pola

### Command Modele

Brak - endpoint GET nie przyjmuje body ani parametrów zapytania.

### Schematy walidacji

Brak - endpoint nie przyjmuje danych wejściowych do walidacji.

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

**Struktura odpowiedzi:**

```json
{
  "author_count": 42,
  "work_count": 150,
  "max_authors": 500,
  "max_works": 5000
}
```

**Opis pól:**

- **author_count** (number, wymagany): Liczba autorów przypisanych do użytkownika (0-500)
- **work_count** (number, wymagany): Liczba dzieł przypisanych do użytkownika (0-5000)
- **max_authors** (number, wymagany): Maksymalna liczba autorów dozwolona dla użytkownika (domyślnie 500)
- **max_works** (number, wymagany): Maksymalna liczba dzieł dozwolona dla użytkownika (domyślnie 5000)

**Nagłówki odpowiedzi:**

- `Content-Type: application/json`
- `Cache-Control: private, no-cache` (opcjonalnie, jeśli profil może się zmieniać często)

### Błąd autoryzacji (401 Unauthorized)

**Struktura odpowiedzi:**

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**Scenariusz:** Użytkownik nie jest zalogowany lub token autoryzacyjny jest nieprawidłowy/wygasły.

### Profil nie znaleziony (404 Not Found)

**Struktura odpowiedzi:**

```json
{
  "error": "Not Found",
  "message": "Profile not found"
}
```

**Scenariusz:** Profil użytkownika nie istnieje w tabeli `profiles`. Może się zdarzyć, jeśli:

- Profil nie został utworzony podczas rejestracji (edge case)
- Profil został usunięty (np. podczas testów)

### Błąd serwera (500 Internal Server Error)

**Struktura odpowiedzi:**

```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

**Scenariusz:** Wystąpił nieoczekiwany błąd podczas przetwarzania żądania (np. błąd połączenia z bazą danych, błąd RLS policy).

## 5. Przepływ danych

### Krok po kroku:

1. **Middleware (Astro)**
   - Middleware w `src/middleware/index.ts` tworzy klienta Supabase z tokenem autoryzacyjnym z nagłówka `Authorization`
   - Klient Supabase jest dostępny w `context.locals.supabase`

2. **Weryfikacja autoryzacji**
   - Wywołanie `supabase.auth.getUser()` w celu weryfikacji tokena i pobrania danych użytkownika
   - Jeśli brak użytkownika lub błąd autoryzacji → zwróć 401

3. **Pobranie profilu z bazy danych**
   - Wywołanie serwisu (lub bezpośrednie zapytanie) do pobrania profilu użytkownika
   - Zapytanie: `SELECT author_count, work_count, max_authors, max_works FROM profiles WHERE user_id = auth.uid()`
   - RLS automatycznie filtruje wyniki zgodnie z policy `profiles_select_authenticated`

4. **Weryfikacja istnienia profilu**
   - Jeśli profil nie istnieje → zwróć 404
   - Jeśli wystąpił błąd zapytania → zwróć 500

5. **Przygotowanie odpowiedzi**
   - Mapowanie danych z bazy na strukturę odpowiedzi DTO
   - Zwrócenie tylko wymaganych pól (author_count, work_count, max_authors, max_works)

6. **Zwrócenie odpowiedzi**
   - Zwrócenie odpowiedzi JSON z kodem 200

### Diagram przepływu:

```
Request → Middleware (auth) → Verify User → Fetch Profile (RLS)
→ Check Exists → Map to DTO → Return Response (200)
```

### Wykorzystanie serwisu

Należy rozważyć utworzenie nowego serwisu `src/lib/services/profile.service.ts`:

**ProfileService:**

- Metoda `getProfile(userId: string): Promise<ProfileRow | null>`
  - Pobiera profil użytkownika z bazy danych
  - Wykorzystuje RLS do automatycznej filtracji
  - Zwraca `null` jeśli profil nie istnieje
  - Rzuca wyjątek w przypadku błędu bazy danych

Alternatywnie, jeśli logika jest prosta, można wykonać zapytanie bezpośrednio w endpoincie, ale zalecane jest wyodrębnienie do serwisu dla lepszej organizacji kodu i możliwości ponownego użycia.

## 6. Względy bezpieczeństwa

### Autoryzacja

- **Wymagana**: Endpoint wymaga zalogowanego użytkownika
- **Mechanizm**: Bearer token w nagłówku `Authorization`
- **Weryfikacja**: `supabase.auth.getUser()` weryfikuje token i zwraca dane użytkownika
- **Brak autoryzacji**: Zwraca 401 Unauthorized

### Autoryzacja danych

- **RLS (Row Level Security)**: Supabase automatycznie filtruje wyniki zgodnie z policy `profiles_select_authenticated`
- **Policy**: `user_id = auth.uid()` - użytkownik może odczytać tylko swój własny profil
- **Zapytanie używa `user_id` z sesji/tokena**: Brak możliwości odczytania profilu innego użytkownika
- **Brak parametrów wejściowych**: Endpoint nie przyjmuje żadnych parametrów, więc nie ma ryzyka manipulacji

### Walidacja danych wejściowych

- Brak danych wejściowych do walidacji (endpoint GET bez parametrów)

### Ochrona przed atakami

- **SQL Injection**: Użycie Supabase Client zapewnia parametryzowane zapytania
- **XSS**: Dane wyjściowe są zwracane jako JSON, nie są renderowane bezpośrednio w HTML
- **CSRF**: Astro automatycznie obsługuje ochronę CSRF dla endpointów API
- **Rate Limiting**: Endpoint może być poddany rate limitingowi, ale nie jest to wymagane w specyfikacji (endpoint odczytowy, niski koszt)

## 7. Obsługa błędów

### Lista potencjalnych błędów i sposób ich obsługi:

1. **401 Unauthorized - Brak autoryzacji**
   - **Przyczyna**: Użytkownik nie jest zalogowany lub token jest nieprawidłowy/wygasły
   - **Obsługa**: Zwróć 401 z komunikatem "Authentication required"
   - **Logowanie**: Zaloguj ostrzeżenie z informacją o próbie dostępu bez autoryzacji

2. **404 Not Found - Profil nie istnieje**
   - **Przyczyna**: Profil użytkownika nie został znaleziony w tabeli `profiles`
   - **Obsługa**: Zwróć 404 z komunikatem "Profile not found"
   - **Logowanie**: Zaloguj informację o braku profilu dla użytkownika (może wskazywać na problem w procesie rejestracji)

3. **500 Internal Server Error - Błąd bazy danych**
   - **Przyczyna**: Błąd połączenia z bazą danych, błąd zapytania SQL, błąd RLS policy
   - **Obsługa**: Zwróć 500 z ogólnym komunikatem błędu (nie ujawniaj szczegółów technicznych)
   - **Logowanie**: Zaloguj pełny błąd z stack trace dla debugowania

4. **500 Internal Server Error - Błąd serwera**
   - **Przyczyna**: Nieoczekiwany błąd podczas przetwarzania (np. błąd mapowania danych)
   - **Obsługa**: Zwróć 500 z ogólnym komunikatem błędu
   - **Logowanie**: Zaloguj pełny błąd z kontekstem dla debugowania

### Strategia logowania

- **Użycie loggera**: Wykorzystaj `logger` z `src/lib/logger.ts`
- **Poziomy logowania**:
  - `logger.warn()`: Dla błędów autoryzacji (401) i brakujących profili (404)
  - `logger.error()`: Dla błędów serwera (500)
- **Kontekst logowania**: Zawsze dołączaj `userId` (jeśli dostępny) i szczegóły błędu

## 8. Rozważania dotyczące wydajności

### Potencjalne wąskie gardła:

1. **Zapytanie do bazy danych**
   - **Ryzyko**: Niskie - zapytanie używa primary key (`user_id`), więc jest bardzo szybkie
   - **Optymalizacja**: Indeks na `profiles(user_id)` jest automatyczny (primary key)

2. **RLS Policy Evaluation**
   - **Ryzyko**: Niskie - policy `profiles_select_authenticated` jest prosta (porównanie `user_id = auth.uid()`)
   - **Optymalizacja**: RLS jest zoptymalizowane przez Supabase

3. **Częstotliwość wywołań**
   - **Ryzyko**: Średnie - endpoint może być wywoływany często (np. w globalnym nagłówku przy każdym przeładowaniu strony)
   - **Optymalizacja**: Rozważyć cache'owanie odpowiedzi po stronie klienta (np. React Query, SWR) z krótkim TTL (np. 30 sekund)
   - **Nie zalecane**: Cache po stronie serwera, ponieważ dane mogą się zmieniać często (liczniki są aktualizowane przy każdej operacji)

### Strategie optymalizacji:

1. **Cache po stronie klienta**
   - Użycie biblioteki do cache'owania (React Query, SWR) z krótkim TTL
   - Automatyczne odświeżanie przy zmianie danych (np. po dodaniu autora/dzieła)

2. **Minimalizacja danych**
   - Zwracanie tylko wymaganych pól (author_count, work_count, max_authors, max_works)
   - Pominięcie pól `user_id`, `created_at`, `updated_at` w odpowiedzi

3. **Monitoring**
   - Monitorowanie czasu odpowiedzi endpointu
   - Alerty przy wzroście czasu odpowiedzi powyżej progu (np. 100ms)

## 9. Etapy wdrożenia

1. **Utworzenie typu DTO dla odpowiedzi**
   - Dodanie typu `ProfileResponseDto` w `src/types.ts`
   - Typ powinien zawierać tylko pola: `author_count`, `work_count`, `max_authors`, `max_works`

2. **Utworzenie serwisu ProfileService (opcjonalnie, ale zalecane)**
   - Utworzenie pliku `src/lib/services/profile.service.ts`
   - Implementacja klasy `ProfileService` z metodą `getProfile(userId: string)`
   - Metoda powinna używać Supabase Client do pobrania profilu z bazy danych
   - Obsługa przypadku, gdy profil nie istnieje (zwróć `null`)
   - Obsługa błędów bazy danych (rzuć wyjątek)

3. **Utworzenie endpointu API**
   - Utworzenie pliku `src/pages/api/user/profile.ts`
   - Eksport funkcji `GET` jako `APIRoute`
   - Ustawienie `export const prerender = false`

4. **Implementacja weryfikacji autoryzacji**
   - Wywołanie `supabase.auth.getUser()` w endpoincie
   - Obsługa przypadku braku użytkownika (zwróć 401)
   - Logowanie ostrzeżenia przy braku autoryzacji

5. **Implementacja pobierania profilu**
   - Wywołanie serwisu `ProfileService.getProfile(userId)` (lub bezpośrednie zapytanie do bazy)
   - Obsługa przypadku, gdy profil nie istnieje (zwróć 404)
   - Logowanie informacji o braku profilu

6. **Implementacja mapowania danych**
   - Mapowanie danych z bazy (`ProfileRow`) na strukturę odpowiedzi (`ProfileResponseDto`)
   - Wybór tylko wymaganych pól (author_count, work_count, max_authors, max_works)

7. **Implementacja obsługi błędów**
   - Obsługa błędów bazy danych (zwróć 500)
   - Logowanie błędów z pełnym kontekstem
   - Zwracanie ogólnych komunikatów błędów (bez szczegółów technicznych)

8. **Implementacja odpowiedzi sukcesu**
   - Zwrócenie odpowiedzi JSON z kodem 200
   - Ustawienie nagłówka `Content-Type: application/json`
   - Zwrócenie danych w formacie `ProfileResponseDto`

9. **Testy manualne**
   Opisz testy manualne w pliku `.ai/api/api-user-profile-get-manual-tests.md`
   - Test przypadku sukcesu (200) - użytkownik z istniejącym profilem
   - Test przypadku braku autoryzacji (401) - brak tokena lub nieprawidłowy token
   - Test przypadku braku profilu (404) - użytkownik bez profilu
   - Test przypadku błędu serwera (500) - symulacja błędu bazy danych
