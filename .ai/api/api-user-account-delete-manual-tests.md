# Manual Tests: DELETE /api/user/account

## Test Environment Setup

**Endpoint:** `DELETE /api/user/account`  
**Base URL:** `http://localhost:3000/api/user/account` (lub odpowiedni URL środowiska)  
**Authentication:** Bearer token w nagłówku `Authorization`

### Prerequisites

- Zalogowany użytkownik z ważnym tokenem autoryzacyjnym
- Użytkownik z istniejącym kontem i danymi w bazie (profile, user_authors, user_works, itp.)
- Dostęp do bazy danych do weryfikacji danych przed i po usunięciu
- Narzędzie do testowania API (curl, Postman, Insomnia, lub podobne)
- Dla testów weryfikacyjnych: drugi użytkownik z danymi do sprawdzenia, że jego dane nie zostały naruszone
- **UWAGA:** Operacja jest nieodwracalna - używaj tylko kont testowych!

---

## Test Suite 1: Podstawowe funkcjonalności (Happy Path)

### Test 1.1: Usunięcie konta z prawidłową autentykacją

**Cel:** Sprawdzenie, czy endpoint poprawnie usuwa konto użytkownika i wszystkie powiązane dane

**Przygotowanie:**

- Zaloguj się jako użytkownik testowy
- Upewnij się, że użytkownik ma dane w bazie:
  - Profil w tabeli `profiles`
  - Rekordy w `user_authors`
  - Rekordy w `user_works`
  - Ewentualnie własne rekordy w `authors`, `works`, `editions` (z `owner_user_id`)
- Zapisz `user_id` użytkownika do późniejszej weryfikacji
- Zapisz przykładowe ID rekordów do weryfikacji (np. `author_id`, `work_id`)

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/user/account" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `204 No Content`
- Response body: Brak (pusty)
- Nagłówki:
  - Brak `Content-Type` (lub może być pominięty przy 204)

**Weryfikacja:**

- [ ] Status code = 204
- [ ] Response body jest pusty
- [ ] W bazie danych:
  - [ ] Użytkownik nie istnieje w `auth.users` (sprawdź: `SELECT * FROM auth.users WHERE id = 'USER_ID';`)
  - [ ] Profil nie istnieje w `profiles` (sprawdź: `SELECT * FROM profiles WHERE user_id = 'USER_ID';`)
  - [ ] Rekordy w `user_authors` zostały usunięte (sprawdź: `SELECT * FROM user_authors WHERE user_id = 'USER_ID';`)
  - [ ] Rekordy w `user_works` zostały usunięte (sprawdź: `SELECT * FROM user_works WHERE user_id = 'USER_ID';`)
  - [ ] Własne rekordy w `authors` z `owner_user_id = USER_ID` zostały usunięte (sprawdź: `SELECT * FROM authors WHERE owner_user_id = 'USER_ID';`)
  - [ ] Własne rekordy w `works` z `owner_user_id = USER_ID` zostały usunięte (sprawdź: `SELECT * FROM works WHERE owner_user_id = 'USER_ID';`)
  - [ ] Własne rekordy w `editions` z `owner_user_id = USER_ID` zostały usunięte (sprawdź: `SELECT * FROM editions WHERE owner_user_id = 'USER_ID';`)

**Uwagi:**

- Operacja jest nieodwracalna - upewnij się, że używasz konta testowego
- Po usunięciu konta, token autoryzacyjny przestanie działać

---

### Test 1.2: Usunięcie konta bez powiązanych danych

**Cel:** Sprawdzenie, czy endpoint poprawnie obsługuje usunięcie konta użytkownika bez dodatkowych danych

**Przygotowanie:**

- Utwórz nowe konto testowe (lub użyj istniejącego bez danych)
- Zaloguj się jako użytkownik
- Upewnij się, że użytkownik ma tylko profil w `profiles`, ale nie ma rekordów w `user_authors`, `user_works`, itp.
- Zapisz `user_id` użytkownika

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/user/account" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `204 No Content`
- Response body: Brak (pusty)

**Weryfikacja:**

- [ ] Status code = 204
- [ ] W bazie danych:
  - [ ] Użytkownik nie istnieje w `auth.users`
  - [ ] Profil nie istnieje w `profiles`

---

## Test Suite 2: Obsługa błędów autentykacji

### Test 2.1: Usunięcie konta bez autentykacji

**Cel:** Sprawdzenie, czy endpoint zwraca 401 gdy brak tokena autoryzacyjnego

**Przygotowanie:**

- Nie loguj się (brak tokena)

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/user/account" \
  -H "Content-Type: application/json"
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

- Nagłówki:
  - `Content-Type: application/json`

**Weryfikacja:**

- [ ] Status code = 401
- [ ] Response zawiera pola `error` i `message`
- [ ] `error` = "Unauthorized"
- [ ] `message` = "Authentication required"
- [ ] W bazie danych użytkownik nadal istnieje (jeśli był wcześniej utworzony)

---

### Test 2.2: Usunięcie konta z nieprawidłowym tokenem

**Cel:** Sprawdzenie, czy endpoint zwraca 401 gdy token jest nieprawidłowy

**Przygotowanie:**

- Przygotuj nieprawidłowy token (np. losowy string, wygasły token, token z innego projektu)

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/user/account" \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json"
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
- [ ] Response zawiera pola `error` i `message`
- [ ] `error` = "Unauthorized"
- [ ] `message` = "Authentication required"

---

### Test 2.3: Usunięcie konta z wygasłym tokenem

**Cel:** Sprawdzenie, czy endpoint zwraca 401 gdy token wygasł

**Przygotowanie:**

- Użyj wygasłego tokena (jeśli możesz go uzyskać)

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/user/account" \
  -H "Authorization: Bearer EXPIRED_TOKEN" \
  -H "Content-Type: application/json"
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
- [ ] Response zawiera pola `error` i `message`

---

## Test Suite 3: Weryfikacja integralności danych

### Test 3.1: Weryfikacja, że wszystkie dane użytkownika zostały usunięte

**Cel:** Sprawdzenie, czy wszystkie powiązane dane użytkownika zostały usunięte przez kaskady

**Przygotowanie:**

- Utwórz użytkownika testowego z kompletnym zestawem danych:
  - Profil w `profiles`
  - Kilka rekordów w `user_authors` (np. 3-5)
  - Kilka rekordów w `user_works` (np. 3-5)
  - Własne rekordy w `authors` z `owner_user_id = USER_ID` (np. 2-3)
  - Własne rekordy w `works` z `owner_user_id = USER_ID` (np. 2-3)
  - Własne rekordy w `editions` z `owner_user_id = USER_ID` (np. 2-3)
- Zapisz wszystkie ID rekordów do weryfikacji
- Zaloguj się jako użytkownik

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/user/account" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `204 No Content`

**Weryfikacja w bazie danych:**

- [ ] Użytkownik nie istnieje w `auth.users`
- [ ] Profil nie istnieje w `profiles`
- [ ] Wszystkie rekordy w `user_authors` dla tego użytkownika zostały usunięte
- [ ] Wszystkie rekordy w `user_works` dla tego użytkownika zostały usunięte
- [ ] Wszystkie rekordy w `authors` z `owner_user_id = USER_ID` zostały usunięte
- [ ] Wszystkie rekordy w `works` z `owner_user_id = USER_ID` zostały usunięte
- [ ] Wszystkie rekordy w `editions` z `owner_user_id = USER_ID` zostały usunięte
- [ ] Powiązane rekordy w `author_works` dla usuniętych works zostały usunięte (jeśli były)

**Zapytania SQL do weryfikacji:**

```sql
-- Sprawdź użytkownika
SELECT * FROM auth.users WHERE id = 'USER_ID';

-- Sprawdź profil
SELECT * FROM profiles WHERE user_id = 'USER_ID';

-- Sprawdź user_authors
SELECT * FROM user_authors WHERE user_id = 'USER_ID';

-- Sprawdź user_works
SELECT * FROM user_works WHERE user_id = 'USER_ID';

-- Sprawdź własne authors
SELECT * FROM authors WHERE owner_user_id = 'USER_ID';

-- Sprawdź własne works
SELECT * FROM works WHERE owner_user_id = 'USER_ID';

-- Sprawdź własne editions
SELECT * FROM editions WHERE owner_user_id = 'USER_ID';
```

---

### Test 3.2: Weryfikacja, że dane innych użytkowników nie zostały naruszone

**Cel:** Sprawdzenie, czy usunięcie konta jednego użytkownika nie wpływa na dane innych użytkowników

**Przygotowanie:**

- Utwórz dwóch użytkowników testowych: User A i User B
- User A: dodaj dane (profile, user_authors, user_works, własne authors/works/editions)
- User B: dodaj dane (profile, user_authors, user_works, własne authors/works/editions)
- Zapisz ID obu użytkowników i przykładowe ID ich rekordów
- Zaloguj się jako User A

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/user/account" \
  -H "Authorization: Bearer USER_A_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `204 No Content`

**Weryfikacja w bazie danych:**

- [ ] User A nie istnieje w `auth.users`
- [ ] User A nie ma profilu w `profiles`
- [ ] Wszystkie dane User A zostały usunięte
- [ ] User B nadal istnieje w `auth.users`
- [ ] User B nadal ma profil w `profiles`
- [ ] Wszystkie dane User B pozostały nienaruszone:
  - [ ] Rekordy w `user_authors` dla User B
  - [ ] Rekordy w `user_works` dla User B
  - [ ] Własne rekordy w `authors` dla User B
  - [ ] Własne rekordy w `works` dla User B
  - [ ] Własne rekordy w `editions` dla User B

**Zapytania SQL do weryfikacji:**

```sql
-- Sprawdź User A (powinien nie istnieć)
SELECT * FROM auth.users WHERE id = 'USER_A_ID';
SELECT * FROM profiles WHERE user_id = 'USER_A_ID';
SELECT * FROM user_authors WHERE user_id = 'USER_A_ID';
SELECT * FROM user_works WHERE user_id = 'USER_A_ID';

-- Sprawdź User B (powinien istnieć z danymi)
SELECT * FROM auth.users WHERE id = 'USER_B_ID';
SELECT * FROM profiles WHERE user_id = 'USER_B_ID';
SELECT * FROM user_authors WHERE user_id = 'USER_B_ID';
SELECT * FROM user_works WHERE user_id = 'USER_B_ID';
SELECT * FROM authors WHERE owner_user_id = 'USER_B_ID';
SELECT * FROM works WHERE owner_user_id = 'USER_B_ID';
SELECT * FROM editions WHERE owner_user_id = 'USER_B_ID';
```

---

### Test 3.3: Weryfikacja kaskadowego usuwania powiązanych danych

**Cel:** Sprawdzenie, czy kaskady w bazie danych działają poprawnie

**Przygotowanie:**

- Utwórz użytkownika z złożoną strukturą danych:
  - User ma własny `author` (z `owner_user_id = USER_ID`)
  - Ten `author` ma powiązane `works` (przez `author_works`)
  - Te `works` mają powiązane `editions`
  - User ma również `user_authors` i `user_works` powiązane z innymi autorami/works
- Zapisz wszystkie ID do weryfikacji
- Zaloguj się jako użytkownik

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/user/account" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `204 No Content`

**Weryfikacja w bazie danych:**

- [ ] Użytkownik został usunięty
- [ ] Własny `author` użytkownika został usunięty
- [ ] Powiązane `author_works` dla tego autora zostały usunięte
- [ ] Własne `works` użytkownika zostały usunięte
- [ ] Powiązane `editions` dla tych works zostały usunięte (jeśli miały `owner_user_id = USER_ID`)
- [ ] Rekordy w `user_authors` i `user_works` zostały usunięte
- [ ] Współdzielone dane (authors/works/editions bez `owner_user_id = USER_ID`) pozostały nienaruszone

---

## Test Suite 4: Obsługa błędów serwera

### Test 4.1: Usunięcie konta z nieprawidłowym kluczem service role (symulacja)

**Cel:** Sprawdzenie, czy endpoint zwraca 500 gdy klucz service role jest nieprawidłowy

**Uwaga:** Ten test wymaga modyfikacji zmiennych środowiskowych. W środowisku produkcyjnym nie powinien być wykonywany.

**Przygotowanie:**

- Tymczasowo ustaw nieprawidłowy `SUPABASE_SERVICE_ROLE_KEY` w zmiennych środowiskowych
- Zaloguj się jako użytkownik testowy

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/user/account" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `500 Internal Server Error`
- Response body:

```json
{
  "error": "Internal server error",
  "message": "Failed to delete user account"
}
```

**Weryfikacja:**

- [ ] Status code = 500
- [ ] Response zawiera pola `error` i `message`
- [ ] `error` = "Internal server error"
- [ ] `message` = "Failed to delete user account"
- [ ] W bazie danych użytkownik nadal istnieje (operacja się nie powiodła)

**Przywróć prawidłowy klucz service role po teście!**

---

### Test 4.2: Usunięcie już usuniętego konta

**Cel:** Sprawdzenie, czy endpoint obsługuje próbę usunięcia już usuniętego konta

**Przygotowanie:**

- Usuń konto użytkownika (np. przez Test 1.1)
- Spróbuj użyć starego tokena (jeśli nadal działa) lub utwórz nowe konto z tym samym email

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/user/account" \
  -H "Authorization: Bearer OLD_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `401 Unauthorized` (jeśli token jest nieważny) lub `500 Internal Server Error` (jeśli token jest ważny, ale użytkownik nie istnieje)

**Weryfikacja:**

- [ ] Endpoint zwraca odpowiedni kod błędu
- [ ] W bazie danych użytkownik nadal nie istnieje

---

## Test Suite 5: Testy wydajności i edge cases

### Test 5.1: Usunięcie konta z dużą ilością danych

**Cel:** Sprawdzenie, czy endpoint obsługuje usunięcie konta z dużą ilością powiązanych danych

**Przygotowanie:**

- Utwórz użytkownika z dużą ilością danych:
  - Wiele rekordów w `user_authors` (np. 100+)
  - Wiele rekordów w `user_works` (np. 1000+)
  - Wiele własnych rekordów w `authors`, `works`, `editions`
- Zaloguj się jako użytkownik

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/user/account" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  --max-time 60
```

**Oczekiwany wynik:**

- Status: `204 No Content`
- Operacja powinna zakończyć się w rozsądnym czasie (< 30 sekund dla typowego konta)

**Weryfikacja:**

- [ ] Status code = 204
- [ ] Operacja zakończyła się w rozsądnym czasie
- [ ] Wszystkie dane zostały usunięte (sprawdź losowe próbki)

---

### Test 5.2: Wielokrotne wywołanie DELETE dla tego samego konta

**Cel:** Sprawdzenie, czy endpoint obsługuje wielokrotne wywołania

**Przygotowanie:**

- Zaloguj się jako użytkownik testowy

**Request 1:**

```bash
curl -X DELETE "http://localhost:3000/api/user/account" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `204 No Content`

**Request 2 (natychmiast po pierwszym):**

```bash
curl -X DELETE "http://localhost:3000/api/user/account" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `401 Unauthorized` (token może być nieważny po usunięciu konta) lub `500 Internal Server Error` (jeśli token jest ważny, ale użytkownik nie istnieje)

**Weryfikacja:**

- [ ] Pierwsze wywołanie zwraca 204
- [ ] Drugie wywołanie zwraca odpowiedni kod błędu
- [ ] W bazie danych użytkownik został usunięty tylko raz

---

## Checklist końcowy

Po wykonaniu wszystkich testów, upewnij się, że:

- [ ] Wszystkie testy happy path zakończyły się sukcesem
- [ ] Wszystkie testy błędów autentykacji zwracają 401
- [ ] Wszystkie testy błędów serwera zwracają 500
- [ ] Weryfikacja integralności danych potwierdza, że:
  - [ ] Wszystkie dane użytkownika zostały usunięte
  - [ ] Dane innych użytkowników pozostały nienaruszone
  - [ ] Kaskady działają poprawnie
- [ ] Logi serwera zawierają odpowiednie wpisy dla wszystkich operacji
- [ ] Nie ma wycieków danych ani problemów z bezpieczeństwem

---

## Uwagi końcowe

1. **Operacja jest nieodwracalna** - zawsze używaj kont testowych
2. **Backup danych** - przed testami wykonaj backup bazy danych
3. **Czyszczenie** - po testach usuń pozostałe dane testowe
4. **Monitoring** - monitoruj logi serwera podczas testów
5. **Wydajność** - zwróć uwagę na czas wykonania operacji dla dużych kont
