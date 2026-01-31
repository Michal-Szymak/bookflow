# Manual Tests: GET /api/user/authors

## Test Environment Setup

**Endpoint:** `GET /api/user/authors`  
**Base URL:** `http://localhost:4321/api/user/authors` (lub odpowiedni URL środowiska)  
**Authentication:** Bearer token w nagłówku `Authorization`

### Prerequisites

- Zalogowany użytkownik z ważnym tokenem autoryzacyjnym
- Użytkownik powinien mieć przypisanych kilku autorów (dla testów paginacji)
- Narzędzie do testowania API (curl, Postman, Insomnia, lub podobne)

---

## Test Suite 1: Podstawowe funkcjonalności

### Test 1.1: Request bez parametrów (domyślne wartości)

**Cel:** Sprawdzenie, czy endpoint zwraca listę autorów z domyślnymi wartościami (page=1, sort=name_asc)

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body zawiera:
  - `items`: tablica autorów (maksymalnie 20)
  - `total`: całkowita liczba autorów przypisanych do użytkownika
- Autorzy posortowani alfabetycznie po nazwie (A-Z)
- Każdy element w `items` zawiera:
  - `author`: pełne dane autora (id, name, openlibrary_id, itp.)
  - `created_at`: data przypisania autora do użytkownika

**Weryfikacja:**

- [ ] Status code = 200
- [ ] `items` jest tablicą
- [ ] `total` jest liczbą >= 0
- [ ] Autorzy są posortowani alfabetycznie
- [ ] Każdy element ma strukturę zgodną z `UserAuthorDto`

---

### Test 1.2: Request z parametrem `page`

**Cel:** Sprawdzenie paginacji - pobranie drugiej strony wyników

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors?page=2" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response zawiera autorów z drugiej strony (pozycje 21-40, jeśli istnieją)
- `total` pozostaje takie samo jak w Test 1.1

**Weryfikacja:**

- [ ] Status code = 200
- [ ] `items` zawiera autorów z drugiej strony
- [ ] `total` jest takie samo jak w Test 1.1
- [ ] Jeśli użytkownik ma < 21 autorów, `items` jest puste

---

### Test 1.3: Request z parametrem `search`

**Cel:** Sprawdzenie wyszukiwania autorów po nazwie

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors?search=Tolkien" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response zawiera tylko autorów, których nazwa zawiera "Tolkien" (case-insensitive)
- `total` = liczba znalezionych autorów

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie autorzy w `items` mają "Tolkien" w nazwie (case-insensitive)
- [ ] `total` = liczba znalezionych autorów
- [ ] Wyszukiwanie działa case-insensitive (przetestować z "tolkien", "TOLKIEN")

---

### Test 1.4: Request z parametrem `sort=created_desc`

**Cel:** Sprawdzenie sortowania po dacie przypisania (najnowsze pierwsze)

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors?sort=created_desc" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Autorzy posortowani po `created_at` z `user_authors` (najnowsze pierwsze)
- `total` = całkowita liczba autorów

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Autorzy są posortowani malejąco po `created_at`
- [ ] Najnowszy autor jest pierwszy w liście

---

### Test 1.5: Request z wszystkimi parametrami jednocześnie

**Cel:** Sprawdzenie kombinacji wszystkich parametrów

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors?page=1&search=John&sort=name_asc" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response zawiera autorów z nazwą zawierającą "John", posortowanych alfabetycznie, z pierwszej strony

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie parametry działają jednocześnie
- [ ] Wyniki są przefiltrowane i posortowane poprawnie

---

## Test Suite 2: Walidacja parametrów

### Test 2.1: Nieprawidłowa wartość `page` (< 1)

**Cel:** Sprawdzenie walidacji - `page` musi być >= 1

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors?page=0" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body:

```json
{
  "error": "Validation error",
  "message": "Page must be at least 1",
  "details": [...]
}
```

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Response zawiera komunikat błędu walidacji
- [ ] `details` zawiera szczegóły błędów

---

### Test 2.2: Nieprawidłowa wartość `page` (nie liczba)

**Cel:** Sprawdzenie walidacji - `page` musi być liczbą całkowitą

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors?page=abc" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response zawiera komunikat o nieprawidłowym formacie `page`

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu wskazuje na problem z formatem `page`

---

### Test 2.3: Nieprawidłowa wartość `sort`

**Cel:** Sprawdzenie walidacji - `sort` musi być jednym z dozwolonych wartości

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors?sort=invalid_sort" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response zawiera komunikat o nieprawidłowej wartości `sort`

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu wskazuje na nieprawidłową wartość `sort`

---

### Test 2.4: Zbyt długi `search` (> 200 znaków)

**Cel:** Sprawdzenie walidacji - `search` nie może przekraczać 200 znaków

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors?search=VERY_LONG_STRING_OVER_200_CHARS..." \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response zawiera komunikat o przekroczeniu maksymalnej długości `search`

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu wskazuje na przekroczenie limitu 200 znaków

---

### Test 2.5: Pusty `search` (tylko białe znaki)

**Cel:** Sprawdzenie walidacji - `search` po trimowaniu nie może być pusty

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors?search=   " \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `400 Bad Request` LUB `200 OK` (w zależności od implementacji - jeśli pusty search jest ignorowany)
- Jeśli 400: komunikat o pustym `search` po trimowaniu

**Weryfikacja:**

- [ ] Status code = 400 lub 200 (zależnie od implementacji)
- [ ] Jeśli 400, komunikat błędu jest odpowiedni

---

## Test Suite 3: Autoryzacja

### Test 3.1: Request bez tokena autoryzacyjnego

**Cel:** Sprawdzenie, czy endpoint wymaga autoryzacji

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors" \
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

### Test 3.2: Request z nieprawidłowym tokenem

**Cel:** Sprawdzenie obsługi nieprawidłowego tokena

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors" \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `401 Unauthorized`
- Response zawiera komunikat o wymaganej autoryzacji

**Weryfikacja:**

- [ ] Status code = 401
- [ ] Response zawiera komunikat o wymaganej autoryzacji

---

### Test 3.3: Request z prawidłowym tokenem

**Cel:** Sprawdzenie, czy prawidłowy token pozwala na dostęp

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors" \
  -H "Authorization: Bearer VALID_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response zawiera listę autorów przypisanych do użytkownika

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Response zawiera dane użytkownika (tylko jego autorzy)

---

## Test Suite 4: Edge Cases

### Test 4.1: Użytkownik bez przypisanych autorów

**Cel:** Sprawdzenie obsługi pustej listy autorów

**Przygotowanie:**

- Upewnij się, że użytkownik testowy nie ma przypisanych autorów (lub użyj nowego użytkownika)

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body:

```json
{
  "items": [],
  "total": 0
}
```

**Weryfikacja:**

- [ ] Status code = 200 (nie 404!)
- [ ] `items` jest pustą tablicą
- [ ] `total` = 0

---

### Test 4.2: Wyszukiwanie bez wyników

**Cel:** Sprawdzenie obsługi wyszukiwania, które nie zwraca wyników

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors?search=NONEXISTENT_AUTHOR_NAME_XYZ123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body:

```json
{
  "items": [],
  "total": 0
}
```

**Weryfikacja:**

- [ ] Status code = 200 (nie 404!)
- [ ] `items` jest pustą tablicą
- [ ] `total` = 0

---

### Test 4.3: Duża liczba autorów (paginacja)

**Cel:** Sprawdzenie paginacji dla użytkownika z dużą liczbą autorów (> 20)

**Przygotowanie:**

- Upewnij się, że użytkownik testowy ma > 20 przypisanych autorów

**Request (strona 1):**

```bash
curl -X GET "http://localhost:4321/api/user/authors?page=1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Request (strona 2):**

```bash
curl -X GET "http://localhost:4321/api/user/authors?page=2" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK` dla obu requestów
- Strona 1: `items` zawiera maksymalnie 20 autorów
- Strona 2: `items` zawiera kolejne autorów (pozycje 21-40)
- `total` jest takie samo dla obu stron i >= 20

**Weryfikacja:**

- [ ] Status code = 200 dla obu stron
- [ ] Strona 1 zawiera maksymalnie 20 autorów
- [ ] Strona 2 zawiera kolejne autorów
- [ ] `total` jest spójne między stronami
- [ ] Brak duplikatów między stronami

---

### Test 4.4: Strona poza zakresem (więcej niż dostępne strony)

**Cel:** Sprawdzenie obsługi strony, która nie istnieje

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors?page=999" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body:

```json
{
  "items": [],
  "total": <liczba_autorów_użytkownika>
}
```

**Weryfikacja:**

- [ ] Status code = 200 (nie 404!)
- [ ] `items` jest pustą tablicą
- [ ] `total` pokazuje rzeczywistą liczbę autorów

---

### Test 4.5: Wyszukiwanie z wieloma wynikami i paginacją

**Cel:** Sprawdzenie kombinacji wyszukiwania i paginacji

**Request:**

```bash
curl -X GET "http://localhost:4321/api/user/authors?search=John&page=1&sort=name_asc" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response zawiera tylko autorów z "John" w nazwie, posortowanych alfabetycznie, z pierwszej strony
- `total` = liczba wszystkich autorów z "John" w nazwie (niezależnie od paginacji)

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie autorzy w `items` mają "John" w nazwie
- [ ] Autorzy są posortowani alfabetycznie
- [ ] `total` = całkowita liczba autorów z "John" (może być > 20)

---

## Test Suite 5: Wydajność i bezpieczeństwo

### Test 5.1: Sprawdzenie RLS (Row Level Security)

**Cel:** Upewnienie się, że użytkownik widzi tylko swoich autorów

**Przygotowanie:**

- Użyj tokena użytkownika A
- Upewnij się, że użytkownik B ma przypisanych autorów

**Request (z tokenem użytkownika A):**

```bash
curl -X GET "http://localhost:4321/api/user/authors" \
  -H "Authorization: Bearer USER_A_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response zawiera TYLKO autorów przypisanych do użytkownika A
- Brak autorów użytkownika B w wynikach

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie autorzy w `items` należą do użytkownika A
- [ ] Brak autorów użytkownika B w wynikach

---

### Test 5.2: Sprawdzenie case-insensitive search

**Cel:** Weryfikacja, że wyszukiwanie działa case-insensitive

**Requesty:**

```bash
# Test 1: lowercase
curl -X GET "http://localhost:4321/api/user/authors?search=tolkien" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test 2: uppercase
curl -X GET "http://localhost:4321/api/user/authors?search=TOLKIEN" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test 3: mixed case
curl -X GET "http://localhost:4321/api/user/authors?search=ToLkIeN" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Oczekiwany wynik:**

- Wszystkie trzy requesty zwracają te same wyniki (jeśli istnieje autor "Tolkien")

**Weryfikacja:**

- [ ] Wszystkie trzy requesty zwracają identyczne wyniki
- [ ] Wyszukiwanie działa case-insensitive

---

## Checklist podsumowujący

### Funkcjonalność podstawowa

- [ ] Request bez parametrów działa
- [ ] Paginacja działa poprawnie
- [ ] Wyszukiwanie działa poprawnie
- [ ] Sortowanie działa poprawnie
- [ ] Wszystkie parametry działają razem

### Walidacja

- [ ] Nieprawidłowe wartości `page` są odrzucane
- [ ] Nieprawidłowe wartości `sort` są odrzucane
- [ ] Zbyt długi `search` jest odrzucany
- [ ] Komunikaty błędów są czytelne

### Autoryzacja

- [ ] Brak tokena zwraca 401
- [ ] Nieprawidłowy token zwraca 401
- [ ] Prawidłowy token pozwala na dostęp

### Edge Cases

- [ ] Pusta lista autorów zwraca 200 z pustą tablicą
- [ ] Wyszukiwanie bez wyników zwraca 200 z pustą tablicą
- [ ] Paginacja działa dla dużej liczby autorów
- [ ] Strona poza zakresem zwraca pustą tablicę

### Bezpieczeństwo

- [ ] RLS działa poprawnie (użytkownik widzi tylko swoich autorów)
- [ ] Wyszukiwanie jest case-insensitive

---

## Notatki z testów

**Data testów:** ******\_\_\_******  
**Tester:** ******\_\_\_******  
**Środowisko:** ******\_\_\_******  
**Wersja API:** ******\_\_\_******

**Znalezione problemy:**

1.
2.
3.

**Uwagi:**

-
