# API Endpoint Implementation Plan: DELETE /api/user/authors/{authorId}

## 1. Przegląd punktu końcowego

Endpoint `DELETE /api/user/authors/{authorId}` służy do odłączenia autora od profilu zalogowanego użytkownika. Endpoint usuwa relację w tabeli `user_authors` oraz kaskadowo usuwa wszystkie powiązane rekordy `user_works` dla dzieł tego autora. Operacja automatycznie zmniejsza liczniki w profilu użytkownika poprzez triggery bazy danych.

**Główne funkcjonalności:**

- Usunięcie relacji użytkownik-autor z tabeli `user_authors`
- Kaskadowe usunięcie wszystkich rekordów `user_works` dla dzieł tego autora należących do użytkownika
- Automatyczne zmniejszanie licznika `author_count` w profilu użytkownika (via trigger)
- Automatyczne zmniejszanie licznika `work_count` w profilu użytkownika dla usuniętych `user_works` (via trigger)
- Weryfikacja, że autor jest przypisany do użytkownika przed usunięciem

**Wykorzystywane zasoby bazy danych:**

- Tabela `user_authors` (relacja użytkownik-autor, composite PK: user_id, author_id)
- Tabela `user_works` (relacja użytkownik-dzieło, composite PK: user_id, work_id)
- Tabela `author_works` (relacja autor-dzieło, do identyfikacji dzieł autora)
- Tabela `profiles` (liczniki `author_count` i `work_count`, aktualizowane przez triggery)
- Trigger `user_authors_decrement_count` (automatyczne zmniejszanie licznika autorów)
- Trigger `user_works_decrement_count` (automatyczne zmniejszanie licznika dzieł)
- Indeksy: `user_authors(user_id)`, `user_works(user_id)`, `author_works(author_id)`

**Uwaga:** Endpoint nie usuwa samego autora z bazy danych (tabela `authors`), tylko relację użytkownik-autor. Autor pozostaje w katalogu globalnym i może być przypisany do innych użytkowników.

## 2. Szczegóły żądania

**Metoda HTTP:** `DELETE`

**Struktura URL:** `/api/user/authors/{authorId}`

**Parametry ścieżki:**

- **authorId** (wymagany)
  - Typ: UUID (string)
  - Opis: Identyfikator autora do odłączenia od profilu użytkownika
  - Walidacja: prawidłowy format UUID v4
  - Przykład: `550e8400-e29b-41d4-a716-446655440000`

**Parametry zapytania (query parameters):** Brak

**Request Body:** Brak (operacja DELETE nie wymaga body)

**Nagłówki:**

- `Authorization: Bearer <access_token>` (opcjonalne, jeśli używany jest token Bearer)
- Alternatywnie: sesja cookie ustawiona przez endpointy autoryzacyjne Supabase

**Przykładowe żądanie:**

```bash
DELETE /api/user/authors/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <access_token>
```

**Wymagana autoryzacja:** Tak (Bearer token w nagłówku Authorization lub sesja cookie)

## 3. Wykorzystywane typy

### Typy walidacji

**AuthorIdParamSchema** (`src/lib/validation/author-id.schema.ts`):

- Schemat Zod do walidacji parametru `authorId` jako UUID v4
- Już istnieje w projekcie, można użyć bezpośrednio

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

**AuthorsService** (`src/lib/services/authors.service.ts`):

- Metoda `isAuthorAttached(userId: string, authorId: string): Promise<boolean>` - sprawdza, czy autor jest przypisany do użytkownika (już istnieje)
- Metoda `detachUserAuthor(userId: string, authorId: string): Promise<void>` - **do utworzenia** - odłącza autora od użytkownika i usuwa powiązane `user_works`

## 4. Szczegóły odpowiedzi

### Sukces (204 No Content)

**Status:** `204 No Content`

**Response Body:** Brak (pusty body)

**Nagłówki:**

- `Content-Type: application/json` (opcjonalnie, ale standardowo nie jest wymagany dla 204)

**Przykład odpowiedzi:**

```
HTTP/1.1 204 No Content
```

### Błędy

#### 400 Bad Request - Błąd walidacji

**Status:** `400 Bad Request`

**Response Body:**

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

**Scenariusze:**

- Parametr `authorId` nie został podany
- Parametr `authorId` nie jest w formacie UUID v4

#### 401 Unauthorized - Brak autoryzacji

**Status:** `401 Unauthorized`

**Response Body:**

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**Scenariusze:**

- Użytkownik nie jest zalogowany
- Sesja wygasła lub token jest nieprawidłowy

#### 404 Not Found - Autor nie jest przypisany

**Status:** `404 Not Found`

**Response Body:**

```json
{
  "error": "Not Found",
  "message": "Author is not attached to your profile"
}
```

**Scenariusze:**

- Autor nie jest przypisany do profilu użytkownika
- Autor nie istnieje lub nie jest widoczny dla użytkownika (RLS)

#### 500 Internal Server Error - Błąd serwera

**Status:** `500 Internal Server Error`

**Response Body:**

```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

**Scenariusze:**

- Błąd bazy danych podczas operacji DELETE
- Błąd podczas kaskadowego usuwania `user_works`
- Błąd podczas aktualizacji liczników (trigger)
- Inne nieoczekiwane błędy

## 5. Przepływ danych

### Krok 1: Ekstrakcja i walidacja parametru ścieżki

1. Pobierz parametr `authorId` z `params.authorId`
2. Sprawdź, czy parametr istnieje - jeśli nie, zwróć 400
3. Waliduj format UUID używając `AuthorIdParamSchema.safeParse()`
4. Jeśli walidacja nie powiedzie się, zwróć 400 Bad Request z szczegółami błędów

### Krok 2: Weryfikacja autoryzacji

1. Pobierz instancję Supabase z `locals.supabase`
2. Wywołaj `supabase.auth.getUser()` aby pobrać zalogowanego użytkownika
3. Jeśli użytkownik nie jest zalogowany (`authError` lub `!user`), zwróć 401 Unauthorized
4. Zapisz `user.id` do dalszego użycia

### Krok 3: Weryfikacja, czy autor jest przypisany

1. Utwórz instancję `AuthorsService` z klientem Supabase
2. Wywołaj metodę `isAuthorAttached(user.id, authorId)` na `AuthorsService`
3. Jeśli metoda zwróci `false` (autor nie jest przypisany), zwróć 404 Not Found
4. Jeśli wystąpi błąd podczas zapytania, zaloguj błąd i zwróć 500 Internal Server Error

### Krok 4: Odłączenie autora i kaskadowe usunięcie user_works

1. Wywołaj metodę `detachUserAuthor(user.id, authorId)` na `AuthorsService`
2. Metoda powinna wykonać następujące operacje w transakcji:
   a. Znajdź wszystkie dzieła autora poprzez `author_works`:
   ```sql
   SELECT work_id FROM author_works WHERE author_id = authorId
   ```
   b. Usuń wszystkie rekordy `user_works` dla tych dzieł należące do użytkownika:
   ```sql
   DELETE FROM user_works
   WHERE user_id = userId
   AND work_id IN (SELECT work_id FROM author_works WHERE author_id = authorId)
   ```
   c. Usuń rekord `user_authors`:
   ```sql
   DELETE FROM user_authors
   WHERE user_id = userId AND author_id = authorId
   ```
3. Triggery bazy danych automatycznie zaktualizują liczniki:
   - `user_works_decrement_count` zmniejszy `profiles.work_count` dla każdego usuniętego `user_works`
   - `user_authors_decrement_count` zmniejszy `profiles.author_count` po usunięciu `user_authors`
4. Jeśli operacja się powiedzie, zwróć 204 No Content
5. Jeśli wystąpi błąd (np. naruszenie ograniczeń, błąd RLS), zaloguj błąd i zwróć odpowiedni kod statusu:
   - 403 Forbidden - jeśli RLS blokuje operację
   - 500 Internal Server Error - dla innych błędów bazy danych

### Krok 5: Obsługa błędów i logowanie

1. Wszystkie błędy powinny być logowane używając `logger` z `src/lib/logger`
2. Błędy walidacji: poziom `warn` z szczegółami walidacji
3. Błędy autoryzacji: poziom `warn` z informacją o próbie dostępu
4. Błędy bazy danych: poziom `error` z pełnym stack trace
5. Nieoczekiwane błędy: poziom `error` z pełnym stack trace

## 6. Względy bezpieczeństwa

### Autoryzacja

1. **Wymagana autoryzacja:** Endpoint wymaga zalogowanego użytkownika. Brak sesji lub nieprawidłowy token skutkuje odpowiedzią 401.
2. **RLS (Row Level Security):** Supabase RLS automatycznie egzekwuje, że użytkownik może usuwać tylko swoje własne rekordy `user_authors` i `user_works`:
   - Policy `user_authors_delete_authenticated`: `user_id = auth.uid()`
   - Policy `user_works_delete_authenticated`: `user_id = auth.uid()`
3. **Walidacja parametrów:** Parametr `authorId` jest walidowany jako UUID, co zapobiega atakom typu SQL injection.

### Autoryzacja danych

1. **Weryfikacja przypisania:** Przed usunięciem sprawdzamy, czy autor jest rzeczywiście przypisany do użytkownika, aby uniknąć niepotrzebnych operacji i zapewnić czytelne komunikaty błędów.
2. **Idempotentność:** Wielokrotne wywołanie DELETE z tym samym `authorId` powinno zwracać 404 (autor już nie jest przypisany), co jest bezpieczne i zgodne z konwencjami REST.

### Ochrona przed atakami

1. **SQL Injection:** Wszystkie zapytania używają Supabase SDK, które automatycznie parametryzuje zapytania, eliminując ryzyko SQL injection.
2. **Rate Limiting:** Endpoint nie wymaga rate limitingu (w przeciwieństwie do POST), ponieważ operacja DELETE jest idempotentna i mniej podatna na nadużycia.
3. **CORS:** Endpoint powinien respektować ustawienia CORS aplikacji (domyślnie Astro obsługuje to automatycznie).

## 7. Obsługa błędów

### Scenariusze błędów i odpowiedzi

| Scenariusz                      | Kod statusu | Komunikat                                        | Logowanie |
| ------------------------------- | ----------- | ------------------------------------------------ | --------- |
| Brak parametru `authorId`       | 400         | "authorId parameter is required"                 | warn      |
| Nieprawidłowy format UUID       | 400         | "authorId must be a valid UUID"                  | warn      |
| Użytkownik nie zalogowany       | 401         | "Authentication required"                        | warn      |
| Autor nie przypisany            | 404         | "Author is not attached to your profile"         | warn      |
| Błąd RLS (naruszenie uprawnień) | 403         | "Cannot detach author: insufficient permissions" | warn      |
| Błąd bazy danych                | 500         | "An unexpected error occurred"                   | error     |
| Nieoczekiwany błąd              | 500         | "An unexpected error occurred"                   | error     |

### Szczegółowa obsługa błędów

#### Błędy walidacji (400)

- Walidacja parametru `authorId` używając `AuthorIdParamSchema.safeParse()`
- Zwróć szczegóły błędów walidacji w polu `details`
- Zaloguj błąd na poziomie `warn` z informacją o nieprawidłowym parametrze

#### Błędy autoryzacji (401)

- Sprawdź sesję użytkownika przed wykonaniem jakichkolwiek operacji
- Zwróć 401 natychmiast, jeśli użytkownik nie jest zalogowany
- Zaloguj próbę dostępu na poziomie `warn`

#### Błędy nie znalezionych zasobów (404)

- Sprawdź, czy autor jest przypisany do użytkownika przed próbą usunięcia
- Zwróć 404, jeśli autor nie jest przypisany (nie używaj 204 dla nieistniejących relacji)
- Zaloguj na poziomie `warn` z informacją o próbie odłączenia nieprzypisanego autora

#### Błędy uprawnień (403)

- RLS może zwrócić błąd 403, jeśli użytkownik próbuje usunąć rekord, do którego nie ma dostępu
- Obsłuż kod błędu `42501` (RLS policy violation) i zwróć 403
- Zaloguj na poziomie `warn` z informacją o naruszeniu uprawnień

#### Błędy serwera (500)

- Wszystkie nieoczekiwane błędy bazy danych powinny być logowane na poziomie `error` z pełnym stack trace
- Zwróć ogólny komunikat błędu dla użytkownika (nie ujawniaj szczegółów technicznych)
- Obsłuż błędy transakcji, jeśli operacja kaskadowa się nie powiedzie

## 8. Rozważania dotyczące wydajności

### Optymalizacja zapytań

1. **Efektywne usuwanie user_works:**
   - Użyj jednego zapytania DELETE z podzapytaniem zamiast wielu pojedynczych usunięć
   - Zapytanie powinno używać indeksu `user_works(user_id)` i `author_works(author_id)`
   - Przykład optymalnego zapytania:
     ```sql
     DELETE FROM user_works
     WHERE user_id = $1
     AND work_id IN (
       SELECT work_id FROM author_works WHERE author_id = $2
     )
     ```

2. **Weryfikacja przypisania:**
   - Użyj istniejącej metody `isAuthorAttached()`, która wykonuje szybkie zapytanie na composite PK
   - Indeks `user_authors(user_id)` zapewnia szybkie wyszukiwanie

3. **Transakcje:**
   - Wszystkie operacje DELETE powinny być wykonane w jednej transakcji, aby zapewnić spójność danych
   - Supabase automatycznie obsługuje transakcje dla operacji w ramach jednego wywołania

### Potencjalne wąskie gardła

1. **Duża liczba powiązanych user_works:** Jeśli autor ma bardzo dużo dzieł przypisanych do użytkownika, usunięcie wszystkich `user_works` może zająć więcej czasu. Baza danych powinna obsłużyć to efektywnie dzięki indeksom.
2. **Blokowanie transakcji:** Operacja DELETE może blokować wiersze podczas usuwania. W przypadku bardzo dużej liczby powiązanych rekordów może to wpłynąć na wydajność.
3. **Aktualizacja liczników:** Triggery aktualizujące liczniki mogą dodać niewielkie opóźnienie, ale są zoptymalizowane przez bazę danych.

### Strategie optymalizacji

1. **Batch operations:** Użyj jednego zapytania DELETE z podzapytaniem zamiast wielu pojedynczych operacji
2. **Indeksy:** Upewnij się, że istnieją odpowiednie indeksy:
   - `user_authors(user_id)` - już istnieje
   - `user_works(user_id)` - już istnieje
   - `author_works(author_id)` - już istnieje
3. **Monitoring:** Monitoruj czas wykonania operacji DELETE, szczególnie dla autorów z dużą liczbą powiązanych dzieł

## 9. Etapy wdrożenia

### Krok 1: Rozszerzenie AuthorsService o metodę detachUserAuthor

1. Otwórz plik `src/lib/services/authors.service.ts`
2. Dodaj nową metodę `detachUserAuthor(userId: string, authorId: string): Promise<void>`
3. Metoda powinna:
   a. Znaleźć wszystkie dzieła autora poprzez zapytanie do `author_works`:
   ```typescript
   const { data: authorWorks, error: authorWorksError } = await this.supabase
     .from("author_works")
     .select("work_id")
     .eq("author_id", authorId);
   ```
   b. Jeśli autor ma dzieła, usuń wszystkie powiązane `user_works`:
   ```typescript
   if (authorWorks && authorWorks.length > 0) {
     const workIds = authorWorks.map((aw) => aw.work_id);
     const { error: deleteWorksError } = await this.supabase
       .from("user_works")
       .delete()
       .eq("user_id", userId)
       .in("work_id", workIds);

     if (deleteWorksError) {
       throw new Error(`Failed to delete user works: ${deleteWorksError.message}`);
     }
   }
   ```
   c. Usuń rekord `user_authors`:
   ```typescript
   const { data, error } = await this.supabase
     .from("user_authors")
     .delete()
     .eq("user_id", userId)
     .eq("author_id", authorId)
     .select();

   if (error) {
     // Handle RLS policy violations
     if (error.code === "42501") {
       throw new Error("Cannot detach author: insufficient permissions");
     }
     throw new Error(`Failed to detach author: ${error.message}`);
   }

   // Check if any row was actually deleted
   if (!data || data.length === 0) {
     throw new Error("Author is not attached to user profile");
   }
   ```
4. Dodaj dokumentację JSDoc dla metody, opisującą kaskadowe usunięcie `user_works`
5. Obsłuż błędy bazy danych i przekaż je dalej z odpowiednimi komunikatami

### Krok 2: Utworzenie endpointu DELETE w pliku index.ts

1. Otwórz plik `src/pages/api/user/authors/index.ts`
2. Dodaj eksport `export const DELETE: APIRoute = async ({ params, locals }) => { ... }`
3. Zaimplementuj logikę zgodnie z przepływem danych opisanym w sekcji 5:
   - Ekstrakcja i walidacja `authorId` z `params.authorId` używając `AuthorIdParamSchema`
   - Weryfikacja autoryzacji użytkownika
   - Weryfikacja, czy autor jest przypisany używając `AuthorsService.isAuthorAttached()`
   - Odłączenie autora używając `AuthorsService.detachUserAuthor()`
   - Zwrócenie odpowiedzi 204 No Content
4. Dodaj obsługę błędów dla wszystkich scenariuszy (400, 401, 404, 403, 500)
5. Dodaj logowanie błędów używając `logger` z `src/lib/logger`
6. Dodaj dokumentację JSDoc dla endpointu zgodnie z formatem używanym w projekcie

### Krok 3: Importowanie wymaganych zależności

1. W pliku `src/pages/api/user/authors/index.ts`:
   - Zaimportuj `AuthorIdParamSchema` z `@/lib/validation/author-id.schema`
   - Upewnij się, że `AuthorsService` jest już zaimportowany (sprawdź istniejące importy)
   - Upewnij się, że `logger` jest już zaimportowany

### Krok 4: Testowanie ręczne endpointu

**Plik:** `.ai/api/api-user-authors-delete-manual-tests.md`

1. Przygotuj testy manualne dla wszystkich scenariuszy:
   - Sukces: odłączenie autora bez powiązanych dzieł
   - Sukces: odłączenie autora z powiązanymi dziełami (kaskadowe usunięcie user_works)
   - Błąd 400: nieprawidłowy format UUID
   - Błąd 401: brak autoryzacji
   - Błąd 404: autor nie jest przypisany
   - Błąd 500: błąd bazy danych
2. Zweryfikuj, że liczniki w `profiles` są poprawnie aktualizowane przez triggery
3. Zweryfikuj, że kaskadowe usunięcie `user_works` działa poprawnie
4. Zweryfikuj idempotentność (wielokrotne wywołanie DELETE zwraca 404)

### Krok 5: Weryfikacja zgodności z RLS

1. Sprawdź, że endpoint działa poprawnie z politykami RLS:
   - Użytkownik może usuwać tylko swoje własne rekordy `user_authors`
   - Użytkownik może usuwać tylko swoje własne rekordy `user_works`
2. Przetestuj scenariusz, w którym RLS blokuje operację (powinien zwrócić 403)

### Krok 6: Dokumentacja i code review

1. Upewnij się, że wszystkie metody mają dokumentację JSDoc
2. Sprawdź, że kod jest zgodny z zasadami projektu (early returns, error handling)
3. Zweryfikuj, że wszystkie błędy są odpowiednio logowane
4. Upewnij się, że endpoint zwraca prawidłowe kody statusu HTTP
