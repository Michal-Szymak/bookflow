# Plan implementacji widoku Not Found / Error

## 1. Przegląd

Widok Not Found / Error jest widokiem globalnym obsługującym dwa główne scenariusze:

1. **Strona 404 (Not Found)**: Wyświetlana, gdy użytkownik próbuje uzyskać dostęp do nieistniejącej ścieżki w aplikacji (np. `/app/authors/nieistniejacy-id` lub `/app/nieistniejaca-strona`).
2. **Kontekstowe błędy inline**: Wzorzec wyświetlania błędów API bezpośrednio w widokach list (np. błędy OpenLibrary podczas wyszukiwania autorów).

Głównym celem widoku jest czytelne prowadzenie użytkownika w razie błędów routingu i awarii API, zapewniając przyjazne komunikaty bez technicznych szczegółów (stack trace'ów) oraz oferując jasne akcje powrotu do głównych sekcji aplikacji.

Widok składa się z:

- Strony 404 dostępnej pod ścieżką `/404` (fallback Astro) z przyciskami CTA "Wróć do Autorów" i "Wróć do Książek"
- Wzorca "inline error" już zaimplementowanego w widokach list poprzez komponent `ErrorDisplay`

## 2. Routing widoku

### 2.1. Strona 404

Astro automatycznie obsługuje strony 404 poprzez plik `404.astro` w katalogu `src/pages/`. Plik ten jest wywoływany automatycznie, gdy:

- Użytkownik próbuje uzyskać dostęp do nieistniejącej ścieżki
- API zwraca 404 dla zasobu (np. autor/książka nie istnieje)
- Middleware przekierowuje do 404 w przypadku nieprawidłowych parametrów

**Ścieżka pliku**: `src/pages/404.astro`

**Dostępność**:

- Działa dla wszystkich ścieżek, które nie pasują do istniejących routów
- Dostępna zarówno dla zalogowanych, jak i niezalogowanych użytkowników
- Używa odpowiedniego layoutu w zależności od stanu autoryzacji

### 2.2. Inline errors w widokach list

Inline errors są już zaimplementowane w widokach list poprzez komponent `ErrorDisplay` i są wyświetlane w kontekście konkretnego widoku (np. lista autorów, lista książek).

**Lokalizacje**:

- `src/components/authors/AuthorsListContent.tsx` - wyświetla `ErrorDisplay` gdy `error !== null`
- `src/components/books/BooksListContent.tsx` - wyświetla `ErrorDisplay` gdy `error !== null`
- Inne widoki list używające podobnego wzorca

## 3. Struktura komponentów

```
404.astro (strona 404)
├── Layout.astro (dla niezalogowanych) lub AppLayout.astro (dla zalogowanych)
└── NotFoundView (komponent React - client:load)
    ├── ErrorIcon (lucide-react)
    ├── ErrorMessage (tekst)
    └── NavigationButtons
        ├── Button "Wróć do Autorów" (jeśli zalogowany)
        └── Button "Wróć do Książek" (jeśli zalogowany)
        └── Button "Wróć do strony głównej" (jeśli niezalogowany)

ErrorDisplay.tsx (już istnieje - inline errors)
├── AlertCircle icon
├── Error message
└── Retry button (opcjonalnie)
```

## 4. Szczegóły komponentów

### 4.1. NotFoundView (nowy komponent React)

**Opis komponentu**: Komponent React wyświetlający stronę 404 z przyjaznym komunikatem i przyciskami nawigacji do głównych sekcji aplikacji. Komponent jest responsywny i dostosowuje się do stanu autoryzacji użytkownika.

**Główne elementy**:

- Kontener główny z wyśrodkowaną zawartością (`flex flex-col items-center justify-center`)
- Ikona błędu (AlertCircle z lucide-react) w okręgu z tłem
- Nagłówek "Strona nie została znaleziona" (h2)
- Opisowy komunikat wyjaśniający sytuację
- Sekcja przycisków nawigacji z warunkowym renderowaniem w zależności od stanu autoryzacji

**Obsługiwane zdarzenia**:

- `onClick` na przyciskach nawigacji - przekierowanie do odpowiednich sekcji
- Automatyczne wykrywanie stanu autoryzacji przez props

**Warunki walidacji**:

- Brak walidacji po stronie komponentu (walidacja routingu po stronie Astro)

**Typy**:

- `NotFoundViewProps`:
  ```typescript
  interface NotFoundViewProps {
    isAuthenticated: boolean;
    className?: string;
  }
  ```

**Propsy**:

- `isAuthenticated: boolean` - określa, czy użytkownik jest zalogowany (wpływa na wyświetlane przyciski)
- `className?: string` - opcjonalna klasa CSS do dostosowania stylów

### 4.2. ErrorDisplay (istniejący komponent)

**Opis komponentu**: Komponent wyświetlający błędy inline w widokach list. Używany do wyświetlania błędów API bezpośrednio w kontekście konkretnego widoku (np. lista autorów, lista książek).

**Główne elementy**:

- Kontener z wyśrodkowaną zawartością
- Ikona błędu (AlertCircle) w okręgu z tłem destruktywnym
- Nagłówek "Coś poszło nie tak" (h3)
- Komunikat błędu (parametr `message`)
- Przycisk "Spróbuj ponownie" (opcjonalny, gdy `onRetry` jest przekazany)

**Obsługiwane zdarzenia**:

- `onClick` na przycisku retry - wywołuje funkcję `onRetry` przekazaną przez props

**Warunki walidacji**:

- Brak walidacji (komponent wyświetla tylko przekazany komunikat)

**Typy**:

- `ErrorDisplayProps`:
  ```typescript
  interface ErrorDisplayProps {
    message: string;
    onRetry?: () => void;
    className?: string;
  }
  ```

**Propsy**:

- `message: string` - komunikat błędu do wyświetlenia
- `onRetry?: () => void` - opcjonalna funkcja wywoływana po kliknięciu przycisku retry
- `className?: string` - opcjonalna klasa CSS

### 4.3. 404.astro (nowa strona Astro)

**Opis komponentu**: Strona Astro obsługująca routing 404. Automatycznie wywoływana przez Astro, gdy użytkownik próbuje uzyskać dostęp do nieistniejącej ścieżki. Wykrywa stan autoryzacji użytkownika i renderuje odpowiedni layout oraz komponenty.

**Główne elementy**:

- Logika wykrywania stanu autoryzacji (`Astro.locals.user`)
- Warunkowe renderowanie layoutu (`AppLayout` dla zalogowanych, `Layout` dla niezalogowanych)
- Komponent `NotFoundView` z przekazanym stanem autoryzacji

**Obsługiwane zdarzenia**:

- Brak bezpośrednich zdarzeń (logika po stronie serwera)

**Warunki walidacji**:

- Automatyczna obsługa przez Astro (nie wymaga dodatkowej walidacji)

**Typy**:

- Brak dodatkowych typów (używa standardowych typów Astro)

**Propsy**:

- Brak props (strona Astro)

## 5. Typy

### 5.1. NotFoundViewProps

Interfejs definiujący props komponentu `NotFoundView`:

```typescript
interface NotFoundViewProps {
  /**
   * Określa, czy użytkownik jest zalogowany.
   * Wpływa na wyświetlane przyciski nawigacji.
   */
  isAuthenticated: boolean;

  /**
   * Opcjonalna klasa CSS do dostosowania stylów komponentu.
   */
  className?: string;
}
```

**Pola**:

- `isAuthenticated: boolean` - wartość boolean określająca stan autoryzacji użytkownika. Gdy `true`, wyświetlane są przyciski "Wróć do Autorów" i "Wróć do Książek". Gdy `false`, wyświetlany jest przycisk "Wróć do strony głównej".
- `className?: string` - opcjonalna klasa CSS pozwalająca na dostosowanie stylów komponentu z zewnątrz.

### 5.2. ErrorDisplayProps (już istnieje)

Interfejs definiujący props komponentu `ErrorDisplay` (już zaimplementowany w `src/components/authors/ErrorDisplay.tsx`):

```typescript
interface ErrorDisplayProps {
  /**
   * Komunikat błędu do wyświetlenia użytkownikowi.
   * Powinien być przyjazny i zrozumiały, bez technicznych szczegółów.
   */
  message: string;

  /**
   * Opcjonalna funkcja wywoływana po kliknięciu przycisku "Spróbuj ponownie".
   * Gdy nie jest przekazana, przycisk retry nie jest wyświetlany.
   */
  onRetry?: () => void;

  /**
   * Opcjonalna klasa CSS do dostosowania stylów komponentu.
   */
  className?: string;
}
```

**Pola**:

- `message: string` - komunikat błędu wyświetlany użytkownikowi. Powinien być przyjazny i zrozumiały, bez technicznych szczegółów (stack trace'ów).
- `onRetry?: () => void` - opcjonalna funkcja callback wywoływana po kliknięciu przycisku "Spróbuj ponownie". Gdy nie jest przekazana, przycisk retry nie jest renderowany.
- `className?: string` - opcjonalna klasa CSS pozwalająca na dostosowanie stylów komponentu.

## 6. Zarządzanie stanem

### 6.1. Strona 404

Strona 404 nie wymaga zarządzania stanem po stronie klienta, ponieważ:

- Stan autoryzacji jest przekazywany przez `Astro.locals.user` (server-side)
- Komponent `NotFoundView` jest prostym komponentem prezentacyjnym bez wewnętrznego stanu
- Nawigacja odbywa się poprzez standardowe linki `<a>` lub `window.location.href`

### 6.2. Inline errors w widokach list

Inline errors są zarządzane przez istniejące hooki:

- `useAuthorsList` - zarządza stanem błędów dla listy autorów (`error: string | null`)
- `useBooksList` - zarządza stanem błędów dla listy książek (`error: string | null`)
- Inne hooki używające podobnego wzorca

**Stan błędów**:

- `error: string | null` - przechowuje komunikat błędu lub `null` gdy brak błędu
- Ustawiany przez hooki podczas obsługi błędów API
- Resetowany do `null` podczas retry lub nowego żądania

**Brak potrzeby custom hook**: Istniejące hooki już obsługują zarządzanie stanem błędów, więc nie ma potrzeby tworzenia dodatkowego custom hooka dla widoku błędów.

## 7. Integracja API

### 7.1. Strona 404

Strona 404 **nie wymaga integracji z API**, ponieważ:

- Jest wywoływana automatycznie przez Astro przy nieistniejących ścieżkach
- Nie wykonuje żadnych wywołań API
- Stan autoryzacji jest dostępny przez `Astro.locals.user` (ustawiany przez middleware)

### 7.2. Inline errors w widokach list

Inline errors są wyświetlane w odpowiedzi na błędy z istniejących wywołań API:

**Endpointy mogące zwracać błędy**:

- `GET /api/user/authors` - lista autorów użytkownika
- `GET /api/user/works` - lista książek użytkownika
- `GET /api/authors/search` - wyszukiwanie autorów w OpenLibrary
- `POST /api/openlibrary/import/author` - import autora z OpenLibrary
- Inne endpointy używane w widokach list

**Typy odpowiedzi błędów**:

```typescript
interface ErrorResponse {
  error: string;
  message: string;
}
```

**Obsługa błędów w hookach**:

- Hooki przechwytują błędy z `fetch` i parsują odpowiedzi JSON
- Komunikaty błędów są ekstrahowane z `error.message` lub `errorResponse.message`
- Stan `error` jest ustawiany w hooku i przekazywany do komponentu `ErrorDisplay`

**Przykład obsługi błędu** (z `useAuthorsList`):

```typescript
try {
  const response = await fetch("/api/user/authors?...");
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    setError(errorData.message || "Wystąpił błąd podczas ładowania autorów");
    return;
  }
  // ... sukces
} catch (err) {
  setError(err instanceof Error ? err.message : "Wystąpił nieoczekiwany błąd");
}
```

## 8. Interakcje użytkownika

### 8.1. Strona 404

**Interakcje**:

1. **Kliknięcie przycisku "Wróć do Autorów"** (tylko dla zalogowanych):
   - Akcja: Przekierowanie do `/app/authors`
   - Implementacja: `<a href="/app/authors">` lub `window.location.href = '/app/authors'`
   - Oczekiwany wynik: Użytkownik jest przekierowany do listy autorów

2. **Kliknięcie przycisku "Wróć do Książek"** (tylko dla zalogowanych):
   - Akcja: Przekierowanie do `/app/books`
   - Implementacja: `<a href="/app/books">` lub `window.location.href = '/app/books'`
   - Oczekiwany wynik: Użytkownik jest przekierowany do listy książek

3. **Kliknięcie przycisku "Wróć do strony głównej"** (tylko dla niezalogowanych):
   - Akcja: Przekierowanie do `/`
   - Implementacja: `<a href="/">` lub `window.location.href = '/'`
   - Oczekiwany wynik: Użytkownik jest przekierowany do strony głównej

### 8.2. Inline errors w widokach list

**Interakcje**:

1. **Kliknięcie przycisku "Spróbuj ponownie"** (gdy `onRetry` jest przekazany):
   - Akcja: Wywołanie funkcji `onRetry` przekazanej przez props
   - Implementacja: `onClick={onRetry}` w komponencie `ErrorDisplay`
   - Oczekiwany wynik: Hook ponownie wykonuje żądanie API i aktualizuje stan (sukces lub nowy błąd)

**Brak interakcji** (gdy `onRetry` nie jest przekazany):

- Przycisk retry nie jest wyświetlany
- Użytkownik może odświeżyć stronę ręcznie lub użyć nawigacji

## 9. Warunki i walidacja

### 9.1. Strona 404

**Warunki routingu**:

- Astro automatycznie wywołuje `404.astro` dla nieistniejących ścieżek
- Nie wymaga dodatkowej walidacji po stronie komponentu

**Warunki renderowania**:

- `isAuthenticated === true`: Renderuje `AppLayout` i przyciski "Wróć do Autorów" / "Wróć do Książek"
- `isAuthenticated === false`: Renderuje `Layout` i przycisk "Wróć do strony głównej"

### 9.2. Inline errors w widokach list

**Warunki wyświetlania błędów**:

- `error !== null && error !== undefined`: Komponent `ErrorDisplay` jest renderowany zamiast zawartości listy
- `error === null`: Normalna zawartość listy jest renderowana (lub loading/empty state)

**Warunki wyświetlania przycisku retry**:

- `onRetry !== undefined && onRetry !== null`: Przycisk "Spróbuj ponownie" jest wyświetlany
- `onRetry === undefined || onRetry === null`: Przycisk retry nie jest wyświetlany

**Wpływ warunków na stan UI**:

| Warunek                                  | Komponent                                 | Efekt UI                                      |
| ---------------------------------------- | ----------------------------------------- | --------------------------------------------- |
| `error !== null`                         | `AuthorsListContent` / `BooksListContent` | Renderuje `ErrorDisplay` zamiast listy        |
| `onRetry !== undefined`                  | `ErrorDisplay`                            | Wyświetla przycisk "Spróbuj ponownie"         |
| `isLoading === true`                     | `AuthorsListContent` / `BooksListContent` | Renderuje skeleton zamiast `ErrorDisplay`     |
| `error === null && authors.length === 0` | `AuthorsListContent`                      | Renderuje `EmptyState` zamiast `ErrorDisplay` |

## 10. Obsługa błędów

### 10.1. Strona 404

**Scenariusze błędów**:

1. **Brak dostępu do `Astro.locals.user`**:
   - Obsługa: Użycie wartości domyślnej `false` dla `isAuthenticated`
   - Implementacja: `const isAuthenticated = !!Astro.locals.user;`
   - Rezultat: Strona renderuje się z przyciskiem "Wróć do strony głównej"

2. **Błąd podczas renderowania komponentu React**:
   - Obsługa: Astro obsługuje błędy renderowania automatycznie
   - Implementacja: Fallback do podstawowego HTML, jeśli komponent React nie może być załadowany
   - Rezultat: Użytkownik widzi podstawową wersję strony 404

### 10.2. Inline errors w widokach list

**Scenariusze błędów** (już obsługiwane przez istniejące hooki):

1. **Błąd sieci (Network Error)**:
   - Obsługa: Hook przechwytuje `TypeError` z `fetch` i ustawia komunikat "Brak połączenia z internetem"
   - Implementacja: `catch (err) { if (err instanceof TypeError) { setError('Brak połączenia z internetem'); } }`
   - Rezultat: `ErrorDisplay` wyświetla komunikat z przyciskiem retry

2. **Błąd 401 Unauthorized**:
   - Obsługa: Hook przekierowuje do `/login` zamiast wyświetlać błąd
   - Implementacja: `if (response.status === 401) { window.location.href = '/login'; return; }`
   - Rezultat: Użytkownik jest przekierowany do strony logowania

3. **Błąd 404 Not Found** (dla zasobów):
   - Obsługa: Hook ustawia komunikat błędu i opcjonalnie odświeża listę
   - Implementacja: `if (response.status === 404) { setError('Zasób nie został znaleziony'); await fetchList(); }`
   - Rezultat: `ErrorDisplay` wyświetla komunikat, lista jest odświeżona

4. **Błąd 500 Internal Server Error**:
   - Obsługa: Hook ustawia ogólny komunikat błędu
   - Implementacja: `setError('Wystąpił błąd serwera. Spróbuj ponownie później.');`
   - Rezultat: `ErrorDisplay` wyświetla komunikat z przyciskiem retry

5. **Błąd 502 Bad Gateway (OpenLibrary)**:
   - Obsługa: Hook ustawia specyficzny komunikat z sugestią fallbacku
   - Implementacja: `setError('OpenLibrary jest niedostępne. Spróbuj ponownie później lub dodaj autora ręcznie.');`
   - Rezultat: `ErrorDisplay` wyświetla komunikat z sugestią ręcznego dodania

6. **Błąd parsowania odpowiedzi JSON**:
   - Obsługa: Hook używa domyślnego komunikatu błędu
   - Implementacja: `const errorData = await response.json().catch(() => ({ message: 'Wystąpił błąd' }));`
   - Rezultat: `ErrorDisplay` wyświetla domyślny komunikat

**Zasady wyświetlania komunikatów błędów**:

- Komunikaty są przyjazne i zrozumiałe dla użytkownika
- Nie wyświetlają technicznych szczegółów (stack trace'ów, kodów błędów HTTP)
- Logowanie techniczne odbywa się po stronie serwera (logger)
- Komunikaty są w języku polskim

## 11. Kroki implementacji

### 11.1. Utworzenie komponentu NotFoundView

1. **Utworzenie pliku komponentu**:
   - Ścieżka: `src/components/error/NotFoundView.tsx`
   - Utworzenie katalogu `src/components/error/` jeśli nie istnieje

2. **Implementacja komponentu**:
   - Importowanie zależności: `React`, `lucide-react` (AlertCircle), `Button` z Shadcn/ui, `cn` z utils
   - Definiowanie interfejsu `NotFoundViewProps`
   - Implementacja komponentu z ikoną, komunikatem i przyciskami nawigacji
   - Warunkowe renderowanie przycisków w zależności od `isAuthenticated`
   - Stylowanie z użyciem Tailwind 4

3. **Testowanie komponentu**:
   - Weryfikacja renderowania dla `isAuthenticated === true`
   - Weryfikacja renderowania dla `isAuthenticated === false`
   - Weryfikacja działania przycisków nawigacji

### 11.2. Utworzenie strony 404.astro

1. **Utworzenie pliku strony**:
   - Ścieżka: `src/pages/404.astro`

2. **Implementacja strony**:
   - Pobranie użytkownika z `Astro.locals.user`
   - Określenie stanu autoryzacji: `const isAuthenticated = !!user;`
   - Warunkowe importowanie layoutu: `AppLayout` dla zalogowanych, `Layout` dla niezalogowanych
   - Renderowanie komponentu `NotFoundView` z przekazanym `isAuthenticated`
   - Użycie `client:load` dla komponentu React

3. **Testowanie strony**:
   - Weryfikacja wyświetlania dla nieistniejących ścieżek (np. `/app/nieistniejaca`)
   - Weryfikacja renderowania dla zalogowanych użytkowników
   - Weryfikacja renderowania dla niezalogowanych użytkowników
   - Weryfikacja działania przycisków nawigacji

### 11.3. Weryfikacja istniejących inline errors

1. **Sprawdzenie komponentu ErrorDisplay**:
   - Weryfikacja, że komponent `ErrorDisplay` istnieje w `src/components/authors/ErrorDisplay.tsx`
   - Weryfikacja, że komponent jest używany w `AuthorsListContent` i `BooksListContent`
   - Weryfikacja, że komunikaty błędów są przyjazne i nie zawierają stack trace'ów

2. **Sprawdzenie hooków**:
   - Weryfikacja, że hooki (`useAuthorsList`, `useBooksList`) poprawnie obsługują błędy
   - Weryfikacja, że komunikaty błędów są w języku polskim
   - Weryfikacja, że funkcje `onRetry` są poprawnie przekazywane do `ErrorDisplay`

### 11.4. Testowanie end-to-end

1. **Testowanie strony 404**:
   - Próba dostępu do nieistniejącej ścieżki jako zalogowany użytkownik
   - Próba dostępu do nieistniejącej ścieżki jako niezalogowany użytkownik
   - Weryfikacja działania przycisków nawigacji
   - Weryfikacja responsywności na różnych rozmiarach ekranu

2. **Testowanie inline errors**:
   - Symulacja błędu sieci podczas ładowania listy autorów
   - Symulacja błędu 500 podczas ładowania listy książek
   - Weryfikacja działania przycisku "Spróbuj ponownie"
   - Weryfikacja, że komunikaty błędów są przyjazne i zrozumiałe

3. **Testowanie dostępności**:
   - Weryfikacja ARIA labels dla przycisków
   - Weryfikacja nawigacji klawiaturą
   - Weryfikacja czytników ekranu (screen readers)

### 11.5. Dokumentacja i finalizacja

1. **Aktualizacja dokumentacji**:
   - Dodanie informacji o stronie 404 do dokumentacji projektu (jeśli istnieje)
   - Zaktualizowanie sekcji obsługi błędów w dokumentacji

2. **Code review**:
   - Weryfikacja zgodności z konwencjami projektu
   - Weryfikacja zgodności z PRD i wymaganiami UX
   - Weryfikacja zgodności z zasadami bezpieczeństwa (brak wyświetlania stack trace'ów)

3. **Finalne testy**:
   - Testowanie na różnych przeglądarkach
   - Testowanie na różnych urządzeniach (desktop, mobile)
   - Weryfikacja wydajności renderowania
