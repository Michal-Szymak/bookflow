# Specyfikacja architektury modułu autentykacji - BookFlow

## 1. Przegląd

Niniejszy dokument opisuje szczegółową architekturę modułu rejestracji, logowania, odzyskiwania hasła i usuwania konta dla aplikacji BookFlow, zgodnie z wymaganiami US-001, US-002 i US-003 z PRD.

### 1.1. Zakres funkcjonalności

- **US-001**: Rejestracja e-mail/hasło
- **US-002**: Logowanie i wylogowanie
- **US-003**: Usunięcie konta i danych
- **Dodatkowo**: Odzyskiwanie hasła (wymagane przez Supabase Auth)

### 1.2. Ograniczenia

- Brak SSO/Legimi (tylko e-mail + hasło)
- Brak powiadomień e-mail w MVP (opcjonalnie można włączyć w Supabase)
- Brak weryfikacji e-mail w MVP (można włączyć w konfiguracji Supabase)

### 1.3. Technologie

- **Frontend**: Astro 5 (SSR), React 19 (komponenty interaktywne), TypeScript 5, Tailwind 4, Shadcn/ui
- **Backend**: Supabase Auth (autentykacja), Astro API Routes (endpointy)
- **Middleware**: Astro middleware (ochrona tras, zarządzanie sesją)

---

## 2. ARCHITEKTURA INTERFEJSU UŻYTKOWNIKA

### 2.1. Struktura stron i routingu

#### 2.1.1. Strony publiczne (non-auth)

**`/src/pages/login.astro`**
- **Cel**: Strona logowania użytkownika
- **Typ**: Astro page (SSR)
- **Layout**: `Layout.astro` z modyfikacją dla trybu auth (uproszczony header/footer)
- **Komponenty React**:
  - `LoginForm` (client:load) - formularz logowania z walidacją
- **Logika**:
  - Jeśli użytkownik jest już zalogowany (sprawdzenie w middleware), redirect do `/app/authors`
  - Po udanym logowaniu, redirect do `/app/authors` lub URL z parametru `redirect_to`
- **Stylowanie**: Tailwind 4, komponenty Shadcn/ui (Input, Button, Label, Alert)

**`/src/pages/register.astro`**
- **Cel**: Strona rejestracji nowego użytkownika
- **Typ**: Astro page (SSR)
- **Layout**: `Layout.astro` z modyfikacją dla trybu auth
- **Komponenty React**:
  - `RegisterForm` (client:load) - formularz rejestracji z walidacją
- **Logika**:
  - Jeśli użytkownik jest już zalogowany, redirect do `/app/authors`
  - Po udanej rejestracji, automatyczne logowanie i redirect do `/app/authors`
- **Stylowanie**: Tailwind 4, komponenty Shadcn/ui

**`/src/pages/forgot-password.astro`**
- **Cel**: Strona inicjacji odzyskiwania hasła
- **Typ**: Astro page (SSR)
- **Layout**: `Layout.astro` z modyfikacją dla trybu auth
- **Komponenty React**:
  - `ForgotPasswordForm` (client:load) - formularz z polem e-mail
- **Logika**:
  - Wysyłka e-maila z linkiem resetu przez Supabase Auth
  - Komunikat sukcesu po wysłaniu (nawet jeśli e-mail nie istnieje - bezpieczeństwo)
- **Stylowanie**: Tailwind 4, komponenty Shadcn/ui

**`/src/pages/reset-password.astro`**
- **Cel**: Strona resetu hasła (dostępna przez link z e-maila)
- **Typ**: Astro page (SSR)
- **Layout**: `Layout.astro` z modyfikacją dla trybu auth
- **Komponenty React**:
  - `ResetPasswordForm` (client:load) - formularz z polami: hasło, potwierdzenie hasła
- **Logika**:
  - Walidacja tokenu z URL (`?token=...&type=recovery`)
  - Po udanym resecie, automatyczne logowanie i redirect do `/app/authors`
- **Stylowanie**: Tailwind 4, komponenty Shadcn/ui

**`/src/pages/index.astro`**
- **Cel**: Strona główna (landing page)
- **Modyfikacja**: 
  - Jeśli użytkownik zalogowany → redirect do `/app/authors`
  - Jeśli nie zalogowany → wyświetlenie strony powitalnej z linkami do logowania/rejestracji
- **Komponenty**: `Welcome.astro` (można rozszerzyć o CTA do rejestracji)

#### 2.1.2. Strony chronione (auth-required)

**`/src/pages/app/*.astro`** (wszystkie strony w `/app`)
- **Ochrona**: Middleware sprawdza autentykację przed renderowaniem
- **Logika**: Jeśli brak sesji → redirect do `/login?redirect_to=/app/...`
- **Przykład**: `/src/pages/app/authors.astro` (już istnieje, wymaga aktualizacji)

**`/src/pages/app/settings.astro`**
- **Cel**: Strona ustawień konta użytkownika
- **Typ**: Astro page (SSR)
- **Layout**: `Layout.astro`
- **Komponenty React**:
  - `AccountSettings` (client:load) - sekcja zarządzania kontem
  - `DeleteAccountDialog` (client:load) - dialog potwierdzenia usunięcia konta
- **Logika**:
  - Wyświetlenie informacji o koncie
  - Przycisk wylogowania
  - Sekcja usuwania konta z dialogiem potwierdzenia
- **Stylowanie**: Tailwind 4, komponenty Shadcn/ui

### 2.2. Komponenty React (client-side)

#### 2.2.1. `LoginForm` (`/src/components/auth/LoginForm.tsx`)

**Odpowiedzialność**:
- Renderowanie formularza logowania
- Walidacja pól (e-mail, hasło)
- Wywołanie API `/api/auth/login`
- Obsługa błędów i komunikatów
- Przekierowanie po sukcesie

**Stan komponentu**:
- `email: string` - wartość pola e-mail
- `password: string` - wartość pola hasło
- `isLoading: boolean` - stan ładowania podczas żądania
- `error: string | null` - komunikat błędu
- `showPassword: boolean` - widoczność hasła (opcjonalnie)

**Walidacja**:
- E-mail: format e-mail (regex lub HTML5 validation)
- Hasło: minimum 6 znaków (zgodnie z wymaganiami Supabase)
- Walidacja po stronie klienta przed wysłaniem żądania

**Akcje**:
- `handleSubmit(e: FormEvent)` - obsługa submit formularza
- `handleEmailChange(e: ChangeEvent)` - aktualizacja stanu e-mail
- `handlePasswordChange(e: ChangeEvent)` - aktualizacja stanu hasło
- `handleTogglePassword()` - przełączanie widoczności hasła

**Integracja z API**:
```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
```

**Obsługa błędów**:
- 400: Błędne dane (wyświetlenie komunikatu walidacji)
- 401: Nieprawidłowe dane logowania (komunikat: "Nieprawidłowy e-mail lub hasło")
- 500: Błąd serwera (komunikat: "Wystąpił błąd. Spróbuj ponownie później.")

**UI**:
- Użycie komponentów Shadcn/ui: `Input`, `Button`, `Label`, `Alert`
- Link do `/forgot-password` pod formularzem
- Link do `/register` pod formularzem ("Nie masz konta? Zarejestruj się")

#### 2.2.2. `RegisterForm` (`/src/components/auth/RegisterForm.tsx`)

**Odpowiedzialność**:
- Renderowanie formularza rejestracji
- Walidacja pól (e-mail, hasło, potwierdzenie hasła)
- Wywołanie API `/api/auth/register`
- Obsługa błędów i komunikatów
- Przekierowanie po sukcesie

**Stan komponentu**:
- `email: string`
- `password: string`
- `confirmPassword: string`
- `isLoading: boolean`
- `error: string | null`
- `showPassword: boolean`
- `showConfirmPassword: boolean`

**Walidacja**:
- E-mail: format e-mail
- Hasło: minimum 6 znaków
- Potwierdzenie hasła: musi być identyczne z hasłem
- Walidacja w czasie rzeczywistym (onChange) i przy submit

**Akcje**:
- `handleSubmit(e: FormEvent)`
- `handleEmailChange(e: ChangeEvent)`
- `handlePasswordChange(e: ChangeEvent)`
- `handleConfirmPasswordChange(e: ChangeEvent)`
- `handleTogglePassword()`
- `handleToggleConfirmPassword()`

**Integracja z API**:
```typescript
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
```

**Obsługa błędów**:
- 400: Błędne dane (walidacja)
- 409: Konto już istnieje (komunikat: "Konto z tym e-mailem już istnieje")
- 500: Błąd serwera

**UI**:
- Komponenty Shadcn/ui
- Link do `/login` pod formularzem ("Masz już konto? Zaloguj się")
- Komunikat o wymaganiach hasła (minimum 6 znaków)

#### 2.2.3. `ForgotPasswordForm` (`/src/components/auth/ForgotPasswordForm.tsx`)

**Odpowiedzialność**:
- Renderowanie formularza z polem e-mail
- Wywołanie API `/api/auth/forgot-password`
- Wyświetlenie komunikatu sukcesu (nawet jeśli e-mail nie istnieje)

**Stan komponentu**:
- `email: string`
- `isLoading: boolean`
- `isSuccess: boolean` - czy e-mail został wysłany
- `error: string | null`

**Walidacja**:
- E-mail: format e-mail

**Akcje**:
- `handleSubmit(e: FormEvent)`
- `handleEmailChange(e: ChangeEvent)`

**Integracja z API**:
```typescript
const response = await fetch('/api/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email })
});
```

**Obsługa błędów**:
- 400: Błędny format e-mail
- 500: Błąd serwera
- **Uwaga**: Zawsze wyświetlamy komunikat sukcesu (bezpieczeństwo)

**UI**:
- Po sukcesie: komunikat "Jeśli konto z tym e-mailem istnieje, otrzymasz link do resetu hasła"
- Link do `/login` pod formularzem

#### 2.2.4. `ResetPasswordForm` (`/src/components/auth/ResetPasswordForm.tsx`)

**Odpowiedzialność**:
- Renderowanie formularza resetu hasła
- Walidacja tokenu z URL
- Wywołanie API `/api/auth/reset-password`
- Przekierowanie po sukcesie

**Stan komponentu**:
- `password: string`
- `confirmPassword: string`
- `isLoading: boolean`
- `error: string | null`
- `showPassword: boolean`
- `showConfirmPassword: boolean`
- `token: string | null` - token z URL

**Walidacja**:
- Hasło: minimum 6 znaków
- Potwierdzenie hasła: musi być identyczne
- Token: musi być obecny w URL

**Akcje**:
- `handleSubmit(e: FormEvent)`
- `handlePasswordChange(e: ChangeEvent)`
- `handleConfirmPasswordChange(e: ChangeEvent)`
- `handleTogglePassword()`
- `handleToggleConfirmPassword()`

**Integracja z API**:
```typescript
const response = await fetch('/api/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token, password })
});
```

**Obsługa błędów**:
- 400: Błędne dane lub nieprawidłowy token
- 401: Token wygasł lub jest nieprawidłowy
- 500: Błąd serwera

**UI**:
- Komponenty Shadcn/ui
- Link do `/login` pod formularzem

#### 2.2.5. `DeleteAccountDialog` (`/src/components/auth/DeleteAccountDialog.tsx`)

**Odpowiedzialność**:
- Renderowanie dialogu potwierdzenia usunięcia konta
- Wywołanie API `/api/user/account` (DELETE)
- Obsługa błędów i komunikatów
- Przekierowanie po sukcesie

**Stan komponentu**:
- `isOpen: boolean` - czy dialog jest otwarty
- `isLoading: boolean` - stan ładowania podczas żądania
- `error: string | null` - komunikat błędu
- `confirmText: string` - tekst potwierdzenia (np. "USUŃ" dla walidacji)

**Walidacja**:
- Wymagane wpisanie tekstu potwierdzenia (np. "USUŃ") przed aktywacją przycisku
- Ostrzeżenie o nieodwracalności operacji

**Akcje**:
- `handleConfirm()` - obsługa potwierdzenia i wywołanie API
- `handleCancel()` - zamknięcie dialogu
- `handleConfirmTextChange(e: ChangeEvent)` - aktualizacja tekstu potwierdzenia

**Integracja z API**:
```typescript
const response = await fetch('/api/user/account', {
  method: 'DELETE',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
});
```

**Obsługa błędów**:
- 401: Brak autoryzacji (komunikat: "Sesja wygasła. Zaloguj się ponownie.")
- 500: Błąd serwera (komunikat: "Wystąpił błąd podczas usuwania konta. Spróbuj ponownie później.")

**UI**:
- Użycie komponentów Shadcn/ui: `AlertDialog`, `Button`, `Alert`
- Ostrzeżenie o nieodwracalności operacji
- Pole tekstowe do wpisania tekstu potwierdzenia
- Przycisk "Anuluj" i "Usuń konto" (aktywny tylko po wpisaniu tekstu potwierdzenia)

#### 2.2.6. `AccountSettings` (`/src/components/auth/AccountSettings.tsx`)

**Odpowiedzialność**:
- Renderowanie sekcji ustawień konta
- Wyświetlenie informacji o koncie (e-mail)
- Przycisk wylogowania
- Sekcja usuwania konta z przyciskiem otwierającym dialog

**Stan komponentu**:
- `user: User | null` - dane użytkownika
- `isDeleteDialogOpen: boolean` - stan dialogu usuwania konta
- `isLoggingOut: boolean` - stan podczas wylogowania

**Akcje**:
- `handleLogout()` - wywołanie `/api/auth/logout` i przekierowanie
- `handleDeleteClick()` - otwarcie dialogu usuwania konta
- `handleDeleteConfirm()` - obsługa potwierdzenia usunięcia (przekazana do dialogu)
- `handleDeleteCancel()` - zamknięcie dialogu

**UI**:
- Sekcja "Konto" z e-mailem użytkownika
- Przycisk "Wyloguj"
- Sekcja "Usuń konto" z ostrzeżeniem i przyciskiem otwierającym dialog

#### 2.2.7. `AuthLayout` (`/src/components/auth/AuthLayout.tsx`) - opcjonalnie

**Odpowiedzialność**:
- Wspólny layout dla stron autentykacji (centrowanie, styling)
- Można użyć zamiast modyfikacji `Layout.astro`

**Props**:
- `title: string` - tytuł strony
- `children: ReactNode` - zawartość formularza

### 2.3. Layouty Astro

#### 2.3.1. `Layout.astro` - rozszerzenie

**Modyfikacje**:
- Dodanie warunkowego renderowania dla trybu auth
- Props: `authMode?: boolean` - czy strona jest w trybie autentykacji
- W trybie auth: uproszczony header/footer lub brak nawigacji

**Przykład**:
```astro
---
interface Props {
  title?: string;
  authMode?: boolean;
}

const { title = "BookFlow", authMode = false } = Astro.props;
---

<!doctype html>
<html lang="pl">
  <head>
    <!-- ... -->
  </head>
  <body>
    {!authMode && <Header />}
    <slot />
    {!authMode && <Footer />}
  </body>
</html>
```

#### 2.3.2. `AppLayout.astro` (nowy, opcjonalnie)

**Cel**: Layout dla stron w `/app/*` z nawigacją i headerem użytkownika

**Zawartość**:
- Header z nawigacją (Autorzy, Książki, Ustawienia)
- Menu użytkownika (dropdown z opcją wylogowania)
- Breadcrumbs (opcjonalnie)

**Komponenty React**:
- `UserMenu` (client:load) - menu użytkownika z opcją wylogowania i linkiem do ustawień

### 2.4. Komponenty pomocnicze

#### 2.4.1. `PasswordInput` (`/src/components/ui/password-input.tsx`)

**Cel**: Reużywalny komponent pola hasła z przyciskiem pokaż/ukryj

**Funkcjonalność**:
- Input typu password/text z przełączaniem
- Ikona oka (pokazuje/ukrywa hasło)
- Integracja z Shadcn/ui Input

#### 2.4.2. `FormField` (`/src/components/ui/form-field.tsx`)

**Cel**: Wrapper dla pola formularza z etykietą i komunikatem błędu

**Funkcjonalność**:
- Label
- Input (dowolny typ)
- Komunikat błędu (opcjonalnie)
- Integracja z Shadcn/ui

### 2.5. Walidacja formularzy

#### 2.5.1. Schematy walidacji (Zod)

**`/src/lib/validation/auth/login.schema.ts`**
```typescript
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Nieprawidłowy format e-mail'),
  password: z.string().min(6, 'Hasło musi mieć minimum 6 znaków'),
});
```

**`/src/lib/validation/auth/register.schema.ts`**
```typescript
import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Nieprawidłowy format e-mail'),
  password: z.string().min(6, 'Hasło musi mieć minimum 6 znaków'),
});
```

**`/src/lib/validation/auth/forgot-password.schema.ts`**
```typescript
import { z } from 'zod';

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Nieprawidłowy format e-mail'),
});
```

**`/src/lib/validation/auth/reset-password.schema.ts`**
```typescript
import { z } from 'zod';

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token jest wymagany'),
  password: z.string().min(6, 'Hasło musi mieć minimum 6 znaków'),
});
```

#### 2.5.2. Walidacja po stronie klienta

- Użycie schematów Zod w komponentach React
- Walidacja w czasie rzeczywistym (onChange) i przy submit
- Wyświetlanie komunikatów błędów pod polami

### 2.6. Obsługa sesji po stronie klienta

#### 2.6.1. Hook `useAuth` (`/src/lib/hooks/useAuth.ts`)

**Odpowiedzialność**:
- Zarządzanie stanem autentykacji w React
- Sprawdzanie czy użytkownik jest zalogowany
- Pobieranie danych użytkownika
- Funkcje: `login`, `logout`, `register`, `deleteAccount`

**Stan**:
- `user: User | null` - dane użytkownika
- `isLoading: boolean` - stan ładowania
- `isAuthenticated: boolean` - czy użytkownik jest zalogowany

**Funkcje**:
- `login(email: string, password: string): Promise<void>`
- `logout(): Promise<void>`
- `register(email: string, password: string): Promise<void>`
- `deleteAccount(): Promise<void>` - usunięcie konta użytkownika
- `getUser(): Promise<User | null>`
- `getAccessToken(): Promise<string | null>` - pobranie tokenu dostępu dla żądań API

**Implementacja**:
- Użycie Supabase client po stronie klienta (`supabaseClient`)
- Przechowywanie sesji w localStorage (domyślnie Supabase)
- Subskrypcja zmian sesji (`supabase.auth.onAuthStateChange`)

#### 2.6.2. Context `AuthContext` (`/src/lib/contexts/AuthContext.tsx`)

**Odpowiedzialność**:
- Globalny context dla stanu autentykacji
- Udostępnienie `useAuth` dla wszystkich komponentów

**Provider**:
- `AuthProvider` - wrapper dla aplikacji
- Inicjalizacja sesji przy starcie aplikacji

### 2.7. Komunikaty błędów i sukcesu

#### 2.7.1. Komponenty Shadcn/ui

- `Alert` - dla komunikatów błędów/sukcesu
- `Toast` (Sonner) - dla powiadomień (opcjonalnie, jeśli już używane)

#### 2.7.2. Mapowanie błędów API na komunikaty użytkownika

**Błędy Supabase Auth**:
- `invalid_credentials` → "Nieprawidłowy e-mail lub hasło"
- `email_not_confirmed` → "Potwierdź swój e-mail przed zalogowaniem" (jeśli włączone)
- `user_already_registered` → "Konto z tym e-mailem już istnieje"
- `weak_password` → "Hasło jest zbyt słabe"
- `token_expired` → "Link do resetu hasła wygasł. Wyślij nowy."
- `invalid_token` → "Nieprawidłowy link. Sprawdź czy link jest kompletny."

**Ogólne błędy**:
- 400 → "Błędne dane. Sprawdź wprowadzone informacje."
- 401 → "Brak autoryzacji. Zaloguj się ponownie."
- 500 → "Wystąpił błąd serwera. Spróbuj ponownie później."

### 2.8. Scenariusze użycia

#### 2.8.1. Rejestracja nowego użytkownika

1. Użytkownik wchodzi na `/register`
2. Wypełnia formularz (e-mail, hasło, potwierdzenie hasła)
3. Walidacja po stronie klienta
4. Wysłanie żądania do `/api/auth/register`
5. Po sukcesie: automatyczne logowanie
6. Redirect do `/app/authors`
7. Wyświetlenie komunikatu sukcesu (opcjonalnie)

#### 2.8.2. Logowanie istniejącego użytkownika

1. Użytkownik wchodzi na `/login`
2. Wypełnia formularz (e-mail, hasło)
3. Walidacja po stronie klienta
4. Wysłanie żądania do `/api/auth/login`
5. Po sukcesie: zapisanie sesji
6. Redirect do `/app/authors` lub URL z `redirect_to`

#### 2.8.3. Wylogowanie

1. Użytkownik klika "Wyloguj" w menu
2. Wywołanie `/api/auth/logout`
3. Usunięcie sesji
4. Redirect do `/login`

#### 2.8.4. Odzyskiwanie hasła

1. Użytkownik wchodzi na `/forgot-password`
2. Wypełnia e-mail
3. Wysłanie żądania do `/api/auth/forgot-password`
4. Wyświetlenie komunikatu sukcesu
5. Użytkownik otrzymuje e-mail z linkiem
6. Kliknięcie linku → `/reset-password?token=...&type=recovery`
7. Wypełnienie nowego hasła
8. Wysłanie żądania do `/api/auth/reset-password`
9. Po sukcesie: automatyczne logowanie
10. Redirect do `/app/authors`

#### 2.8.5. Ochrona tras

1. Użytkownik próbuje wejść na `/app/authors` bez logowania
2. Middleware sprawdza sesję
3. Brak sesji → redirect do `/login?redirect_to=/app/authors`
4. Po zalogowaniu → redirect do `/app/authors`

#### 2.8.6. Usunięcie konta i danych

1. Użytkownik wchodzi na `/app/settings`
2. Przewija do sekcji "Usuń konto"
3. Klika przycisk "Usuń konto"
4. Otwiera się dialog z ostrzeżeniem o nieodwracalności
5. Użytkownik wpisuje tekst potwierdzenia (np. "USUŃ")
6. Klika przycisk "Usuń konto" w dialogu
7. Wysłanie żądania DELETE do `/api/user/account`
8. Po sukcesie: usunięcie konta i wszystkich powiązanych danych (autorzy, książki)
9. Sesja wygasa automatycznie
10. Redirect do `/login` z komunikatem potwierdzającym (opcjonalnie)

---

## 3. LOGIKA BACKENDOWA

### 3.1. Endpointy API

#### 3.1.1. `POST /api/auth/register` (`/src/pages/api/auth/register.ts`)

**Cel**: Rejestracja nowego użytkownika

**Request Body**:
```typescript
{
  email: string;
  password: string;
}
```

**Walidacja**:
- Użycie `RegisterSchema` (Zod)
- Sprawdzenie czy e-mail jest unikalny (Supabase zwraca błąd jeśli istnieje)

**Logika**:
1. Walidacja danych wejściowych
2. Wywołanie `supabase.auth.signUp({ email, password })`
3. Po sukcesie: automatyczne logowanie (Supabase zwraca sesję)
4. Utworzenie profilu użytkownika w tabeli `profiles` (jeśli nie istnieje automatycznie przez trigger)
5. Zwrócenie danych użytkownika i tokenu sesji

**Response (200)**:
```typescript
{
  user: {
    id: string;
    email: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}
```

**Błędy**:
- 400: Błędne dane (walidacja)
- 409: Konto już istnieje (`user_already_registered`)
- 500: Błąd serwera

**Bezpieczeństwo**:
- Hasło nie jest logowane
- Rate limiting (opcjonalnie, przez Supabase)

#### 3.1.2. `POST /api/auth/login` (`/src/pages/api/auth/login.ts`)

**Cel**: Logowanie użytkownika

**Request Body**:
```typescript
{
  email: string;
  password: string;
}
```

**Walidacja**:
- Użycie `LoginSchema` (Zod)

**Logika**:
1. Walidacja danych wejściowych
2. Wywołanie `supabase.auth.signInWithPassword({ email, password })`
3. Po sukcesie: zwrócenie danych użytkownika i tokenu sesji

**Response (200)**:
```typescript
{
  user: {
    id: string;
    email: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}
```

**Błędy**:
- 400: Błędne dane
- 401: Nieprawidłowe dane logowania (`invalid_credentials`)
- 500: Błąd serwera

**Bezpieczeństwo**:
- Rate limiting przez Supabase
- Hasło nie jest logowane

#### 3.1.3. `POST /api/auth/logout` (`/src/pages/api/auth/logout.ts`)

**Cel**: Wylogowanie użytkownika

**Request Headers**:
- `Authorization: Bearer <token>` (opcjonalnie, jeśli sesja jest w cookie)

**Logika**:
1. Sprawdzenie autentykacji (jeśli token w headerze)
2. Wywołanie `supabase.auth.signOut()`
3. Usunięcie sesji po stronie klienta (przez Supabase client)

**Response (200)**:
```typescript
{
  message: "Wylogowano pomyślnie";
}
```

**Błędy**:
- 401: Brak autoryzacji (opcjonalnie)
- 500: Błąd serwera

#### 3.1.4. `POST /api/auth/forgot-password` (`/src/pages/api/auth/forgot-password.ts`)

**Cel**: Inicjacja procesu odzyskiwania hasła

**Request Body**:
```typescript
{
  email: string;
}
```

**Walidacja**:
- Użycie `ForgotPasswordSchema` (Zod)

**Logika**:
1. Walidacja danych wejściowych
2. Wywołanie `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })`
3. Zawsze zwracamy sukces (bezpieczeństwo - nie ujawniamy czy e-mail istnieje)

**Response (200)**:
```typescript
{
  message: "Jeśli konto z tym e-mailem istnieje, otrzymasz link do resetu hasła";
}
```

**Błędy**:
- 400: Błędny format e-mail
- 500: Błąd serwera

**Konfiguracja Supabase**:
- URL przekierowania: `https://yourdomain.com/reset-password`
- Template e-mail: można dostosować w Supabase Dashboard

#### 3.1.5. `POST /api/auth/reset-password` (`/src/pages/api/auth/reset-password.ts`)

**Cel**: Reset hasła użytkownika

**Request Body**:
```typescript
{
  token: string;
  password: string;
}
```

**Walidacja**:
- Użycie `ResetPasswordSchema` (Zod)

**Logika**:
1. Walidacja danych wejściowych
2. Wywołanie `supabase.auth.updateUser({ password })` z tokenem w sesji
3. **Uwaga**: Supabase wymaga, aby użytkownik był zalogowany przez link z e-maila (sesja recovery)
4. Alternatywnie: użycie `supabase.auth.verifyOtp({ token, type: 'recovery' })` i następnie `updateUser`

**Response (200)**:
```typescript
{
  message: "Hasło zostało zresetowane pomyślnie";
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}
```

**Błędy**:
- 400: Błędne dane
- 401: Token wygasł lub jest nieprawidłowy
- 500: Błąd serwera

**Uwaga**: Implementacja zależy od konfiguracji Supabase Auth. Może wymagać użycia `exchangeCodeForSession` jeśli token jest w formie kodu.

#### 3.1.6. `DELETE /api/user/account` (`/src/pages/api/user/account.ts`)

**Cel**: Trwałe usunięcie konta użytkownika i wszystkich powiązanych danych

**Request Headers**:
- `Authorization: Bearer <token>` - wymagany token dostępu użytkownika

**Logika**:
1. Sprawdzenie autentykacji użytkownika (`supabase.auth.getUser()`)
2. Jeśli brak autoryzacji → zwrócenie 401
3. Utworzenie `AccountService` z kluczem service role
4. Wywołanie `accountService.deleteAccount(user.id)`
5. Usunięcie użytkownika z `auth.users` przez Supabase Admin API
6. Automatyczne usunięcie wszystkich powiązanych danych przez kaskady w bazie danych:
   - `profiles` (FK: user_id → auth.users)
   - `user_authors` (FK: user_id → auth.users)
   - `user_works` (FK: user_id → auth.users)
   - `authors` z `owner_user_id = user.id` (FK: owner_user_id → auth.users)
   - `works` z `owner_user_id = user.id` (FK: owner_user_id → auth.users)
   - `editions` z `owner_user_id = user.id` (FK: owner_user_id → auth.users)

**Response (204)**:
- Status: `204 No Content`
- Body: Brak (pusty)

**Błędy**:
- 401: Brak autoryzacji (komunikat: "Authentication required")
- 500: Błąd serwera (komunikat: "Failed to delete user account")

**Bezpieczeństwo**:
- Wymaga pełnej autentykacji użytkownika
- Użycie Supabase Admin API (service role key) do usunięcia z `auth.users`
- Operacja nieodwracalna
- Logowanie operacji dla audytu

**Uwaga**: Endpoint już istnieje w `/src/pages/api/user/account.ts` i używa `AccountService` z `/src/lib/services/account.service.ts`.

#### 3.1.7. `GET /api/auth/session` (`/src/pages/api/auth/session.ts`) - opcjonalnie

**Cel**: Sprawdzenie aktualnej sesji użytkownika

**Request Headers**:
- `Authorization: Bearer <token>` (opcjonalnie)

**Logika**:
1. Sprawdzenie tokenu w headerze lub cookie
2. Wywołanie `supabase.auth.getUser()`
3. Zwrócenie danych użytkownika jeśli zalogowany

**Response (200)**:
```typescript
{
  user: {
    id: string;
    email: string;
  } | null;
}
```

**Błędy**:
- 401: Brak sesji (zwraca `user: null`)

### 3.2. Serwisy (Services)

#### 3.2.1. `AuthService` (`/src/lib/services/auth.service.ts`)

**Odpowiedzialność**: Logika biznesowa autentykacji

**Metody**:
- `register(email: string, password: string): Promise<{ user, session }>`
- `login(email: string, password: string): Promise<{ user, session }>`
- `logout(): Promise<void>`
- `forgotPassword(email: string): Promise<void>`
- `resetPassword(token: string, password: string): Promise<{ user, session }>`
- `getUser(): Promise<User | null>`

#### 3.2.2. `AccountService` (`/src/lib/services/account.service.ts`)

**Odpowiedzialność**: Logika biznesowa usuwania konta użytkownika

**Metody**:
- `deleteAccount(userId: string): Promise<void>` - usuwa konto użytkownika z Supabase Auth

**Implementacja**:
- Użycie Supabase Admin API (service role key) do usunięcia użytkownika z `auth.users`
- Usunięcie z `auth.users` automatycznie wyzwala kaskadowe usunięcie wszystkich powiązanych danych w bazie danych
- Obsługa błędów i logowanie operacji

**Uwaga**: Serwis już istnieje w `/src/lib/services/account.service.ts`.

**Implementacja**:
- Użycie Supabase client z `locals.supabase` (server-side)
- Obsługa błędów Supabase i mapowanie na błędy aplikacji
- Logowanie błędów (przez `logger`)

**Przykład**:
```typescript
export class AuthService {
  constructor(private supabase: SupabaseClient) {}

  async register(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }
}
```

### 3.3. Walidacja danych wejściowych

#### 3.3.1. Schematy Zod (już opisane w sekcji 2.5.1)

- Wszystkie endpointy używają schematów Zod do walidacji
- Błędy walidacji zwracane jako 400 z szczegółami

#### 3.3.2. Walidacja w endpointach

**Wzorzec**:
```typescript
const validation = LoginSchema.safeParse(body);
if (!validation.success) {
  return new Response(
    JSON.stringify({
      error: "Validation error",
      message: validation.error.errors[0]?.message,
      details: validation.error.errors,
    }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}
```

### 3.4. Obsługa wyjątków

#### 3.4.1. Mapowanie błędów Supabase

**Błędy Supabase Auth**:
- `invalid_credentials` → 401 Unauthorized
- `user_already_registered` → 409 Conflict
- `email_not_confirmed` → 403 Forbidden (jeśli włączone)
- `weak_password` → 400 Bad Request
- `token_expired` → 401 Unauthorized
- `invalid_token` → 401 Unauthorized

#### 3.4.2. Logowanie błędów

- Użycie `logger` z `/src/lib/logger.ts`
- Logowanie błędów z kontekstem (userId, endpoint, error message)
- Nie logowanie haseł i tokenów

#### 3.4.3. Komunikaty błędów dla użytkownika

- Przyjazne komunikaty w języku polskim
- Brak ujawniania szczegółów technicznych
- Spójne formatowanie odpowiedzi błędów

### 3.5. Aktualizacja renderowania stron server-side

#### 3.5.1. Middleware (`/src/middleware/index.ts`)

**Aktualizacja**:
- Sprawdzanie sesji użytkownika z cookie/header
- Ochrona tras `/app/*` - redirect do `/login` jeśli brak sesji
- Przekazywanie sesji do `context.locals` dla użycia w stronach Astro

**Implementacja**:
```typescript
export const onRequest = defineMiddleware(async (context, next) => {
  // ... existing code (tworzenie Supabase client) ...

  // Sprawdzenie sesji dla tras chronionych
  if (context.url.pathname.startsWith('/app')) {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (!user || error) {
      const redirectUrl = `/login?redirect_to=${encodeURIComponent(context.url.pathname)}`;
      return context.redirect(redirectUrl);
    }
    
    // Przekazanie użytkownika do locals
    context.locals.user = user;
  }

  // Sprawdzenie czy użytkownik jest zalogowany na stronach auth
  if (['/login', '/register', '/forgot-password'].includes(context.url.pathname)) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      return context.redirect('/app/authors');
    }
  }

  return next();
});
```

#### 3.5.2. Aktualizacja `env.d.ts`

**Dodanie typu dla `locals.user`**:
```typescript
declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database>;
      user?: {
        id: string;
        email: string;
      } | null;
    }
  }
}
```

#### 3.5.3. Użycie w stronach Astro

**Przykład w `/src/pages/app/authors.astro`**:
```astro
---
import Layout from "@/layouts/Layout.astro";
import { AuthorsListView } from "@/components/authors/AuthorsListView";

// Użytkownik jest już zweryfikowany przez middleware
const user = Astro.locals.user;

const title = "Autorzy - BookFlow";
---

<Layout title={title}>
  <main>
    <AuthorsListView client:load />
  </main>
</Layout>
```

---

## 4. SYSTEM AUTENTYKACJI

### 4.1. Konfiguracja Supabase Auth

#### 4.1.1. Ustawienia w Supabase Dashboard

**Email Auth**:
- Włączone: Email/Password authentication
- Wyłączone (MVP): Email confirmation (opcjonalnie można włączyć)
- Wyłączone (MVP): Magic link (nie używamy w MVP)

**Password Reset**:
- Włączone: Password reset via email
- Redirect URL: `https://yourdomain.com/reset-password`
- Template e-mail: można dostosować (język polski)

**Session Management**:
- JWT expiry: 3600 sekund (1 godzina) - domyślne
- Refresh token rotation: włączone (domyślnie)
- Refresh token reuse interval: 10 sekund (domyślnie)

#### 4.1.2. Konfiguracja w `supabase/config.toml` (lokalnie)

**Ustawienia**:
```toml
[auth]
enabled = true
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = ["https://127.0.0.1:3000"]
jwt_expiry = 3600
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10
```

### 4.2. Integracja Supabase Auth z Astro

#### 4.2.1. Server-side (middleware i API routes)

**Tworzenie Supabase client**:
- Użycie `createClient` z `@supabase/supabase-js`
- Konfiguracja: `persistSession: false`, `autoRefreshToken: false` (server-side)
- Przekazywanie tokenu przez header `Authorization: Bearer <token>`

**Sprawdzanie sesji**:
- `supabase.auth.getUser()` - weryfikacja tokenu i pobranie użytkownika
- `supabase.auth.signUp()` - rejestracja
- `supabase.auth.signInWithPassword()` - logowanie
- `supabase.auth.signOut()` - wylogowanie
- `supabase.auth.resetPasswordForEmail()` - wysłanie e-maila resetu
- `supabase.auth.updateUser()` - aktualizacja hasła

#### 4.2.2. Client-side (React components)

**Tworzenie Supabase client**:
- Użycie `supabaseClient` z `/src/db/supabase.client.ts`
- Konfiguracja: domyślna (persistSession: true, autoRefreshToken: true)

**Zarządzanie sesją**:
- Sesja przechowywana w localStorage (domyślnie Supabase)
- Automatyczne odświeżanie tokenu
- Subskrypcja zmian: `supabase.auth.onAuthStateChange()`

**Przykład w `useAuth`**:
```typescript
import { supabaseClient } from '@/db/supabase.client';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Pobranie aktualnej sesji
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Subskrypcja zmian
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ...
}
```

### 4.3. Zarządzanie sesją

#### 4.3.1. Przechowywanie tokenu

**Server-side**:
- Token przekazywany przez header `Authorization: Bearer <token>`
- Brak przechowywania w cookie (opcjonalnie można dodać)

**Client-side**:
- Token przechowywany w localStorage przez Supabase
- Automatyczne dołączanie do żądań API (jeśli używamy Supabase client)

#### 4.3.2. Odświeżanie tokenu

**Automatyczne** (client-side):
- Supabase automatycznie odświeża token przed wygaśnięciem
- Użycie refresh token

**Manualne** (jeśli potrzebne):
- `supabase.auth.refreshSession()`

#### 4.3.3. Wylogowanie

**Server-side**:
- `supabase.auth.signOut()` - wylogowanie użytkownika

**Client-side**:
- `supabaseClient.auth.signOut()` - usunięcie sesji z localStorage
- Redirect do `/login`

### 4.4. Bezpieczeństwo

#### 4.4.1. Ochrona przed atakami

**SQL Injection**:
- Użycie Supabase Client zapewnia parametryzowane zapytania
- Brak bezpośrednich zapytań SQL

**XSS**:
- Dane wyjściowe są zwracane jako JSON
- React automatycznie escapuje wartości w JSX

**CSRF**:
- Astro automatycznie obsługuje ochronę CSRF dla endpointów API
- Token w headerze `Authorization` (nie w cookie) zmniejsza ryzyko CSRF

**Rate Limiting**:
- Supabase Auth ma wbudowane rate limiting
- Dodatkowo można dodać własny rate limiting (np. przez `RateLimitService`)

#### 4.4.2. Walidacja haseł

**Wymagania Supabase**:
- Minimum 6 znaków (domyślnie)
- Można dostosować w konfiguracji Supabase

**Walidacja po stronie klienta**:
- Sprawdzenie minimum 6 znaków przed wysłaniem
- Opcjonalnie: sprawdzenie siły hasła (duże/małe litery, cyfry, znaki specjalne)

#### 4.4.3. Ochrona tras

**Middleware**:
- Sprawdzanie sesji przed renderowaniem stron `/app/*`
- Redirect do `/login` jeśli brak sesji
- Przekazywanie `redirect_to` w URL

**API Routes**:
- Sprawdzanie autoryzacji w każdym endpoincie chronionym
- Zwracanie 401 jeśli brak autoryzacji

### 4.5. Integracja z istniejącym kodem

#### 4.5.1. Kompatybilność z istniejącymi endpointami

**Istniejące endpointy** (`/api/user/*`, `/api/authors/*`, etc.):
- Używają już `supabase.auth.getUser()` do weryfikacji
- Nie wymagają zmian - działają z nowym systemem autentykacji

**Przykład** (`/src/pages/api/user/profile.ts`):
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return new Response(/* 401 */);
}
```

#### 4.5.2. Aktualizacja komponentów React

**Komponenty używające API** (np. `AuthorsListView`):
- Muszą dołączać token w headerze `Authorization: Bearer <token>`
- Użycie `useAuth` hook do pobrania tokenu
- Obsługa 401 - redirect do `/login`

**Przykład**:
```typescript
const { user, getAccessToken } = useAuth();

const fetchAuthors = async () => {
  const token = await getAccessToken();
  const response = await fetch('/api/user/authors', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (response.status === 401) {
    window.location.href = '/login';
    return;
  }
  // ...
};
```

#### 4.5.3. Aktualizacja middleware

**Obecny middleware** (`/src/middleware/index.ts`):
- Już tworzy Supabase client
- Już obsługuje token w headerze `Authorization`
- Wymaga rozszerzenia o:
  - Sprawdzanie sesji z cookie (opcjonalnie)
  - Ochronę tras `/app/*`
  - Redirect dla zalogowanych użytkowników na stronach auth

---

## 5. Podsumowanie implementacji

### 5.1. Nowe pliki do utworzenia

#### Frontend (React/Astro):
- `/src/pages/login.astro`
- `/src/pages/register.astro`
- `/src/pages/forgot-password.astro`
- `/src/pages/reset-password.astro`
- `/src/pages/app/settings.astro`
- `/src/components/auth/LoginForm.tsx`
- `/src/components/auth/RegisterForm.tsx`
- `/src/components/auth/ForgotPasswordForm.tsx`
- `/src/components/auth/ResetPasswordForm.tsx`
- `/src/components/auth/DeleteAccountDialog.tsx`
- `/src/components/auth/AccountSettings.tsx`
- `/src/components/auth/AuthLayout.tsx` (opcjonalnie)
- `/src/components/ui/password-input.tsx`
- `/src/components/ui/form-field.tsx` (opcjonalnie)
- `/src/lib/hooks/useAuth.ts`
- `/src/lib/contexts/AuthContext.tsx` (opcjonalnie)

#### Backend (API):
- `/src/pages/api/auth/register.ts`
- `/src/pages/api/auth/login.ts`
- `/src/pages/api/auth/logout.ts`
- `/src/pages/api/auth/forgot-password.ts`
- `/src/pages/api/auth/reset-password.ts`
- `/src/pages/api/auth/session.ts` (opcjonalnie)
- `/src/pages/api/user/account.ts` (już istnieje - endpoint DELETE)
- `/src/lib/services/auth.service.ts`
- `/src/lib/services/account.service.ts` (już istnieje)
- `/src/lib/validation/auth/login.schema.ts`
- `/src/lib/validation/auth/register.schema.ts`
- `/src/lib/validation/auth/forgot-password.schema.ts`
- `/src/lib/validation/auth/reset-password.schema.ts`

### 5.2. Pliki do modyfikacji

- `/src/middleware/index.ts` - rozszerzenie o ochronę tras i sprawdzanie sesji
- `/src/layouts/Layout.astro` - dodanie props `authMode`
- `/src/pages/index.astro` - dodanie logiki redirect dla zalogowanych
- `/src/pages/app/authors.astro` - usunięcie TODO, dodanie komentarza o middleware
- `/src/env.d.ts` - dodanie typu `App.Locals.user`
- Komponenty React używające API - dodanie tokenu w headerze (jeśli potrzebne)

### 5.3. Zależności do zainstalowania

**Jeśli nie są już zainstalowane**:
- `zod` - walidacja schematów (prawdopodobnie już zainstalowane)
- Komponenty Shadcn/ui: `input`, `label`, `alert` (jeśli nie są już zainstalowane)

### 5.4. Konfiguracja Supabase

- Włączenie Email/Password authentication w Supabase Dashboard
- Konfiguracja redirect URL dla resetu hasła
- Opcjonalnie: dostosowanie template e-mail (język polski)

### 5.5. Testowanie

#### Scenariusze testowe:
1. Rejestracja nowego użytkownika
2. Logowanie istniejącego użytkownika
3. Próba logowania z nieprawidłowymi danymi
4. Wylogowanie
5. Odzyskiwanie hasła (pełny flow)
6. Ochrona tras `/app/*` - redirect do logowania
7. Redirect zalogowanego użytkownika z `/login` do `/app/authors`
8. Integracja z istniejącymi endpointami API
9. Usunięcie konta i danych (US-003):
   - Wejście na `/app/settings`
   - Otwarcie dialogu usuwania konta
   - Wpisanie tekstu potwierdzenia
   - Potwierdzenie usunięcia
   - Weryfikacja usunięcia konta i wszystkich powiązanych danych
   - Weryfikacja wygaśnięcia sesji i redirect do `/login`

---

## 6. Uwagi końcowe

### 6.1. Zgodność z wymaganiami

- ✅ US-001: Rejestracja e-mail/hasło - pełna implementacja
- ✅ US-002: Logowanie i wylogowanie - pełna implementacja
- ✅ US-003: Usunięcie konta i danych - pełna implementacja (endpoint już istnieje, wymaga UI)
- ✅ Brak SSO/Legimi - zgodnie z wymaganiami
- ✅ Supabase Auth + RLS - zgodnie z wymaganiami
- ✅ Komunikaty błędów przyjazne użytkownikowi - implementowane
- ✅ Możliwość usunięcia konta i danych - zgodnie z PRD (linie 19, 31)

### 6.2. Zgodność z istniejącym kodem

- ✅ Nie narusza istniejących endpointów API
- ✅ Wykorzystuje istniejącą strukturę middleware
- ✅ Kompatybilne z istniejącymi komponentami React
- ✅ Używa istniejących narzędzi (logger, validation schemas)

### 6.3. Rozszerzalność

- Możliwość dodania weryfikacji e-mail w przyszłości
- Możliwość dodania SSO w przyszłości
- Możliwość dodania 2FA w przyszłości
- Możliwość dodania zarządzania sesjami (lista aktywnych sesji)

---

**Koniec specyfikacji**
