# Manual Tests: POST /api/user/authors

## Test Environment Setup

**Endpoint:** `POST /api/user/authors`  
**Base URL:** `http://localhost:3000/api/user/authors` (lub odpowiedni URL środowiska)  
**Authentication:** Bearer token w nagłówku `Authorization`

### Prerequisites

- Zalogowany użytkownik z ważnym tokenem autoryzacyjnym
- Dostęp do bazy danych z autorami (globalnymi z OpenLibrary i manualnymi)
- Narzędzie do testowania API (curl, Postman, Insomnia, lub podobne)
- Dla testów limitu: użytkownik z blisko 500 przypisanymi autorami
- Dla testów rate limitingu: możliwość wykonania wielu żądań w krótkim czasie

---

## Test Suite 1: Podstawowe funkcjonalności (Happy Path)

### Test 1.1: Przypisanie autora globalnego (OpenLibrary)

**Cel:** Sprawdzenie, czy można przypisać autora globalnego (z OpenLibrary) do profilu użytkownika

**Przygotowanie:**

- Znajdź UUID autora globalnego (z OpenLibrary, `owner_user_id IS NULL`)
- Upewnij się, że autor nie jest już przypisany do użytkownika

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created`
- Response body:

```json
{
  "author_id": "123e4567-e89b-12d3-a456-426614174000",
  "created_at": "2024-01-15T10:30:00Z"
}
```

- Nagłówki:
  - `Content-Type: application/json`
  - `Location: /api/user/authors/123e4567-e89b-12d3-a456-426614174000`

**Weryfikacja:**

- [ ] Status code = 201
- [ ] Response zawiera `author_id` i `created_at`
- [ ] Nagłówek `Location` jest ustawiony poprawnie
- [ ] W tabeli `user_authors` istnieje rekord z `user_id` i `author_id`
- [ ] Licznik `author_count` w tabeli `profiles` został zwiększony o 1 (via trigger)

---

### Test 1.2: Przypisanie autora manualnego (własnego)

**Cel:** Sprawdzenie, czy można przypisać własnego autora manualnego do profilu

**Przygotowanie:**

- Utwórz autora manualnego dla zalogowanego użytkownika (POST /api/authors)
- Upewnij się, że autor nie jest już przypisany do użytkownika

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "YOUR_MANUAL_AUTHOR_UUID"
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created`
- Response body zawiera `author_id` i `created_at`
- Relacja została utworzona w `user_authors`

**Weryfikacja:**

- [ ] Status code = 201
- [ ] Response zawiera poprawne dane
- [ ] Rekord w `user_authors` został utworzony
- [ ] Licznik `author_count` został zwiększony

---

## Test Suite 2: Walidacja danych wejściowych

### Test 2.1: Brak pola `author_id` w body

**Cel:** Sprawdzenie walidacji - `author_id` jest wymagany

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body:

```json
{
  "error": "Validation error",
  "message": "author_id must be a valid UUID",
  "details": [...]
}
```

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu wskazuje na brakujące lub nieprawidłowe `author_id`

---

### Test 2.2: Nieprawidłowy format UUID

**Cel:** Sprawdzenie walidacji - `author_id` musi być prawidłowym UUID

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "not-a-valid-uuid"
  }'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body zawiera komunikat o nieprawidłowym formacie UUID

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu wskazuje na nieprawidłowy format UUID

---

### Test 2.3: Nieprawidłowy format JSON

**Cel:** Sprawdzenie obsługi nieprawidłowego JSON w body

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{invalid json}'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body:

```json
{
  "error": "Validation error",
  "message": "Invalid JSON in request body"
}
```

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu wskazuje na nieprawidłowy JSON

---

### Test 2.4: `author_id` jako null

**Cel:** Sprawdzenie walidacji - `author_id` nie może być null

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": null
  }'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response zawiera komunikat o nieprawidłowym formacie UUID

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu jest odpowiedni

---

## Test Suite 3: Autoryzacja

### Test 3.1: Request bez tokena autoryzacyjnego

**Cel:** Sprawdzenie, czy endpoint wymaga autoryzacji

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Oczekiwany wynik:**

- Status: `401 Unauthorized`
- Response body:

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**Weryfikacja:**

- [ ] Status code = 401
- [ ] Response zawiera komunikat o wymaganej autoryzacji

---

### Test 3.2: Request z nieprawidłowym tokenem

**Cel:** Sprawdzenie obsługi nieprawidłowego tokena

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Oczekiwany wynik:**

- Status: `401 Unauthorized`
- Response zawiera komunikat o wymaganej autoryzacji

**Weryfikacja:**

- [ ] Status code = 401
- [ ] Response zawiera komunikat o wymaganej autoryzacji

---

### Test 3.3: Request z wygasłym tokenem

**Cel:** Sprawdzenie obsługi wygasłego tokena

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer EXPIRED_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Oczekiwany wynik:**

- Status: `401 Unauthorized`
- Response zawiera komunikat o wymaganej autoryzacji

**Weryfikacja:**

- [ ] Status code = 401
- [ ] Response zawiera komunikat o wymaganej autoryzacji

---

## Test Suite 4: Błędy zasobów

### Test 4.1: Autor nie istnieje (nieistniejący UUID)

**Cel:** Sprawdzenie obsługi przypadku, gdy autor o podanym UUID nie istnieje

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "00000000-0000-0000-0000-000000000000"
  }'
```

**Oczekiwany wynik:**

- Status: `404 Not Found`
- Response body:

```json
{
  "error": "Not Found",
  "message": "Author not found or not accessible"
}
```

**Weryfikacja:**

- [ ] Status code = 404
- [ ] Response zawiera komunikat o nieznalezionym autorze

---

### Test 4.2: Autor manualny innego użytkownika (RLS)

**Cel:** Sprawdzenie, czy nie można przypisać autora manualnego należącego do innego użytkownika

**Przygotowanie:**

- Utwórz konto testowe użytkownika A
- Utwórz autora manualnego dla użytkownika A
- Zaloguj się jako użytkownik B
- Próbuj przypisać autora użytkownika A

**Request (jako użytkownik B):**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer USER_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "USER_A_MANUAL_AUTHOR_UUID"
  }'
```

**Oczekiwany wynik:**

- Status: `404 Not Found`
- Response body:

```json
{
  "error": "Not Found",
  "message": "Author not found or not accessible"
}
```

**Weryfikacja:**

- [ ] Status code = 404
- [ ] Response zawiera komunikat o niedostępnym autorze
- [ ] RLS poprawnie blokuje dostęp do autora innego użytkownika

---

## Test Suite 5: Konflikty i limity

### Test 5.1: Próba przypisania tego samego autora dwukrotnie (duplikat)

**Cel:** Sprawdzenie obsługi duplikatów - autor nie może być przypisany dwukrotnie

**Przygotowanie:**

- Przypisz autora do użytkownika (Test 1.1 lub 1.2)
- Spróbuj przypisać tego samego autora ponownie

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "ALREADY_ATTACHED_AUTHOR_UUID"
  }'
```

**Oczekiwany wynik:**

- Status: `409 Conflict`
- Response body:

```json
{
  "error": "Conflict",
  "message": "Author is already attached to your profile"
}
```

**Weryfikacja:**

- [ ] Status code = 409
- [ ] Response zawiera komunikat o duplikacie
- [ ] W tabeli `user_authors` nie został utworzony drugi rekord
- [ ] Licznik `author_count` nie został zwiększony ponownie

---

### Test 5.2: Próba przypisania autora po osiągnięciu limitu 500

**Cel:** Sprawdzenie obsługi limitu 500 autorów na użytkownika

**Przygotowanie:**

- Użytkownik musi mieć już 500 przypisanych autorów (`author_count = 500`)
- Lub zmodyfikuj `max_authors` w tabeli `profiles` na niższą wartość dla testów

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "NEW_AUTHOR_UUID"
  }'
```

**Oczekiwany wynik:**

- Status: `409 Conflict`
- Response body:

```json
{
  "error": "Conflict",
  "message": "Author limit reached (500 authors per user)"
}
```

**Weryfikacja:**

- [ ] Status code = 409
- [ ] Response zawiera komunikat o osiągniętym limicie
- [ ] W tabeli `user_authors` nie został utworzony nowy rekord
- [ ] Licznik `author_count` nie został zwiększony

---

### Test 5.3: Race condition - równoległe żądania (duplikat)

**Cel:** Sprawdzenie obsługi race condition - dwa równoległe żądania próbują przypisać tego samego autora

**Przygotowanie:**

- Upewnij się, że autor nie jest jeszcze przypisany
- Wykonaj dwa równoległe żądania z tym samym `author_id`

**Request (wykonaj równolegle dwa razy):**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "SAME_AUTHOR_UUID"
  }'
```

**Oczekiwany wynik:**

- Jedno żądanie: Status `201 Created` (sukces)
- Drugie żądanie: Status `409 Conflict` (duplikat wykryty przez unique constraint)

**Weryfikacja:**

- [ ] Jedno żądanie zakończyło się sukcesem (201)
- [ ] Drugie żądanie zwróciło 409 (duplikat)
- [ ] W tabeli `user_authors` istnieje tylko jeden rekord
- [ ] Licznik `author_count` został zwiększony tylko raz

---

## Test Suite 6: Rate Limiting

### Test 6.1: Próba wykonania 11 żądań w minucie (limit 10/min)

**Cel:** Sprawdzenie rate limitingu - maksymalnie 10 żądań na minutę

**Przygotowanie:**

- Przygotuj 11 różnych UUID autorów (lub użyj tego samego, jeśli chcesz przetestować duplikaty)
- Wykonaj 11 żądań szybko po sobie (w ciągu minuty)

**Request (wykonaj 11 razy):**

```bash
# Żądanie 1-10 powinny się powieść
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "AUTHOR_UUID_1"
  }'

# ... powtórz dla autorów 2-10 ...

# Żądanie 11 powinno zwrócić 429
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "AUTHOR_UUID_11"
  }'
```

**Oczekiwany wynik:**

- Żądania 1-10: Status `201 Created` (lub `409 Conflict` jeśli duplikaty)
- Żądanie 11: Status `429 Too Many Requests`
- Response body dla żądania 11:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded: maximum 10 author additions per minute"
}
```

- Nagłówki dla żądania 11:
  - `Retry-After: 60`

**Weryfikacja:**

- [ ] Żądania 1-10 przeszły pomyślnie (201 lub 409)
- [ ] Żądanie 11 zwróciło status 429
- [ ] Response zawiera komunikat o przekroczonym limicie
- [ ] Nagłówek `Retry-After: 60` jest ustawiony
- [ ] Po upływie minuty można wykonać kolejne żądania

---

### Test 6.2: Rate limit reset po upływie minuty

**Cel:** Sprawdzenie, czy rate limit resetuje się po upływie okna czasowego

**Przygotowanie:**

- Wykonaj 10 żądań (osiągnij limit)
- Poczekaj 61 sekund
- Wykonaj kolejne żądanie

**Request:**

```bash
# Wykonaj 10 żądań (osiągnij limit)
# ... (10 żądań) ...

# Poczekaj 61 sekund

# Wykonaj 11. żądanie
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "AUTHOR_UUID_AFTER_WAIT"
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created` (lub `409 Conflict` jeśli duplikat)
- Rate limit został zresetowany

**Weryfikacja:**

- [ ] Żądanie po upływie minuty przeszło pomyślnie
- [ ] Rate limit został poprawnie zresetowany

---

## Test Suite 7: Weryfikacja danych w bazie

### Test 7.1: Weryfikacja utworzenia rekordu w `user_authors`

**Cel:** Sprawdzenie, czy rekord został poprawnie utworzony w bazie danych

**Przygotowanie:**

- Wykonaj Test 1.1 lub 1.2 (przypisanie autora)
- Sprawdź dane w bazie

**Weryfikacja w bazie danych:**

```sql
SELECT * FROM user_authors
WHERE user_id = 'YOUR_USER_ID'
  AND author_id = 'ATTACHED_AUTHOR_ID';
```

**Oczekiwany wynik:**

- Rekord istnieje w tabeli `user_authors`
- `user_id` = ID zalogowanego użytkownika
- `author_id` = ID przypisanego autora
- `created_at` jest ustawione na aktualny timestamp

**Weryfikacja:**

- [ ] Rekord istnieje w tabeli `user_authors`
- [ ] `user_id` jest poprawne
- [ ] `author_id` jest poprawne
- [ ] `created_at` jest ustawione

---

### Test 7.2: Weryfikacja zwiększenia licznika `author_count`

**Cel:** Sprawdzenie, czy trigger automatycznie zwiększył licznik w profilu

**Przygotowanie:**

- Zapisz aktualną wartość `author_count` przed przypisaniem
- Wykonaj Test 1.1 lub 1.2
- Sprawdź wartość `author_count` po przypisaniu

**Weryfikacja w bazie danych:**

```sql
-- Przed przypisaniem
SELECT author_count FROM profiles WHERE user_id = 'YOUR_USER_ID';

-- Po przypisaniu
SELECT author_count FROM profiles WHERE user_id = 'YOUR_USER_ID';
```

**Oczekiwany wynik:**

- `author_count` został zwiększony o 1
- Trigger `user_authors_increment_count` działa poprawnie

**Weryfikacja:**

- [ ] `author_count` został zwiększony o 1
- [ ] Trigger działa automatycznie

---

## Test Suite 8: Edge Cases

### Test 8.1: Przypisanie autora z bardzo długim UUID (prawidłowy format)

**Cel:** Sprawdzenie obsługi prawidłowego UUID (edge case)

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "ffffffff-ffff-ffff-ffff-ffffffffffff"
  }'
```

**Oczekiwany wynik:**

- Jeśli autor istnieje: Status `201 Created` lub `404 Not Found`
- Jeśli autor nie istnieje: Status `404 Not Found`

**Weryfikacja:**

- [ ] UUID jest poprawnie walidowany
- [ ] Endpoint działa poprawnie z prawidłowym UUID

---

### Test 8.2: Przypisanie autora z dodatkowymi polami w body (ignorowane)

**Cel:** Sprawdzenie, czy dodatkowe pola w body są ignorowane

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "author_id": "VALID_AUTHOR_UUID",
    "extra_field": "should_be_ignored",
    "another_field": 123
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created` (jeśli autor istnieje i nie jest przypisany)
- Dodatkowe pola są ignorowane przez walidację Zod

**Weryfikacja:**

- [ ] Endpoint działa poprawnie
- [ ] Dodatkowe pola nie powodują błędów

---

## Checklist końcowy

Po wykonaniu wszystkich testów, zweryfikuj:

- [ ] Wszystkie testy happy path (1.1, 1.2) przeszły pomyślnie
- [ ] Wszystkie testy walidacji (2.1-2.4) zwróciły odpowiednie błędy 400
- [ ] Wszystkie testy autoryzacji (3.1-3.3) zwróciły 401
- [ ] Testy błędów zasobów (4.1-4.2) zwróciły 404
- [ ] Testy konfliktów (5.1-5.3) zwróciły 409
- [ ] Testy rate limitingu (6.1-6.2) zwróciły 429 dla 11. żądania
- [ ] Weryfikacja w bazie danych potwierdza poprawne działanie triggerów
- [ ] Wszystkie edge cases zostały przetestowane

---

## Notatki do testów

### Jak uzyskać token autoryzacyjny:

1. Zaloguj się przez Supabase Auth
2. Pobierz `access_token` z odpowiedzi
3. Użyj go w nagłówku `Authorization: Bearer <token>`

### Jak znaleźć UUID autora:

- Autorzy globalni (OpenLibrary): `SELECT id, name FROM authors WHERE owner_user_id IS NULL LIMIT 10;`
- Autorzy manualni: `SELECT id, name FROM authors WHERE owner_user_id = 'YOUR_USER_ID' LIMIT 10;`

### Jak sprawdzić liczbę przypisanych autorów:

```sql
SELECT author_count, max_authors
FROM profiles
WHERE user_id = 'YOUR_USER_ID';
```

### Jak przygotować użytkownika z limitem 500:

```sql
-- Tymczasowo zmniejsz max_authors dla testów
UPDATE profiles
SET max_authors = 5
WHERE user_id = 'YOUR_USER_ID';

-- Lub zwiększ author_count do max_authors
UPDATE profiles
SET author_count = max_authors
WHERE user_id = 'YOUR_USER_ID';
```

### Jak zresetować rate limit dla testów:

- Restart serwera (rate limit jest w pamięci)
- Lub poczekaj 60 sekund

---

**Data utworzenia:** 2024-01-15  
**Ostatnia aktualizacja:** 2024-01-15  
**Wersja endpointu:** 1.0
