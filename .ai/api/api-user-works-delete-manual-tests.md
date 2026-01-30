# Manual Tests: DELETE /api/user/works/{workId}

## Test Environment Setup

**Endpoint:** `DELETE /api/user/works/{workId}`  
**Base URL:** `http://localhost:3000/api/user/works/{workId}` (lub odpowiedni URL środowiska)  
**Authentication:** Bearer token w nagłówku `Authorization`

### Prerequisites
- Zalogowany użytkownik z ważnym tokenem autoryzacyjnym
- Dostęp do bazy danych z dziełami i relacjami
- Narzędzie do testowania API (curl, Postman, Insomnia, lub podobne)
- Użytkownik z przypisanymi dziełami (dla testów sukcesu)
- Użytkownik bez przypisanego dzieła (dla testów 404)

---

## Test Suite 1: Podstawowe funkcjonalności (Happy Path)

### Test 1.1: Odłączenie dzieła z profilu użytkownika
**Cel:** Sprawdzenie, czy można odłączyć dzieło z profilu użytkownika

**Przygotowanie:**
- Znajdź UUID dzieła przypisanego do użytkownika (w tabeli `user_works`)
- Zapisz początkową wartość `work_count` w `profiles` dla użytkownika
- Zapisz informacje o dziele w tabeli `works` (aby zweryfikować, że nie zostało usunięte)

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `204 No Content`
- Response body: Brak (pusty)
- Nagłówki:
  - `Content-Type` może być pominięty (dla 204)

**Weryfikacja:**
- [ ] Status code = 204
- [ ] Response body jest pusty
- [ ] W tabeli `user_works` nie ma już rekordu z `user_id` i `work_id`
- [ ] Licznik `work_count` w tabeli `profiles` został zmniejszony o 1 (via trigger `user_works_decrement_count`)
- [ ] Dzieło nadal istnieje w tabeli `works` (nie zostało usunięte z katalogu globalnego)
- [ ] Relacje `author_works` dla tego dzieła nadal istnieją (nie zostały usunięte)
- [ ] Inne użytkownicy, którzy mają to dzieło przypisane, nadal mają dostęp (jeśli istnieją)

---

### Test 1.2: Idempotentność (wielokrotne wywołanie DELETE)
**Cel:** Sprawdzenie, czy wielokrotne wywołanie DELETE z tym samym `workId` zwraca 404

**Przygotowanie:**
- Wykonaj Test 1.1 (odłącz dzieło)
- Upewnij się, że dzieło nie jest już przypisane do użytkownika

**Request (pierwsze wywołanie - powinno zwrócić 204):**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Request (drugie wywołanie - powinno zwrócić 404):**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik (drugie wywołanie):**
- Status: `404 Not Found`
- Response body:
```json
{
  "error": "Not Found",
  "message": "Work is not attached to your profile"
}
```

**Weryfikacja:**
- [ ] Pierwsze wywołanie zwraca 204
- [ ] Drugie wywołanie zwraca 404
- [ ] Komunikat błędu jest czytelny i informuje, że dzieło nie jest przypisane

---

## Test Suite 2: Błędy walidacji (400 Bad Request)

### Test 2.1: Brak parametru workId
**Cel:** Sprawdzenie obsługi braku parametru ścieżki

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `400 Bad Request` (lub 404 jeśli routing nie dopasuje)
- Response body (jeśli 400):
```json
{
  "error": "Validation error",
  "message": "workId parameter is required"
}
```

**Weryfikacja:**
- [ ] Status code = 400 lub 404 (w zależności od routingu Astro)
- [ ] Komunikat błędu jest czytelny

---

### Test 2.2: Nieprawidłowy format UUID
**Cel:** Sprawdzenie walidacji formatu UUID

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/not-a-valid-uuid" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `400 Bad Request`
- Response body:
```json
{
  "error": "Validation error",
  "message": "workId must be a valid UUID",
  "details": [
    {
      "code": "invalid_string",
      "path": ["workId"],
      "message": "workId must be a valid UUID"
    }
  ]
}
```

**Weryfikacja:**
- [ ] Status code = 400
- [ ] Response zawiera szczegóły błędów walidacji w polu `details`
- [ ] Komunikat błędu jest czytelny

---

### Test 2.3: Nieprawidłowy format UUID (za krótki)
**Cel:** Sprawdzenie walidacji zbyt krótkiego UUID

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `400 Bad Request`
- Response body z błędem walidacji UUID

**Weryfikacja:**
- [ ] Status code = 400
- [ ] Komunikat błędu wskazuje na nieprawidłowy format UUID

---

## Test Suite 3: Błędy autoryzacji (401 Unauthorized)

### Test 3.1: Brak tokenu autoryzacyjnego
**Cel:** Sprawdzenie, czy endpoint wymaga autoryzacji

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
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
- [ ] Komunikat błędu jest czytelny
- [ ] Endpoint nie wykonuje żadnych operacji na bazie danych

---

### Test 3.2: Nieprawidłowy token autoryzacyjny
**Cel:** Sprawdzenie obsługi nieprawidłowego tokenu

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
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
- [ ] Komunikat błędu jest czytelny

---

### Test 3.3: Wygasły token autoryzacyjny
**Cel:** Sprawdzenie obsługi wygasłego tokenu

**Przygotowanie:**
- Użyj wygasłego tokenu (jeśli dostępny)

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer EXPIRED_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `401 Unauthorized`
- Response body z komunikatem o wymaganej autoryzacji

**Weryfikacja:**
- [ ] Status code = 401
- [ ] Endpoint nie wykonuje żadnych operacji na bazie danych

---

## Test Suite 4: Błędy nie znalezionych zasobów (404 Not Found)

### Test 4.1: Dzieło nie jest przypisane do użytkownika
**Cel:** Sprawdzenie obsługi przypadku, gdy dzieło nie jest przypisane

**Przygotowanie:**
- Znajdź UUID dzieła, które istnieje w bazie, ale nie jest przypisane do użytkownika
- Upewnij się, że dzieło istnieje w tabeli `works`
- Upewnij się, że nie ma rekordu w `user_works` dla tego użytkownika i dzieła

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
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
- [ ] Komunikat błędu jest czytelny i informuje, że dzieło nie jest przypisane
- [ ] Endpoint nie wykonuje żadnych operacji DELETE na bazie danych

---

### Test 4.2: Dzieło nie istnieje w bazie danych
**Cel:** Sprawdzenie obsługi nieistniejącego dzieła

**Przygotowanie:**
- Użyj losowego, ale prawidłowego UUID, który nie istnieje w bazie danych

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
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
- [ ] Komunikat błędu jest czytelny
- [ ] Endpoint nie wykonuje żadnych operacji DELETE na bazie danych

---

## Test Suite 5: Błędy uprawnień (403 Forbidden)

### Test 5.1: RLS policy violation (jeśli możliwe)
**Cel:** Sprawdzenie obsługi naruszenia polityki RLS

**Przygotowanie:**
- Ten test może być trudny do wykonania w środowisku lokalnym, jeśli RLS jest wyłączone
- W środowisku produkcyjnym: próba usunięcia rekordu `user_works` należącego do innego użytkownika

**Uwaga:** W normalnych warunkach RLS powinien automatycznie filtrować rekordy, więc ten scenariusz może nie wystąpić. Jeśli jednak wystąpi błąd RLS podczas operacji DELETE, powinien być obsłużony jako 403.

**Oczekiwany wynik (jeśli wystąpi):**
- Status: `403 Forbidden`
- Response body:
```json
{
  "error": "Forbidden",
  "message": "Cannot detach work: insufficient permissions"
}
```

**Weryfikacja:**
- [ ] Status code = 403 (jeśli błąd RLS wystąpi)
- [ ] Komunikat błędu jest czytelny

---

## Test Suite 6: Błędy serwera (500 Internal Server Error)

### Test 6.1: Błąd bazy danych (symulacja)
**Cel:** Sprawdzenie obsługi nieoczekiwanych błędów bazy danych

**Uwaga:** Ten test może być trudny do wykonania bez modyfikacji kodu lub bazy danych. Można spróbować:
- Tymczasowo zmienić nazwę tabeli w kodzie
- Wyłączyć połączenie z bazą danych
- Użyć nieprawidłowych danych powodujących błąd bazy danych

**Oczekiwany wynik:**
- Status: `500 Internal Server Error`
- Response body:
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

**Weryfikacja:**
- [ ] Status code = 500
- [ ] Komunikat błędu nie ujawnia szczegółów technicznych
- [ ] Błąd jest zalogowany na poziomie `error` z pełnym stack trace (sprawdź logi serwera)

---

## Test Suite 7: Weryfikacja aktualizacji liczników

### Test 7.1: Weryfikacja zmniejszenia work_count
**Cel:** Sprawdzenie, czy trigger `user_works_decrement_count` działa poprawnie

**Przygotowanie:**
- Zapisz początkową wartość `work_count` w `profiles` dla użytkownika
- Upewnij się, że użytkownik ma przynajmniej jedno przypisane dzieło

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Weryfikacja:**
- [ ] Licznik `work_count` w tabeli `profiles` został zmniejszony o 1
- [ ] Zmniejszenie nastąpiło automatycznie (via trigger, nie przez kod aplikacji)
- [ ] Inne liczniki (np. `author_count`) nie zostały zmienione

---

## Test Suite 8: Weryfikacja zachowania globalnego katalogu

### Test 8.1: Weryfikacja, że dzieło pozostaje w globalnym katalogu
**Cel:** Sprawdzenie, czy dzieło nie jest usuwane z katalogu globalnego

**Przygotowanie:**
- Znajdź dzieło przypisane do użytkownika
- Zapisz informacje o dziele w tabeli `works` (id, title, openlibrary_id, itp.)
- Sprawdź, czy inne użytkownicy mają to dzieło przypisane (jeśli możliwe)

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Weryfikacja:**
- [ ] Dzieło nadal istnieje w tabeli `works` (nie zostało usunięte)
- [ ] Wszystkie pola dzieła (title, openlibrary_id, first_publish_year, itp.) pozostały niezmienione
- [ ] Relacje `author_works` dla tego dzieła nadal istnieją (nie zostały usunięte)
- [ ] Jeśli inne użytkownicy mają to dzieło przypisane, ich rekordy `user_works` nadal istnieją
- [ ] Rekord `user_works` dla testowanego użytkownika został usunięty

---

### Test 8.2: Weryfikacja, że relacje z autorami pozostają nienaruszone
**Cel:** Sprawdzenie, czy usunięcie powiązania użytkownika z dziełem nie wpływa na relacje autora z dziełem

**Przygotowanie:**
- Znajdź dzieło z przynajmniej jednym autorem
- Zapisz listę `author_id` dla tego dzieła z tabeli `author_works`
- Upewnij się, że dzieło jest przypisane do użytkownika

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Weryfikacja:**
- [ ] Wszystkie relacje `author_works` dla tego dzieła nadal istnieją
- [ ] Liczba relacji `author_works` nie zmieniła się
- [ ] Autorzy nadal są powiązani z dziełem w globalnym katalogu

---

## Test Suite 9: Testy wydajności i edge cases

### Test 9.1: Dzieło z wieloma autorami (edge case)
**Cel:** Sprawdzenie obsługi dzieła z wieloma autorami

**Przygotowanie:**
- Znajdź dzieło przypisane do użytkownika, które ma przynajmniej 2-3 autorów
- Zapisz listę autorów dla tego dzieła

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Weryfikacja:**
- [ ] Status code = 204
- [ ] Rekord `user_works` został usunięty
- [ ] Wszystkie relacje `author_works` dla tego dzieła nadal istnieją
- [ ] Licznik `work_count` został zmniejszony o 1

---

### Test 9.2: Dzieło bez autorów (edge case)
**Cel:** Sprawdzenie obsługi dzieła bez przypisanych autorów (jeśli możliwe)

**Przygotowanie:**
- Znajdź dzieło przypisane do użytkownika, które nie ma żadnych autorów w `author_works`
- Lub znajdź dzieło, które ma autorów, ale nie są one przypisane do użytkownika

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Weryfikacja:**
- [ ] Status code = 204
- [ ] Rekord `user_works` został usunięty
- [ ] Licznik `work_count` został zmniejszony o 1
- [ ] Dzieło nadal istnieje w tabeli `works`

---

### Test 9.3: Dzieło używane przez wielu użytkowników
**Cel:** Sprawdzenie, czy usunięcie powiązania przez jednego użytkownika nie wpływa na innych

**Przygotowanie:**
- Znajdź dzieło, które jest przypisane do przynajmniej 2 użytkowników
- Zapisz listę `user_id` dla tego dzieła z tabeli `user_works`
- Wybierz jednego użytkownika do testu

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/works/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Weryfikacja:**
- [ ] Status code = 204
- [ ] Rekord `user_works` dla testowanego użytkownika został usunięty
- [ ] Rekordy `user_works` dla innych użytkowników nadal istnieją
- [ ] Licznik `work_count` dla testowanego użytkownika został zmniejszony o 1
- [ ] Liczniki `work_count` dla innych użytkowników nie zostały zmienione
- [ ] Dzieło nadal istnieje w tabeli `works`

---

## Podsumowanie testów

### Checklist końcowy:
- [ ] Wszystkie testy z Test Suite 1 (Happy Path) przeszły
- [ ] Wszystkie testy z Test Suite 2 (Błędy walidacji) przeszły
- [ ] Wszystkie testy z Test Suite 3 (Błędy autoryzacji) przeszły
- [ ] Wszystkie testy z Test Suite 4 (Błędy 404) przeszły
- [ ] Wszystkie testy z Test Suite 5 (Błędy 403) przeszły (jeśli możliwe)
- [ ] Wszystkie testy z Test Suite 6 (Błędy 500) przeszły (jeśli możliwe)
- [ ] Wszystkie testy z Test Suite 7 (Weryfikacja liczników) przeszły
- [ ] Wszystkie testy z Test Suite 8 (Globalny katalog) przeszły
- [ ] Wszystkie testy z Test Suite 9 (Edge cases) przeszły

### Notatki:
- Zapisz wszystkie zaobserwowane problemy i odchylenia od oczekiwanych wyników
- Zweryfikuj logi serwera dla wszystkich testów (szczególnie błędów)
- Sprawdź, czy wszystkie operacje są idempotentne
- Zweryfikuj, czy trigger `user_works_decrement_count` działa poprawnie
- Upewnij się, że dzieła nie są usuwane z globalnego katalogu
- Sprawdź, czy relacje z autorami pozostają nienaruszone

