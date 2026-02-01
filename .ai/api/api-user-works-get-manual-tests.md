# Manual Tests: GET /api/user/works

## Test Environment Setup

**Endpoint:** `GET /api/user/works`  
**Base URL:** `http://localhost:3000/api/user/works` (lub odpowiedni URL środowiska)  
**Authentication:** Bearer token w nagłówku `Authorization`

### Prerequisites

- Zalogowany użytkownik z ważnym tokenem autoryzacyjnym
- Użytkownik z przypisanymi dziełami (różne statusy, dostępności, autorzy)
- Dostęp do bazy danych z dziełami, wydaniami i relacjami autor-dzieło
- Narzędzie do testowania API (curl, Postman, Insomnia, lub podobne)
- Dla testów paginacji: użytkownik z >20 przypisanymi dziełami
- Dla testów wydajności: użytkownik z dużą liczbą dzieł (>100)

---

## Test Suite 1: Podstawowe funkcjonalności (Happy Path)

### Test 1.1: Pobranie wszystkich dzieł użytkownika (domyślne parametry)

**Cel:** Sprawdzenie, czy endpoint zwraca listę dzieł użytkownika z domyślnymi parametrami

**Przygotowanie:**

- Upewnij się, że użytkownik ma przypisane przynajmniej kilka dzieł
- Upewnij się, że niektóre dzieła mają primary edition, a niektóre nie

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body:

```json
{
  "items": [
    {
      "work": {
        "id": "uuid",
        "title": "string",
        "openlibrary_id": "string | null",
        "first_publish_year": "number | null",
        "primary_edition_id": "uuid | null",
        "manual": false,
        "owner_user_id": "uuid | null",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z",
        "primary_edition": {
          "id": "uuid",
          "title": "string",
          "openlibrary_id": "string | null",
          "publish_year": "number | null",
          "publish_date": "2024-01-15",
          "publish_date_raw": "string | null",
          "isbn13": "string | null",
          "cover_url": "string | null",
          "language": "string | null"
        } | null
      },
      "status": "to_read",
      "available_in_legimi": true,
      "status_updated_at": "2024-01-15T10:30:00Z | null",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "page": 1,
  "total": 42
}
```

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Response zawiera `items` (tablica), `page` (number), `total` (number)
- [ ] `page` = 1 (domyślna wartość)
- [ ] `items` zawiera maksymalnie 20 elementów
- [ ] Każdy element w `items` ma strukturę `UserWorkItemDto`
- [ ] `work.primary_edition` może być `null` dla dzieł bez primary edition
- [ ] Sortowanie jest domyślne (`published_desc` - najnowsze według roku publikacji)
- [ ] Wszystkie zwrócone dzieła należą do zalogowanego użytkownika

---

### Test 1.2: Pobranie pierwszej strony z domyślnym sortowaniem

**Cel:** Sprawdzenie domyślnego sortowania `published_desc`

**Przygotowanie:**

- Upewnij się, że użytkownik ma dzieła z różnymi latami publikacji

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?page=1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Dzieła posortowane według `COALESCE(work.first_publish_year, work.primary_edition.publish_year) DESC NULLS LAST`
- Następnie alfabetycznie po tytule
- Następnie po `work.id` (dla stabilności sortowania)

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Dzieła są posortowane od najnowszych do najstarszych (według roku publikacji)
- [ ] Dzieła bez roku publikacji są na końcu
- [ ] W przypadku remisu, sortowanie jest alfabetyczne po tytule

---

## Test Suite 2: Walidacja danych wejściowych

### Test 2.1: Nieprawidłowy format `page` (nie integer)

**Cel:** Sprawdzenie walidacji - `page` musi być integer

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?page=abc" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body:

```json
{
  "error": "Validation error",
  "message": "Page must be an integer",
  "details": [...]
}
```

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Response zawiera komunikat błędu walidacji
- [ ] `details` zawiera szczegóły błędów walidacji

---

### Test 2.2: `page` mniejsze niż 1

**Cel:** Sprawdzenie walidacji - `page` musi być >= 1

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?page=0" \
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
- [ ] Komunikat błędu wskazuje na minimalną wartość

---

### Test 2.3: Nieprawidłowy status (nie z enum)

**Cel:** Sprawdzenie walidacji - `status` musi być z dozwolonych wartości

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?status=invalid_status" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body zawiera komunikat o nieprawidłowym statusie

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu wskazuje na nieprawidłową wartość statusu

---

### Test 2.4: Nieprawidłowy format `author_id` (nie UUID)

**Cel:** Sprawdzenie walidacji - `author_id` musi być UUID

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?author_id=not-a-uuid" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
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
- [ ] Komunikat błędu wskazuje na wymagany format UUID

---

### Test 2.5: `search` przekracza 200 znaków

**Cel:** Sprawdzenie walidacji - `search` maksymalnie 200 znaków

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?search=$(python -c 'print("a" * 201)')" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body:

```json
{
  "error": "Validation error",
  "message": "Search query cannot exceed 200 characters",
  "details": [...]
}
```

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu wskazuje na limit 200 znaków

---

### Test 2.6: Nieprawidłowy `sort` (nie z enum)

**Cel:** Sprawdzenie walidacji - `sort` musi być `published_desc` lub `title_asc`

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?sort=invalid_sort" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body zawiera komunikat o nieprawidłowej wartości sort

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu wskazuje na dozwolone wartości

---

## Test Suite 3: Uwierzytelnienie

### Test 3.1: Brak tokenu autoryzacyjnego

**Cel:** Sprawdzenie, czy endpoint wymaga uwierzytelnienia

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works" \
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
- [ ] Response zawiera komunikat o wymaganym uwierzytelnieniu

---

### Test 3.2: Nieprawidłowy token autoryzacyjny

**Cel:** Sprawdzenie obsługi nieprawidłowego tokenu

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works" \
  -H "Authorization: Bearer invalid_token_12345" \
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
- [ ] Response zawiera komunikat o błędzie uwierzytelnienia

---

### Test 3.3: Wygasły token autoryzacyjny

**Cel:** Sprawdzenie obsługi wygasłego tokenu

**Przygotowanie:**

- Użyj wygasłego tokenu (jeśli dostępny)

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works" \
  -H "Authorization: Bearer EXPIRED_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `401 Unauthorized`
- Response body zawiera komunikat o błędzie uwierzytelnienia

**Weryfikacja:**

- [ ] Status code = 401
- [ ] Response zawiera komunikat o błędzie uwierzytelnienia

---

## Test Suite 4: Filtrowanie

### Test 4.1: Filtrowanie po pojedynczym statusie

**Cel:** Sprawdzenie filtrowania po jednym statusie

**Przygotowanie:**

- Upewnij się, że użytkownik ma dzieła ze statusem `to_read`

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?status=to_read" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Wszystkie zwrócone dzieła mają `status = "to_read"`
- `total` wskazuje na liczbę dzieł ze statusem `to_read`

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie elementy w `items` mają `status = "to_read"`
- [ ] `total` odpowiada rzeczywistej liczbie dzieł ze statusem `to_read`

---

### Test 4.2: Filtrowanie po wielu statusach (multi-select)

**Cel:** Sprawdzenie filtrowania po wielu statusach jednocześnie

**Przygotowanie:**

- Upewnij się, że użytkownik ma dzieła ze statusami `to_read` i `in_progress`

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?status=to_read&status=in_progress" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Wszystkie zwrócone dzieła mają `status` równy `"to_read"` LUB `"in_progress"`
- `total` wskazuje na sumę dzieł z oboma statusami

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie elementy w `items` mają `status` z dozwolonych wartości
- [ ] `total` odpowiada rzeczywistej liczbie dzieł z wybranymi statusami

---

### Test 4.3: Filtrowanie po dostępności `available=true`

**Cel:** Sprawdzenie filtrowania po dostępności w Legimi (true)

**Przygotowanie:**

- Upewnij się, że użytkownik ma dzieła z `available_in_legimi = true`

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?available=true" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Wszystkie zwrócone dzieła mają `available_in_legimi = true`
- `total` wskazuje na liczbę dzieł z `available_in_legimi = true`

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie elementy w `items` mają `available_in_legimi = true`
- [ ] `total` odpowiada rzeczywistej liczbie dzieł z `available_in_legimi = true`

---

### Test 4.4: Filtrowanie po dostępności `available=false`

**Cel:** Sprawdzenie filtrowania po dostępności w Legimi (false)

**Przygotowanie:**

- Upewnij się, że użytkownik ma dzieła z `available_in_legimi = false`

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?available=false" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Wszystkie zwrócone dzieła mają `available_in_legimi = false`
- `total` wskazuje na liczbę dzieł z `available_in_legimi = false`

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie elementy w `items` mają `available_in_legimi = false`
- [ ] `total` odpowiada rzeczywistej liczbie dzieł z `available_in_legimi = false`

---

### Test 4.5: Filtrowanie po dostępności `available=null` (nieoznaczone)

**Cel:** Sprawdzenie filtrowania po dostępności w Legimi (null - nieoznaczone)

**Przygotowanie:**

- Upewnij się, że użytkownik ma dzieła z `available_in_legimi = null`

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?available=null" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Wszystkie zwrócone dzieła mają `available_in_legimi = null`
- `total` wskazuje na liczbę dzieł z `available_in_legimi = null`

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie elementy w `items` mają `available_in_legimi = null`
- [ ] `total` odpowiada rzeczywistej liczbie dzieł z `available_in_legimi = null`

---

### Test 4.6: Filtrowanie po autorze (`author_id`)

**Cel:** Sprawdzenie filtrowania po konkretnym autorze

**Przygotowanie:**

- Znajdź UUID autora, który ma przypisane dzieła użytkownika
- Upewnij się, że użytkownik ma dzieła powiązane z tym autorem

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?author_id=123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Wszystkie zwrócone dzieła są powiązane z podanym autorem (przez `author_works`)
- `total` wskazuje na liczbę dzieł użytkownika powiązanych z tym autorem

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie zwrócone dzieła są powiązane z podanym autorem
- [ ] `total` odpowiada rzeczywistej liczbie dzieł powiązanych z autorem
- [ ] Weryfikacja w bazie danych: sprawdź relacje `author_works` dla zwróconych dzieł

---

### Test 4.7: Filtrowanie po wyszukiwaniu (`search`)

**Cel:** Sprawdzenie wyszukiwania po tytule dzieła (case-insensitive, substring)

**Przygotowanie:**

- Upewnij się, że użytkownik ma dzieła z tytułami zawierającymi "harry" (różne wielkości liter)

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?search=harry" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Wszystkie zwrócone dzieła mają tytuły zawierające "harry" (case-insensitive)
- `total` wskazuje na liczbę dzieł pasujących do wyszukiwania

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie elementy w `items` mają tytuły zawierające "harry" (case-insensitive)
- [ ] Wyszukiwanie działa dla różnych wielkości liter ("Harry", "HARRY", "harry")
- [ ] `total` odpowiada rzeczywistej liczbie pasujących dzieł

---

### Test 4.8: Kombinacja wielu filtrów

**Cel:** Sprawdzenie działania wielu filtrów jednocześnie

**Przygotowanie:**

- Upewnij się, że użytkownik ma dzieła spełniające wszystkie kryteria

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?status=to_read&status=in_progress&available=true&author_id=123e4567-e89b-12d3-a456-426614174000&search=harry" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Wszystkie zwrócone dzieła spełniają WSZYSTKIE kryteria:
  - Status = `to_read` LUB `in_progress`
  - `available_in_legimi = true`
  - Powiązane z podanym autorem
  - Tytuł zawiera "harry" (case-insensitive)

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie elementy spełniają wszystkie kryteria filtrowania
- [ ] `total` odpowiada rzeczywistej liczbie dzieł spełniających wszystkie kryteria

---

## Test Suite 5: Sortowanie

### Test 5.1: Sortowanie `published_desc` (domyślne)

**Cel:** Sprawdzenie sortowania od najnowszych do najstarszych według roku publikacji

**Przygotowanie:**

- Upewnij się, że użytkownik ma dzieła z różnymi latami publikacji

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?sort=published_desc" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Dzieła posortowane według `COALESCE(work.first_publish_year, work.primary_edition.publish_year) DESC NULLS LAST`
- Następnie alfabetycznie po tytule
- Następnie po `work.id` (dla stabilności)

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Dzieła są posortowane od najnowszych do najstarszych (według roku publikacji)
- [ ] Dzieła bez roku publikacji są na końcu
- [ ] W przypadku remisu, sortowanie jest alfabetyczne po tytule

---

### Test 5.2: Sortowanie `title_asc`

**Cel:** Sprawdzenie sortowania alfabetycznego po tytule

**Przygotowanie:**

- Upewnij się, że użytkownik ma dzieła z różnymi tytułami

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?sort=title_asc" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Dzieła posortowane alfabetycznie po tytule (A-Z)
- Następnie po `work.id` (dla stabilności)

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Dzieła są posortowane alfabetycznie po tytule (A-Z)
- [ ] Sortowanie jest case-insensitive (lub zgodne z implementacją)

---

### Test 5.3: Sortowanie z filtrowaniem

**Cel:** Sprawdzenie, czy sortowanie działa poprawnie z filtrowaniem

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?status=read&sort=title_asc" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Tylko dzieła ze statusem `read`
- Posortowane alfabetycznie po tytule

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Filtrowanie działa poprawnie
- [ ] Sortowanie działa poprawnie na przefiltrowanych wynikach

---

## Test Suite 6: Paginacja

### Test 6.1: Pierwsza strona (domyślna)

**Cel:** Sprawdzenie domyślnej paginacji (strona 1)

**Przygotowanie:**

- Upewnij się, że użytkownik ma >20 przypisanych dzieł

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?page=1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- `page = 1`
- `items` zawiera maksymalnie 20 elementów
- `total` wskazuje na całkowitą liczbę dzieł

**Weryfikacja:**

- [ ] Status code = 200
- [ ] `page = 1`
- [ ] `items.length <= 20`
- [ ] `total` odpowiada rzeczywistej liczbie dzieł użytkownika

---

### Test 6.2: Druga strona

**Cel:** Sprawdzenie paginacji dla strony 2

**Przygotowanie:**

- Upewnij się, że użytkownik ma >20 przypisanych dzieł

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?page=2" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- `page = 2`
- `items` zawiera maksymalnie 20 elementów (elementy 21-40)
- `total` wskazuje na całkowitą liczbę dzieł

**Weryfikacja:**

- [ ] Status code = 200
- [ ] `page = 2`
- [ ] `items.length <= 20`
- [ ] Elementy są różne od strony 1
- [ ] `total` jest takie samo jak na stronie 1

---

### Test 6.3: Ostatnia strona (częściowo wypełniona)

**Cel:** Sprawdzenie paginacji dla ostatniej strony

**Przygotowanie:**

- Upewnij się, że użytkownik ma np. 42 dzieła (3 strony: 20 + 20 + 2)

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?page=3" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- `page = 3`
- `items.length = 2` (lub odpowiednia liczba dla ostatniej strony)
- `total = 42`

**Weryfikacja:**

- [ ] Status code = 200
- [ ] `page = 3`
- [ ] `items.length` odpowiada liczbie dzieł na ostatniej stronie
- [ ] `total = 42`

---

### Test 6.4: Strona poza zakresem (pusta strona)

**Cel:** Sprawdzenie obsługi strony poza zakresem

**Przygotowanie:**

- Upewnij się, że użytkownik ma np. 10 dzieł (tylko 1 strona)

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?page=100" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- `page = 100`
- `items = []` (pusta tablica)
- `total = 10` (lub rzeczywista liczba dzieł)

**Weryfikacja:**

- [ ] Status code = 200 (nie 404!)
- [ ] `page = 100`
- [ ] `items = []`
- [ ] `total` odpowiada rzeczywistej liczbie dzieł

---

### Test 6.5: Paginacja z filtrowaniem

**Cel:** Sprawdzenie, czy paginacja działa poprawnie z filtrowaniem

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?status=to_read&page=2" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- `page = 2`
- Tylko dzieła ze statusem `to_read`
- `total` wskazuje na liczbę dzieł ze statusem `to_read` (nie wszystkich dzieł)

**Weryfikacja:**

- [ ] Status code = 200
- [ ] `page = 2`
- [ ] Wszystkie elementy mają `status = "to_read"`
- [ ] `total` odpowiada liczbie dzieł ze statusem `to_read`

---

## Test Suite 7: Edge Cases

### Test 7.1: Użytkownik bez przypisanych dzieł (pusta lista)

**Cel:** Sprawdzenie obsługi użytkownika bez dzieł

**Przygotowanie:**

- Użyj użytkownika, który nie ma przypisanych dzieł (lub usuń wszystkie relacje)

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body:

```json
{
  "items": [],
  "page": 1,
  "total": 0
}
```

**Weryfikacja:**

- [ ] Status code = 200 (nie 404!)
- [ ] `items = []`
- [ ] `page = 1`
- [ ] `total = 0`

---

### Test 7.2: Dzieło bez primary edition

**Cel:** Sprawdzenie obsługi dzieła bez primary edition

**Przygotowanie:**

- Upewnij się, że użytkownik ma dzieło z `primary_edition_id = null`

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Dzieło bez primary edition ma `work.primary_edition = null`
- Pozostałe pola `work` są wypełnione poprawnie

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Dzieło bez primary edition ma `work.primary_edition = null`
- [ ] Pozostałe pola są wypełnione poprawnie

---

### Test 7.3: Filtrowanie po nieistniejącym autorze

**Cel:** Sprawdzenie obsługi filtrowania po autorze, który nie ma przypisanych dzieł użytkownika

**Przygotowanie:**

- Znajdź UUID autora, który istnieje, ale nie ma przypisanych dzieł użytkownika

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?author_id=123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body:

```json
{
  "items": [],
  "page": 1,
  "total": 0
}
```

**Weryfikacja:**

- [ ] Status code = 200 (nie 404!)
- [ ] `items = []`
- [ ] `total = 0`

---

### Test 7.4: Filtrowanie po statusie, który nie pasuje do żadnych dzieł

**Cel:** Sprawdzenie obsługi filtrowania po statusie, który nie pasuje do żadnych dzieł

**Przygotowanie:**

- Upewnij się, że użytkownik nie ma dzieł ze statusem `hidden` (lub użyj innego statusu)

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?status=hidden" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body:

```json
{
  "items": [],
  "page": 1,
  "total": 0
}
```

**Weryfikacja:**

- [ ] Status code = 200
- [ ] `items = []`
- [ ] `total = 0`

---

### Test 7.5: Wyszukiwanie bez wyników

**Cel:** Sprawdzenie obsługi wyszukiwania, które nie zwraca wyników

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?search=nonexistent_title_xyz123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body:

```json
{
  "items": [],
  "page": 1,
  "total": 0
}
```

**Weryfikacja:**

- [ ] Status code = 200
- [ ] `items = []`
- [ ] `total = 0`

---

### Test 7.6: Pusty string w `search` (powinien być ignorowany)

**Cel:** Sprawdzenie obsługi pustego stringa w `search`

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works?search=" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Wszystkie dzieła użytkownika (jakby `search` nie był podany)
- `total` wskazuje na wszystkie dzieła

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wyniki są takie same jak bez parametru `search`
- [ ] Pusty string jest ignorowany (nie filtruje)

---

### Test 7.7: Primary edition wskazuje na nieistniejące wydanie

**Cel:** Sprawdzenie obsługi przypadku, gdy `primary_edition_id` wskazuje na nieistniejące wydanie

**Przygotowanie:**

- Utwórz sytuację, gdzie `work.primary_edition_id` wskazuje na nieistniejące wydanie (może wymagać ręcznej modyfikacji w bazie)

**Request:**

```bash
curl -X GET "http://localhost:3000/api/user/works" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK` lub `500 Internal Server Error` (w zależności od implementacji)
- Jeśli 200: `work.primary_edition = null` (FK constraint ON DELETE SET NULL)

**Weryfikacja:**

- [ ] Endpoint obsługuje ten przypadek poprawnie
- [ ] Jeśli błąd, to jest odpowiednio obsłużony i zalogowany

---

## Test Suite 8: Wydajność (opcjonalne)

### Test 8.1: Duża liczba dzieł użytkownika (>100)

**Cel:** Sprawdzenie wydajności z dużą liczbą dzieł

**Przygotowanie:**

- Użyj użytkownika z >100 przypisanymi dziełami
- Zmierz czas odpowiedzi

**Request:**

```bash
time curl -X GET "http://localhost:3000/api/user/works" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Czas odpowiedzi < 1 sekunda (lub odpowiedni dla środowiska)
- Wszystkie dane są zwrócone poprawnie

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Czas odpowiedzi jest akceptowalny
- [ ] Wszystkie dane są poprawne
- [ ] Sprawdź logi bazy danych pod kątem optymalizacji zapytań

---

### Test 8.2: Złożone zapytanie z wieloma filtrami i sortowaniem

**Cel:** Sprawdzenie wydajności złożonego zapytania

**Request:**

```bash
time curl -X GET "http://localhost:3000/api/user/works?status=to_read&status=in_progress&available=true&author_id=123e4567-e89b-12d3-a456-426614174000&search=harry&sort=published_desc&page=1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Czas odpowiedzi jest akceptowalny nawet z wieloma filtrami
- Wszystkie filtry działają poprawnie

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Czas odpowiedzi jest akceptowalny
- [ ] Wszystkie filtry działają poprawnie
- [ ] Sprawdź użycie indeksów w bazie danych

---

## Test Suite 9: Integracja z RLS (Row Level Security)

### Test 9.1: Użytkownik widzi tylko swoje dzieła

**Cel:** Sprawdzenie, czy RLS działa poprawnie - użytkownik widzi tylko swoje dzieła

**Przygotowanie:**

- Użyj dwóch różnych użytkowników
- Upewnij się, że każdy ma przypisane różne dzieła

**Request (User 1):**

```bash
curl -X GET "http://localhost:3000/api/user/works" \
  -H "Authorization: Bearer USER1_TOKEN" \
  -H "Content-Type: application/json"
```

**Request (User 2):**

```bash
curl -X GET "http://localhost:3000/api/user/works" \
  -H "Authorization: Bearer USER2_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**

- Każdy użytkownik widzi tylko swoje własne dzieła
- `total` dla każdego użytkownika odpowiada liczbie jego dzieł

**Weryfikacja:**

- [ ] User 1 widzi tylko swoje dzieła
- [ ] User 2 widzi tylko swoje dzieła
- [ ] Nie ma przecieku danych między użytkownikami
- [ ] Sprawdź w bazie danych, że RLS działa poprawnie

---

## Checklist końcowy

Przed zakończeniem testów, upewnij się, że:

- [ ] Wszystkie testy z Test Suite 1-7 zostały wykonane
- [ ] Wszystkie błędy zostały zgłoszone i naprawione
- [ ] Wszystkie edge cases zostały przetestowane
- [ ] Wydajność jest akceptowalna (Test Suite 8)
- [ ] RLS działa poprawnie (Test Suite 9)
- [ ] Dokumentacja została zaktualizowana
- [ ] Logi błędów są odpowiednio zapisywane
- [ ] Response times są w akceptowalnym zakresie

---

## Notatki z testów

**Data testów:** **\*\***\_\_\_**\*\***  
**Tester:** **\*\***\_\_\_**\*\***  
**Środowisko:** **\*\***\_\_\_**\*\***  
**Wersja API:** **\*\***\_\_\_**\*\***

### Znalezione problemy:

1.
2.
3.

### Sugestie ulepszeń:

1.
2.
3.
