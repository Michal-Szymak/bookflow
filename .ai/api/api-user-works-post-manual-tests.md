# Manual Tests: POST /api/user/works/bulk

## Test Environment Setup

**Endpoint:** `POST /api/user/works/bulk`  
**Base URL:** `http://localhost:3000/api/user/works/bulk` (lub odpowiedni URL środowiska)  
**Authentication:** Bearer token w nagłówku `Authorization`

### Prerequisites

- Zalogowany użytkownik z ważnym tokenem autoryzacyjnym
- Dostęp do bazy danych z dziełami (globalnymi z OpenLibrary i manualnymi)
- Narzędzie do testowania API (curl, Postman, Insomnia, lub podobne)
- Dla testów limitu: użytkownik z blisko 5000 przypisanymi dziełami
- Co najmniej 3-5 dostępnych dzieł w bazie danych do testowania bulk operations

---

## Test Suite 1: Podstawowe funkcjonalności (Happy Path)

### Test 1.1: Bulk attach pojedynczego dzieła

**Cel:** Sprawdzenie, czy można przypisać jedno dzieło do profilu użytkownika

**Przygotowanie:**

- Znajdź UUID dzieła globalnego (z OpenLibrary, `owner_user_id IS NULL`)
- Upewnij się, że dzieło nie jest już przypisane do użytkownika

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["123e4567-e89b-12d3-a456-426614174000"]
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created`
- Response body:

```json
{
  "added": ["123e4567-e89b-12d3-a456-426614174000"],
  "skipped": []
}
```

- Nagłówki:
  - `Content-Type: application/json`

**Weryfikacja:**

- [ ] Status code = 201
- [ ] Response zawiera `added` z jednym work_id i pustą tablicą `skipped`
- [ ] W tabeli `user_works` istnieje rekord z `user_id` i `work_id`
- [ ] Licznik `work_count` w tabeli `profiles` został zwiększony o 1 (via trigger)
- [ ] Status domyślny to "to_read"

---

### Test 1.2: Bulk attach wielu dzieł (3-5 dzieł)

**Cel:** Sprawdzenie, czy można przypisać wiele dzieł w jednym żądaniu

**Przygotowanie:**

- Znajdź 3-5 UUID dzieł globalnych
- Upewnij się, że żadne z dzieł nie jest już przypisane do użytkownika

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "123e4567-e89b-12d3-a456-426614174000",
      "123e4567-e89b-12d3-a456-426614174001",
      "123e4567-e89b-12d3-a456-426614174002"
    ]
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created`
- Response body:

```json
{
  "added": [
    "123e4567-e89b-12d3-a456-426614174000",
    "123e4567-e89b-12d3-a456-426614174001",
    "123e4567-e89b-12d3-a456-426614174002"
  ],
  "skipped": []
}
```

**Weryfikacja:**

- [ ] Status code = 201
- [ ] Response zawiera wszystkie work_ids w `added`
- [ ] Wszystkie rekordy zostały utworzone w `user_works`
- [ ] Licznik `work_count` został zwiększony o 3

---

### Test 1.3: Bulk attach z niestandardowym statusem

**Cel:** Sprawdzenie, czy można ustawić początkowy status dla przypisanych dzieł

**Przygotowanie:**

- Znajdź UUID dzieła globalnego
- Upewnij się, że dzieło nie jest już przypisane

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["123e4567-e89b-12d3-a456-426614174000"],
    "status": "in_progress"
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created`
- Response body zawiera `added` z work_id

**Weryfikacja:**

- [ ] Status code = 201
- [ ] Rekord w `user_works` ma `status = "in_progress"`
- [ ] Pole `status_updated_at` jest ustawione (via trigger)

---

### Test 1.4: Bulk attach z różnymi statusami (test wszystkich wartości enum)

**Cel:** Sprawdzenie wszystkich możliwych wartości statusu

**Przygotowanie:**

- Przygotuj 4 dzieła do przypisania
- Upewnij się, że żadne nie jest już przypisane

**Request (wykonaj 4 razy z różnymi statusami):**

```bash
# Test status "to_read"
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["WORK_ID_1"],
    "status": "to_read"
  }'

# Test status "in_progress"
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["WORK_ID_2"],
    "status": "in_progress"
  }'

# Test status "read"
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["WORK_ID_3"],
    "status": "read"
  }'

# Test status "hidden"
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["WORK_ID_4"],
    "status": "hidden"
  }'
```

**Weryfikacja:**

- [ ] Wszystkie 4 statusy są akceptowane
- [ ] Każdy rekord ma odpowiedni status w bazie danych

---

## Test Suite 2: Walidacja danych wejściowych

### Test 2.1: Pusta tablica `work_ids`

**Cel:** Sprawdzenie walidacji - `work_ids` musi zawierać co najmniej 1 element

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": []
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
- [ ] Response zawiera komunikat o wymaganym minimum 1 element

---

### Test 2.2: Brak pola `work_ids` w body

**Cel:** Sprawdzenie walidacji - `work_ids` jest wymagany

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response zawiera komunikat o wymaganym polu `work_ids`

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Response zawiera komunikat walidacji

---

### Test 2.3: Nieprawidłowy format UUID w `work_ids`

**Cel:** Sprawdzenie walidacji formatu UUID

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["invalid-uuid", "123e4567-e89b-12d3-a456-426614174000"]
  }'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response zawiera komunikat o nieprawidłowym formacie UUID

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Response wskazuje, który element ma nieprawidłowy format

---

### Test 2.4: Przekroczony maksymalny rozmiar tablicy (101+ elementów)

**Cel:** Sprawdzenie limitu maksymalnego rozmiaru batch (100 elementów)

**Przygotowanie:**

- Przygotuj tablicę z 101 poprawnymi UUID

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["UUID_1", "UUID_2", ..., "UUID_101"]
  }'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response zawiera komunikat o przekroczonym maksymalnym rozmiarze

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Response wskazuje limit 100 elementów

---

### Test 2.5: Nieprawidłowa wartość status

**Cel:** Sprawdzenie walidacji enum statusu

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["123e4567-e89b-12d3-a456-426614174000"],
    "status": "invalid_status"
  }'
```

**Oczekiwany wynik:**

- Status: `400 Bad Request`
- Response zawiera komunikat o nieprawidłowej wartości statusu

**Weryfikacja:**

- [ ] Status code = 400
- [ ] Response wskazuje dozwolone wartości enum

---

### Test 2.6: Nieprawidłowy format JSON

**Cel:** Sprawdzenie obsługi nieprawidłowego formatu JSON

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"work_ids": [invalid json}'
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
- [ ] Response zawiera komunikat o nieprawidłowym formacie JSON

---

## Test Suite 3: Autoryzacja

### Test 3.1: Request bez tokena autoryzacyjnego

**Cel:** Sprawdzenie wymagania autoryzacji

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["123e4567-e89b-12d3-a456-426614174000"]
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
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["123e4567-e89b-12d3-a456-426614174000"]
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

### Test 4.1: Dzieło nie istnieje (nieistniejący UUID)

**Cel:** Sprawdzenie obsługi przypadku, gdy dzieło o podanym UUID nie istnieje

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["00000000-0000-0000-0000-000000000000"]
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created`
- Response body:

```json
{
  "added": [],
  "skipped": ["00000000-0000-0000-0000-000000000000"]
}
```

**Weryfikacja:**

- [ ] Status code = 201 (endpoint nie zwraca błędu, tylko pomija niedostępne dzieła)
- [ ] Response zawiera nieistniejące work_id w `skipped`
- [ ] Żadne rekordy nie zostały utworzone w `user_works`

---

### Test 4.2: Dzieło manualne innego użytkownika (RLS)

**Cel:** Sprawdzenie, czy nie można przypisać dzieła manualnego należącego do innego użytkownika

**Przygotowanie:**

- Utwórz konto testowe użytkownika A
- Utwórz dzieło manualne dla użytkownika A
- Zaloguj się jako użytkownik B
- Próbuj przypisać dzieło użytkownika A

**Request (jako użytkownik B):**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer USER_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["USER_A_MANUAL_WORK_UUID"]
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created`
- Response body:

```json
{
  "added": [],
  "skipped": ["USER_A_MANUAL_WORK_UUID"]
}
```

**Weryfikacja:**

- [ ] Status code = 201
- [ ] Response zawiera niedostępne work_id w `skipped`
- [ ] RLS poprawnie blokuje dostęp do dzieła innego użytkownika

---

### Test 4.3: Mieszanka dostępnych i niedostępnych dzieł

**Cel:** Sprawdzenie obsługi mieszanki dostępnych i niedostępnych dzieł

**Przygotowanie:**

- Przygotuj 2 dostępne dzieła (globalne)
- Przygotuj 1 niedostępne dzieło (nieistniejące lub innego użytkownika)

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "AVAILABLE_WORK_1",
      "AVAILABLE_WORK_2",
      "UNAVAILABLE_WORK"
    ]
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created`
- Response body:

```json
{
  "added": ["AVAILABLE_WORK_1", "AVAILABLE_WORK_2"],
  "skipped": ["UNAVAILABLE_WORK"]
}
```

**Weryfikacja:**

- [ ] Status code = 201
- [ ] Response poprawnie rozdziela `added` i `skipped`
- [ ] Tylko dostępne dzieła zostały dodane

---

## Test Suite 5: Konflikty i limity

### Test 5.1: Próba przypisania już przypisanego dzieła (duplikat)

**Cel:** Sprawdzenie obsługi duplikatów - dzieło nie może być przypisane dwukrotnie

**Przygotowanie:**

- Przypisz dzieło do użytkownika (Test 1.1)
- Spróbuj przypisać to samo dzieło ponownie

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["ALREADY_ATTACHED_WORK_ID"]
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created`
- Response body:

```json
{
  "added": [],
  "skipped": ["ALREADY_ATTACHED_WORK_ID"]
}
```

**Weryfikacja:**

- [ ] Status code = 201
- [ ] Response zawiera work_id w `skipped`
- [ ] Licznik `work_count` nie został zwiększony ponownie

---

### Test 5.2: Bulk attach z mieszanką nowych i już przypisanych dzieł

**Cel:** Sprawdzenie obsługi mieszanki nowych i duplikatów

**Przygotowanie:**

- Przypisz 2 dzieła do użytkownika
- Przygotuj 2 nowe dzieła do przypisania

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "ALREADY_ATTACHED_1",
      "ALREADY_ATTACHED_2",
      "NEW_WORK_1",
      "NEW_WORK_2"
    ]
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created`
- Response body:

```json
{
  "added": ["NEW_WORK_1", "NEW_WORK_2"],
  "skipped": ["ALREADY_ATTACHED_1", "ALREADY_ATTACHED_2"]
}
```

**Weryfikacja:**

- [ ] Status code = 201
- [ ] Response poprawnie rozdziela `added` i `skipped`
- [ ] Tylko nowe dzieła zostały dodane
- [ ] Licznik `work_count` został zwiększony o 2

---

### Test 5.3: Automatyczna deduplikacja w tablicy `work_ids`

**Cel:** Sprawdzenie, czy duplikaty w tablicy są automatycznie usuwane przed przetwarzaniem

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "123e4567-e89b-12d3-a456-426614174000",
      "123e4567-e89b-12d3-a456-426614174000",
      "123e4567-e89b-12d3-a456-426614174001",
      "123e4567-e89b-12d3-a456-426614174001"
    ]
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created`
- Response body zawiera tylko unikalne work_ids w `added`

**Weryfikacja:**

- [ ] Status code = 201
- [ ] Duplikaty w tablicy są ignorowane
- [ ] Każde unikalne dzieło jest przetwarzane tylko raz

---

### Test 5.4: Przekroczenie limitu użytkownika (5000 dzieł)

**Cel:** Sprawdzenie obsługi limitu maksymalnej liczby dzieł na użytkownika

**Przygotowanie:**

- Użytkownik z 4998 przypisanymi dziełami (blisko limitu 5000)
- Przygotuj 3 nowe dzieła do przypisania

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "NEW_WORK_1",
      "NEW_WORK_2",
      "NEW_WORK_3"
    ]
  }'
```

**Oczekiwany wynik:**

- Status: `409 Conflict`
- Response body:

```json
{
  "error": "Conflict",
  "message": "Work limit reached (5000 works per user)"
}
```

**Weryfikacja:**

- [ ] Status code = 409
- [ ] Response zawiera komunikat o przekroczonym limicie
- [ ] Żadne nowe rekordy nie zostały utworzone

---

### Test 5.5: Przekroczenie limitu przez batch (dokładnie na granicy)

**Cel:** Sprawdzenie obsługi przypadku, gdy batch przekroczyłby limit

**Przygotowanie:**

- Użytkownik z 4995 przypisanymi dziełami
- Przygotuj 6 nowych dzieł do przypisania (4995 + 6 = 5001 > 5000)

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "NEW_WORK_1",
      "NEW_WORK_2",
      "NEW_WORK_3",
      "NEW_WORK_4",
      "NEW_WORK_5",
      "NEW_WORK_6"
    ]
  }'
```

**Oczekiwany wynik:**

- Status: `409 Conflict`
- Response zawiera komunikat o przekroczonym limicie

**Weryfikacja:**

- [ ] Status code = 409
- [ ] Limit jest sprawdzany przed wstawieniem

---

### Test 5.6: Limit po deduplikacji (część dzieł już przypisana)

**Cel:** Sprawdzenie, czy limit jest sprawdzany po usunięciu duplikatów

**Przygotowanie:**

- Użytkownik z 4998 przypisanymi dziełami
- 2 z dzieł w batch są już przypisane
- 3 nowe dzieła (4998 + 3 = 5001 > 5000)

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "ALREADY_ATTACHED_1",
      "ALREADY_ATTACHED_2",
      "NEW_WORK_1",
      "NEW_WORK_2",
      "NEW_WORK_3"
    ]
  }'
```

**Oczekiwany wynik:**

- Status: `409 Conflict`
- Response zawiera komunikat o przekroczonym limicie

**Weryfikacja:**

- [ ] Status code = 409
- [ ] Limit jest sprawdzany po deduplikacji (4998 + 3 = 5001 > 5000)

---

## Test Suite 6: Edge Cases

### Test 6.1: Bulk attach z maksymalną liczbą elementów (100)

**Cel:** Sprawdzenie obsługi maksymalnego rozmiaru batch

**Przygotowanie:**

- Przygotuj dokładnie 100 unikalnych UUID dzieł dostępnych dla użytkownika

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["UUID_1", "UUID_2", ..., "UUID_100"]
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created`
- Response zawiera wszystkie 100 work_ids w `added`

**Weryfikacja:**

- [ ] Status code = 201
- [ ] Wszystkie 100 dzieł zostało dodanych
- [ ] Licznik `work_count` został zwiększony o 100

---

### Test 6.2: Bulk attach z wszystkimi dziełami już przypisanymi

**Cel:** Sprawdzenie przypadku, gdy wszystkie dzieła w batch są już przypisane

**Przygotowanie:**

- Przypisz 3 dzieła do użytkownika
- Spróbuj przypisać te same 3 dzieła ponownie

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "ALREADY_ATTACHED_1",
      "ALREADY_ATTACHED_2",
      "ALREADY_ATTACHED_3"
    ]
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created`
- Response body:

```json
{
  "added": [],
  "skipped": ["ALREADY_ATTACHED_1", "ALREADY_ATTACHED_2", "ALREADY_ATTACHED_3"]
}
```

**Weryfikacja:**

- [ ] Status code = 201
- [ ] Wszystkie work_ids są w `skipped`
- [ ] Licznik `work_count` nie został zmieniony

---

### Test 6.3: Bulk attach z wszystkimi dziełami niedostępnymi

**Cel:** Sprawdzenie przypadku, gdy wszystkie dzieła w batch są niedostępne

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": [
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
      "00000000-0000-0000-0000-000000000003"
    ]
  }'
```

**Oczekiwany wynik:**

- Status: `201 Created`
- Response body:

```json
{
  "added": [],
  "skipped": [
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002",
    "00000000-0000-0000-0000-000000000003"
  ]
}
```

**Weryfikacja:**

- [ ] Status code = 201
- [ ] Wszystkie work_ids są w `skipped`
- [ ] Żadne rekordy nie zostały utworzone

---

### Test 6.4: Race condition - duplikat wykryty podczas wstawiania

**Cel:** Sprawdzenie obsługi race condition (dzieło dodane między sprawdzeniem a wstawieniem)

**Przygotowanie:**

- Wykonaj równolegle dwa żądania z tym samym work_id
- Oba żądania powinny być wysłane niemal jednocześnie

**Request (wykonaj równolegle w dwóch terminalach):**

```bash
# Terminal 1
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["RACE_CONDITION_WORK_ID"]
  }'

# Terminal 2 (wykonaj niemal jednocześnie)
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["RACE_CONDITION_WORK_ID"]
  }'
```

**Oczekiwany wynik:**

- Jedno żądanie: Status `201`, work_id w `added`
- Drugie żądanie: Status `201`, work_id w `skipped` (duplikat wykryty przez unique constraint)

**Weryfikacja:**

- [ ] Oba żądania zwracają status 201
- [ ] Tylko jedno dzieło zostało dodane (unique constraint)
- [ ] Drugie żądanie poprawnie obsłużyło duplikat

---

## Test Suite 7: Integracja z triggerami bazy danych

### Test 7.1: Weryfikacja automatycznego zwiększania `work_count`

**Cel:** Sprawdzenie, czy trigger automatycznie zwiększa licznik

**Przygotowanie:**

- Sprawdź aktualny `work_count` użytkownika przed testem

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["WORK_ID_1", "WORK_ID_2", "WORK_ID_3"]
  }'
```

**Weryfikacja:**

- [ ] Licznik `work_count` w tabeli `profiles` został zwiększony o 3
- [ ] Zwiększenie nastąpiło automatycznie (via trigger)

---

### Test 7.2: Weryfikacja ustawienia `status_updated_at` dla niestandardowego statusu

**Cel:** Sprawdzenie, czy trigger ustawia `status_updated_at` dla statusu innego niż domyślny

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["WORK_ID"],
    "status": "in_progress"
  }'
```

**Weryfikacja:**

- [ ] Pole `status_updated_at` jest ustawione w rekordzie `user_works`
- [ ] Wartość odpowiada czasowi wstawienia

---

## Test Suite 8: Wydajność i optymalizacja

### Test 8.1: Bulk attach dużej liczby dzieł (50-100)

**Cel:** Sprawdzenie wydajności przy dużej liczbie dzieł

**Przygotowanie:**

- Przygotuj 50-100 dostępnych dzieł

**Request:**

```bash
curl -X POST "http://localhost:3000/api/user/works/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_ids": ["UUID_1", "UUID_2", ..., "UUID_50"]
  }'
```

**Weryfikacja:**

- [ ] Żądanie zakończyło się w rozsądnym czasie (< 5 sekund)
- [ ] Wszystkie dzieła zostały poprawnie dodane
- [ ] Licznik `work_count` został zwiększony o poprawną liczbę

---

## Podsumowanie testów

### Statystyki

- **Całkowita liczba testów:** ~30 scenariuszy
- **Kategorie testów:**
  - Happy Path: 4 testy
  - Walidacja: 6 testów
  - Autoryzacja: 2 testy
  - Błędy zasobów: 3 testy
  - Konflikty i limity: 6 testów
  - Edge Cases: 4 testy
  - Integracja z triggerami: 2 testy
  - Wydajność: 1 test

### Krytyczne scenariusze do przetestowania

1. ✅ Bulk attach wielu dzieł
2. ✅ Automatyczna deduplikacja
3. ✅ Obsługa duplikatów (już przypisane)
4. ✅ Obsługa niedostępnych dzieł (RLS)
5. ✅ Weryfikacja limitu użytkownika
6. ✅ Race conditions
7. ✅ Wszystkie wartości enum statusu

### Uwagi do testowania

- Przed testami upewnij się, że masz dostęp do bazy danych do weryfikacji wyników
- Dla testów limitu przygotuj użytkownika z odpowiednią liczbą przypisanych dzieł
- Testy race condition wymagają równoległego wykonania żądań
- Wszystkie UUID w przykładach należy zastąpić rzeczywistymi UUID z bazy danych
