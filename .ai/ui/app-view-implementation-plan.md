# Plan implementacji widoku App Layout

## 1. Przegląd

App Layout to wspólna powłoka aplikacji dostępna dla wszystkich widoków w ścieżce `/app/*`. Głównym celem widoku jest zapewnienie spójnej nawigacji między sekcjami aplikacji oraz globalnych usług UI, takich jak system powiadomień toast. Widok działa jako layout wrapper, który otacza wszystkie chronione strony aplikacji (Autorzy, Książki, Ustawienia) i zapewnia:

- Spójną nawigację top-level między głównymi sekcjami aplikacji
- Globalny system powiadomień (Sonner) dostępny we wszystkich widokach
- Wspólny header z informacjami o użytkowniku i opcją wylogowania
- Automatyczną ochronę autoryzacyjną (middleware redirect do `/login` przy braku sesji)

Widok nie wymaga bezpośredniej integracji z API, ponieważ autoryzacja jest obsługiwana przez middleware Astro, a dane użytkownika są przekazywane przez `Astro.locals.user`.

## 2. Routing widoku

Widok App Layout jest dostępny dla wszystkich ścieżek rozpoczynających się od `/app/*`:

- `/app/authors` - Lista autorów użytkownika
- `/app/authors/:authorId` - Szczegóły autora z listą works
- `/app/books` - Lista książek użytkownika
- `/app/settings` - Ustawienia konta

**Ochrona autoryzacyjna:**

- Middleware (`src/middleware/index.ts`) automatycznie sprawdza sesję użytkownika dla wszystkich ścieżek `/app/*`
- W przypadku braku sesji użytkownik jest przekierowywany do `/login?redirect_to=<ścieżka>`
- Po udanym logowaniu użytkownik jest przekierowywany do `/app/authors` (domyślny widok po zalogowaniu)

## 3. Struktura komponentów

```
AppLayout.astro (nowy layout)
├── Header (Astro)
│   ├── Logo/Title
│   ├── AppNavigation (React island - client:load)
│   │   ├── NavLink (Autorzy)
│   │   ├── NavLink (Książki)
│   │   └── NavLink (Ustawienia)
│   └── UserInfo (Astro)
│       ├── UserEmail
│       └── LogoutButton (React island - client:load)
├── Toaster (React island - client:only)
└── <slot /> (zawartość strony)
```

**Hierarchia komponentów:**

1. **AppLayout.astro** - Główny layout wrapper dla wszystkich widoków `/app/*`
2. **AppNavigation.tsx** - Komponent React obsługujący nawigację z aktywnym linkiem
3. **LogoutButton.tsx** - Istniejący komponent (wymaga integracji)
4. **Toaster** - Komponent Sonner do wyświetlania powiadomień toast

## 4. Szczegóły komponentów

### AppLayout.astro

**Opis komponentu:**
Główny layout Astro dla wszystkich widoków aplikacji po zalogowaniu. Zapewnia wspólną strukturę HTML, header z nawigacją, oraz miejsce na globalne usługi UI (toast notifications).

**Główne elementy:**

- `<html>` z atrybutem `lang="pl"`
- `<head>` z meta tagami, tytułem strony, favicon
- `<body>` z:
  - `<header>` zawierający:
    - Logo/title aplikacji
    - Komponent `AppNavigation` (React island)
    - Informacje o użytkowniku (email)
    - Komponent `LogoutButton` (React island)
  - `<main>` z `<slot />` dla zawartości strony
  - Komponent `<Toaster />` (React island) dla powiadomień toast

**Obsługiwane zdarzenia:**

- Brak bezpośrednich zdarzeń (komponent Astro, zdarzenia obsługiwane przez dzieci)

**Obsługiwana walidacja:**

- Brak walidacji (komponent prezentacyjny)

**Typy:**

- `Props` interface:
  ```typescript
  interface Props {
    title?: string; // Opcjonalny tytuł strony (domyślnie "BookFlow")
  }
  ```
- `Astro.locals.user` (z middleware):
  ```typescript
  {
    id: string;
    email: string | null;
  } | undefined
  ```

**Props:**

- `title?: string` - Tytuł strony wyświetlany w `<title>` i opcjonalnie w headerze

### AppNavigation.tsx

**Opis komponentu:**
React component renderujący nawigację top-level z linkami do głównych sekcji aplikacji. Wykrywa aktywną ścieżkę na podstawie `window.location.pathname` i wyróżnia aktywny link odpowiednimi stylami.

**Główne elementy:**

- `<nav>` z atrybutem `aria-label="Główna nawigacja"`
- Lista linków (`<a>` lub Astro `<Link>`) do:
  - `/app/authors` - "Autorzy"
  - `/app/books` - "Książki"
  - `/app/settings` - "Ustawienia"
- Aktywny link wyróżniony klasami CSS (np. `aria-current="page"`, odpowiednie style)

**Obsługiwane zdarzenia:**

- `onClick` na linkach (opcjonalnie, dla trackingu)
- Automatyczne wykrywanie aktywnej ścieżki przy zmianie routingu

**Obsługiwana walidacja:**

- Weryfikacja, czy ścieżka zaczyna się od `/app/` (dla bezpieczeństwa)
- Sprawdzenie, czy link odpowiada aktualnej ścieżce (dla aktywnego stanu)

**Typy:**

- Brak zewnętrznych DTO (komponent prezentacyjny)
- Wewnętrzny stan:
  ```typescript
  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.pathname : ""
  );
  ```

**Props:**

- Brak props (komponent samodzielny, odczytuje ścieżkę z `window.location`)

**Uwagi implementacyjne:**

- Używa `useEffect` do nasłuchiwania zmian w `window.location.pathname`
- Może używać `window.addEventListener('popstate')` dla obsługi nawigacji przeglądarki (back/forward)
- Stylowanie aktywnego linku: użycie `aria-current="page"` i odpowiednich klas Tailwind

### LogoutButton.tsx

**Opis komponentu:**
Istniejący komponent React obsługujący wylogowanie użytkownika. Wywołuje endpoint `/api/auth/logout` i przekierowuje do strony logowania.

**Główne elementy:**

- `<Button>` z ikoną `LogOut` i tekstem "Wyloguj się"
- Stan ładowania z ikoną spinnera podczas wylogowania

**Obsługiwane zdarzenia:**

- `onClick` - wywołanie funkcji `handleLogout`

**Obsługiwana walidacja:**

- Brak walidacji (komponent już zaimplementowany)

**Typy:**

- Brak zewnętrznych DTO
- Wewnętrzny stan:
  ```typescript
  const [isLoading, setIsLoading] = useState<boolean>(false);
  ```

**Props:**

- Brak props

### Toaster (Sonner)

**Opis komponentu:**
Komponent Sonner do wyświetlania globalnych powiadomień toast. Renderowany raz w AppLayout i dostępny we wszystkich widokach aplikacji.

**Główne elementy:**

- `<Toaster />` z konfiguracją:
  - `position="top-right"` (lub `top-center`)
  - `richColors` - kolorowe powiadomienia
  - Opcjonalnie: `duration`, `closeButton`, `toastOptions`

**Obsługiwane zdarzenia:**

- Automatyczna obsługa przez Sonner (dismiss, action clicks)

**Obsługiwana walidacja:**

- Brak walidacji (komponent biblioteczny)

**Typy:**

- Import z `sonner`:
  ```typescript
  import { Toaster } from "sonner";
  ```

**Props:**

- Props komponentu `Toaster` z biblioteki Sonner

## 5. Typy

### Typy wymagane przez AppLayout.astro

**Props interface:**

```typescript
interface AppLayoutProps {
  title?: string;
}
```

**User type (z middleware):**

```typescript
interface User {
  id: string;
  email: string | null;
}
```

**Typ dla lokalizacji (dla AppNavigation):**

```typescript
// Wewnętrzny typ w AppNavigation.tsx
type NavItem = {
  href: string;
  label: string;
  exact?: boolean; // Czy link musi być dokładnie równy ścieżce
};
```

### Typy dla integracji z istniejącymi komponentami

**LogoutButton** - nie wymaga dodatkowych typów (już zaimplementowany)

**Toaster** - używa typów z biblioteki `sonner` (nie wymaga dodatkowych definicji)

## 6. Zarządzanie stanem

### Stan w AppLayout.astro

AppLayout.astro jest komponentem Astro (server-side), więc nie zarządza stanem React. Stan jest zarządzany przez:

1. **Middleware** - przekazuje `user` przez `Astro.locals.user`
2. **Komponenty React islands** - zarządzają własnym stanem lokalnym

### Stan w AppNavigation.tsx

Komponent wymaga prostego stanu do śledzenia aktualnej ścieżki:

```typescript
const [currentPath, setCurrentPath] = useState<string>(() =>
  typeof window !== "undefined" ? window.location.pathname : ""
);
```

**Custom hook (opcjonalnie):**

Można utworzyć hook `useCurrentPath` dla reużywalności:

```typescript
function useCurrentPath(): string {
  const [path, setPath] = useState<string>(() => (typeof window !== "undefined" ? window.location.pathname : ""));

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);

    // Listen to popstate (back/forward navigation)
    window.addEventListener("popstate", updatePath);

    // For programmatic navigation, we might need to listen to custom events
    // or use a MutationObserver on the URL (less common)

    return () => window.removeEventListener("popstate", updatePath);
  }, []);

  return path;
}
```

**Uwagi:**

- W Astro z React islands, nawigacja między stronami powoduje pełne przeładowanie strony, więc `popstate` może nie być potrzebne
- Jeśli w przyszłości zostanie dodana client-side routing (np. przez Astro View Transitions), hook będzie przydatny

### Stan w LogoutButton.tsx

Komponent już zarządza własnym stanem `isLoading` (istniejący komponent).

### Globalny stan toastów

Sonner zarządza własnym stanem wewnętrznie. Nie wymaga dodatkowego zarządzania stanem.

## 7. Integracja API

App Layout **nie wymaga bezpośredniej integracji z API**, ponieważ:

1. **Autoryzacja** jest obsługiwana przez middleware Astro (`src/middleware/index.ts`)
2. **Dane użytkownika** są przekazywane przez `Astro.locals.user` (ustawiane w middleware)
3. **Wylogowanie** jest obsługiwane przez istniejący komponent `LogoutButton`, który wywołuje `/api/auth/logout`

### Middleware integration

Middleware automatycznie:

- Sprawdza sesję użytkownika przez `supabase.auth.getUser()`
- Przekierowuje do `/login` jeśli brak sesji i ścieżka nie jest w `PUBLIC_PATHS`
- Ustawia `Astro.locals.user` dla zalogowanych użytkowników

**Nie wymaga zmian w middleware** - już obsługuje `/app/*` routes.

## 8. Interakcje użytkownika

### Nawigacja między sekcjami

**Akcja:** Kliknięcie w link nawigacji (Autorzy, Książki, Ustawienia)

**Oczekiwany wynik:**

- Przekierowanie do odpowiedniej ścieżki (`/app/authors`, `/app/books`, `/app/settings`)
- Aktywny link jest wyróżniony (zmiana stylu, `aria-current="page"`)
- Strona ładuje się z pełnym przeładowaniem (standardowe zachowanie Astro)

**Implementacja:**

- Użycie standardowych linków `<a href="/app/authors">` lub Astro `<Link href="/app/authors">`
- Wykrywanie aktywnej ścieżki w `AppNavigation` przez porównanie `window.location.pathname` z `href` linku

### Wylogowanie

**Akcja:** Kliknięcie przycisku "Wyloguj się"

**Oczekiwany wynik:**

- Wywołanie endpointu `/api/auth/logout`
- Usunięcie sesji (cookies)
- Przekierowanie do `/login`
- Opcjonalnie: toast notification "Wylogowano pomyślnie" (jeśli zostanie dodany)

**Implementacja:**

- Obsługiwane przez istniejący komponent `LogoutButton`
- Nie wymaga zmian w AppLayout

### Wyświetlanie powiadomień toast

**Akcja:** Automatyczna (wywoływana z innych komponentów przez `toast.success()`, `toast.error()`, etc.)

**Oczekiwany wynik:**

- Powiadomienie pojawia się w prawym górnym rogu (lub skonfigurowanej pozycji)
- Automatyczne zniknięcie po określonym czasie
- Możliwość ręcznego zamknięcia

**Implementacja:**

- Komponent `<Toaster />` renderowany w AppLayout
- Inne komponenty używają `import { toast } from "sonner"` do wyświetlania powiadomień

## 9. Warunki i walidacja

### Warunki autoryzacyjne

**Warunek:** Użytkownik musi być zalogowany, aby uzyskać dostęp do `/app/*`

**Weryfikacja:**

- Middleware sprawdza `supabase.auth.getUser()`
- Jeśli brak sesji → redirect do `/login?redirect_to=<ścieżka>`

**Komponent:** Middleware (`src/middleware/index.ts`)

**Wpływ na UI:**

- Jeśli użytkownik nie jest zalogowany, nie zobaczy AppLayout (zostanie przekierowany)
- Jeśli użytkownik jest zalogowany, `Astro.locals.user` jest dostępny i może być użyty do wyświetlenia emaila w headerze

### Warunki dla aktywnego linku nawigacji

**Warunek:** Link jest aktywny, jeśli `window.location.pathname` odpowiada `href` linku

**Weryfikacja:**

- Porównanie ścieżek w `AppNavigation.tsx`
- Dla linków do `/app/authors` i `/app/books`: sprawdzenie, czy ścieżka zaczyna się od `href` (dla podstron jak `/app/authors/:authorId`)
- Dla linku `/app/settings`: dokładne dopasowanie (exact match)

**Komponent:** `AppNavigation.tsx`

**Wpływ na UI:**

- Aktywny link otrzymuje:
  - `aria-current="page"` (dla dostępności)
  - Odpowiednie klasy CSS (np. `bg-accent`, `text-primary`, `font-semibold`)
  - Wizualne wyróżnienie (podkreślenie, tło, etc.)

### Warunki dla wyświetlania emaila użytkownika

**Warunek:** Email jest wyświetlany tylko jeśli `user?.email` istnieje

**Weryfikacja:**

- Sprawdzenie `Astro.locals.user?.email` w AppLayout.astro

**Komponent:** AppLayout.astro

**Wpływ na UI:**

- Jeśli email istnieje → wyświetlenie w headerze
- Jeśli email nie istnieje → pominięcie wyświetlania (lub wyświetlenie placeholder)

## 10. Obsługa błędów

### Błędy autoryzacji (401 Unauthorized)

**Scenariusz:** Sesja użytkownika wygasła podczas korzystania z aplikacji

**Obsługa:**

- Middleware automatycznie przekierowuje do `/login` przy próbie dostępu do `/app/*` bez sesji
- Jeśli błąd 401 występuje w wywołaniu API z komponentu, komponent powinien obsłużyć redirect (np. przez `window.location.href = "/login"`)

**Komponent odpowiedzialny:** Middleware + komponenty wywołujące API

**Komunikat dla użytkownika:**

- Toast notification: "Sesja wygasła. Zaloguj się ponownie." (opcjonalnie, jeśli zostanie dodany w komponentach API)

### Błędy podczas wylogowania

**Scenariusz:** Endpoint `/api/auth/logout` zwraca błąd

**Obsługa:**

- Komponent `LogoutButton` już obsługuje błędy - nawet przy błędzie przekierowuje do `/login`
- Logowanie błędu do konsoli (przez `logger.error`)

**Komponent odpowiedzialny:** `LogoutButton.tsx` (już zaimplementowany)

**Komunikat dla użytkownika:**

- Brak komunikatu (użytkownik jest przekierowywany niezależnie od błędu)

### Błędy renderowania komponentów React

**Scenariusz:** Błąd w komponencie React (np. `AppNavigation`, `Toaster`)

**Obsługa:**

- Astro obsługuje błędy w React islands przez Error Boundaries (jeśli zostaną dodane)
- Fallback: wyświetlenie podstawowej nawigacji HTML (bez React) lub ukrycie komponentu

**Komponent odpowiedzialny:** AppLayout.astro (może dodać try-catch lub Error Boundary)

**Komunikat dla użytkownika:**

- Opcjonalnie: komunikat o błędzie w konsoli (development) lub ukrycie błędu (production)

### Błędy konfiguracji Sonner

**Scenariusz:** Błąd podczas renderowania `<Toaster />`

**Obsługa:**

- Sonner jest biblioteką zewnętrzną, więc błędy są rzadkie
- Jeśli wystąpi błąd, toasty po prostu nie będą działać (nie blokuje aplikacji)

**Komponent odpowiedzialny:** AppLayout.astro

**Komunikat dla użytkownika:**

- Brak komunikatu (toasty po prostu nie działają, ale aplikacja działa)

## 11. Kroki implementacji

### Krok 1: Utworzenie komponentu AppNavigation.tsx

1. Utworzyć plik `src/components/app/AppNavigation.tsx`
2. Zaimplementować komponent React z:
   - Stanem `currentPath` do śledzenia aktywnej ścieżki
   - Listą linków nawigacji (`/app/authors`, `/app/books`, `/app/settings`)
   - Logiką wykrywania aktywnego linku
   - Stylowaniem aktywnego linku (Tailwind CSS)
   - Atrybutami dostępności (`aria-current="page"`)
3. Dodać hook `useCurrentPath` (opcjonalnie, dla reużywalności)
4. Przetestować komponent w izolacji (opcjonalnie, Storybook lub testy)

**Pliki do utworzenia:**

- `src/components/app/AppNavigation.tsx`

### Krok 2: Utworzenie layoutu AppLayout.astro

1. Utworzyć plik `src/layouts/AppLayout.astro`
2. Zaimplementować strukturę HTML:
   - `<html lang="pl">`
   - `<head>` z meta tagami, tytułem, favicon
   - `<body>` z:
     - `<header>` zawierający:
       - Logo/title (np. "BookFlow")
       - Komponent `AppNavigation` (React island z `client:load`)
       - Wyświetlenie emaila użytkownika (jeśli dostępny)
       - Komponent `LogoutButton` (React island z `client:load`)
     - `<main>` z `<slot />`
     - Komponent `<Toaster />` (React island z `client:only="react"`)
3. Dodać style Tailwind dla layoutu (container, spacing, etc.)
4. Zaimplementować responsywność (mobile-first)

**Pliki do utworzenia:**

- `src/layouts/AppLayout.astro`

### Krok 3: Integracja Sonner Toaster

1. Sprawdzić, czy `sonner` jest zainstalowany (już jest w `package.json`)
2. Zaimportować `Toaster` z `sonner` w AppLayout.astro
3. Dodać komponent `<Toaster />` w `<body>` przed zamknięciem tagu
4. Skonfigurować opcje Toaster:
   - `position="top-right"` (lub preferowana pozycja)
   - `richColors` dla kolorowych powiadomień
   - Opcjonalnie: `duration`, `closeButton`
5. Przetestować wyświetlanie toastów (np. przez `toast.success("Test")` w konsoli)

**Pliki do modyfikacji:**

- `src/layouts/AppLayout.astro`

### Krok 4: Aktualizacja istniejących stron `/app/*`

1. Zaktualizować `src/pages/app/authors.astro`:
   - Zmienić import z `Layout` na `AppLayout`
   - Usunąć duplikację headerów (jeśli istnieją)
2. Zaktualizować `src/pages/app/settings.astro`:
   - Zmienić import z `Layout` na `AppLayout`
   - Usunąć duplikację headerów (jeśli istnieją)
3. Utworzyć `src/pages/app/books.astro` (jeśli jeszcze nie istnieje):
   - Użyć `AppLayout` jako layout
   - Dodać placeholder zawartości (zostanie zaimplementowany w przyszłości)

**Pliki do modyfikacji:**

- `src/pages/app/authors.astro`
- `src/pages/app/settings.astro`
- `src/pages/app/books.astro` (utworzyć, jeśli nie istnieje)

### Krok 5: Stylowanie i dostępność

1. Dodać style Tailwind dla:
   - Header (border, background, spacing)
   - Nawigacji (linki, aktywny stan, hover)
   - Responsywność (mobile menu, jeśli potrzebne)
2. Dodać atrybuty dostępności:
   - `aria-label` dla `<nav>`
   - `aria-current="page"` dla aktywnego linku
   - Semantyczne tagi HTML (`<nav>`, `<header>`, `<main>`)
3. Przetestować dostępność:
   - Keyboard navigation (Tab, Enter)
   - Screen reader (aria-current)
   - Focus states

**Pliki do modyfikacji:**

- `src/components/app/AppNavigation.tsx`
- `src/layouts/AppLayout.astro`

### Krok 6: Testowanie i weryfikacja

1. Przetestować nawigację:
   - Kliknięcie w każdy link nawigacji
   - Weryfikacja, czy aktywny link jest wyróżniony
   - Weryfikacja, czy strona ładuje się poprawnie
2. Przetestować autoryzację:
   - Próba dostępu do `/app/*` bez logowania (powinien być redirect)
   - Próba dostępu po logowaniu (powinien być dostęp)
3. Przetestować wylogowanie:
   - Kliknięcie "Wyloguj się"
   - Weryfikacja przekierowania do `/login`
4. Przetestować toasty:
   - Wywołanie `toast.success()` z konsoli
   - Weryfikacja wyświetlania powiadomienia
5. Przetestować responsywność:
   - Mobile (< 640px)
   - Tablet (640px - 1024px)
   - Desktop (> 1024px)

**Pliki do testowania:**

- Wszystkie utworzone/zmodyfikowane pliki

### Krok 7: Dokumentacja i cleanup

1. Zaktualizować dokumentację projektu (jeśli istnieje):
   - Opis struktury layoutów
   - Opis komponentów nawigacji
2. Sprawdzić, czy nie ma duplikacji kodu:
   - Usunąć stary header z `Layout.astro` (jeśli był używany tylko dla `/app/*`)
   - Upewnić się, że `Layout.astro` nadal działa dla stron publicznych (`/login`, `/register`)
3. Sprawdzić linter i formatowanie:
   - Uruchomić `npm run lint`
   - Uruchomić `npm run format`
4. Commit zmian:
   - Utworzyć commit z opisem zmian
   - Opcjonalnie: utworzyć PR z opisem implementacji

**Pliki do sprawdzenia:**

- Wszystkie zmodyfikowane pliki
- `src/layouts/Layout.astro` (upewnić się, że nadal działa dla publicznych stron)
