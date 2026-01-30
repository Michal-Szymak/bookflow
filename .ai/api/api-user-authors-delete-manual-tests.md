# Manual Tests: DELETE /api/user/authors/{authorId}

## Test Environment Setup

**Endpoint:** `DELETE /api/user/authors/{authorId}`  
**Base URL:** `http://localhost:3000/api/user/authors/{authorId}` (lub odpowiedni URL środowiska)  
**Authentication:** Bearer token w nagłówku `Authorization`

### Prerequisites
- Zalogowany użytkownik z ważnym tokenem autoryzacyjnym
- Dostęp do bazy danych z autorami, dziełami i relacjami
- Narzędzie do testowania API (curl, Postman, Insomnia, lub podobne)
- Użytkownik z przypisanymi autorami (dla testów sukcesu)
- Autor z przypisanymi dziełami (dla testów kaskadowego usuwania)
- Użytkownik bez przypisanego autora (dla testów 404)

---

## Test Suite 1: Podstawowe funkcjonalności (Happy Path)

### Test 1.1: Odłączenie autora bez powiązanych dzieł
**Cel:** Sprawdzenie, czy można odłączyć autora, który nie ma przypisanych dzieł użytkownika

**Przygotowanie:**
- Znajdź UUID autora przypisanego do użytkownika (w tabeli `user_authors`)
- Upewnij się, że autor nie ma dzieł przypisanych do użytkownika (brak rekordów w `user_works` dla dzieł tego autora)
- Zapisz początkową wartość `author_count` w `profiles` dla użytkownika

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/authors/550e8400-e29b-41d4-a716-446655440000" \
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
- [ ] W tabeli `user_authors` nie ma już rekordu z `user_id` i `author_id`
- [ ] Licznik `author_count` w tabeli `profiles` został zmniejszony o 1 (via trigger `user_authors_decrement_count`)
- [ ] Autor nadal istnieje w tabeli `authors` (nie został usunięty z katalogu globalnego)

---

### Test 1.2: Odłączenie autora z powiązanymi dziełami (kaskadowe usunięcie user_works)
**Cel:** Sprawdzenie, czy kaskadowe usunięcie `user_works` działa poprawnie

**Przygotowanie:**
- Znajdź UUID autora przypisanego do użytkownika
- Upewnij się, że autor ma przynajmniej 2-3 dzieła przypisane do użytkownika:
  - Sprawdź `author_works` dla tego autora
  - Sprawdź `user_works` dla tych dzieł należących do użytkownika
- Zapisz początkową wartość `author_count` i `work_count` w `profiles` dla użytkownika
- Zapisz liczbę rekordów `user_works` dla dzieł tego autora

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/authors/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `204 No Content`
- Response body: Brak (pusty)

**Weryfikacja:**
- [ ] Status code = 204
- [ ] W tabeli `user_authors` nie ma już rekordu z `user_id` i `author_id`
- [ ] Wszystkie rekordy `user_works` dla dzieł tego autora należących do użytkownika zostały usunięte
- [ ] Licznik `author_count` w tabeli `profiles` został zmniejszony o 1 (via trigger)
- [ ] Licznik `work_count` w tabeli `profiles` został zmniejszony o liczbę usuniętych `user_works` (via trigger `user_works_decrement_count`)
- [ ] Dzieła (`works`) nadal istnieją w bazie danych (nie zostały usunięte)
- [ ] Relacje `author_works` nadal istnieją (nie zostały usunięte)

---

### Test 1.3: Idempotentność (wielokrotne wywołanie DELETE)
**Cel:** Sprawdzenie, czy wielokrotne wywołanie DELETE z tym samym `authorId` zwraca 404

**Przygotowanie:**
- Wykonaj Test 1.1 lub 1.2 (odłącz autora)
- Upewnij się, że autor nie jest już przypisany do użytkownika

**Request (pierwsze wywołanie - powinno zwrócić 204):**
```bash
curl -X DELETE "http://localhost:3000/api/user/authors/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Request (drugie wywołanie - powinno zwrócić 404):**
```bash
curl -X DELETE "http://localhost:3000/api/user/authors/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik (drugie wywołanie):**
- Status: `404 Not Found`
- Response body:
```json
{
  "error": "Not Found",
  "message": "Author is not attached to your profile"
}
```

**Weryfikacja:**
- [ ] Pierwsze wywołanie zwraca 204
- [ ] Drugie wywołanie zwraca 404
- [ ] Komunikat błędu jest czytelny i informuje, że autor nie jest przypisany

---

## Test Suite 2: Błędy walidacji (400 Bad Request)

### Test 2.1: Brak parametru authorId
**Cel:** Sprawdzenie obsługi braku parametru ścieżki

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/authors/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `400 Bad Request` (lub 404 jeśli routing nie dopasuje)
- Response body (jeśli 400):
```json
{
  "error": "Validation error",
  "message": "authorId parameter is required"
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
curl -X DELETE "http://localhost:3000/api/user/authors/not-a-valid-uuid" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `400 Bad Request`
- Response body:
```json
{
  "error": "Validation error",
  "message": "authorId must be a valid UUID",
  "details": [
    {
      "code": "invalid_string",
      "path": ["authorId"],
      "message": "authorId must be a valid UUID"
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
curl -X DELETE "http://localhost:3000/api/user/authors/123" \
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
curl -X DELETE "http://localhost:3000/api/user/authors/550e8400-e29b-41d4-a716-446655440000" \
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
curl -X DELETE "http://localhost:3000/api/user/authors/550e8400-e29b-41d4-a716-446655440000" \
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
curl -X DELETE "http://localhost:3000/api/user/authors/550e8400-e29b-41d4-a716-446655440000" \
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

### Test 4.1: Autor nie jest przypisany do użytkownika
**Cel:** Sprawdzenie obsługi przypadku, gdy autor nie jest przypisany

**Przygotowanie:**
- Znajdź UUID autora, który istnieje w bazie, ale nie jest przypisany do użytkownika
- Upewnij się, że autor istnieje w tabeli `authors`
- Upewnij się, że nie ma rekordu w `user_authors` dla tego użytkownika i autora

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/authors/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `404 Not Found`
- Response body:
```json
{
  "error": "Not Found",
  "message": "Author is not attached to your profile"
}
```

**Weryfikacja:**
- [ ] Status code = 404
- [ ] Komunikat błędu jest czytelny i informuje, że autor nie jest przypisany
- [ ] Endpoint nie wykonuje żadnych operacji DELETE na bazie danych

---

### Test 4.2: Autor nie istnieje w bazie danych
**Cel:** Sprawdzenie obsługi nieistniejącego autora

**Przygotowanie:**
- Użyj losowego, ale prawidłowego UUID, który nie istnieje w bazie danych

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/authors/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik:**
- Status: `404 Not Found`
- Response body:
```json
{
  "error": "Not Found",
  "message": "Author is not attached to your profile"
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
- W środowisku produkcyjnym: próba usunięcia rekordu `user_authors` należącego do innego użytkownika

**Uwaga:** W normalnych warunkach RLS powinien automatycznie filtrować rekordy, więc ten scenariusz może nie wystąpić. Jeśli jednak wystąpi błąd RLS podczas operacji DELETE, powinien być obsłużony jako 403.

**Oczekiwany wynik (jeśli wystąpi):**
- Status: `403 Forbidden`
- Response body:
```json
{
  "error": "Forbidden",
  "message": "Cannot detach author: insufficient permissions"
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

### Test 7.1: Weryfikacja zmniejszenia author_count
**Cel:** Sprawdzenie, czy trigger `user_authors_decrement_count` działa poprawnie

**Przygotowanie:**
- Zapisz początkową wartość `author_count` w `profiles` dla użytkownika
- Upewnij się, że użytkownik ma przynajmniej jednego przypisanego autora

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/authors/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Weryfikacja:**
- [ ] Licznik `author_count` w tabeli `profiles` został zmniejszony o 1
- [ ] Zmniejszenie nastąpiło automatycznie (via trigger, nie przez kod aplikacji)
- [ ] Inne liczniki (np. `work_count`) nie zostały zmienione (jeśli autor nie miał dzieł)

---

### Test 7.2: Weryfikacja zmniejszenia work_count
**Cel:** Sprawdzenie, czy trigger `user_works_decrement_count` działa poprawnie

**Przygotowanie:**
- Zapisz początkową wartość `work_count` w `profiles` dla użytkownika
- Upewnij się, że autor ma przynajmniej 2-3 dzieła przypisane do użytkownika
- Zapisz liczbę rekordów `user_works` dla dzieł tego autora

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/authors/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Weryfikacja:**
- [ ] Licznik `work_count` w tabeli `profiles` został zmniejszony o liczbę usuniętych `user_works`
- [ ] Licznik `author_count` w tabeli `profiles` został zmniejszony o 1
- [ ] Zmniejszenie nastąpiło automatycznie (via trigger, nie przez kod aplikacji)

---

## Test Suite 8: Weryfikacja kaskadowego usuwania

### Test 8.1: Weryfikacja usunięcia user_works dla wszystkich dzieł autora
**Cel:** Sprawdzenie, czy wszystkie `user_works` dla dzieł autora są usuwane

**Przygotowanie:**
- Znajdź autora z przynajmniej 3 dziełami przypisanymi do użytkownika
- Zapisz listę `work_id` dla dzieł tego autora przypisanych do użytkownika
- Sprawdź, że niektóre z tych dzieł mogą mieć również innych autorów

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/authors/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Weryfikacja:**
- [ ] Wszystkie rekordy `user_works` dla dzieł tego autora należące do użytkownika zostały usunięte
- [ ] Dzieła (`works`) nadal istnieją w bazie danych
- [ ] Relacje `author_works` nadal istnieją (nie zostały usunięte)
- [ ] Jeśli dzieło ma innych autorów, relacje `user_works` dla tych autorów nie zostały usunięte (tylko dla usuniętego autora)

---

## Test Suite 9: Testy wydajności i edge cases

### Test 9.1: Autor z dużą liczbą dzieł (jeśli możliwe)
**Cel:** Sprawdzenie wydajności dla autora z wieloma dziełami

**Przygotowanie:**
- Znajdź autora z dużą liczbą dzieł przypisanych do użytkownika (>10, >50, >100)
- Zmierz czas wykonania operacji DELETE

**Request:**
```bash
time curl -X DELETE "http://localhost:3000/api/user/authors/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Weryfikacja:**
- [ ] Operacja zakończyła się sukcesem (204)
- [ ] Czas wykonania jest akceptowalny (<5 sekund dla 100 dzieł)
- [ ] Wszystkie `user_works` zostały usunięte
- [ ] Liczniki zostały poprawnie zaktualizowane

---

### Test 9.2: Autor bez dzieł (edge case)
**Cel:** Sprawdzenie obsługi autora bez żadnych dzieł

**Przygotowanie:**
- Znajdź autora przypisanego do użytkownika, który nie ma żadnych dzieł w `author_works`
- Lub znajdź autora, którego dzieła nie są przypisane do użytkownika

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/authors/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Weryfikacja:**
- [ ] Status code = 204
- [ ] Rekord `user_authors` został usunięty
- [ ] Licznik `author_count` został zmniejszony o 1
- [ ] Licznik `work_count` nie został zmieniony (brak `user_works` do usunięcia)

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
- [ ] Wszystkie testy z Test Suite 8 (Kaskadowe usuwanie) przeszły
- [ ] Wszystkie testy z Test Suite 9 (Edge cases) przeszły

### Notatki:
- Zapisz wszystkie zaobserwowane problemy i odchylenia od oczekiwanych wyników
- Zweryfikuj logi serwera dla wszystkich testów (szczególnie błędów)
- Sprawdź, czy wszystkie operacje są idempotentne
- Zweryfikuj, czy triggery działają poprawnie w różnych scenariuszach

