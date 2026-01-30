# Manual Tests: GET /api/user/profile

## Test Environment Setup

**Endpoint:** `GET /api/user/profile`  
**Base URL:** `http://localhost:3000/api/user/profile` (lub odpowiedni URL środowiska)  
**Authentication:** Bearer token w nagłówku `Authorization`

### Prerequisites
- Zalogowany użytkownik z ważnym tokenem autoryzacyjnym
- Użytkownik z istniejącym profilem w tabeli `profiles`
- Dostęp do bazy danych do weryfikacji danych
- Narzędzie do testowania API (curl, Postman, Insomnia, lub podobne)
- Dla testów edge cases: użytkownik z profilem o różnych wartościach liczników

---

## Test Suite 1: Podstawowe funkcjonalności (Happy Path)

### Test 1.1: Pobranie profilu użytkownika z istniejącym profilem
**Cel:** Sprawdzenie, czy endpoint poprawnie zwraca dane profilu użytkownika

**Przygotowanie:**
- Zaloguj się jako użytkownik z istniejącym profilem
- Upewnij się, że profil ma ustawione wartości `author_count`, `work_count`, `max_authors`, `max_works`

**Request:**
```bash
curl -X GET "http://localhost:3000/api/user/profile" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `200 OK`
- Response body:
```json
{
  "author_count": 42,
  "work_count": 150,
  "max_authors": 500,
  "max_works": 5000
}
```
- Nagłówki:
  - `Content-Type: application/json`

**Weryfikacja:**
- [ ] Status code = 200
- [ ] Response zawiera wszystkie wymagane pola: `author_count`, `work_count`, `max_authors`, `max_works`
- [ ] Wartości w odpowiedzi odpowiadają wartościom w tabeli `profiles` dla danego użytkownika
- [ ] Nagłówek `Content-Type` jest ustawiony na `application/json`
- [ ] Response nie zawiera pól `user_id`, `created_at`, `updated_at` (tylko wymagane pola)

---

### Test 1.2: Pobranie profilu z zerowymi licznikami
**Cel:** Sprawdzenie, czy endpoint poprawnie obsługuje profil z zerowymi licznikami

**Przygotowanie:**
- Upewnij się, że profil użytkownika ma `author_count = 0` i `work_count = 0`
- Możesz zresetować liczniki: `UPDATE profiles SET author_count = 0, work_count = 0 WHERE user_id = 'YOUR_USER_ID';`

**Request:**
```bash
curl -X GET "http://localhost:3000/api/user/profile" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `200 OK`
- Response body:
```json
{
  "author_count": 0,
  "work_count": 0,
  "max_authors": 500,
  "max_works": 5000
}
```

**Weryfikacja:**
- [ ] Status code = 200
- [ ] `author_count` = 0
- [ ] `work_count` = 0
- [ ] `max_authors` i `max_works` mają wartości domyślne (500 i 5000)

---

### Test 1.3: Pobranie profilu z maksymalnymi licznikami
**Cel:** Sprawdzenie, czy endpoint poprawnie obsługuje profil z wysokimi licznikami

**Przygotowanie:**
- Upewnij się, że profil użytkownika ma wysokie wartości liczników (np. blisko maksimum)
- Możesz ustawić: `UPDATE profiles SET author_count = 499, work_count = 4999 WHERE user_id = 'YOUR_USER_ID';`

**Request:**
```bash
curl -X GET "http://localhost:3000/api/user/profile" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `200 OK`
- Response body zawiera wysokie wartości liczników

**Weryfikacja:**
- [ ] Status code = 200
- [ ] Wszystkie wartości są zwracane poprawnie
- [ ] Liczniki nie przekraczają limitów

---

## Test Suite 2: Autoryzacja

### Test 2.1: Request bez tokena autoryzacyjnego
**Cel:** Sprawdzenie obsługi braku autoryzacji

**Request:**
```bash
curl -X GET "http://localhost:3000/api/user/profile" \
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
- [ ] Response zawiera komunikat o wymaganej autoryzacji
- [ ] Nagłówek `Content-Type: application/json`

---

### Test 2.2: Request z nieprawidłowym tokenem
**Cel:** Sprawdzenie obsługi nieprawidłowego tokena

**Request:**
```bash
curl -X GET "http://localhost:3000/api/user/profile" \
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
- [ ] Response zawiera komunikat o wymaganej autoryzacji

---

### Test 2.3: Request z wygasłym tokenem
**Cel:** Sprawdzenie obsługi wygasłego tokena

**Przygotowanie:**
- Użyj tokena, który wygasł (np. token z przeszłości lub token z ręcznie ustawionym czasem wygaśnięcia)

**Request:**
```bash
curl -X GET "http://localhost:3000/api/user/profile" \
  -H "Authorization: Bearer EXPIRED_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `401 Unauthorized`
- Response body zawiera komunikat o wymaganej autoryzacji

**Weryfikacja:**
- [ ] Status code = 401
- [ ] Response zawiera komunikat o wymaganej autoryzacji

---

### Test 2.4: Request z tokenem innego użytkownika (RLS)
**Cel:** Sprawdzenie, czy RLS poprawnie filtruje wyniki - użytkownik widzi tylko swój profil

**Przygotowanie:**
- Zaloguj się jako użytkownik A i pobierz jego token
- Zaloguj się jako użytkownik B i pobierz jego token
- Upewnij się, że obaj użytkownicy mają profile

**Request (jako użytkownik A):**
```bash
curl -X GET "http://localhost:3000/api/user/profile" \
  -H "Authorization: Bearer USER_A_TOKEN" \
  -H "Content-Type: application/json"
```

**Request (jako użytkownik B):**
```bash
curl -X GET "http://localhost:3000/api/user/profile" \
  -H "Authorization: Bearer USER_B_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `200 OK` dla obu użytkowników
- Każdy użytkownik widzi tylko swoje dane profilu
- RLS automatycznie filtruje wyniki zgodnie z policy `profiles_select_authenticated`

**Weryfikacja:**
- [ ] Status code = 200 dla obu użytkowników
- [ ] Użytkownik A widzi tylko swoje dane (`author_count`, `work_count` użytkownika A)
- [ ] Użytkownik B widzi tylko swoje dane (`author_count`, `work_count` użytkownika B)
- [ ] RLS poprawnie działa - nie ma możliwości odczytania profilu innego użytkownika

---

## Test Suite 3: Błędy zasobów

### Test 3.1: Profil nie istnieje (404)
**Cel:** Sprawdzenie obsługi przypadku, gdy profil użytkownika nie istnieje w tabeli `profiles`

**Przygotowanie:**
- Zaloguj się jako użytkownik, który nie ma profilu w tabeli `profiles`
- Lub usuń profil: `DELETE FROM profiles WHERE user_id = 'YOUR_USER_ID';`
- **UWAGA:** W normalnych warunkach profil powinien być tworzony podczas rejestracji, więc ten test sprawdza edge case

**Request:**
```bash
curl -X GET "http://localhost:3000/api/user/profile" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `404 Not Found`
- Response body:
```json
{
  "error": "Not Found",
  "message": "Profile not found"
}
```

**Weryfikacja:**
- [ ] Status code = 404
- [ ] Response zawiera komunikat o nieznalezionym profilu
- [ ] W tabeli `profiles` nie ma rekordu dla danego `user_id`

---

## Test Suite 4: Edge Cases

### Test 4.1: Profil z niestandardowymi limitami
**Cel:** Sprawdzenie, czy endpoint poprawnie zwraca niestandardowe wartości limitów

**Przygotowanie:**
- Ustaw niestandardowe limity dla użytkownika:
```sql
UPDATE profiles 
SET max_authors = 100, max_works = 1000 
WHERE user_id = 'YOUR_USER_ID';
```

**Request:**
```bash
curl -X GET "http://localhost:3000/api/user/profile" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `200 OK`
- Response body zawiera niestandardowe wartości `max_authors` i `max_works`

**Weryfikacja:**
- [ ] Status code = 200
- [ ] `max_authors` = 100
- [ ] `max_works` = 1000
- [ ] Wartości odpowiadają wartościom w bazie danych

---

### Test 4.2: Wielokrotne wywołania endpointu (cache po stronie klienta)
**Cel:** Sprawdzenie, czy endpoint zwraca aktualne dane przy każdym wywołaniu

**Przygotowanie:**
- Zaloguj się jako użytkownik z profilem
- Wykonaj pierwsze żądanie
- Zmień wartości w bazie danych (np. zwiększ `author_count`)
- Wykonaj drugie żądanie

**Request 1:**
```bash
curl -X GET "http://localhost:3000/api/user/profile" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Akcja między żądaniami:**
```sql
-- Zwiększ licznik autorów
UPDATE profiles 
SET author_count = author_count + 1 
WHERE user_id = 'YOUR_USER_ID';
```

**Request 2:**
```bash
curl -X GET "http://localhost:3000/api/user/profile" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Oba żądania zwracają status `200 OK`
- Drugie żądanie zwraca zaktualizowane wartości liczników

**Weryfikacja:**
- [ ] Oba żądania zwracają status 200
- [ ] Drugie żądanie zwraca zaktualizowane wartości (np. `author_count` zwiększony o 1)
- [ ] Endpoint nie cache'uje odpowiedzi po stronie serwera (dane są zawsze aktualne)

---

### Test 4.3: Request z dodatkowymi nagłówkami
**Cel:** Sprawdzenie, czy dodatkowe nagłówki nie wpływają na działanie endpointu

**Request:**
```bash
curl -X GET "http://localhost:3000/api/user/profile" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Custom-Header: test-value" \
  -H "Accept: application/json"
```

**Oczekiwany wynik:**
- Status: `200 OK`
- Endpoint działa poprawnie, ignorując nieznane nagłówki

**Weryfikacja:**
- [ ] Status code = 200
- [ ] Response zawiera poprawne dane profilu
- [ ] Dodatkowe nagłówki nie powodują błędów

---

### Test 4.4: Request z parametrami query (ignorowane)
**Cel:** Sprawdzenie, czy endpoint ignoruje parametry query (endpoint nie przyjmuje parametrów)

**Request:**
```bash
curl -X GET "http://localhost:3000/api/user/profile?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `200 OK`
- Endpoint działa poprawnie, ignorując parametry query
- Response zawiera pełne dane profilu (nie paginowane)

**Weryfikacja:**
- [ ] Status code = 200
- [ ] Response zawiera wszystkie pola profilu
- [ ] Parametry query nie powodują błędów

---

## Test Suite 5: Wydajność i stabilność

### Test 5.1: Wielokrotne szybkie żądania
**Cel:** Sprawdzenie stabilności endpointu przy wielu szybkich żądaniach

**Request:**
```bash
# Wykonaj 10 żądań sekwencyjnie
for i in {1..10}; do
  curl -X GET "http://localhost:3000/api/user/profile" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json"
  echo ""
done
```

**Oczekiwany wynik:**
- Wszystkie żądania zwracają status `200 OK`
- Czas odpowiedzi jest konsystentny
- Brak błędów 500

**Weryfikacja:**
- [ ] Wszystkie żądania zwracają status 200
- [ ] Czas odpowiedzi jest akceptowalny (< 500ms)
- [ ] Brak błędów serwera

---

### Test 5.2: Równoległe żądania
**Cel:** Sprawdzenie obsługi równoległych żądań

**Request:**
```bash
# Wykonaj 5 równoległych żądań
for i in {1..5}; do
  curl -X GET "http://localhost:3000/api/user/profile" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" &
done
wait
```

**Oczekiwany wynik:**
- Wszystkie żądania zwracają status `200 OK`
- Brak konfliktów lub błędów

**Weryfikacja:**
- [ ] Wszystkie żądania zwracają status 200
- [ ] Brak błędów związanych z równoległym dostępem
- [ ] Dane są spójne we wszystkich odpowiedziach

---

## Checklist końcowy

Po wykonaniu wszystkich testów, zweryfikuj:

- [ ] Wszystkie testy happy path (1.1, 1.2, 1.3) przeszły pomyślnie
- [ ] Wszystkie testy autoryzacji (2.1-2.4) zwróciły odpowiednie kody (401 lub 200)
- [ ] Test błędu zasobu (3.1) zwrócił 404
- [ ] Wszystkie edge cases (4.1-4.4) przeszły pomyślnie
- [ ] Testy wydajności (5.1-5.2) potwierdzają stabilność endpointu
- [ ] Weryfikacja w bazie danych potwierdza, że dane odpowiadają odpowiedziom API
- [ ] RLS poprawnie działa - użytkownicy widzą tylko swoje profile
- [ ] Wszystkie odpowiedzi mają poprawny format JSON
- [ ] Wszystkie odpowiedzi mają nagłówek `Content-Type: application/json`

---

## Notatki do testów

### Jak uzyskać token autoryzacyjny:
1. Zaloguj się przez Supabase Auth
2. Pobierz `access_token` z odpowiedzi
3. Użyj go w nagłówku `Authorization: Bearer <token>`

### Jak sprawdzić dane profilu w bazie danych:
```sql
SELECT user_id, author_count, work_count, max_authors, max_works, created_at, updated_at
FROM profiles
WHERE user_id = 'YOUR_USER_ID';
```

### Jak utworzyć profil dla użytkownika (jeśli nie istnieje):
```sql
INSERT INTO profiles (user_id, author_count, work_count, max_authors, max_works)
VALUES ('YOUR_USER_ID', 0, 0, 500, 5000);
```

### Jak usunąć profil użytkownika (dla testu 404):
```sql
DELETE FROM profiles WHERE user_id = 'YOUR_USER_ID';
```

### Jak zresetować liczniki profilu:
```sql
UPDATE profiles 
SET author_count = 0, work_count = 0 
WHERE user_id = 'YOUR_USER_ID';
```

### Jak ustawić niestandardowe limity:
```sql
UPDATE profiles 
SET max_authors = 100, max_works = 1000 
WHERE user_id = 'YOUR_USER_ID';
```

### Jak zwiększyć liczniki dla testów:
```sql
-- Zwiększ licznik autorów
UPDATE profiles 
SET author_count = author_count + 1 
WHERE user_id = 'YOUR_USER_ID';

-- Zwiększ licznik dzieł
UPDATE profiles 
SET work_count = work_count + 1 
WHERE user_id = 'YOUR_USER_ID';
```

### Jak sprawdzić, czy RLS działa poprawnie:
```sql
-- Jako użytkownik A (przez Supabase Client z tokenem użytkownika A)
SELECT * FROM profiles WHERE user_id = auth.uid();

-- Powinno zwrócić tylko profil użytkownika A
-- Nie powinno zwrócić profilu użytkownika B
```

### Weryfikacja logów:
- Sprawdź logi serwera pod kątem komunikatów z loggera:
  - `logger.warn()` dla błędów autoryzacji (401) i brakujących profili (404)
  - `logger.error()` dla błędów serwera (500)
- Logi powinny zawierać kontekst: `userId`, szczegóły błędu

---

## Obserwacje i uwagi

### Spodziewane zachowania:
- Endpoint jest bardzo szybki (używa primary key lookup)
- RLS automatycznie filtruje wyniki
- Brak cache'owania po stronie serwera (dane są zawsze aktualne)
- Endpoint nie przyjmuje parametrów, więc nie ma walidacji danych wejściowych

### Potencjalne problemy:
- Jeśli profil nie istnieje, może to wskazywać na problem w procesie rejestracji
- Wysoka częstotliwość wywołań może obciążać bazę danych (rozważyć cache po stronie klienta)

### Rekomendacje:
- Użyj cache'owania po stronie klienta (React Query, SWR) z krótkim TTL (30 sekund)
- Monitoruj czas odpowiedzi endpointu
- Rozważ alerty przy wzroście czasu odpowiedzi powyżej progu (np. 100ms)

---

**Data utworzenia:** 2025-01-26  
**Ostatnia aktualizacja:** 2025-01-26  
**Wersja endpointu:** 1.0  
**Endpoint:** GET /api/user/profile

