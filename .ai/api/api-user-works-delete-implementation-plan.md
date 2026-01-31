# API Endpoint Implementation Plan: DELETE /api/user/works/{workId}

## 1. Przegląd punktu końcowego

Endpoint `DELETE /api/user/works/{workId}` służy do odłączenia (detach) dzieła z listy użytkownika. Operacja usuwa tylko powiązanie między użytkownikiem a dziełem w tabeli `user_works`, nie usuwa samego dzieła z globalnego katalogu w tabeli `works`. 

Po usunięciu powiązania:
- Rekord w tabeli `user_works` jest usuwany
- Trigger bazy danych automatycznie zmniejsza licznik `profiles.work_count`
- Dzieło pozostaje w globalnym katalogu i może być nadal używane przez innych użytkowników

Endpoint wymaga uwierzytelnienia i pozwala użytkownikowi usuwać tylko swoje własne powiązania z dziełami.

## 2. Szczegóły żądania

- **Metoda HTTP**: `DELETE`
- **Struktura URL**: `/api/user/works/{workId}`
- **Parametry**:
  - **Wymagane**:
    - `workId` (path parameter): UUID dzieła do odłączenia w standardowym formacie (np. `"550e8400-e29b-41d4-a716-446655440000"`)
  - **Opcjonalne**: Brak
- **Request Body**: Brak (operacja DELETE nie wymaga body)
- **Headers**:
  - `Authorization: Bearer <access_token>` (opcjonalnie, jeśli używane są tokeny)
  - Session cookie (jeśli używane są cookies z Supabase Auth)

## 3. Wykorzystywane typy

### Typy walidacji

- **`WorkIdParamSchema`** (z `src/lib/validation/work-id.schema.ts`): Schemat Zod do walidacji parametru `workId` w ścieżce URL
  - Wymaga, aby `workId` był poprawnym UUID v4
  - Typ zwracany: `WorkIdParamValidated` z polem `workId: string`

### Typy odpowiedzi

- **Brak body odpowiedzi**: Endpoint zwraca `204 No Content` bez body w przypadku sukcesu
- **Error responses**: Wszystkie błędy zwracają JSON z polami:
  - `error: string` - Kategoria błędu
  - `message: string` - Czytelna wiadomość dla użytkownika
  - `details?: array` - (opcjonalnie) Szczegóły błędów walidacji

## 4. Szczegóły odpowiedzi

### Sukces

- **Status**: `204 No Content`
- **Body**: Brak
- **Headers**: Brak specjalnych nagłówków

### Błędy

- **400 Bad Request**: Nieprawidłowy format UUID lub brakujący parametr `workId`
  ```json
  {
    "error": "Validation error",
    "message": "workId must be a valid UUID",
    "details": [...]
  }
  ```

- **401 Unauthorized**: Brak uwierzytelnienia lub nieprawidłowa sesja
  ```json
  {
    "error": "Unauthorized",
    "message": "Authentication required"
  }
  ```

- **403 Forbidden**: Naruszenie polityki RLS (użytkownik próbuje usunąć powiązanie, do którego nie ma dostępu)
  ```json
  {
    "error": "Forbidden",
    "message": "Cannot detach work: insufficient permissions"
  }
  ```

- **404 Not Found**: Dzieło nie jest przypisane do profilu użytkownika
  ```json
  {
    "error": "Not Found",
    "message": "Work is not attached to your profile"
  }
  ```

- **500 Internal Server Error**: Nieoczekiwany błąd serwera
  ```json
  {
    "error": "Internal server error",
    "message": "An unexpected error occurred"
  }
  ```

## 5. Przepływ danych

### Krok 1: Walidacja parametrów ścieżki

1. Sprawdź, czy parametr `workId` istnieje w `params`
2. Jeśli brakuje, zwróć `400 Bad Request`
3. Użyj `WorkIdParamSchema.safeParse()` do walidacji formatu UUID
4. Jeśli walidacja nie powiedzie się, zwróć `400 Bad Request` z szczegółami błędów

### Krok 2: Weryfikacja autoryzacji

1. Pobierz instancję Supabase z `locals.supabase`
2. Wywołaj `supabase.auth.getUser()` aby pobrać zalogowanego użytkownika
3. Jeśli użytkownik nie jest zalogowany (`authError` lub `!user`), zwróć `401 Unauthorized`
4. Zapisz `user.id` do dalszego użycia

### Krok 3: Weryfikacja, czy dzieło jest przypisane

1. Utwórz instancję `WorksService` z klientem Supabase
2. Wywołaj metodę `isWorkAttached(user.id, workId)` na `WorksService`
3. Jeśli metoda zwróci `false` (dzieło nie jest przypisane), zwróć `404 Not Found`
4. Jeśli wystąpi błąd podczas zapytania, zaloguj błąd i zwróć `500 Internal Server Error`

### Krok 4: Odłączenie dzieła

1. Wywołaj metodę `detachUserWork(user.id, workId)` na `WorksService`
2. Metoda powinna wykonać następującą operację:
   ```sql
   DELETE FROM user_works 
   WHERE user_id = userId AND work_id = workId
   ```
3. Trigger bazy danych `user_works_decrement_count` automatycznie zmniejszy `profiles.work_count`
4. Jeśli operacja się powiedzie, zwróć `204 No Content`
5. Jeśli wystąpi błąd (np. naruszenie ograniczeń, błąd RLS), zaloguj błąd i zwróć odpowiedni kod statusu:
   - `403 Forbidden` dla naruszeń RLS
   - `404 Not Found` jeśli rekord nie został znaleziony (nie jest przypisany)
   - `500 Internal Server Error` dla innych błędów bazy danych

### Interakcje z bazą danych

- **Tabela `user_works`**: Usunięcie rekordu z composite primary key (`user_id`, `work_id`)
- **Tabela `profiles`**: Automatyczna aktualizacja `work_count` przez trigger `user_works_decrement_count`
- **Tabela `works`**: **NIE** jest modyfikowana - dzieło pozostaje w globalnym katalogu
- **Tabela `user_authors`**: **NIE** jest modyfikowana - powiązania z autorami pozostają nienaruszone

## 6. Względy bezpieczeństwa

### Uwierzytelnianie

- Endpoint wymaga aktywnej sesji użytkownika
- Weryfikacja odbywa się poprzez `supabase.auth.getUser()`
- Brak sesji lub nieprawidłowy token skutkuje `401 Unauthorized`

### Autoryzacja (RLS)

- Row Level Security (RLS) w Supabase zapewnia, że użytkownik może usuwać tylko swoje własne rekordy w `user_works`
- Polityka RLS powinna zezwalać na DELETE tylko gdy `user_id = auth.uid()`
- Naruszenie polityki RLS skutkuje `403 Forbidden`

### Walidacja danych wejściowych

- Parametr `workId` jest walidowany przy użyciu schematu Zod `WorkIdParamSchema`
- Sprawdzany jest format UUID v4
- Nieprawidłowy format skutkuje `400 Bad Request`

### Ochrona przed atakami

- **SQL Injection**: Chronione przez parametryzowane zapytania Supabase
- **IDOR (Insecure Direct Object Reference)**: Chronione przez RLS - użytkownik może usuwać tylko swoje własne powiązania
- **Race conditions**: Composite primary key w `user_works` zapobiega duplikatom, ale należy rozważyć obsługę sytuacji, gdy rekord zostanie usunięty między sprawdzeniem a usunięciem

### Logowanie

- Wszystkie błędy powinny być logowane z kontekstem (userId, workId, error message)
- Sukces operacji może być logowany na poziomie INFO dla celów audytu
- Nie loguj wrażliwych danych (tokeny, hasła)

## 7. Obsługa błędów

### Scenariusze błędów i odpowiedzi

1. **Brakujący parametr `workId`**
   - **Wykrycie**: Sprawdzenie `params.workId`
   - **Kod**: `400 Bad Request`
   - **Akcja**: Zwróć komunikat walidacji

2. **Nieprawidłowy format UUID**
   - **Wykrycie**: Walidacja Zod `WorkIdParamSchema`
   - **Kod**: `400 Bad Request`
   - **Akcja**: Zwróć szczegóły błędów walidacji

3. **Brak uwierzytelnienia**
   - **Wykrycie**: `authError` lub `!user` z `supabase.auth.getUser()`
   - **Kod**: `401 Unauthorized`
   - **Akcja**: Zwróć komunikat o wymaganym uwierzytelnieniu

4. **Dzieło nie jest przypisane do użytkownika**
   - **Wykrycie**: `isWorkAttached()` zwraca `false`
   - **Kod**: `404 Not Found`
   - **Akcja**: Zwróć komunikat, że dzieło nie jest przypisane

5. **Naruszenie polityki RLS**
   - **Wykrycie**: Kod błędu `42501` z Supabase
   - **Kod**: `403 Forbidden`
   - **Akcja**: Zwróć komunikat o braku uprawnień

6. **Błąd podczas sprawdzania przypisania**
   - **Wykrycie**: Wyjątek z `isWorkAttached()`
   - **Kod**: `500 Internal Server Error`
   - **Akcja**: Zaloguj błąd, zwróć ogólny komunikat

7. **Błąd podczas usuwania**
   - **Wykrycie**: Wyjątek z `detachUserWork()`
   - **Kod**: `500 Internal Server Error` (lub `403`/`404` w zależności od typu błędu)
   - **Akcja**: Zaloguj błąd, zwróć odpowiedni komunikat

8. **Nieoczekiwany błąd**
   - **Wykrycie**: Wyjątek w bloku try-catch
   - **Kod**: `500 Internal Server Error`
   - **Akcja**: Zaloguj pełny stack trace, zwróć ogólny komunikat

### Strategia obsługi błędów

- Używaj early returns dla warunków błędów
- Zawsze loguj błędy z kontekstem przed zwróceniem odpowiedzi
- Nie ujawniaj szczegółów błędów wewnętrznych w odpowiedziach dla użytkownika
- Zwracaj spójne formaty odpowiedzi błędów (JSON z `error` i `message`)

## 8. Rozważania dotyczące wydajności

### Potencjalne wąskie gardła

1. **Zapytanie do bazy danych**: DELETE na `user_works` z composite primary key powinno być szybkie dzięki indeksowi
2. **Trigger aktualizacji licznika**: Automatyczna aktualizacja `profiles.work_count` przez trigger może być wąskim gardłem przy dużej liczbie równoczesnych operacji
3. **Sprawdzanie przypisania**: Dodatkowe zapytanie SELECT przed DELETE zwiększa opóźnienie, ale jest konieczne dla precyzyjnej obsługi błędów

### Strategie optymalizacji

1. **Indeksy**: Upewnij się, że istnieją odpowiednie indeksy:
   - `user_works(user_id, work_id)` - composite primary key (już istnieje)
   - `user_works(user_id)` - dla szybkiego wyszukiwania powiązań użytkownika
2. **Batch operations**: Nie dotyczy - operacja dotyczy pojedynczego rekordu
3. **Caching**: Nie dotyczy - operacja modyfikująca wymaga aktualnych danych
4. **Monitoring**: Monitoruj czas wykonania operacji DELETE, szczególnie w okresach wysokiego obciążenia

### Optymalizacja zapytań

- Użyj pojedynczego zapytania DELETE z warunkami `user_id` i `work_id` zamiast wielu operacji
- Sprawdzenie `isWorkAttached()` może być zoptymalizowane przez użycie `maybeSingle()` zamiast pełnego SELECT

## 9. Etapy wdrożenia

### Krok 1: Rozszerzenie WorksService o metody pomocnicze

1. Otwórz plik `src/lib/services/works.service.ts`
2. Dodaj nową metodę `isWorkAttached(userId: string, workId: string): Promise<boolean>`
3. Metoda powinna:
   - Wykonać zapytanie do `user_works` z warunkami `user_id = userId` i `work_id = workId`
   - Użyć `.maybeSingle()` dla efektywności
   - Zwrócić `true` jeśli rekord istnieje, `false` w przeciwnym razie
   - Rzucić wyjątek w przypadku błędu bazy danych
4. Dodaj nową metodę `detachUserWork(userId: string, workId: string): Promise<void>`
5. Metoda powinna:
   - Wykonać DELETE na `user_works` z warunkami `user_id = userId` i `work_id = workId`
   - Użyć `.select()` aby sprawdzić, czy jakikolwiek rekord został usunięty
   - Jeśli żaden rekord nie został usunięty, rzucić wyjątek z komunikatem "Work is not attached to user profile"
   - Obsłużyć błędy RLS (kod `42501`) i rzucić odpowiedni wyjątek
   - Pozwolić triggerowi bazy danych automatycznie zaktualizować `profiles.work_count`

### Krok 2: Utworzenie endpointu API

1. Utwórz plik `src/pages/api/user/works/[workId].ts`
2. Zaimportuj wymagane zależności:
   - `APIRoute` z `astro`
   - `WorkIdParamSchema` z `@/lib/validation/work-id.schema`
   - `WorksService` z `@/lib/services/works.service`
   - `logger` z `@/lib/logger`
3. Dodaj `export const prerender = false` na początku pliku
4. Utwórz funkcję `DELETE: APIRoute` z parametrami `{ params, locals }`

### Krok 3: Implementacja logiki endpointu

1. **Walidacja parametrów**:
   - Sprawdź, czy `params.workId` istnieje
   - Jeśli nie, zwróć `400 Bad Request`
   - Użyj `WorkIdParamSchema.safeParse()` do walidacji
   - Jeśli walidacja nie powiedzie się, zwróć `400 Bad Request` z szczegółami

2. **Weryfikacja autoryzacji**:
   - Pobierz `supabase` z `locals.supabase`
   - Wywołaj `supabase.auth.getUser()`
   - Jeśli brak użytkownika, zwróć `401 Unauthorized`

3. **Weryfikacja przypisania**:
   - Utwórz instancję `WorksService`
   - Wywołaj `isWorkAttached(user.id, workId)`
   - Jeśli `false`, zwróć `404 Not Found`
   - Obsłuż błędy i zwróć `500 Internal Server Error` w przypadku nieoczekiwanych błędów

4. **Odłączenie dzieła**:
   - Wywołaj `detachUserWork(user.id, workId)`
   - Obsłuż różne typy błędów:
     - RLS violations → `403 Forbidden`
     - "not attached" → `404 Not Found`
     - Inne błędy → `500 Internal Server Error`
   - W przypadku sukcesu, zwróć `204 No Content`

5. **Obsługa błędów globalnych**:
   - Dodaj zewnętrzny blok try-catch dla nieoczekiwanych błędów
   - Zaloguj błąd i zwróć `500 Internal Server Error`

### Krok 4: Dodanie dokumentacji

1. Dodaj komentarz JSDoc na początku funkcji `DELETE` opisujący:
   - Cel endpointu
   - Parametry ścieżki
   - Kody odpowiedzi
   - Obsługiwane błędy
2. Dodaj komentarze inline w kluczowych miejscach kodu wyjaśniające logikę

### Krok 5: Testowanie

1. **Testy manualne**: (wypisać w pliku `.ai/api/api-user-works-delete-manual-tests.md`)
   - Test sukcesu: odłączenie istniejącego dzieła
   - Test 400: nieprawidłowy format UUID
   - Test 401: brak uwierzytelnienia
   - Test 404: próba odłączenia nieprzypisanego dzieła
   - Test 403: próba odłączenia dzieła innego użytkownika (jeśli możliwe)
   - Test weryfikacji, że dzieło pozostaje w globalnym katalogu

### Krok 6: Weryfikacja zgodności z zasadami

1. Sprawdź, czy kod używa `locals.supabase` zamiast bezpośredniego importu
2. Sprawdź, czy używa typu `SupabaseClient` z `src/db/supabase.client.ts`
3. Sprawdź, czy używa Zod do walidacji
4. Sprawdź, czy logika biznesowa jest w serwisie, a nie w endpoincie
5. Sprawdź, czy używa early returns dla warunków błędów
6. Sprawdź, czy wszystkie błędy są odpowiednio logowane

### Krok 7: Code review i refaktoryzacja

1. Przejrzyj kod pod kątem zgodności z zasadami clean code
2. Upewnij się, że wszystkie błędy są obsłużone
3. Sprawdź spójność z innymi endpointami (np. `DELETE /api/user/authors/{authorId}`)
4. Zweryfikuj, czy logowanie jest odpowiednie
5. Upewnij się, że komentarze są pomocne i aktualne
