# API Endpoint Implementation Plan: DELETE /api/authors/{authorId}

## 1. Przegląd punktu końcowego

Endpoint `DELETE /api/authors/{authorId}` umożliwia usunięcie manualnego autora należącego do zalogowanego użytkownika. Operacja jest dozwolona wyłącznie dla autorów, które:

- Mają ustawione `manual=true`
- Mają `owner_user_id` równe ID zalogowanego użytkownika (`auth.uid()`)

Usunięcie autora powoduje kaskadowe usunięcie powiązanych rekordów:

- Wszystkie powiązania w tabeli `author_works` (relacje autor-dzieło)
- Wszystkie powiązania w tabeli `user_authors` (relacje użytkownik-autor)
- Wszystkie powiązane dzieła (`works`) należące do tego autora (jeśli są manualne i należą do tego samego użytkownika)
- Wszystkie wydania (`editions`) powiązane z usuniętymi dziełami

Operacja jest nieodwracalna i wymaga autoryzacji użytkownika.

## 2. Szczegóły żądania

- **Metoda HTTP:** `DELETE`
- **Struktura URL:** `/api/authors/{authorId}`
- **Parametry ścieżki:**
  - `authorId` (wymagane): UUID autora w standardowym formacie (np. `550e8400-e29b-41d4-a716-446655440000`)
- **Request Body:** Brak (operacja DELETE nie wymaga body)
- **Nagłówki:**
  - `Authorization: Bearer <access_token>` (opcjonalne, jeśli używany jest token Bearer)
  - Alternatywnie: sesja cookie ustawiona przez endpointy autoryzacyjne Supabase

## 3. Wykorzystywane typy

### Typy walidacji

- **AuthorIdParamSchema** (`src/lib/validation/author-id.schema.ts`): Schemat Zod do walidacji parametru `authorId` jako UUID v4

### Typy odpowiedzi

Endpoint nie zwraca żadnych danych w przypadku sukcesu (204 No Content). W przypadku błędów zwracane są standardowe obiekty błędów:

```typescript
{
  error: string;      // Krótki identyfikator błędu
  message: string;    // Opis błędu dla użytkownika
  details?: unknown;  // Opcjonalne szczegóły (dla błędów walidacji)
}
```

### Typy serwisowe

- **AuthorsService** (`src/lib/services/authors.service.ts`): Serwis do operacji na autorach
  - Wymagana nowa metoda: `deleteManualAuthor(authorId: string, userId: string): Promise<void>`

## 4. Szczegóły odpowiedzi

### 204 No Content (Sukces)

Usunięcie autora zakończyło się pomyślnie. Odpowiedź nie zawiera body.

**Nagłówki:**

- `Content-Length: 0` (lub brak nagłówka Content-Length)

### 400 Bad Request (Błąd walidacji)

Parametr `authorId` ma nieprawidłowy format (nie jest UUID).

```json
{
  "error": "Validation error",
  "message": "authorId must be a valid UUID",
  "details": [
    {
      "path": ["authorId"],
      "message": "authorId must be a valid UUID"
    }
  ]
}
```

### 401 Unauthorized (Brak autoryzacji)

Użytkownik nie jest zalogowany lub sesja/token jest nieprawidłowy.

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden (Brak uprawnień)

Użytkownik próbuje usunąć autora, który:

- Nie jest autorem manualnym (`manual=false`)
- Nie należy do użytkownika (`owner_user_id != auth.uid()`)

```json
{
  "error": "Forbidden",
  "message": "Only manual authors owned by the current user can be deleted"
}
```

### 404 Not Found (Nie znaleziono)

Autor o podanym ID nie istnieje w bazie danych lub nie jest widoczny dla użytkownika zgodnie z zasadami RLS.

```json
{
  "error": "Not found",
  "message": "Author not found or not accessible"
}
```

### 500 Internal Server Error (Błąd serwera)

Wystąpił nieoczekiwany błąd podczas przetwarzania żądania (błąd bazy danych, błąd serwisu).

```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## 5. Przepływ danych

### Krok 1: Ekstrakcja i walidacja parametrów ścieżki

1. Pobierz parametr `authorId` z `params.authorId` (z kontekstu Astro)
2. Sprawdź, czy parametr istnieje - jeśli nie, zwróć 400
3. Waliduj format UUID używając `AuthorIdParamSchema.safeParse()`
4. Jeśli walidacja nie powiedzie się, zwróć 400 Bad Request z szczegółami błędów

### Krok 2: Weryfikacja autoryzacji

1. Pobierz instancję Supabase z `locals.supabase`
2. Wywołaj `supabase.auth.getUser()` aby pobrać zalogowanego użytkownika
3. Jeśli użytkownik nie jest zalogowany (`authError` lub `!user`), zwróć 401 Unauthorized
4. Zapisz `user.id` do dalszego użycia

### Krok 3: Pobranie autora z bazy danych

1. Utwórz instancję `AuthorsService` z klientem Supabase
2. Wywołaj metodę `findById(authorId)` na `AuthorsService`
3. Jeśli metoda zwróci `null` (autor nie istnieje lub nie jest widoczny przez RLS), zwróć 404 Not Found
4. Jeśli wystąpi błąd podczas zapytania, zaloguj błąd i zwróć 500 Internal Server Error

### Krok 4: Weryfikacja uprawnień do usunięcia

1. Sprawdź, czy autor ma `manual=true`
   - Jeśli `manual=false`, zwróć 403 Forbidden z komunikatem o tym, że tylko manualni autorzy mogą być usuwani
2. Sprawdź, czy `owner_user_id === user.id`
   - Jeśli `owner_user_id !== user.id`, zwróć 403 Forbidden z komunikatem o braku uprawnień
3. Jeśli oba warunki są spełnione, przejdź do następnego kroku

### Krok 5: Usunięcie autora

1. Wywołaj metodę `deleteManualAuthor(authorId, user.id)` na `AuthorsService`
2. Metoda powinna wykonać operację DELETE na tabeli `authors` z warunkiem:
   - `id = authorId`
   - `manual = true`
   - `owner_user_id = userId`
3. Baza danych automatycznie wykona kaskadowe usunięcia:
   - `author_works` (relacje autor-dzieło) - ON DELETE CASCADE
   - `user_authors` (relacje użytkownik-autor) - ON DELETE CASCADE
   - `works` (dzieła należące do autora, jeśli są manualne i należą do tego samego użytkownika) - ON DELETE CASCADE
   - `editions` (wydania powiązane z usuniętymi dziełami) - ON DELETE CASCADE
4. Jeśli operacja się powiedzie, zwróć 204 No Content
5. Jeśli wystąpi błąd (np. naruszenie ograniczeń, błąd RLS), zaloguj błąd i zwróć odpowiedni kod statusu:
   - 403 Forbidden - jeśli RLS blokuje operację
   - 500 Internal Server Error - dla innych błędów bazy danych

### Diagram przepływu

```
Request → Extract authorId → Validate UUID → Authenticate User
                                                      ↓
Response ← Return 204 ← Delete Author ← Verify Ownership & Manual Flag ← Fetch Author
```

## 6. Względy bezpieczeństwa

### Autoryzacja i uwierzytelnianie

1. **Wymagana autoryzacja:** Endpoint wymaga zalogowanego użytkownika. Brak sesji/tokenu skutkuje odpowiedzią 401.
2. **Weryfikacja właściciela:** Endpoint sprawdza, czy `owner_user_id` autora odpowiada `auth.uid()` przed usunięciem.
3. **Ograniczenie do manualnych autorów:** Tylko autorzy z `manual=true` mogą być usuwani przez endpoint. Autorzy z OpenLibrary (`manual=false`, `owner_user_id=null`) są chronieni przed usunięciem przez użytkowników.

### Row Level Security (RLS)

1. **Polityki RLS w Supabase:** Polityki RLS w bazie danych powinny zapewniać, że:
   - Użytkownicy mogą usuwać tylko autorów, których są właścicielami (`owner_user_id = auth.uid()`)
   - Autorzy globalni (`owner_user_id is null`) nie mogą być usuwani przez zwykłych użytkowników
2. **Podwójna weryfikacja:** Endpoint wykonuje weryfikację uprawnień zarówno na poziomie aplikacji (przed wywołaniem DELETE), jak i na poziomie bazy danych (przez RLS).

### Walidacja danych wejściowych

1. **Format UUID:** Parametr `authorId` jest walidowany jako UUID v4 przed wykonaniem jakichkolwiek operacji na bazie danych.
2. **Ochrona przed SQL Injection:** Użycie Supabase Client zapewnia parametryzowane zapytania, co eliminuje ryzyko SQL injection.

### Kaskadowe usunięcia

1. **Bezpieczeństwo kaskad:** Kaskadowe usunięcia są zarządzane przez bazę danych, co zapewnia spójność danych.
2. **Świadomość konsekwencji:** Usunięcie autora powoduje usunięcie wszystkich powiązanych danych (dzieła, wydania, relacje), co jest operacją nieodwracalną.

### Logowanie i monitorowanie

1. **Logowanie operacji:** Wszystkie próby usunięcia powinny być logowane (zarówno sukcesy, jak i niepowodzenia) dla celów audytu.
2. **Logowanie błędów:** Błędy są logowane z kontekstem (authorId, userId) dla ułatwienia debugowania.

## 7. Obsługa błędów

### Scenariusze błędów i odpowiedzi

#### Błąd walidacji (400 Bad Request)

**Przyczyna:** Parametr `authorId` ma nieprawidłowy format lub jest brakujący.

**Obsługa:**

- Waliduj parametr używając `AuthorIdParamSchema`
- Zwróć 400 z czytelnym komunikatem błędu i szczegółami walidacji
- Zaloguj ostrzeżenie z parametrem i błędami walidacji

#### Brak autoryzacji (401 Unauthorized)

**Przyczyna:** Użytkownik nie jest zalogowany lub token/sesja jest nieprawidłowa.

**Obsługa:**

- Sprawdź `supabase.auth.getUser()` na początku endpointu
- Zwróć 401 z komunikatem o wymaganej autoryzacji
- Zaloguj ostrzeżenie o nieudanej próbie dostępu

#### Brak uprawnień (403 Forbidden)

**Przyczyna:**

- Autor nie jest manualny (`manual=false`)
- Autor nie należy do użytkownika (`owner_user_id != auth.uid()`)

**Obsługa:**

- Sprawdź flagę `manual` przed próbą usunięcia
- Sprawdź `owner_user_id` przed próbą usunięcia
- Zwróć 403 z komunikatem wyjaśniającym przyczynę odmowy
- Zaloguj ostrzeżenie z informacją o próbie usunięcia nieuprawnionego autora

#### Nie znaleziono (404 Not Found)

**Przyczyna:** Autor o podanym ID nie istnieje w bazie danych lub nie jest widoczny dla użytkownika zgodnie z zasadami RLS.

**Obsługa:**

- Sprawdź wynik `findById()` - jeśli zwraca `null`, zwróć 404
- Zwróć 404 z komunikatem o nieznalezionym autorze
- Nie loguj tego jako błąd (to normalny scenariusz)

#### Błąd bazy danych (500 Internal Server Error)

**Przyczyna:** Wystąpił nieoczekiwany błąd podczas operacji na bazie danych (np. błąd połączenia, naruszenie ograniczeń, błąd RLS).

**Obsługa:**

- Złap wszystkie wyjątki w bloku try-catch
- Zaloguj błąd z pełnym kontekstem (authorId, userId, komunikat błędu)
- Zwróć 500 z ogólnym komunikatem (nie ujawniaj szczegółów błędu użytkownikowi)
- Rozważ różnicowanie między błędami RLS (403) a innymi błędami bazy danych (500)

### Strategia obsługi błędów

1. **Early returns:** Używaj wczesnych zwrotów dla błędów walidacji i autoryzacji, aby uniknąć głębokiego zagnieżdżenia.
2. **Guard clauses:** Sprawdzaj warunki wstępne (autoryzacja, istnienie autora, uprawnienia) na początku, przed wykonaniem operacji.
3. **Spójne komunikaty błędów:** Używaj spójnego formatu odpowiedzi błędów we wszystkich scenariuszach.
4. **Logowanie kontekstowe:** Zawsze loguj błędy z kontekstem (authorId, userId) dla ułatwienia debugowania.
5. **Bezpieczeństwo komunikatów:** Nie ujawniaj szczegółów błędów bazy danych użytkownikom końcowym (tylko w logach).

## 8. Rozważania dotyczące wydajności

### Optymalizacje zapytań

1. **Indeksowanie:** Tabela `authors` ma indeks na kolumnie `id` (klucz główny), co zapewnia szybkie wyszukiwanie O(log n).
2. **Kaskadowe usunięcia:** Kaskadowe usunięcia są wykonywane przez bazę danych, co jest bardziej wydajne niż ręczne usuwanie w pętli w kodzie aplikacji.
3. **Pojedyncze zapytanie:** Operacja DELETE wykonuje jedno zapytanie do bazy danych (z warunkami), zamiast wielu zapytań.

### Potencjalne wąskie gardła

1. **Duża liczba powiązanych rekordów:** Jeśli autor ma bardzo dużo powiązanych dzieł i wydań, kaskadowe usunięcie może zająć więcej czasu. Baza danych powinna obsłużyć to efektywnie dzięki indeksom i kaskadom.
2. **Blokowanie transakcji:** Operacja DELETE może blokować wiersze podczas usuwania. W przypadku bardzo dużej liczby powiązanych rekordów może to wpłynąć na wydajność.

## 9. Etapy wdrożenia

### Krok 1: Rozszerzenie AuthorsService o metodę usuwania

1. Otwórz plik `src/lib/services/authors.service.ts`
2. Dodaj nową metodę `deleteManualAuthor(authorId: string, userId: string): Promise<void>`
3. Metoda powinna:
   - Wykonać zapytanie DELETE do tabeli `authors` z warunkami:
     - `id = authorId`
     - `manual = true`
     - `owner_user_id = userId`
   - Użyć `.eq()` dla wszystkich trzech warunków
   - Sprawdzić wynik operacji - jeśli żaden wiersz nie został usunięty, rzucić odpowiedni błąd
   - Obsłużyć błędy bazy danych (RLS, ograniczenia) i przekazać je dalej
4. Dodaj dokumentację JSDoc dla metody

### Krok 2: Implementacja endpointu DELETE

1. Otwórz plik `src/pages/api/authors/[authorId].ts`
2. Dodaj eksport `export const DELETE: APIRoute = async ({ params, locals }) => { ... }`
3. Zaimplementuj logikę zgodnie z przepływem danych opisanym w sekcji 5:
   - Ekstrakcja i walidacja `authorId` używając `AuthorIdParamSchema`
   - Weryfikacja autoryzacji użytkownika
   - Pobranie autora z bazy danych używając `AuthorsService.findById()`
   - Weryfikacja uprawnień (manual flag i ownership)
   - Usunięcie autora używając `AuthorsService.deleteManualAuthor()`
   - Zwrócenie odpowiedzi 204 No Content
4. Dodaj obsługę błędów dla wszystkich scenariuszy (400, 401, 403, 404, 500)
5. Dodaj logowanie błędów używając `logger` z `src/lib/logger`
6. Dodaj dokumentację JSDoc dla endpointu

### Krok 3: Testowanie ręczne endpointu

**Plik:** `.ai/api/api-authors-delete-manual-tests.md`

1. Przygotuj testy manualne dla wszystkich scenariuszy:
   - Pomyślne usunięcie manualnego autora należącego do użytkownika
   - Próba usunięcia autora bez autoryzacji (401)
   - Próba usunięcia autora z nieprawidłowym UUID (400)
   - Próba usunięcia nieistniejącego autora (404)
   - Próba usunięcia autora nie-manualnego (403)
   - Próba usunięcia autora należącego do innego użytkownika (403)
   - Weryfikacja kaskadowego usunięcia powiązanych rekordów
2. Zweryfikuj, że wszystkie odpowiedzi mają poprawne kody statusu i formaty JSON (dla błędów)

### Krok 4: Weryfikacja kaskadowych usunięć

1. Utwórz testowego autora manualnego z powiązanymi dziełami i wydaniami
2. Usuń autora przez endpoint
3. Zweryfikuj w bazie danych, że:
   - Autor został usunięty
   - Wszystkie rekordy w `author_works` dla tego autora zostały usunięte
   - Wszystkie rekordy w `user_authors` dla tego autora zostały usunięte
   - Wszystkie powiązane manualne dzieła należące do tego samego użytkownika zostały usunięte
   - Wszystkie wydania powiązane z usuniętymi dziełami zostały usunięte

### Krok 5: Aktualizacja dokumentacji (opcjonalne)

1. Jeśli istnieje dokumentacja API (np. OpenAPI/Swagger), zaktualizuj ją o nowy endpoint
2. Dodaj przykłady użycia i odpowiedzi dla wszystkich scenariuszy

### Krok 6: Code review i refaktoryzacja

1. Przejrzyj kod pod kątem zgodności z zasadami projektu:
   - Użycie early returns dla błędów
   - Brak niepotrzebnych else statements
   - Właściwe użycie guard clauses
   - Spójne formatowanie i nazewnictwo
2. Upewnij się, że kod jest zgodny z linterem
3. Zweryfikuj, że wszystkie błędy są właściwie obsługiwane i logowane
