# Manual Tests: PATCH /api/user/works/{workId} & POST /api/user/works/status-bulk

## Test Environment Setup

**Endpoints:**

- `PATCH /api/user/works/{workId}`
- `POST /api/user/works/status-bulk`

**Base URL:** `http://localhost:3000/api/user/works` (lub odpowiedni URL środowiska)  
**Authentication:** Bearer token w nagłówku `Authorization`

### Prerequisites

- Zalogowany użytkownik z ważnym tokenem autoryzacyjnym
- Dostęp do bazy danych z dziełami i relacjami `user_works`
- Narzędzie do testowania API (curl, Postman, Insomnia, lub podobne)
- Użytkownik z przypisanymi dziełami (dla testów sukcesu)
- Użytkownik bez przypisanego dzieła (dla testów 404)
- Minimum 3-5 dzieł przypisanych do użytkownika (dla testów bulk)

---

## Test Suite 1: PATCH /api/user/works/{workId} - Podstawowe funkcjonalności (Happy Path)

### Test 1.1: Aktualizacja statusu dzieła

**Cel:** Sprawdzenie, czy można zaktualizować status pojedynczego dzieła

**Przygotowanie:**

- Znajdź UUID dzieła przypisanego do użytkownika (w tabeli `user_works`)
- Zapisz początkową wartość `status` i `status_updated_at` w `user_works`
- Upewnij się, że dzieło ma status różny od docelowego (np. `to_read` → `in_progress`)

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress"
  }'
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body:

```json
{
  "work": {
    "work": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Example Work Title",
      "openlibrary_id": null,
      "first_publish_year": 2020,
      "primary_edition_id": "660e8400-e29b-41d4-a716-446655440001",
      "manual": false,
      "owner_user_id": null,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "primary_edition": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "title": "Example Edition Title",
        "openlibrary_id": null,
        "publish_year": 2020,
        "publish_date": null,
        "publish_date_raw": null,
        "isbn13": "9781234567890",
        "cover_url": null,
        "language": "pl"
      }
    },
    "status": "in_progress",
    "available_in_legimi": null,
    "status_updated_at": "2024-01-15T11:00:00Z",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Response zawiera pełne dane dzieła z `primary_edition`
- [ ] Status w odpowiedzi = `in_progress`
- [ ] W tabeli `user_works` status został zaktualizowany na `in_progress`
- [ ] Pole `status_updated_at` zostało zaktualizowane (trigger bazy danych)
- [ ] Pole `updated_at` zostało zaktualizowane (trigger bazy danych)
- [ ] Inne pola (`available_in_legimi`) pozostały niezmienione

---

### Test 1.2: Aktualizacja dostępności w Legimi

**Cel:** Sprawdzenie, czy można zaktualizować `available_in_legimi` bez zmiany statusu

**Przygotowanie:**

- Znajdź UUID dzieła przypisanego do użytkownika
- Zapisz początkową wartość `available_in_legimi` i `status_updated_at`
- Upewnij się, że status nie ulega zmianie

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "available_in_legimi": true
  }'
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body zawiera zaktualizowane `available_in_legimi: true`
- Status pozostaje niezmieniony

**Weryfikacja:**

- [ ] Status code = 200
- [ ] `available_in_legimi` w odpowiedzi = `true`
- [ ] Status w odpowiedzi pozostał taki sam jak przed aktualizacją
- [ ] W tabeli `user_works` `available_in_legimi` = `true`
- [ ] Pole `status_updated_at` NIE zostało zaktualizowane (status się nie zmienił)
- [ ] Pole `updated_at` zostało zaktualizowane

---

### Test 1.3: Aktualizacja obu pól jednocześnie

**Cel:** Sprawdzenie, czy można zaktualizować zarówno status, jak i `available_in_legimi` w jednym żądaniu

**Przygotowanie:**

- Znajdź UUID dzieła przypisanego do użytkownika
- Zapisz początkowe wartości `status`, `available_in_legimi` i `status_updated_at`

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "read",
    "available_in_legimi": false
  }'
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body zawiera zaktualizowane oba pola

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Status w odpowiedzi = `read`
- [ ] `available_in_legimi` w odpowiedzi = `false`
- [ ] W tabeli `user_works` oba pola zostały zaktualizowane
- [ ] Pole `status_updated_at` zostało zaktualizowane (status się zmienił)
- [ ] Pole `updated_at` zostało zaktualizowane

---

### Test 1.4: Ustawienie `available_in_legimi` na `null`

**Cel:** Sprawdzenie, czy można ustawić `available_in_legimi` na `null`

**Przygotowanie:**

- Znajdź UUID dzieła przypisanego do użytkownika z `available_in_legimi = true` lub `false`

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "available_in_legimi": null
  }'
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body zawiera `available_in_legimi: null`

**Weryfikacja:**

- [ ] Status code = 200
- [ ] `available_in_legimi` w odpowiedzi = `null`
- [ ] W tabeli `user_works` `available_in_legimi` = `NULL`

---

## Test Suite 2: PATCH /api/user/works/{workId} - Błędy walidacji (400 Bad Request)

### Test 2.1: Nieprawidłowy UUID w path parameter

**Cel:** Sprawdzenie walidacji UUID w path parameter

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/user/works/invalid-uuid" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress"
  }'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body:

```json
{
  "error": "Validation error",
  "message": "workId must be a valid UUID",
  "details": [...]
}
```

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu informuje o nieprawidłowym UUID
- [ ] Response zawiera szczegóły walidacji

---

### Test 2.2: Brak wymaganych pól w body (puste body)

**Cel:** Sprawdzenie, czy endpoint wymaga co najmniej jednego z pól (`status` lub `available_in_legimi`)

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
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
  "message": "At least one of 'status' or 'available_in_legimi' must be provided",
  "details": [...]
}
```

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu informuje o wymaganym polu
- [ ] Response zawiera szczegóły walidacji

---

### Test 2.3: Nieprawidłowa wartość enum dla status

**Cel:** Sprawdzenie walidacji enum dla status

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "invalid_status"
  }'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body zawiera komunikat o nieprawidłowej wartości enum

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu informuje o nieprawidłowej wartości enum

---

### Test 2.4: Nieprawidłowy typ dla `available_in_legimi`

**Cel:** Sprawdzenie walidacji typu dla `available_in_legimi` (musi być boolean lub null)

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "available_in_legimi": "not-a-boolean"
  }'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body zawiera komunikat o nieprawidłowym typie

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu informuje o nieprawidłowym typie

---

### Test 2.5: Nieoczekiwane pola w body (strict validation)

**Cel:** Sprawdzenie, czy endpoint odrzuca nieoczekiwane pola

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "unexpected_field": "value"
  }'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body zawiera komunikat o nieoczekiwanych polach

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu informuje o nieoczekiwanych polach

---

## Test Suite 3: PATCH /api/user/works/{workId} - Błędy autoryzacji i dostępu

### Test 3.1: Brak autoryzacji (brak tokena)

**Cel:** Sprawdzenie obsługi braku autoryzacji

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress"
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
- [ ] Komunikat błędu informuje o wymaganej autoryzacji

---

### Test 3.2: Nieprawidłowy token autoryzacyjny

**Cel:** Sprawdzenie obsługi nieprawidłowego tokena

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress"
  }'
```

**Oczekiwany wynik:**

- Status: `401 Unauthorized`
- Response body zawiera komunikat o błędzie autoryzacji

**Weryfikacja:**

- [ ] Status code = 401
- [ ] Komunikat błędu informuje o błędzie autoryzacji

---

### Test 3.3: Dzieło nie przypisane do użytkownika (404)

**Cel:** Sprawdzenie obsługi przypadku, gdy dzieło nie jest przypisane do użytkownika

**Przygotowanie:**

- Znajdź UUID dzieła, które NIE jest przypisane do zalogowanego użytkownika
- Lub użyj UUID dzieła, które nie istnieje w bazie danych

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress"
  }'
```

**Oczekiwany wynik:**

- Status: `404 Not Found`
- Response body:

```json
{
  "error": "Not Found",
  "message": "Work is not attached to your profile"
}
```

**Weryfikacja:**

- [ ] Status code = 404
- [ ] Komunikat błędu informuje, że dzieło nie jest przypisane do profilu

---

## Test Suite 4: PATCH /api/user/works/{workId} - Weryfikacja triggera bazy danych

### Test 4.1: Weryfikacja aktualizacji `status_updated_at` przy zmianie statusu

**Cel:** Sprawdzenie, czy trigger bazy danych aktualizuje `status_updated_at` przy zmianie statusu

**Przygotowanie:**

- Znajdź UUID dzieła przypisanego do użytkownika
- Zapisz początkową wartość `status_updated_at` (może być `null`)
- Zapisz aktualny czas przed wykonaniem żądania

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "read"
  }'
```

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Pole `status_updated_at` w odpowiedzi zostało zaktualizowane na aktualny czas
- [ ] W tabeli `user_works` pole `status_updated_at` zostało zaktualizowane
- [ ] Wartość `status_updated_at` jest zbliżona do czasu wykonania żądania (z tolerancją na opóźnienie)

---

### Test 4.2: Weryfikacja, że `status_updated_at` NIE jest aktualizowane przy zmianie tylko `available_in_legimi`

**Cel:** Sprawdzenie, czy trigger NIE aktualizuje `status_updated_at`, gdy zmienia się tylko `available_in_legimi`

**Przygotowanie:**

- Znajdź UUID dzieła przypisanego do użytkownika
- Zapisz początkową wartość `status_updated_at` i `status`
- Upewnij się, że zmieniasz tylko `available_in_legimi`, a nie `status`

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "available_in_legimi": true
  }'
```

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Pole `status_updated_at` w odpowiedzi pozostało niezmienione (lub `null` jeśli było `null`)
- [ ] W tabeli `user_works` pole `status_updated_at` NIE zostało zaktualizowane
- [ ] Pole `updated_at` zostało zaktualizowane (trigger zawsze aktualizuje `updated_at`)

---

## Test Suite 5: POST /api/user/works/status-bulk - Podstawowe funkcjonalności (Happy Path)

### Test 5.1: Masowa aktualizacja statusu dla wielu dzieł

**Cel:** Sprawdzenie, czy można zaktualizować status wielu dzieł jednocześnie

**Przygotowanie:**

- Znajdź 3-5 UUID dzieł przypisanych do użytkownika
- Zapisz początkowe wartości `status` dla każdego dzieła

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/status-bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "550e8400-e29b-41d4-a716-446655440000",
      "660e8400-e29b-41d4-a716-446655440001",
      "770e8400-e29b-41d4-a716-446655440002"
    ],
    "status": "read"
  }'
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body:

```json
{
  "works": [
    {
      "work": { ... },
      "status": "read",
      "available_in_legimi": null,
      "status_updated_at": "2024-01-15T11:00:00Z",
      "created_at": "...",
      "updated_at": "..."
    },
    ...
  ]
}
```

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Response zawiera tablicę `works` z 3 elementami
- [ ] Wszystkie dzieła w odpowiedzi mają status = `read`
- [ ] W tabeli `user_works` wszystkie 3 dzieła mają zaktualizowany status
- [ ] Pole `status_updated_at` zostało zaktualizowane dla wszystkich dzieł
- [ ] Pole `updated_at` zostało zaktualizowane dla wszystkich dzieł

---

### Test 5.2: Masowa aktualizacja `available_in_legimi` dla wielu dzieł

**Cel:** Sprawdzenie, czy można zaktualizować `available_in_legimi` dla wielu dzieł jednocześnie

**Przygotowanie:**

- Znajdź 3-5 UUID dzieł przypisanych do użytkownika

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/status-bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "550e8400-e29b-41d4-a716-446655440000",
      "660e8400-e29b-41d4-a716-446655440001"
    ],
    "available_in_legimi": true
  }'
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body zawiera tablicę z zaktualizowanymi dziełami

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie dzieła w odpowiedzi mają `available_in_legimi = true`
- [ ] W tabeli `user_works` wszystkie dzieła mają zaktualizowane `available_in_legimi`

---

### Test 5.3: Masowa aktualizacja obu pól dla wielu dzieł

**Cel:** Sprawdzenie, czy można zaktualizować zarówno status, jak i `available_in_legimi` dla wielu dzieł

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/status-bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "550e8400-e29b-41d4-a716-446655440000",
      "660e8400-e29b-41d4-a716-446655440001"
    ],
    "status": "in_progress",
    "available_in_legimi": false
  }'
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body zawiera tablicę z dziełami z zaktualizowanymi oboma polami

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie dzieła mają status = `in_progress`
- [ ] Wszystkie dzieła mają `available_in_legimi = false`
- [ ] W tabeli `user_works` wszystkie dzieła mają zaktualizowane oba pola

---

### Test 5.4: Pominięcie nieprzypisanych dzieł (bez błędu 404)

**Cel:** Sprawdzenie, czy nieprzypisane dzieła są pomijane bez błędu

**Przygotowanie:**

- Znajdź 2 UUID dzieł przypisanych do użytkownika
- Znajdź 1 UUID dzieła NIE przypisanego do użytkownika (lub nieistniejącego)

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/status-bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "550e8400-e29b-41d4-a716-446655440000",
      "660e8400-e29b-41d4-a716-446655440001",
      "999e8400-e29b-41d4-a716-446655449999"
    ],
    "status": "read"
  }'
```

**Oczekiwany wynik:**

- Status: `200 OK` (NIE 404!)
- Response body zawiera tablicę `works` z tylko 2 elementami (przypisane dzieła)
- Nieprzypisane dzieło jest pominięte bez błędu

**Weryfikacja:**

- [ ] Status code = 200 (nie 404)
- [ ] Response zawiera tylko 2 dzieła (przypisane)
- [ ] Nieprzypisane dzieło nie jest w odpowiedzi
- [ ] W tabeli `user_works` tylko 2 dzieła zostały zaktualizowane
- [ ] Nie ma błędów w logach związanych z nieprzypisanym dziełem

---

## Test Suite 6: POST /api/user/works/status-bulk - Błędy walidacji (400 Bad Request)

### Test 6.1: Pusta tablica `work_ids`

**Cel:** Sprawdzenie walidacji - `work_ids` musi zawierać co najmniej 1 element

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/status-bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [],
    "status": "read"
  }'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body:

```json
{
  "error": "Validation error",
  "message": "work_ids must contain at least 1 element",
  "details": [...]
}
```

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu informuje o wymaganiu minimum 1 elementu

---

### Test 6.2: Przekroczony limit 100 elementów

**Cel:** Sprawdzenie walidacji - `work_ids` nie może przekraczać 100 elementów

**Przygotowanie:**

- Przygotuj tablicę z 101 UUID (można użyć tego samego UUID wielokrotnie dla testu)

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/status-bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [/* 101 UUID */],
    "status": "read"
  }'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body:

```json
{
  "error": "Validation error",
  "message": "work_ids array exceeds maximum size of 100",
  "details": [...]
}
```

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu informuje o przekroczeniu limitu 100

---

### Test 6.3: Nieprawidłowe UUID w tablicy `work_ids`

**Cel:** Sprawdzenie walidacji UUID w tablicy

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/status-bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "550e8400-e29b-41d4-a716-446655440000",
      "invalid-uuid",
      "660e8400-e29b-41d4-a716-446655440001"
    ],
    "status": "read"
  }'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body zawiera komunikat o nieprawidłowym UUID

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu informuje o nieprawidłowym UUID w tablicy

---

### Test 6.4: Brak wymaganych pól w body (puste body)

**Cel:** Sprawdzenie, czy endpoint wymaga co najmniej jednego z pól (`status` lub `available_in_legimi`)

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/status-bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["550e8400-e29b-41d4-a716-446655440000"]
  }'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body:

```json
{
  "error": "Validation error",
  "message": "At least one of 'status' or 'available_in_legimi' must be provided",
  "details": [...]
}
```

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu informuje o wymaganym polu

---

### Test 6.5: Nieprawidłowa wartość enum dla status

**Cel:** Sprawdzenie walidacji enum dla status w bulk endpoint

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/status-bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["550e8400-e29b-41d4-a716-446655440000"],
    "status": "invalid_status"
  }'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response body zawiera komunikat o nieprawidłowej wartości enum

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Komunikat błędu informuje o nieprawidłowej wartości enum

---

### Test 6.6: Deduplikacja duplikatów w tablicy `work_ids`

**Cel:** Sprawdzenie, czy duplikaty są automatycznie usuwane z tablicy `work_ids`

**Przygotowanie:**

- Znajdź 1 UUID dzieła przypisanego do użytkownika

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/status-bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "550e8400-e29b-41d4-a716-446655440000",
      "550e8400-e29b-41d4-a716-446655440000",
      "550e8400-e29b-41d4-a716-446655440000"
    ],
    "status": "read"
  }'
```

**Oczekiwany wynik:**

- Status: `200 OK`
- Response body zawiera tablicę `works` z tylko 1 elementem (duplikaty zostały usunięte)
- Dzieło zostało zaktualizowane tylko raz

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Response zawiera tylko 1 dzieło (nie 3)
- [ ] W tabeli `user_works` dzieło zostało zaktualizowane tylko raz
- [ ] Nie ma błędów związanych z duplikatami

---

## Test Suite 7: POST /api/user/works/status-bulk - Błędy autoryzacji

### Test 7.1: Brak autoryzacji (brak tokena)

**Cel:** Sprawdzenie obsługi braku autoryzacji

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/status-bulk" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["550e8400-e29b-41d4-a716-446655440000"],
    "status": "read"
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
- [ ] Komunikat błędu informuje o wymaganej autoryzacji

---

### Test 7.2: Nieprawidłowy token autoryzacyjny

**Cel:** Sprawdzenie obsługi nieprawidłowego tokena

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/status-bulk" \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["550e8400-e29b-41d4-a716-446655440000"],
    "status": "read"
  }'
```

**Oczekiwany wynik:**

- Status: `401 Unauthorized`
- Response body zawiera komunikat o błędzie autoryzacji

**Weryfikacja:**

- [ ] Status code = 401
- [ ] Komunikat błędu informuje o błędzie autoryzacji

---

## Test Suite 8: POST /api/user/works/status-bulk - Weryfikacja triggera bazy danych

### Test 8.1: Weryfikacja aktualizacji `status_updated_at` dla wszystkich zaktualizowanych rekordów

**Cel:** Sprawdzenie, czy trigger aktualizuje `status_updated_at` dla wszystkich dzieł przy masowej aktualizacji statusu

**Przygotowanie:**

- Znajdź 3-5 UUID dzieł przypisanych do użytkownika
- Zapisz początkowe wartości `status_updated_at` dla każdego dzieła

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/status-bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "550e8400-e29b-41d4-a716-446655440000",
      "660e8400-e29b-41d4-a716-446655440001",
      "770e8400-e29b-41d4-a716-446655440002"
    ],
    "status": "read"
  }'
```

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Wszystkie dzieła w odpowiedzi mają zaktualizowane `status_updated_at`
- [ ] W tabeli `user_works` wszystkie 3 dzieła mają zaktualizowane `status_updated_at`
- [ ] Wartości `status_updated_at` są zbliżone do czasu wykonania żądania

---

## Test Suite 9: Testowanie wydajności

### Test 9.1: Bulk update z maksymalną liczbą elementów (100)

**Cel:** Sprawdzenie wydajności przy maksymalnym rozmiarze batch

**Przygotowanie:**

- Znajdź 100 UUID dzieł przypisanych do użytkownika
- Zmierz czas przed wykonaniem żądania

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/status-bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [/* 100 UUID */],
    "status": "read"
  }'
```

**Weryfikacja:**

- [ ] Status code = 200
- [ ] Response zawiera 100 dzieł
- [ ] Czas wykonania jest akceptowalny (< 5 sekund dla 100 elementów)
- [ ] Wszystkie 100 dzieł zostało zaktualizowane w bazie danych
- [ ] Nie ma błędów timeout lub przeciążenia

---

## Checklist końcowy

### PATCH /api/user/works/{workId}

- [ ] Wszystkie testy happy path (1.1-1.4) przeszły
- [ ] Wszystkie testy walidacji (2.1-2.5) przeszły
- [ ] Wszystkie testy autoryzacji (3.1-3.3) przeszły
- [ ] Weryfikacja triggera (4.1-4.2) przeszła
- [ ] Logi błędów są czytelne i zawierają odpowiedni kontekst

### POST /api/user/works/status-bulk

- [ ] Wszystkie testy happy path (5.1-5.4) przeszły
- [ ] Wszystkie testy walidacji (6.1-6.6) przeszły
- [ ] Wszystkie testy autoryzacji (7.1-7.2) przeszły
- [ ] Weryfikacja triggera (8.1) przeszła
- [ ] Test wydajności (9.1) przeszedł
- [ ] Logi błędów są czytelne i zawierają odpowiedni kontekst

### Ogólne

- [ ] Wszystkie endpointy zwracają poprawne kody statusu HTTP
- [ ] Wszystkie odpowiedzi zawierają poprawne struktury danych
- [ ] Obsługa błędów jest spójna i informatywna
- [ ] Dokumentacja JSDoc jest kompletna i aktualna
