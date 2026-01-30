# API Endpoint Implementation Plan: DELETE /api/user/account

## 1. Przegląd punktu końcowego

Endpoint `DELETE /api/user/account` umożliwia użytkownikowi trwałe usunięcie swojego konta oraz wszystkich powiązanych danych. Operacja jest nieodwracalna i wykonuje się wyłącznie po stronie serwera, wykorzystując Supabase Admin API do usunięcia użytkownika z systemu autentykacji.

**Kluczowe cechy:**
- Wymaga pełnej autentykacji użytkownika
- Usuwa wszystkie dane użytkownika z bazy danych (poprzez kaskady)
- Usuwa konto użytkownika z Supabase Auth (wymaga klucza service role)
- Operacja nieodwracalna - nie wymaga potwierdzenia w ciele żądania
- Zwraca kod 204 No Content przy sukcesie

## 2. Szczegóły żądania

### Metoda HTTP
`DELETE`

### Struktura URL
```
/api/user/account
```

### Parametry
- **Brak parametrów ścieżki**
- **Brak parametrów zapytania**
- **Brak ciała żądania** - endpoint nie przyjmuje żadnych danych w ciele żądania

### Headers
- `Authorization: Bearer <access_token>` - wymagany token dostępu użytkownika

## 3. Wykorzystywane typy

### DTOs
Endpoint nie zwraca żadnych danych przy sukcesie (204 No Content), więc nie wymaga DTO dla odpowiedzi.

### Command Modele
Endpoint nie przyjmuje danych wejściowych, więc nie wymaga Command Model.

### Typy pomocnicze
- `SupabaseClient` - z `src/db/supabase.client.ts` (dla operacji na bazie danych)
- `SupabaseClient` z Admin API - nowy klient utworzony z kluczem service role (dla operacji na auth.users)

## 4. Szczegóły odpowiedzi

### Sukces (204 No Content)
- **Status:** `204`
- **Body:** Brak (pusty)
- **Headers:** 
  - `Content-Type: application/json` (może być pominięty przy 204)

### Błędy

#### 401 Unauthorized
Gdy użytkownik nie jest zalogowany lub token jest nieprawidłowy:
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

#### 500 Internal Server Error
Gdy wystąpi błąd podczas usuwania konta (np. błąd Supabase Admin API):
```json
{
  "error": "Internal server error",
  "message": "Failed to delete user account"
}
```

## 5. Przepływ danych

### Krok 1: Walidacja autentykacji
1. Pobierz klienta Supabase z `locals.supabase`
2. Wywołaj `supabase.auth.getUser()` aby zweryfikować token użytkownika
3. Jeśli autentykacja nie powiedzie się, zwróć 401

### Krok 2: Przygotowanie do usunięcia
1. Pobierz `user.id` z zweryfikowanego użytkownika
2. Utwórz klienta Supabase Admin API z kluczem service role (`SUPABASE_SERVICE_ROLE_KEY`)
3. Zainicjalizuj serwis do usuwania konta (np. `AccountService`)

### Krok 3: Usunięcie danych z bazy danych
**Uwaga:** Większość danych zostanie usunięta automatycznie przez kaskady w bazie danych po usunięciu użytkownika z `auth.users`. Jednak dla bezpieczeństwa i logowania, możemy wykonać następujące kroki:

1. **Opcjonalnie:** Przed usunięciem użytkownika z auth, możemy wykonać zapytanie do bazy danych aby:
   - Sprawdzić, czy istnieją dane do usunięcia (dla celów logowania)
   - Wykonać dodatkowe czyszczenie, jeśli wymagane

2. **Kaskady automatyczne** (wykonane przez PostgreSQL po usunięciu z auth.users):
   - `profiles` - usunięte przez `on delete cascade` (FK: user_id → auth.users)
   - `user_authors` - usunięte przez `on delete cascade` (FK: user_id → auth.users)
   - `user_works` - usunięte przez `on delete cascade` (FK: user_id → auth.users)
   - `authors` z `owner_user_id = user.id` - usunięte przez `on delete cascade` (FK: owner_user_id → auth.users)
   - `works` z `owner_user_id = user.id` - usunięte przez `on delete cascade` (FK: owner_user_id → auth.users)
   - `editions` z `owner_user_id = user.id` - usunięte przez `on delete cascade` (FK: owner_user_id → auth.users)

### Krok 4: Usunięcie użytkownika z Supabase Auth
1. Użyj klienta Admin API do wywołania `adminAuthClient.admin.deleteUser(user.id)`
2. Ta operacja spowoduje kaskadowe usunięcie wszystkich powiązanych danych w bazie danych
3. Jeśli operacja się nie powiedzie, zwróć 500 z odpowiednim komunikatem

### Krok 5: Zwrócenie odpowiedzi
1. Jeśli wszystko przebiegło pomyślnie, zwróć odpowiedź 204 No Content
2. W przypadku błędów, zwróć odpowiedni kod statusu z komunikatem błędu

## 6. Względy bezpieczeństwa

### Autentykacja
- Endpoint wymaga pełnej autentykacji użytkownika
- Token dostępu jest weryfikowany przez `supabase.auth.getUser()`
- Użytkownik może usunąć tylko swoje własne konto (weryfikacja przez `user.id`)

### Autoryzacja
- Użytkownik nie może usunąć konta innego użytkownika
- Weryfikacja odbywa się poprzez porównanie `user.id` z tokena z ID użytkownika do usunięcia
- Klucz service role jest używany wyłącznie po stronie serwera i nigdy nie jest eksponowany w kliencie

### Ochrona danych
- Operacja jest nieodwracalna - należy to wyraźnie udokumentować
- Wszystkie dane użytkownika są usuwane zgodnie z zasadami RODO/GDPR
- Kaskady w bazie danych zapewniają spójność danych

### Bezpieczeństwo klucza service role
- Klucz `SUPABASE_SERVICE_ROLE_KEY` musi być przechowywany w zmiennych środowiskowych
- Klucz nigdy nie powinien być logowany ani eksponowany w odpowiedziach API
- Klient Admin API powinien być tworzony tylko w momencie potrzeby, nie globalnie

### Walidacja
- Brak danych wejściowych do walidacji (endpoint nie przyjmuje parametrów)
- Weryfikacja autentykacji jest jedyną walidacją wymaganą

## 7. Obsługa błędów

### Scenariusze błędów i odpowiedzi

#### 1. Brak autentykacji (401 Unauthorized)
**Przyczyna:** Użytkownik nie jest zalogowany lub token jest nieprawidłowy/wygasły

**Obsługa:**
- Sprawdź wynik `supabase.auth.getUser()`
- Jeśli `authError` istnieje lub `user` jest null, zwróć 401
- Zaloguj zdarzenie jako `warn` z informacją o błędzie autentykacji

**Przykład odpowiedzi:**
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

#### 2. Błąd usuwania użytkownika z Auth (500 Internal Server Error)
**Przyczyna:** Błąd podczas wywołania Supabase Admin API (np. problemy z siecią, nieprawidłowy klucz service role, użytkownik już nie istnieje)

**Obsługa:**
- Przechwyć błąd z `adminAuthClient.admin.deleteUser()`
- Zaloguj zdarzenie jako `error` z pełnymi szczegółami (bez eksponowania klucza service role)
- Zwróć 500 z ogólnym komunikatem błędu

**Przykład odpowiedzi:**
```json
{
  "error": "Internal server error",
  "message": "Failed to delete user account"
}
```

#### 3. Błąd bazy danych (500 Internal Server Error)
**Przyczyna:** Błąd podczas operacji na bazie danych (np. problemy z połączeniem, błędy kaskad)

**Obsługa:**
- Przechwyć błędy z operacji na bazie danych
- Zaloguj zdarzenie jako `error` z szczegółami błędu
- Zwróć 500 z ogólnym komunikatem

**Uwaga:** W praktyce, błędy bazy danych związane z kaskadami są rzadkie, ponieważ kaskady są wykonywane automatycznie przez PostgreSQL. Jednak należy obsłużyć przypadki, gdy operacja na bazie danych (jeśli wykonywana przed usunięciem z auth) się nie powiedzie.

#### 4. Nieoczekiwany błąd (500 Internal Server Error)
**Przyczyna:** Nieprzewidziany błąd w kodzie (np. wyjątek JavaScript)

**Obsługa:**
- Przechwyć wszystkie błędy w bloku try-catch na najwyższym poziomie
- Zaloguj zdarzenie jako `error` z pełnym stack trace
- Zwróć 500 z ogólnym komunikatem

### Logowanie błędów
- Użyj `logger` z `src/lib/logger` do logowania wszystkich błędów
- Dla błędów autentykacji: użyj poziomu `warn`
- Dla błędów serwera: użyj poziomu `error`
- Zawsze loguj `userId` (jeśli dostępny) dla celów audytu
- Nie loguj wrażliwych danych (klucze API, hasła)

## 8. Rozważania dotyczące wydajności

### Optymalizacje
1. **Kaskady bazy danych:** Wykorzystanie kaskad PostgreSQL eliminuje potrzebę ręcznego usuwania każdej tabeli, co znacznie poprawia wydajność
2. **Pojedyncze wywołanie Admin API:** Usunięcie użytkownika z auth.users w jednym wywołaniu API
3. **Brak transakcji wieloetapowych:** Ponieważ kaskady są automatyczne, nie ma potrzeby ręcznego zarządzania transakcjami

### Potencjalne wąskie gardła
1. **Supabase Admin API:** Wywołanie zewnętrznego API może być wolniejsze niż operacje lokalne
2. **Duże ilości danych:** Jeśli użytkownik ma wiele powiązanych rekordów (np. tysiące works), kaskady mogą zająć więcej czasu
3. **Blokowanie bazy danych:** Operacje kaskadowe mogą czasowo blokować tabele

### Strategie optymalizacji
1. **Asynchroniczne przetwarzanie (opcjonalne):** Dla bardzo dużych kont, można rozważyć asynchroniczne usuwanie, ale dla większości przypadków synchroniczne usuwanie jest wystarczające
2. **Timeout:** Ustaw odpowiedni timeout dla wywołania Admin API (domyślny timeout może być niewystarczający)
3. **Monitoring:** Monitoruj czas wykonania operacji usuwania konta, aby zidentyfikować potencjalne problemy z wydajnością

### Limity
- Brak limitów na liczbę rekordów do usunięcia (wszystkie dane użytkownika są usuwane)
- Operacja powinna zakończyć się w rozsądnym czasie (< 30 sekund dla typowego konta)

## 9. Etapy wdrożenia

### Krok 1: Aktualizacja definicji środowiskowych
1. Dodaj `SUPABASE_SERVICE_ROLE_KEY` do `src/env.d.ts` w sekcji `ImportMetaEnv`
2. Upewnij się, że zmienna środowiskowa jest dostępna w środowisku produkcyjnym i deweloperskim

### Krok 2: Utworzenie serwisu do usuwania konta
1. Utwórz nowy plik `src/lib/services/account.service.ts`
2. Zaimplementuj klasę `AccountService` z metodą `deleteAccount(userId: string)`
3. Metoda powinna:
   - Utworzyć klienta Supabase Admin API z kluczem service role
   - Wywołać `adminAuthClient.admin.deleteUser(userId)` aby usunąć użytkownika z auth
   - Obsłużyć błędy i rzucić wyjątki z odpowiednimi komunikatami
4. Użyj typu `SupabaseClient` z `src/db/supabase.client.ts` dla spójności typów

### Krok 3: Utworzenie endpointu API
1. Utwórz plik `src/pages/api/user/account.ts`
2. Dodaj `export const prerender = false` na początku pliku
3. Zaimplementuj funkcję `DELETE` zgodnie z wzorcem innych endpointów `/api/user/*`:
   - Walidacja autentykacji (użyj `locals.supabase` i `supabase.auth.getUser()`)
   - Inicjalizacja `AccountService`
   - Wywołanie `accountService.deleteAccount(user.id)`
   - Obsługa błędów z odpowiednimi kodami statusu
   - Zwrócenie odpowiedzi 204 przy sukcesie

### Krok 4: Implementacja logowania
1. Użyj `logger` z `src/lib/logger` do logowania:
   - Błędów autentykacji (poziom `warn`)
   - Błędów usuwania konta (poziom `error`)
   - Sukcesu operacji (opcjonalnie, poziom `info`)
2. Zawsze loguj `userId` dla celów audytu
3. Nie loguj wrażliwych danych (klucze API)

### Krok 5: Obsługa błędów
1. Zaimplementuj obsługę wszystkich scenariuszy błędów wymienionych w sekcji 7
2. Upewnij się, że odpowiedzi błędów są zgodne z formatem używanym w innych endpointach
3. Zweryfikuj, że wszystkie błędy są odpowiednio logowane

### Krok 6: Testy manualne
**Plik `.ai/api-user-account-delete-manual-tests.md`**
   - Test usunięcia konta z prawidłową autentykacją
   - Test usunięcia konta bez autentykacji (powinien zwrócić 401)
   - Test usunięcia konta z nieprawidłowym tokenem (powinien zwrócić 401)
   - Test weryfikacji, że wszystkie dane użytkownika zostały usunięte
   - Test weryfikacji, że dane innych użytkowników nie zostały naruszone

### Krok 7: Dokumentacja
1. Dodaj dokumentację JSDoc do endpointu zgodnie z wzorcem innych endpointów
2. Opisz wszystkie możliwe kody statusu i scenariusze błędów
3. Uwzględnij informację, że operacja jest nieodwracalna

### Krok 8: Weryfikacja zgodności z zasadami
1. Sprawdź, czy implementacja jest zgodna z zasadami z `.cursor/rules/backend.mdc`:
   - Użycie `locals.supabase` zamiast bezpośredniego importu
   - Użycie typu `SupabaseClient` z `src/db/supabase.client.ts`
2. Sprawdź zgodność z `.cursor/rules/astro.mdc`:
   - Użycie `export const prerender = false`
   - Użycie `APIRoute` typu z Astro
   - Użycie `DELETE` w formacie uppercase
3. Sprawdź zgodność z `.cursor/rules/shared.mdc`:
   - Obsługa błędów na początku funkcji
   - Użycie early returns
   - Właściwe logowanie błędów

### Krok 9: Code review i refaktoryzacja
1. Przejrzyj kod pod kątem:
   - Spójności z innymi endpointami
   - Czytelności i utrzymywalności
   - Potencjalnych problemów bezpieczeństwa
2. Upewnij się, że kod jest zgodny z linterem (sprawdź błędy lintera)

### Krok 10: Aktualizacja dokumentacji API
1. Zaktualizuj `.ai/api-plan.md` jeśli wymagane (endpoint jest już tam opisany)
2. Dodaj informacje o endpoincie do głównej dokumentacji API (jeśli istnieje)

