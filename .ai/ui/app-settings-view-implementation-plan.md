# Plan implementacji widoku Ustawienia konta

## 1. Przegląd

Widok Ustawienia konta (`/app/settings`) umożliwia użytkownikowi zarządzanie sesją i lifecycle konta. Widok realizuje wymagania z US-002 (Logowanie i wylogowanie) oraz US-003 (Usunięcie konta i danych). Głównym celem jest zapewnienie bezpiecznego i intuicyjnego interfejsu do wylogowania oraz trwałego usunięcia konta wraz z wszystkimi powiązanymi danymi.

Widok składa się z dwóch głównych sekcji:
- **Sekcja Konto**: wyświetla adres e-mail użytkownika i przycisk wylogowania
- **Sekcja Usuń konto**: zawiera ostrzeżenie o nieodwracalności operacji oraz przycisk uruchamiający dialog potwierdzenia usunięcia konta

## 2. Routing widoku

**Ścieżka widoku**: `/app/settings`

**Plik implementacji**: `src/pages/app/settings.astro`

**Ochrona routingu**: 
- Middleware (`src/middleware/index.ts`) automatycznie przekierowuje nieautoryzowanych użytkowników do `/login?redirect_to=/app/settings`
- Użytkownik musi być zalogowany (sesja weryfikowana przez `supabase.auth.getUser()`)
- Email użytkownika jest dostępny przez `Astro.locals.user?.email` (ustawiane przez middleware)

## 3. Struktura komponentów

```
settings.astro (Astro page)
└── AppLayout.astro (layout wrapper)
    └── AccountSettings.tsx (React component - client:load)
        ├── Sekcja "Konto"
        │   ├── Nagłówek "Konto"
        │   ├── Wyświetlenie e-maila użytkownika
        │   ├── Przycisk "Wyloguj" (LogoutButton.tsx można użyć lub inline)
        │   └── Alert z błędem wylogowania (opcjonalnie)
        └── Sekcja "Usuń konto"
            ├── Nagłówek "Usuń konto"
            ├── Alert z ostrzeżeniem o nieodwracalności
            ├── Przycisk "Usuń konto"
            └── DeleteAccountDialog.tsx (React component)
                ├── AlertDialog (shadcn/ui)
                ├── Opis ostrzeżenia
                ├── Input do wpisania tekstu potwierdzenia
                ├── Alert z błędem (opcjonalnie)
                └── Przyciski Anuluj / Usuń konto
```

## 4. Szczegóły komponentów

### AccountSettings.tsx

**Opis komponentu**: Główny komponent widoku ustawień konta. Wyświetla informacje o koncie, przycisk wylogowania oraz sekcję usuwania konta. Zarządza stanem dialogu usuwania konta i obsługuje akcję wylogowania.

**Główne elementy**:
- Kontener główny (`<div className="space-y-6">`)
- Sekcja "Konto" (`<div className="space-y-4">`):
  - Nagłówek `<h2 className="text-2xl font-semibold">Konto</h2>`
  - Wyświetlenie e-maila: `<p className="text-sm font-medium text-muted-foreground">E-mail</p>` + `<p className="text-sm">{userEmail || "Ładowanie..."}</p>`
  - Przycisk wylogowania (`<Button>` z ikoną `LogOut` z lucide-react)
  - Alert z błędem wylogowania (`<Alert variant="destructive">`) - wyświetlany warunkowo
- Sekcja "Usuń konto" (`<div className="space-y-4 border-t pt-6">`):
  - Nagłówek `<h2 className="text-2xl font-semibold text-destructive">Usuń konto</h2>`
  - Alert z ostrzeżeniem (`<Alert variant="destructive">` z ikoną `AlertTriangle`)
  - Przycisk "Usuń konto" (`<Button variant="destructive">` z ikoną `Trash2`)
- Komponent `DeleteAccountDialog` (renderowany warunkowo)

**Obsługiwane zdarzenia**:
- `onClick` przycisku wylogowania → `handleLogout()`:
  - Ustawia `isLoggingOut = true`
  - Wywołuje `POST /api/auth/logout`
  - Przy sukcesie: `window.location.href = "/login"`
  - Przy błędzie: ustawia `logoutError` i resetuje `isLoggingOut`
- `onClick` przycisku "Usuń konto" → `handleDeleteClick()`:
  - Ustawia `isDeleteDialogOpen = true`
- `onClose` dialogu → `handleDeleteCancel()`:
  - Ustawia `isDeleteDialogOpen = false`

**Obsługiwana walidacja**:
- Brak walidacji po stronie komponentu (walidacja wylogowania po stronie API)
- Stan ładowania wylogowania: przycisk jest `disabled` gdy `isLoggingOut === true`

**Typy**:
- Props: `AccountSettingsProps`:
  ```typescript
  interface AccountSettingsProps {
    userEmail?: string;
  }
  ```
- Stan lokalny:
  - `isDeleteDialogOpen: boolean`
  - `isLoggingOut: boolean`
  - `logoutError: string | null`

**Props**:
- `userEmail?: string` - adres e-mail użytkownika przekazywany z Astro page

### DeleteAccountDialog.tsx

**Opis komponentu**: Dialog potwierdzenia usunięcia konta wymagający wpisania tekstu potwierdzenia "USUŃ" przed umożliwieniem usunięcia. Zapewnia dodatkową warstwę bezpieczeństwa przed przypadkowym usunięciem konta.

**Główne elementy**:
- `AlertDialog` (shadcn/ui):
  - `AlertDialogHeader`:
    - `AlertDialogTitle`: "Usuń konto"
    - `AlertDialogDescription`: opis nieodwracalności operacji
  - `Alert` z błędem (warunkowo, gdy `error !== null`)
  - Formularz potwierdzenia:
    - `Label`: "Aby potwierdzić, wpisz **USUŃ** poniżej:"
    - `Input` (id="confirm-delete", type="text", disabled podczas ładowania, className="uppercase")
  - `AlertDialogFooter`:
    - `AlertDialogCancel`: "Anuluj"
    - `AlertDialogAction` (variant="destructive"): "Usuń konto" (z loaderem podczas ładowania)

**Obsługiwane zdarzenia**:
- `onChange` inputa → `handleConfirmTextChange()`:
  - Aktualizuje `confirmText` z wartości inputa
  - Resetuje `error` na `null`
- `onClick` przycisku "Usuń konto" → `handleConfirm()`:
  - Sprawdza czy `confirmText === CONFIRM_TEXT` ("USUŃ")
  - Jeśli tak:
    - Ustawia `isLoading = true`
    - Wywołuje `DELETE /api/user/account` z `credentials: "include"`
    - Przy sukcesie (204): `window.location.href = "/login"`
    - Przy błędzie 401: ustawia `error = "Sesja wygasła. Zaloguj się ponownie."`
    - Przy innym błędzie: ustawia `error = "Wystąpił błąd podczas usuwania konta. Spróbuj ponownie później."`
    - Resetuje `isLoading = false`
- `onClick` przycisku "Anuluj" → `handleCancel()`:
  - Resetuje `confirmText = ""`
  - Resetuje `error = null`
  - Wywołuje `onClose()`
- `onOpenChange` dialogu → gdy `open === false`, wywołuje `handleCancel()`

**Obsługiwana walidacja**:
- Tekst potwierdzenia musi być dokładnie równy `CONFIRM_TEXT` ("USUŃ") - porównanie case-sensitive
- Przycisk "Usuń konto" jest `disabled` gdy:
  - `confirmText !== CONFIRM_TEXT` LUB
  - `isLoading === true`
- Input jest `disabled` gdy `isLoading === true`

**Typy**:
- Props: `DeleteAccountDialogProps`:
  ```typescript
  interface DeleteAccountDialogProps {
    isOpen: boolean;
    onClose: () => void;
  }
  ```
- Stała: `CONFIRM_TEXT = "USUŃ"` (string)
- Stan lokalny:
  - `confirmText: string`
  - `isLoading: boolean`
  - `error: string | null`

**Props**:
- `isOpen: boolean` - kontroluje widoczność dialogu
- `onClose: () => void` - callback wywoływany przy zamknięciu dialogu

## 5. Typy

### Typy komponentów (interfejsy props)

**AccountSettingsProps**:
```typescript
interface AccountSettingsProps {
  userEmail?: string;
}
```

**DeleteAccountDialogProps**:
```typescript
interface DeleteAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
}
```

### Typy odpowiedzi API

**DELETE /api/user/account**:
- **Sukces (204 No Content)**: Brak body w odpowiedzi
- **Błąd 401 Unauthorized**:
  ```typescript
  {
    error: "Unauthorized";
    message: "Authentication required";
  }
  ```
- **Błąd 500 Internal Server Error**:
  ```typescript
  {
    error: "Internal server error";
    message: "Failed to delete user account";
  }
  ```

**POST /api/auth/logout**:
- **Sukces (200 OK)**: Brak body w odpowiedzi (lub puste JSON)
- **Błąd**: Różne kody statusu z komunikatem błędu

### Typy stanu lokalnego

**AccountSettings.tsx**:
- `isDeleteDialogOpen: boolean` - stan otwarcia dialogu usuwania konta
- `isLoggingOut: boolean` - stan ładowania podczas wylogowania
- `logoutError: string | null` - komunikat błędu wylogowania

**DeleteAccountDialog.tsx**:
- `confirmText: string` - tekst wpisany przez użytkownika do potwierdzenia
- `isLoading: boolean` - stan ładowania podczas usuwania konta
- `error: string | null` - komunikat błędu usuwania konta

## 6. Zarządzanie stanem

Widok używa wyłącznie lokalnego stanu React (useState) w komponentach. Nie wymaga globalnego zarządzania stanem ani niestandardowych hooków.

**AccountSettings.tsx**:
- `useState` dla `isDeleteDialogOpen`, `isLoggingOut`, `logoutError`
- Stan jest lokalny dla komponentu i nie jest współdzielony z innymi komponentami

**DeleteAccountDialog.tsx**:
- `useState` dla `confirmText`, `isLoading`, `error`
- Stan jest lokalny dla dialogu i resetowany przy zamknięciu

**Brak potrzeby custom hooków**: Operacje są proste i nie wymagają logiki wielokrotnego użytku. Wszystkie wywołania API są bezpośrednio w handlerach zdarzeń.

## 7. Integracja API

### DELETE /api/user/account

**Endpoint**: `/api/user/account`

**Metoda**: `DELETE`

**Autoryzacja**: 
- Wymagana sesja użytkownika (cookie/header)
- Endpoint weryfikuje autoryzację przez `supabase.auth.getUser()` w middleware/endpoint

**Request**:
- Brak body
- Headers: `Content-Type: application/json`
- `credentials: "include"` (wymagane dla cookie-based session)

**Response - Sukces (204 No Content)**:
- Brak body
- Po sukcesie: redirect do `/login` + toast (opcjonalnie, można dodać)

**Response - Błąd 401 Unauthorized**:
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```
- Obsługa: wyświetlenie komunikatu "Sesja wygasła. Zaloguj się ponownie." + możliwość redirect do `/login`

**Response - Błąd 500 Internal Server Error**:
```json
{
  "error": "Internal server error",
  "message": "Failed to delete user account"
}
```
- Obsługa: wyświetlenie komunikatu "Wystąpił błąd podczas usuwania konta. Spróbuj ponownie później."

**Implementacja w DeleteAccountDialog.tsx**:
```typescript
const response = await fetch("/api/user/account", {
  method: "DELETE",
  headers: {
    "Content-Type": "application/json",
  },
  credentials: "include",
});
```

### POST /api/auth/logout

**Endpoint**: `/api/auth/logout`

**Metoda**: `POST`

**Autoryzacja**: 
- Wymagana sesja użytkownika

**Request**:
- Body: puste lub `{}`
- Headers: `Content-Type: application/json`

**Response - Sukces (200 OK)**:
- Brak body lub puste JSON
- Po sukcesie: `window.location.href = "/login"`

**Response - Błąd**:
- Różne kody statusu z komunikatem błędu
- Obsługa: wyświetlenie komunikatu błędu, ale nadal redirect do `/login` (sesja może być już nieważna)

**Implementacja w AccountSettings.tsx**:
```typescript
const response = await fetch("/api/auth/logout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
});
```

## 8. Interakcje użytkownika

### Interakcja 1: Wylogowanie

**Kroki użytkownika**:
1. Użytkownik klika przycisk "Wyloguj" w sekcji "Konto"
2. Przycisk pokazuje stan ładowania (ikona spinner + tekst "Wylogowywanie...")
3. Wywoływane jest `POST /api/auth/logout`
4. Przy sukcesie: użytkownik jest przekierowany do `/login`
5. Przy błędzie: wyświetlany jest Alert z komunikatem błędu, przycisk wraca do normalnego stanu

**Oczekiwany wynik**: Użytkownik jest wylogowany i przekierowany do strony logowania. Sesja jest usunięta.

### Interakcja 2: Otwarcie dialogu usuwania konta

**Kroki użytkownika**:
1. Użytkownik klika przycisk "Usuń konto" w sekcji "Usuń konto"
2. Otwiera się `AlertDialog` z ostrzeżeniem
3. Dialog wyświetla opis nieodwracalności operacji
4. Input do wpisania tekstu potwierdzenia jest pusty i gotowy do użycia
5. Przycisk "Usuń konto" w dialogu jest disabled (wymaga wpisania "USUŃ")

**Oczekiwany wynik**: Dialog jest otwarty, użytkownik widzi ostrzeżenie i pole do wpisania potwierdzenia.

### Interakcja 3: Wpisanie tekstu potwierdzenia

**Kroki użytkownika**:
1. Użytkownik wpisuje tekst w input "confirm-delete"
2. Tekst jest automatycznie konwertowany na uppercase (przez className="uppercase")
3. Gdy tekst jest równy "USUŃ", przycisk "Usuń konto" staje się enabled
4. Gdy tekst jest inny, przycisk pozostaje disabled

**Oczekiwany wynik**: Przycisk "Usuń konto" jest enabled tylko gdy tekst potwierdzenia jest dokładnie "USUŃ".

### Interakcja 4: Potwierdzenie usunięcia konta

**Kroki użytkownika**:
1. Użytkownik wpisuje "USUŃ" w input
2. Użytkownik klika przycisk "Usuń konto" w dialogu
3. Przycisk pokazuje stan ładowania (ikona spinner + tekst "Usuwanie...")
4. Input i przyciski są disabled
5. Wywoływane jest `DELETE /api/user/account`
6. Przy sukcesie (204): użytkownik jest przekierowany do `/login`
7. Przy błędzie 401: wyświetlany jest Alert z komunikatem "Sesja wygasła. Zaloguj się ponownie.", stan ładowania jest resetowany
8. Przy innym błędzie: wyświetlany jest Alert z komunikatem błędu, stan ładowania jest resetowany

**Oczekiwany wynik**: Konto użytkownika jest trwale usunięte, użytkownik jest przekierowany do strony logowania. Wszystkie dane użytkownika (profile, user_authors, user_works, manual authors/works/editions) są usunięte przez cascade.

### Interakcja 5: Anulowanie usuwania konta

**Kroki użytkownika**:
1. Użytkownik klika przycisk "Anuluj" w dialogu LUB klika poza dialogiem LUB naciska ESC
2. Dialog się zamyka
3. Stan `confirmText` jest resetowany do pustego stringa
4. Stan `error` jest resetowany do `null`

**Oczekiwany wynik**: Dialog jest zamknięty, stan jest zresetowany. Użytkownik pozostaje na stronie ustawień.

## 9. Warunki i walidacja

### Warunek 1: Autoryzacja użytkownika

**Warunek**: Użytkownik musi być zalogowany, aby uzyskać dostęp do `/app/settings`

**Weryfikacja**: 
- Middleware (`src/middleware/index.ts`) sprawdza `supabase.auth.getUser()`
- Jeśli brak sesji → redirect do `/login?redirect_to=/app/settings`

**Komponent**: Middleware

**Wpływ na UI**: 
- Jeśli użytkownik nie jest zalogowany, nie zobaczy widoku ustawień (zostanie przekierowany)
- Jeśli użytkownik jest zalogowany, `Astro.locals.user.email` jest dostępny i przekazywany do `AccountSettings`

### Warunek 2: Walidacja tekstu potwierdzenia

**Warunek**: Tekst wpisany przez użytkownika musi być dokładnie równy "USUŃ" (case-sensitive)

**Weryfikacja**: 
- W `DeleteAccountDialog.tsx`: `confirmText === CONFIRM_TEXT`
- Input ma `className="uppercase"` dla lepszego UX (automatyczna konwersja na uppercase)

**Komponent**: `DeleteAccountDialog.tsx`

**Wpływ na UI**: 
- Przycisk "Usuń konto" w dialogu jest `disabled` gdy `confirmText !== CONFIRM_TEXT`
- Przycisk jest `enabled` tylko gdy tekst jest dokładnie "USUŃ"

### Warunek 3: Stan ładowania podczas operacji

**Warunek**: Podczas wykonywania operacji (wylogowanie, usuwanie konta) UI powinien być w stanie ładowania

**Weryfikacja**: 
- `isLoggingOut === true` dla wylogowania
- `isLoading === true` dla usuwania konta

**Komponent**: `AccountSettings.tsx`, `DeleteAccountDialog.tsx`

**Wpływ na UI**: 
- Przyciski są `disabled` podczas ładowania
- Przyciski pokazują ikonę spinnera i tekst "Wylogowywanie..." / "Usuwanie..."
- Input w dialogu jest `disabled` podczas ładowania

### Warunek 4: Sesja użytkownika podczas usuwania konta

**Warunek**: Sesja użytkownika musi być ważna podczas wywołania `DELETE /api/user/account`

**Weryfikacja**: 
- Endpoint weryfikuje autoryzację przez `supabase.auth.getUser()`
- Jeśli brak sesji → zwraca 401

**Komponent**: `DeleteAccountDialog.tsx` (obsługa błędu 401)

**Wpływ na UI**: 
- Przy błędzie 401: wyświetlany jest Alert z komunikatem "Sesja wygasła. Zaloguj się ponownie."
- Użytkownik może zostać przekierowany do `/login` (opcjonalnie)

## 10. Obsługa błędów

### Błąd 1: Błąd wylogowania (POST /api/auth/logout)

**Scenariusz**: Wywołanie `POST /api/auth/logout` zwraca błąd (status !== 200)

**Obsługa**:
- Ustawienie `logoutError` na komunikat: "Wystąpił błąd podczas wylogowania. Spróbuj ponownie."
- Resetowanie `isLoggingOut = false`
- Wyświetlenie Alert z błędem pod przyciskiem wylogowania
- **Uwaga**: Nawet przy błędzie można rozważyć redirect do `/login` (sesja może być już nieważna)

**Komponent**: `AccountSettings.tsx`

**Komunikat dla użytkownika**: "Wystąpił błąd podczas wylogowania. Spróbuj ponownie."

### Błąd 2: Błąd 401 podczas usuwania konta

**Scenariusz**: Wywołanie `DELETE /api/user/account` zwraca 401 Unauthorized (sesja wygasła)

**Obsługa**:
- Ustawienie `error` na komunikat: "Sesja wygasła. Zaloguj się ponownie."
- Resetowanie `isLoading = false`
- Wyświetlenie Alert z błędem w dialogu
- Opcjonalnie: redirect do `/login` (można dodać po wyświetleniu komunikatu)

**Komponent**: `DeleteAccountDialog.tsx`

**Komunikat dla użytkownika**: "Sesja wygasła. Zaloguj się ponownie."

### Błąd 3: Błąd 500 podczas usuwania konta

**Scenariusz**: Wywołanie `DELETE /api/user/account` zwraca 500 Internal Server Error (błąd serwera)

**Obsługa**:
- Ustawienie `error` na komunikat: "Wystąpił błąd podczas usuwania konta. Spróbuj ponownie później."
- Resetowanie `isLoading = false`
- Wyświetlenie Alert z błędem w dialogu
- Dialog pozostaje otwarty, użytkownik może spróbować ponownie

**Komponent**: `DeleteAccountDialog.tsx`

**Komunikat dla użytkownika**: "Wystąpił błąd podczas usuwania konta. Spróbuj ponownie później."

### Błąd 4: Błąd sieciowy podczas operacji

**Scenariusz**: Wywołanie API rzuca wyjątek (np. brak połączenia sieciowego)

**Obsługa**:
- W `catch` block: ustawienie odpowiedniego komunikatu błędu
- Resetowanie stanu ładowania
- Wyświetlenie Alert z błędem

**Komponenty**: `AccountSettings.tsx`, `DeleteAccountDialog.tsx`

**Komunikat dla użytkownika**: "Wystąpił błąd podczas [operacji]. Spróbuj ponownie [później]."

### Błąd 5: Nieprawidłowy tekst potwierdzenia

**Scenariusz**: Użytkownik próbuje kliknąć "Usuń konto" gdy tekst potwierdzenia nie jest równy "USUŃ"

**Obsługa**:
- Przycisk "Usuń konto" jest `disabled` gdy `confirmText !== CONFIRM_TEXT`
- Brak możliwości kliknięcia przycisku (walidacja przez `disabled` attribute)
- Brak potrzeby wyświetlania komunikatu błędu (przycisk jest wizualnie disabled)

**Komponent**: `DeleteAccountDialog.tsx`

**Komunikat dla użytkownika**: Brak (przycisk jest disabled, więc użytkownik nie może go kliknąć)

## 11. Kroki implementacji

### Krok 1: Weryfikacja istniejących komponentów

1. Sprawdź czy komponenty `AccountSettings.tsx` i `DeleteAccountDialog.tsx` już istnieją w `src/components/auth/`
2. Jeśli istnieją, zweryfikuj czy są zgodne z planem (szczególnie obsługa błędów i integracja z API)
3. Jeśli nie istnieją lub wymagają modyfikacji, przejdź do następnych kroków

### Krok 2: Implementacja/aktualizacja AccountSettings.tsx

1. Utwórz lub zaktualizuj plik `src/components/auth/AccountSettings.tsx`
2. Zaimportuj wymagane komponenty:
   - `Button` z `@/components/ui/button`
   - `Alert`, `AlertDescription` z `@/components/ui/alert`
   - `DeleteAccountDialog` z `./DeleteAccountDialog`
   - Ikony: `LogOut`, `Trash2`, `AlertTriangle`, `Loader2` z `lucide-react`
3. Zdefiniuj interfejs `AccountSettingsProps` z polem `userEmail?: string`
4. Zaimplementuj komponent z trzema stanami: `isDeleteDialogOpen`, `isLoggingOut`, `logoutError`
5. Zaimplementuj handler `handleLogout`:
   - Ustaw `isLoggingOut = true`, `logoutError = null`
   - Wywołaj `POST /api/auth/logout`
   - Przy sukcesie: `window.location.href = "/login"`
   - Przy błędzie: ustaw `logoutError` i resetuj `isLoggingOut`
6. Zaimplementuj handler `handleDeleteClick` (ustawia `isDeleteDialogOpen = true`)
7. Zaimplementuj handler `handleDeleteCancel` (ustawia `isDeleteDialogOpen = false`)
8. Zaimplementuj JSX:
   - Sekcja "Konto" z e-mailem, przyciskiem wylogowania i Alert z błędem (warunkowo)
   - Sekcja "Usuń konto" z nagłówkiem, Alert z ostrzeżeniem, przyciskiem i `DeleteAccountDialog`
9. Dodaj odpowiednie klasy Tailwind dla layoutu i stylów

### Krok 3: Implementacja/aktualizacja DeleteAccountDialog.tsx

1. Utwórz lub zaktualizuj plik `src/components/auth/DeleteAccountDialog.tsx`
2. Zaimportuj wymagane komponenty:
   - `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` z `@/components/ui/alert-dialog`
   - `Input` z `@/components/ui/input`
   - `Label` z `@/components/ui/label`
   - `Alert`, `AlertDescription` z `@/components/ui/alert`
   - Ikony: `AlertCircle`, `Loader2` z `lucide-react`
3. Zdefiniuj stałą `CONFIRM_TEXT = "USUŃ"`
4. Zdefiniuj interfejs `DeleteAccountDialogProps` z polami `isOpen: boolean`, `onClose: () => void`
5. Zaimplementuj komponent z trzema stanami: `confirmText`, `isLoading`, `error`
6. Zaimplementuj handler `handleConfirmTextChange` (aktualizuje `confirmText` i resetuje `error`)
7. Zaimplementuj handler `handleConfirm`:
   - Sprawdź czy `confirmText === CONFIRM_TEXT`
   - Jeśli tak: ustaw `isLoading = true`, `error = null`
   - Wywołaj `DELETE /api/user/account` z `credentials: "include"`
   - Przy sukcesie (204): `window.location.href = "/login"`
   - Przy błędzie 401: ustaw `error = "Sesja wygasła. Zaloguj się ponownie."`
   - Przy innym błędzie: ustaw `error = "Wystąpił błąd podczas usuwania konta. Spróbuj ponownie później."`
   - Resetuj `isLoading = false`
8. Zaimplementuj handler `handleCancel` (resetuje `confirmText`, `error` i wywołuje `onClose()`)
9. Zaimplementuj JSX:
   - `AlertDialog` z `open={isOpen}` i `onOpenChange`
   - `AlertDialogHeader` z tytułem i opisem
   - `Alert` z błędem (warunkowo, gdy `error !== null`)
   - Formularz z `Label` i `Input` (id="confirm-delete", className="uppercase")
   - `AlertDialogFooter` z przyciskami Anuluj i Usuń konto
10. Ustaw `disabled` dla przycisku "Usuń konto" gdy `confirmText !== CONFIRM_TEXT || isLoading`
11. Dodaj odpowiednie klasy Tailwind dla layoutu i stylów

### Krok 4: Weryfikacja strony settings.astro

1. Sprawdź czy plik `src/pages/app/settings.astro` istnieje
2. Jeśli istnieje, zweryfikuj czy:
   - Importuje `AppLayout` z `@/layouts/AppLayout.astro`
   - Importuje `AccountSettings` z `@/components/auth/AccountSettings`
   - Pobiera `userEmail` z `Astro.locals.user?.email`
   - Renderuje `AppLayout` z tytułem "Ustawienia - BookFlow"
   - Renderuje `AccountSettings` z propem `userEmail` i `client:load`
3. Jeśli nie istnieje lub wymaga modyfikacji, utwórz/zaktualizuj zgodnie z powyższymi wymaganiami

### Krok 5: Testowanie wylogowania

1. Uruchom aplikację w trybie deweloperskim
2. Zaloguj się jako użytkownik
3. Przejdź do `/app/settings`
4. Sprawdź czy e-mail użytkownika jest wyświetlony
5. Kliknij przycisk "Wyloguj"
6. Sprawdź czy:
   - Przycisk pokazuje stan ładowania
   - Po sukcesie następuje redirect do `/login`
   - Po błędzie wyświetla się Alert z komunikatem błędu

### Krok 6: Testowanie usuwania konta

1. Zaloguj się jako użytkownik testowy (można użyć konta, które można usunąć)
2. Przejdź do `/app/settings`
3. Kliknij przycisk "Usuń konto"
4. Sprawdź czy:
   - Dialog się otwiera
   - Przycisk "Usuń konto" w dialogu jest disabled
   - Input jest pusty
5. Wpisz tekst różny od "USUŃ" (np. "usun")
6. Sprawdź czy przycisk "Usuń konto" pozostaje disabled
7. Wpisz "USUŃ" w input
8. Sprawdź czy przycisk "Usuń konto" staje się enabled
9. Kliknij "Anuluj" i sprawdź czy dialog się zamyka i stan jest resetowany
10. Otwórz dialog ponownie, wpisz "USUŃ" i kliknij "Usuń konto"
11. Sprawdź czy:
    - Przycisk pokazuje stan ładowania
    - Po sukcesie (204) następuje redirect do `/login`
    - Konto jest usunięte (nie można się zalogować tym kontem)

### Krok 7: Testowanie obsługi błędów

1. **Test błędu 401**:
   - Symuluj wygaśnięcie sesji (można ręcznie wyczyścić cookies)
   - Spróbuj usunąć konto
   - Sprawdź czy wyświetla się komunikat "Sesja wygasła. Zaloguj się ponownie."

2. **Test błędu 500**:
   - Symuluj błąd serwera (można tymczasowo zmodyfikować endpoint)
   - Spróbuj usunąć konto
   - Sprawdź czy wyświetla się komunikat "Wystąpił błąd podczas usuwania konta. Spróbuj ponownie później."

3. **Test błędu sieciowego**:
   - Odłącz internet
   - Spróbuj wylogować się lub usunąć konto
   - Sprawdź czy wyświetla się odpowiedni komunikat błędu

### Krok 8: Weryfikacja dostępności (a11y)

1. Sprawdź czy wszystkie interaktywne elementy mają odpowiednie `aria-label` lub tekst widoczny
2. Sprawdź czy dialog ma odpowiednie role ARIA (shadcn/ui AlertDialog powinien to zapewniać)
3. Sprawdź czy komunikaty błędów są dostępne dla czytników ekranu (użycie `Alert` z `AlertDescription`)
4. Sprawdź czy focus jest prawidłowo zarządzany (shadcn/ui AlertDialog powinien to zapewniać)
5. Sprawdź czy klawiatura działa prawidłowo (ESC zamyka dialog, Tab przechodzi między elementami)

### Krok 9: Weryfikacja responsywności

1. Sprawdź widok na różnych rozmiarach ekranu (mobile, tablet, desktop)
2. Sprawdź czy dialog jest responsywny (shadcn/ui AlertDialog powinien być responsywny)
3. Sprawdź czy przyciski mają odpowiednie klasy dla responsywności (np. `w-full sm:w-auto`)

### Krok 10: Dodanie toastów (opcjonalnie)

1. Jeśli wymagane, dodaj toast po sukcesie usunięcia konta (przed redirect):
   ```typescript
   import { toast } from "sonner";
   // W handleConfirm, przed redirect:
   toast.success("Konto zostało usunięte");
   ```
2. Toast może być wyświetlony tylko przez bardzo krótki moment przed redirect, więc może nie być widoczny - rozważ czy jest potrzebny

### Krok 11: Finalna weryfikacja zgodności z PRD

1. Sprawdź czy widok realizuje US-002 (wylogowanie):
   - ✅ Przycisk wylogowania jest dostępny
   - ✅ Wylogowanie usuwa sesję
   - ✅ Po wylogowaniu następuje redirect do `/login`

2. Sprawdź czy widok realizuje US-003 (usunięcie konta):
   - ✅ Dialog potwierdzenia wymaga wpisania "USUŃ"
   - ✅ Po potwierdzeniu konto i dane są usuwane
   - ✅ Po usunięciu następuje redirect do `/login`
   - ✅ Sesja wygasa po usunięciu konta

3. Sprawdź czy widok spełnia wymagania bezpieczeństwa:
   - ✅ Usuwanie konta tylko przez `DELETE /api/user/account` (nie bezpośrednio Supabase Admin API)
   - ✅ Wymagane potwierdzenie przed usunięciem
   - ✅ Obsługa błędów 401 (sesja wygasła)

### Krok 12: Dokumentacja i komentarze

1. Dodaj komentarze JSDoc do komponentów i funkcji
2. Upewnij się, że komentarze wyjaśniają logikę biznesową (np. dlaczego wymagamy wpisania "USUŃ")
3. Dodaj komentarze do obsługi błędów wyjaśniające różne scenariusze

