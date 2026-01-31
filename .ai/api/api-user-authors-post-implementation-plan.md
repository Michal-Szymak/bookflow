# API Endpoint Implementation Plan: POST /api/user/authors

## 1. Przegląd punktu końcowego

Endpoint `POST /api/user/authors` służy do przypisania autora do profilu zalogowanego użytkownika. Endpoint tworzy relację w tabeli `user_authors`, która zwiększa licznik autorów użytkownika w profilu. Endpoint wymaga autoryzacji i jest poddany ograniczeniom: maksymalnie 500 autorów na użytkownika oraz limitowi częstotliwości 10 żądań na minutę na użytkownika.

**Główne funkcjonalności:**
- Tworzenie relacji użytkownik-autor w tabeli `user_authors`
- Automatyczne zwiększanie licznika `author_count` w profilu użytkownika (via trigger)
- Weryfikacja, że autor istnieje i jest widoczny dla użytkownika (RLS)
- Sprawdzanie, czy autor nie jest już przypisany (duplikaty)
- Egzekwowanie limitu 500 autorów na użytkownika
- Egzekwowanie limitu częstotliwości 10 żądań/minutę na użytkownika

**Wykorzystywane zasoby bazy danych:**
- Tabela `user_authors` (relacja użytkownik-autor, composite PK: user_id, author_id)
- Tabela `authors` (dane autorów, weryfikacja istnienia i widoczności)
- Tabela `profiles` (licznik `author_count`, limit `max_authors`)
- Trigger `user_authors_increment_count` (automatyczne zwiększanie licznika)
- Indeksy: `user_authors(user_id)`, `authors(id)` (PK)

## 2. Szczegóły żądania

**Metoda HTTP:** `POST`

**Struktura URL:** `/api/user/authors`

**Parametry zapytania (query parameters):** Brak

**Request Body:**
- Format: JSON
- Content-Type: `application/json`
- Wymagane pola:
  - **author_id** (wymagany)
    - Typ: UUID (string)
    - Opis: Identyfikator autora do przypisania do profilu użytkownika
    - Walidacja: prawidłowy format UUID, autor musi istnieć i być widoczny dla użytkownika

**Przykładowe żądanie:**
```json
{
  "author_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Wymagana autoryzacja:** Tak (Bearer token w nagłówku Authorization)

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

Wszystkie wymagane typy DTO są już zdefiniowane w `src/types.ts`:

1. **AttachUserAuthorCommand** (linie 352-354)
   - Reprezentuje dane wejściowe żądania
   - Pola: `author_id: AuthorRow["id"]`

2. **UserAuthorDto** (linie 132-135)
   - Reprezentuje przypisanego autora z metadanymi
   - Pola: `author: AuthorDto`, `created_at: UserAuthorRow["created_at"]`
   - Może być użyty w odpowiedzi (opcjonalnie)

3. **AuthorDto** (linia 26)
   - Typ alias do `AuthorRow` - pełne dane autora z bazy danych

### Command Modele

**AttachUserAuthorCommand** - już zdefiniowany w `src/types.ts`:
```typescript
export interface AttachUserAuthorCommand {
  author_id: AuthorRow["id"];
}
```

### Schematy walidacji

Należy utworzyć nowy schemat walidacji w `src/lib/validation/user-authors-attach.schema.ts`:

- **AttachUserAuthorCommandSchema** - schemat Zod do walidacji body żądania
  - `author_id`: wymagany, string, format UUID (użycie `z.string().uuid()`)

## 4. Szczegóły odpowiedzi

### Sukces (201 Created)

**Struktura odpowiedzi:**
```json
{
  "author_id": "uuid",
  "created_at": "2024-01-15T10:30:00Z"
}
```

Lub alternatywnie (z pełnymi danymi autora):
```json
{
  "author": {
    "id": "uuid",
    "name": "string",
    "openlibrary_id": "string | null",
    "manual": boolean,
    "owner_user_id": "uuid | null",
    "ol_fetched_at": "string | null",
    "ol_expires_at": "string | null",
    "created_at": "string",
    "updated_at": "string"
  },
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Nagłówki:**
- `Content-Type: application/json`
- `Location: /api/user/authors/{author_id}` (opcjonalnie)

### Błędy

#### 400 Bad Request - Nieprawidłowe dane wejściowe
```json
{
  "error": "Validation error",
  "message": "Invalid request body: author_id must be a valid UUID"
}
```

**Scenariusze:**
- Brak pola `author_id` w body
- `author_id` nie jest prawidłowym UUID
- Nieprawidłowy format JSON w body

#### 401 Unauthorized - Brak autoryzacji
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**Scenariusze:**
- Brak tokena autoryzacyjnego w nagłówku
- Nieprawidłowy lub wygasły token

#### 404 Not Found - Autor nie znaleziony lub niedostępny
```json
{
  "error": "Not Found",
  "message": "Author not found or not accessible"
}
```

**Scenariusze:**
- Autor o podanym `author_id` nie istnieje w bazie danych
- Autor istnieje, ale nie jest widoczny dla użytkownika (RLS - np. należy do innego użytkownika jako manual)

#### 409 Conflict - Limit osiągnięty lub duplikat
```json
{
  "error": "Conflict",
  "message": "Author limit reached (500 authors per user)"
}
```

Lub:
```json
{
  "error": "Conflict",
  "message": "Author is already attached to your profile"
}
```

**Scenariusze:**
- Użytkownik osiągnął limit 500 autorów
- Autor jest już przypisany do profilu użytkownika (duplikat)

#### 429 Too Many Requests - Przekroczony limit częstotliwości
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded: maximum 10 author additions per minute"
}
```

**Nagłówki:**
- `Retry-After: 60` (sekundy do następnej możliwości)

**Scenariusze:**
- Użytkownik wykonał więcej niż 10 żądań w ciągu ostatniej minuty

#### 500 Internal Server Error - Błąd serwera
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

**Scenariusze:**
- Błąd bazy danych podczas wstawiania
- Błąd triggera zwiększającego licznik
- Inne nieoczekiwane błędy serwera

## 5. Przepływ danych

### Krok 1: Weryfikacja autoryzacji
- Wywołanie `supabase.auth.getUser()` z kontekstu `locals.supabase`
- Weryfikacja, że użytkownik jest zalogowany
- Jeśli brak autoryzacji → zwróć 401

### Krok 2: Parsowanie i walidacja body
- Odczytanie body żądania jako JSON
- Walidacja przy użyciu Zod schema (`AttachUserAuthorCommandSchema`)
- Jeśli walidacja nie powiedzie się → zwróć 400 z szczegółami błędów

### Krok 3: Weryfikacja rate limitingu
- Sprawdzenie liczby żądań użytkownika w ostatniej minucie
- Implementacja może używać:
  - Cache w pamięci (np. Map z timestampami)
  - Redis (jeśli dostępny)
  - Tabela w bazie danych z timestampami żądań
- Jeśli limit przekroczony → zwróć 429 z nagłówkiem `Retry-After`

### Krok 4: Weryfikacja limitu autorów użytkownika
- Wywołanie metody serwisu `checkUserAuthorLimit(userId)`
- Sprawdzenie, czy `authorCount >= maxAuthors` (domyślnie 500)
- Jeśli limit osiągnięty → zwróć 409

### Krok 5: Weryfikacja istnienia i dostępności autora
- Wywołanie metody serwisu `findById(authorId)` z `AuthorsService`
- RLS automatycznie filtruje autorów niedostępnych dla użytkownika
- Jeśli autor nie istnieje lub nie jest dostępny → zwróć 404

### Krok 6: Sprawdzenie duplikatu
- Zapytanie do tabeli `user_authors` z warunkiem `user_id = userId AND author_id = authorId`
- Jeśli relacja już istnieje → zwróć 409 z komunikatem o duplikacie

### Krok 7: Wstawienie relacji
- Wstawienie rekordu do tabeli `user_authors`:
  - `user_id`: ID zalogowanego użytkownika
  - `author_id`: ID autora z żądania
  - `created_at`: automatycznie ustawione przez bazę danych
- Trigger `user_authors_increment_count` automatycznie zwiększy `author_count` w profilu
- Jeśli trigger zwróci błąd (limit przekroczony) → zwróć 409

### Krok 8: Rejestracja żądania dla rate limitingu
- Zapisanie timestampu żądania dla użytkownika (jeśli używany jest mechanizm śledzenia)

### Krok 9: Zwrócenie odpowiedzi
- Konstrukcja odpowiedzi z danymi utworzonej relacji
- Zwrócenie odpowiedzi JSON z kodem 201

### Diagram przepływu:
```
Request → Middleware (auth) → Parse Body → Validate (Zod) 
→ Check Rate Limit → Check User Limit → Verify Author Exists 
→ Check Duplicate → Insert user_authors (trigger increments counter) 
→ Register Request → Return Response (201)
```

## 6. Względy bezpieczeństwa

### Autoryzacja
- **Wymagana**: Endpoint wymaga zalogowanego użytkownika
- **Mechanizm**: Bearer token w nagłówku `Authorization`
- **Weryfikacja**: Supabase RLS (Row Level Security) automatycznie filtruje autorów niedostępnych dla użytkownika
- **Brak autoryzacji**: Zwraca 401 Unauthorized

### Autoryzacja danych
- RLS w Supabase zapewnia, że użytkownik może przypisać tylko autorów, którzy są widoczni dla niego
- Autorzy globalni (`owner_user_id IS NULL`) są widoczni dla wszystkich
- Autorzy manualne (`owner_user_id = auth.uid()`) są widoczni tylko dla właściciela
- Zapytanie używa `user_id` z sesji/tokena, nie z parametrów żądania
- Brak możliwości przypisania autora do innego użytkownika

### Walidacja danych wejściowych
- Wszystkie dane wejściowe są walidowane przez Zod
- `author_id`: walidacja formatu UUID zapobiega SQL injection
- Ochrona przed SQL injection przez parametryzowane zapytania Supabase
- Trimowanie i sanityzacja danych wejściowych

### Rate limiting
- **Limit**: 10 żądań na minutę na użytkownika
- **Mechanizm**: Implementacja może używać:
  - Cache w pamięci (proste rozwiązanie dla małej skali)
  - Redis (dla większej skali i trwałości)
  - Tabela w bazie danych z timestampami (najbardziej niezawodne)
- **Nagłówek Retry-After**: Zwracany w odpowiedzi 429
- **Zakres**: Tylko dla tego endpointu (POST /api/user/authors)

### Ochrona przed atakami
- **SQL Injection**: Użycie Supabase Client zapewnia parametryzowane zapytania
- **XSS**: Dane wejściowe są walidowane, ale nie są renderowane bezpośrednio w HTML (to endpoint API)
- **CSRF**: Astro automatycznie obsługuje ochronę CSRF dla endpointów API
- **DoS**: Rate limiting zapobiega nadużyciom, limit 500 autorów zapobiega nadmiernemu wzrostowi danych
- **Duplicate attacks**: Sprawdzanie duplikatów przed wstawieniem zapobiega niepotrzebnym operacjom

### Ograniczenia użytkownika
- Sprawdzanie limitów użytkownika przed przypisaniem autora zapobiega nadużyciom
- Limit 500 autorów na użytkownika jest egzekwowany zarówno w API, jak i w bazie danych (triggery)
- Pre-check w API zapobiega niepotrzebnym operacjom bazy danych

### Weryfikacja relacji
- Weryfikacja, że autor istnieje i jest dostępny dla użytkownika przed utworzeniem relacji
- Sprawdzanie duplikatów zapobiega tworzeniu zduplikowanych relacji

## 7. Obsługa błędów

### Kategorie błędów

#### Błędy walidacji (400 Bad Request)
- **Nieprawidłowy format JSON**: Zwracany, gdy request body nie jest prawidłowym JSON
- **Brakujące wymagane pola**: `author_id`
- **Nieprawidłowe wartości**: `author_id` nie jest prawidłowym UUID

**Przykład odpowiedzi:**
```json
{
  "error": "Validation error",
  "message": "Invalid request body: author_id must be a valid UUID",
  "details": [
    {
      "field": "author_id",
      "message": "Invalid UUID format"
    }
  ]
}
```

#### Błędy autoryzacji (401 Unauthorized)
- **Brak tokena**: Brak nagłówka `Authorization` lub nieprawidłowy format
- **Nieprawidłowy token**: Token jest nieprawidłowy lub wygasły
- **Brak sesji**: Użytkownik nie jest zalogowany

**Przykład odpowiedzi:**
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

#### Błędy zasobów (404 Not Found)
- **Autor nie istnieje**: Autor o podanym `author_id` nie istnieje w bazie danych
- **Autor niedostępny**: Autor istnieje, ale nie jest widoczny dla użytkownika (RLS)

**Przykład odpowiedzi:**
```json
{
  "error": "Not Found",
  "message": "Author not found or not accessible"
}
```

#### Błędy konfliktów (409 Conflict)
- **Limit osiągnięty**: Użytkownik osiągnął limit 500 autorów
- **Duplikat**: Autor jest już przypisany do profilu użytkownika

**Przykład odpowiedzi (limit):**
```json
{
  "error": "Conflict",
  "message": "Author limit reached (500 authors per user)"
}
```

**Przykład odpowiedzi (duplikat):**
```json
{
  "error": "Conflict",
  "message": "Author is already attached to your profile"
}
```

#### Błędy rate limitingu (429 Too Many Requests)
- **Przekroczony limit**: Użytkownik wykonał więcej niż 10 żądań w ciągu ostatniej minuty

**Przykład odpowiedzi:**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded: maximum 10 author additions per minute"
}
```

**Nagłówki:**
- `Retry-After: 60`

#### Błędy serwera (500 Internal Server Error)
- **Błąd bazy danych**: Nieoczekiwany błąd podczas operacji na bazie danych
- **Błąd triggera**: Trigger zwiększający licznik zwrócił błąd
- **Inne błędy**: Nieoczekiwane błędy serwera

**Przykład odpowiedzi:**
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

### Logowanie błędów
- Wszystkie błędy powinny być logowane z odpowiednim poziomem (warn dla 4xx, error dla 5xx)
- Logi powinny zawierać:
  - User ID (jeśli dostępny)
  - Author ID (jeśli dostępny)
  - Typ błędu
  - Szczegóły błędu
  - Timestamp

### Obsługa wyjątków triggera
- Trigger `increment_profile_author_count` może zwrócić błąd, jeśli limit został przekroczony
- Błąd triggera powinien być przechwycony i zmapowany na odpowiedź 409
- Należy rozważyć race condition: limit może zostać przekroczony między sprawdzeniem w API a wstawieniem (trigger jako backup)

## 8. Rozważania dotyczące wydajności

### Optymalizacje zapytań
- **Indeksy**: Wykorzystanie istniejących indeksów:
  - `user_authors(user_id)` - dla sprawdzania duplikatów
  - `authors(id)` - dla weryfikacji istnienia autora (PK)
  - `profiles(user_id)` - dla sprawdzania limitów (PK)

### Sprawdzanie duplikatów
- Zapytanie do `user_authors` z warunkiem `user_id = ? AND author_id = ?` wykorzystuje composite PK
- Zapytanie jest bardzo szybkie dzięki indeksowi na composite PK

### Rate limiting
- **Implementacja w pamięci**: Najszybsza, ale traci stan przy restarcie
- **Implementacja w Redis**: Szybka i trwała, wymaga infrastruktury Redis
- **Implementacja w bazie danych**: Najbardziej niezawodna, ale może być wolniejsza
- **Rekomendacja**: Dla małej skali - cache w pamięci, dla większej skali - Redis

### Weryfikacja autora
- Zapytanie `findById` wykorzystuje PK, więc jest bardzo szybkie
- RLS jest wykonywane na poziomie bazy danych, więc nie ma dodatkowego obciążenia

### Trigger zwiększający licznik
- Trigger wykonuje się automatycznie po wstawieniu
- Operacja UPDATE na `profiles` wykorzystuje PK, więc jest szybka
- Trigger zawiera walidację limitu, więc działa jako backup dla sprawdzenia w API

### Race conditions
- Możliwa sytuacja: dwa równoległe żądania mogą przejść sprawdzenie limitu przed wstawieniem
- Trigger w bazie danych zapewnia, że limit nie zostanie przekroczony
- Drugie żądanie otrzyma błąd z triggera, który powinien być zmapowany na 409

### Response Time Target
- **Target**: < 200ms dla typowego żądania (bez rate limiting check)
- **Target**: < 100ms dla sprawdzenia rate limitingu (jeśli w pamięci)
- **Timeout**: Brak timeoutu dla operacji bazy danych (użycie domyślnych timeoutów Supabase)

### Monitoring i Metryki
Warto śledzić:
- Średni czas response endpointu
- Liczba żądań per użytkownik (dla rate limitingu)
- Częstotliwość błędów 409 (limit osiągnięty)
- Częstotliwość błędów 429 (rate limit)
- Częstotliwość błędów 404 (autor nie znaleziony)
- Database query duration

## 9. Etapy wdrożenia

### Krok 1: Utworzenie Zod Schema dla walidacji
**Plik:** `src/lib/validation/user-authors-attach.schema.ts`

**Odpowiedzialności:**
- Walidacja formatu UUID dla `author_id`
- Walidacja wymaganych pól

**Struktura:**
- `AttachUserAuthorCommandSchema` - schemat Zod dla body żądania
- Eksport typu `AttachUserAuthorCommandValidated` z `z.infer`

### Krok 2: Utworzenie/usunięcie metody w AuthorsService
**Plik:** `src/lib/services/authors.service.ts`

**Sprawdzenie:**
- Metoda `checkUserAuthorLimit` już istnieje (linia 199)
- Metoda `findById` już istnieje (linia 23)

**Ewentualne rozszerzenia:**
- Metoda `attachUserAuthor` - może być dodana, ale nie jest konieczna (można użyć bezpośrednio Supabase w endpoint)
- Metoda `isAuthorAttached` - pomocnicza metoda do sprawdzania duplikatów

### Krok 3: Utworzenie/usunięcie Rate Limiting Service
**Plik:** `src/lib/services/rate-limit.service.ts` (nowy) lub użycie istniejącego

**Odpowiedzialności:**
- Śledzenie liczby żądań użytkownika w oknie czasowym
- Sprawdzanie, czy limit został przekroczony
- Czyszczenie starych wpisów

**Metody:**
- `checkRateLimit(userId: string, limit: number, windowMs: number): Promise<boolean>`
- `recordRequest(userId: string): Promise<void>`

**Implementacja:**
- Można użyć cache w pamięci (Map) dla małej skali
- Lub Redis dla większej skali
- Lub tabela w bazie danych dla trwałości

### Krok 4: Utworzenie endpointu API
**Plik:** `src/pages/api/user/authors/index.ts`

**Struktura:**
- Eksport funkcji `POST: APIRoute`
- Ustawienie `export const prerender = false`

**Implementacja kroków:**
1. Weryfikacja autoryzacji (użycie `locals.supabase.auth.getUser()`)
2. Parsowanie body jako JSON
3. Walidacja przy użyciu Zod schema
4. Sprawdzenie rate limitingu (10/min)
5. Sprawdzenie limitu autorów użytkownika (500)
6. Weryfikacja istnienia i dostępności autora
7. Sprawdzenie duplikatu w `user_authors`
8. Wstawienie rekordu do `user_authors`
9. Rejestracja żądania dla rate limitingu
10. Zwrócenie odpowiedzi 201

### Krok 5: Obsługa błędów
**W endpoint:**
- Try-catch dla wszystkich operacji
- Mapowanie błędów na odpowiednie kody statusu
- Logowanie błędów z odpowiednim poziomem

**Scenariusze błędów:**
- 400: Błędy walidacji Zod
- 401: Brak autoryzacji
- 404: Autor nie znaleziony lub niedostępny
- 409: Limit osiągnięty lub duplikat
- 429: Rate limit przekroczony
- 500: Błędy serwera

### Krok 6: Testy manualne
**Plik:** `.ai/api/api-user-authors-post-manual-tests.md`

**Scenariusze testowe:**
- Przypisanie autora globalnego (OpenLibrary)
- Przypisanie autora manualnego (własnego)
- Próba przypisania autora manualnego innego użytkownika (powinno zwrócić 404)
- Próba przypisania tego samego autora dwukrotnie (powinno zwrócić 409)
- Próba przypisania autora po osiągnięciu limitu 500 (powinno zwrócić 409)
- Próba wykonania 11 żądań w minucie (powinno zwrócić 429)
- Błąd walidacji: nieprawidłowy UUID
- Autor nie znaleziony: nieistniejący UUID

### Krok 7: Dokumentacja
**Aktualizacja:**
- Komentarze w kodzie endpointu
- Ewentualna aktualizacja dokumentacji API (jeśli istnieje)

### Krok 8: Integracja z istniejącym kodem
**Sprawdzenie:**
- Kompatybilność z istniejącym middleware
- Kompatybilność z istniejącymi serwisami
- Kompatybilność z istniejącymi typami

### Krok 9: Weryfikacja RLS
**Sprawdzenie:**
- Polityki RLS dla `user_authors` pozwalają na INSERT dla `user_id = auth.uid()`
- Polityki RLS dla `authors` pozwalają na SELECT dla globalnych lub własnych autorów
- Polityki RLS dla `profiles` pozwalają na UPDATE dla `user_id = auth.uid()`

### Krok 10: Testy manualne
**Scenariusze:**
1. Przypisanie autora globalnego (OpenLibrary)
2. Przypisanie autora manualnego (własnego)
3. Próba przypisania autora manualnego innego użytkownika (powinno zwrócić 404)
4. Próba przypisania tego samego autora dwukrotnie (powinno zwrócić 409)
5. Próba przypisania autora po osiągnięciu limitu 500 (powinno zwrócić 409)
6. Próba wykonania 11 żądań w minucie (powinno zwrócić 429)
