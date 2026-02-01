# Plan testów manualnych - Widok Autorzy

## Przygotowanie środowiska testowego

### Wymagania

- [ ] Serwer deweloperski uruchomiony (`npm run dev`)
- [ ] Konto testowe w Supabase z dostępem do API
- [ ] Token autoryzacji w nagłówku Authorization
- [ ] Baza danych z danymi testowymi

### Dane testowe

- [ ] Profil użytkownika z liczbą autorów < 500
- [ ] Profil użytkownika blisko limitu (np. 495/500)
- [ ] Co najmniej 35 autorów (dla testu paginacji)
- [ ] Autorzy z różnymi nazwami (A-Z) dla testu sortowania
- [ ] Mix autorów: OL i ręcznych

---

## Test 1: Załadowanie strony

### Cel

Sprawdzenie poprawnego renderowania widoku przy pierwszym wejściu.

### Kroki

1. Otwórz `/app/authors` w przeglądarce
2. Obserwuj kolejność renderowania

### Oczekiwany rezultat

- ✅ Widoczny loading skeleton (5-10 wierszy)
- ✅ Po ~1-2s pojawia się lista autorów
- ✅ Nagłówek "Autorzy" widoczny
- ✅ LimitIndicator pokazuje prawidłowy count (np. "125/500")
- ✅ Toolbar z search, sort, przyciskiem "Dodaj autora"
- ✅ 30 autorów na pierwszej stronie
- ✅ Paginacja widoczna jeśli > 30 autorów

### Edge cases

- [ ] Brak autorów → EmptyState z "Dodaj pierwszego autora"
- [ ] Błąd 401 → redirect do `/login`
- [ ] Błąd serwera → ErrorDisplay z "Spróbuj ponownie"

---

## Test 2: Wyszukiwanie autorów

### Cel

Sprawdzenie funkcjonalności wyszukiwania z debounce.

### Kroki

1. W polu "Szukaj autora" wpisz "ko"
2. Poczekaj 500ms (debounce)
3. Sprawdź wyniki

### Oczekiwany rezultat

- ✅ Podczas pisania: brak requestu do API
- ✅ Po 500ms: request do `/api/user/authors?search=ko`
- ✅ Lista filtrowana do autorów zawierających "ko"
- ✅ Liczba wyników zaktualizowana
- ✅ Paginacja resetuje się do strony 1
- ✅ URL zawiera `?search=ko`

### Edge cases

- [ ] Wyszukanie 201+ znaków → komunikat błędu walidacji
- [ ] Brak wyników → NoResultsState z "Wyczyść filtry"
- [ ] Kliknięcie "Wyczyść filtry" → reset search, powrót do pełnej listy

---

## Test 3: Sortowanie

### Cel

Sprawdzenie poprawności sortowania alfabetycznego i po dacie.

### Kroki

1. Kliknij dropdown sortowania
2. Wybierz "Ostatnio dodane"
3. Sprawdź kolejność

### Oczekiwany rezultat

- ✅ Request do `/api/user/authors?sort=created_desc`
- ✅ Lista posortowana od najnowszych
- ✅ URL zawiera `?sort=created_desc`
- ✅ Strona resetuje się do 1

### Dodatkowy test

1. Wybierz "Alfabetycznie (A-Z)"
2. Sprawdź kolejność

### Oczekiwany rezultat

- ✅ Lista posortowana alfabetycznie
- ✅ URL zawiera `?sort=name_asc`

---

## Test 4: Paginacja

### Cel

Sprawdzenie nawigacji między stronami.

### Przygotowanie

- Potrzeba > 30 autorów w bazie

### Kroki

1. Sprawdź informację "Strona 1 z X"
2. Kliknij "Następna"
3. Sprawdź stronę 2

### Oczekiwany rezultat

- ✅ Request do `/api/user/authors?page=2`
- ✅ URL zawiera `?page=2`
- ✅ Wyświetlonych 30 kolejnych autorów (31-60)
- ✅ "Poprzednia" aktywna
- ✅ "Następna" disabled jeśli ostatnia strona
- ✅ Informacja zaktualizowana: "Strona 2 z X"

### Edge cases

- [ ] Strona 1 → "Poprzednia" disabled
- [ ] Ostatnia strona → "Następna" disabled
- [ ] Manualna edycja URL `?page=999` → błąd lub pusta strona

---

## Test 5: Dodawanie autora z OpenLibrary

### Cel

Sprawdzenie flow wyszukiwania i dodawania z OL.

### Kroki

1. Kliknij "Dodaj autora"
2. Modal się otwiera, zakładka "Szukaj w OpenLibrary" aktywna
3. Wpisz "Stephen King"
4. Poczekaj na wyniki
5. Kliknij "Dodaj" przy pierwszym wyniku

### Oczekiwany rezultat

- ✅ Modal otwiera się
- ✅ Focus w polu wyszukiwania (opcjonalnie, bo usunęliśmy autoFocus)
- ✅ Po 500ms: request do `/api/authors/search?q=Stephen+King`
- ✅ Lista wyników (np. 5-10 autorów)
- ✅ Jeśli autor w bazie: badge "Już w katalogu"
- ✅ Kliknięcie "Dodaj":
  - Jeśli brak ID: POST `/api/openlibrary/import/author`
  - Następnie: POST `/api/user/authors`
- ✅ Modal zamyka się
- ✅ Toast sukcesu (jeśli Sonner zainstalowany)
- ✅ Lista odświeża się
- ✅ LimitIndicator aktualizuje count

### Edge cases

- [ ] Zapytanie < 2 znaki → "Wpisz co najmniej 2 znaki"
- [ ] Brak wyników → "Nie znaleziono autorów"
- [ ] OL down (502) → "OpenLibrary niedostępne. Dodaj ręcznie"
- [ ] Rate limit (429) → "Odczekaj 60 sekund"
- [ ] Duplikat (409) → "Autor jest już w profilu" + zamknięcie modalu
- [ ] Limit (409) → "Osiągnięto limit 500 autorów"

---

## Test 6: Dodawanie ręcznego autora

### Cel

Sprawdzenie flow ręcznego tworzenia autora.

### Kroki

1. Kliknij "Dodaj autora"
2. Przełącz na zakładkę "Dodaj ręcznie"
3. Wpisz "Jan Kowalski"
4. Kliknij "Dodaj autora"

### Oczekiwany rezultat

- ✅ Zakładka przełącza się
- ✅ Info message: "Autor będzie oznaczony jako ręcznie dodany"
- ✅ Input aktywny
- ✅ Submit: POST `/api/authors` → POST `/api/user/authors`
- ✅ Modal zamyka się
- ✅ Toast sukcesu
- ✅ Lista odświeża się
- ✅ Nowy autor widoczny z badge "Ręczny"

### Walidacja

- [ ] Puste pole → przycisk disabled
- [ ] 1 znak → OK
- [ ] 500 znaków → OK
- [ ] 501 znaków → input ogranicza do 500
- [ ] Licznik znaków widoczny po > 400 znakach

### Edge cases

- [ ] Rate limit (429) → komunikat
- [ ] Limit (409) → "Osiągnięto limit"

---

## Test 7: Usuwanie autora

### Cel

Sprawdzenie flow usuwania autora z profilu.

### Kroki

1. Kliknij ikonę kosza przy autorze
2. Dialog potwierdzenia się otwiera
3. Przeczytaj treść
4. Kliknij "Usuń"

### Oczekiwany rezultat

- ✅ Dialog otwiera się
- ✅ Treść: "Usunąć autora {nazwa} z profilu?"
- ✅ Ostrzeżenie: "Wszystkie książki tego autora także zostaną usunięte"
- ✅ Przyciski: "Anuluj" i "Usuń" (czerwony)
- ✅ Kliknięcie "Usuń": DELETE `/api/user/authors/{id}`
- ✅ Dialog zamyka się
- ✅ Toast sukcesu
- ✅ Lista odświeża się (autor zniknął)
- ✅ LimitIndicator aktualizuje count (zmniejsza)

### Dodatkowy test - Anulowanie

1. Kliknij ikonę kosza
2. Kliknij "Anuluj"

### Oczekiwany rezultat

- ✅ Dialog zamyka się
- ✅ Lista bez zmian
- ✅ Brak requestu DELETE

### Edge cases

- [ ] ESC key → dialog zamyka się
- [ ] Kliknięcie backdrop → dialog zamyka się
- [ ] 404 (race condition) → komunikat + refresh listy

---

## Test 8: Osiągnięcie limitu autorów

### Przygotowanie

- Profil z author_count = max_authors (np. 500/500)

### Kroki

1. Otwórz `/app/authors`
2. Sprawdź LimitIndicator
3. Najedź na przycisk "Dodaj autora"

### Oczekiwany rezultat

- ✅ LimitIndicator: "500/500" (kolor czerwony)
- ✅ Tekst: "(Zbliżasz się do limitu)"
- ✅ Przycisk "Dodaj autora" disabled
- ✅ Tooltip: "Osiągnięto limit autorów"
- ✅ Kliknięcie nie otwiera modalu

---

## Test 9: Responsywność mobile

### Cel

Sprawdzenie layoutu na małych ekranach.

### Kroki

1. Otwórz DevTools
2. Ustaw viewport na 375x667 (iPhone SE)
3. Sprawdź layout

### Oczekiwany rezultat

- ✅ PageHeader: stack (tytuł nad limitIndicator)
- ✅ Toolbar: stack (search, sort, button pionowo)
- ✅ AuthorRow: prawidłowe zawijanie tekstu
- ✅ Modal: responsywny (max-width, padding)
- ✅ Pagination: przyciski czytelne

### Dodatkowe rozdzielczości

- [ ] 768px (tablet) - półresponsywny
- [ ] 1024px+ (desktop) - pełny layout

---

## Test 10: Keyboard navigation

### Cel

Sprawdzenie dostępności z klawiatury.

### Kroki

1. Otwórz stronę
2. Używaj tylko klawiatury (Tab, Enter, ESC)

### Oczekiwany rezultat

- ✅ Tab przechodzi przez: search → sort → "Dodaj autora" → autorów → paginacja
- ✅ Focus widoczny (ring)
- ✅ Enter na "Dodaj autora" → modal
- ✅ ESC w modalu → zamknięcie
- ✅ Tab w modalu → poruszanie się wewnątrz (focus trap)
- ✅ Enter na "Dodaj" w modalu → akcja

---

## Test 11: URL jako source of truth

### Cel

Sprawdzenie synchronizacji stanu z URL.

### Kroki

1. Wyszukaj "test" → sprawdź URL
2. Zmień sort → sprawdź URL
3. Przejdź do strony 2 → sprawdź URL
4. Skopiuj URL
5. Otwórz w nowej karcie

### Oczekiwany rezultat

- ✅ URL po search: `?search=test`
- ✅ URL po sort: `?search=test&sort=created_desc`
- ✅ URL po page: `?search=test&sort=created_desc&page=2`
- ✅ Nowa karta: identyczny stan (filtry, strona)

---

## Test 12: Error recovery

### Cel

Sprawdzenie mechanizmów odzyskiwania po błędzie.

### Przygotowanie

- Symuluj błąd serwera (wyłącz API lub zwróć 500)

### Kroki

1. Otwórz `/app/authors` (z błędem API)
2. Sprawdź ErrorDisplay
3. Kliknij "Spróbuj ponownie"

### Oczekiwany rezultat

- ✅ ErrorDisplay widoczny z komunikatem
- ✅ Ikona błędu
- ✅ Przycisk "Spróbuj ponownie"
- ✅ Kliknięcie → ponowny request
- ✅ Po naprawie API → lista się ładuje

---

## Test 13: Performance

### Cel

Sprawdzenie wydajności i płynności UI.

### Kroki

1. Otwórz DevTools → Performance
2. Rozpocznij nagrywanie
3. Wykonaj: search → sort → page change → modal open/close
4. Zakończ nagrywanie

### Oczekiwany rezultat

- ✅ Brak długich tasków (> 50ms)
- ✅ Płynne animacje (60 FPS)
- ✅ Debounce działa (brak nadmiarowych requestów)
- ✅ Modal transitions bez lagów

---

## Checklist końcowy

### Funkcjonalność podstawowa

- [ ] Załadowanie listy autorów
- [ ] Wyszukiwanie z debounce
- [ ] Sortowanie (name_asc, created_desc)
- [ ] Paginacja (30/strona)
- [ ] Dodawanie z OL (search → import → attach)
- [ ] Dodawanie ręczne (create → attach)
- [ ] Usuwanie z potwierdzeniem

### UI/UX

- [ ] Loading states (skeleton)
- [ ] Empty state
- [ ] No results state
- [ ] Error states z retry
- [ ] LimitIndicator z kolorami
- [ ] Disabled states z tooltipami

### Responsywność

- [ ] Mobile (< 640px)
- [ ] Tablet (640-1024px)
- [ ] Desktop (> 1024px)

### Accessibility

- [ ] Keyboard navigation
- [ ] Focus management
- [ ] ARIA labels
- [ ] Screen reader support

### Error handling

- [ ] 401 → redirect
- [ ] 404 → komunikat
- [ ] 409 (limit) → komunikat
- [ ] 409 (duplikat) → komunikat
- [ ] 429 → rate limit message
- [ ] 502 → OL down fallback
- [ ] 500 → server error + retry
- [ ] Network error → offline message

### Edge cases

- [ ] Limit autorów osiągnięty
- [ ] Brak autorów (pierwsz użycie)
- [ ] Bardzo długie nazwy autorów
- [ ] Specjalne znaki w nazwach
- [ ] Równoczesne operacje
- [ ] Browser back/forward buttons

---

## Bugs i issues do raportowania

Format:

```
**Bug ID**: [Data]-[Numer]
**Priorytet**: Critical / High / Medium / Low
**Komponent**: [Nazwa]
**Opis**: [Krótki opis]
**Kroki reprodukcji**: [Szczegóły]
**Oczekiwane**: [Co powinno się stać]
**Aktualne**: [Co się dzieje]
**Screenshot/Video**: [Link jeśli dostępne]
```

Przykład:

```
**Bug ID**: 2026-01-30-001
**Priorytet**: High
**Komponent**: SearchInput
**Opis**: Debounce nie działa, request wysyłany po każdym znaku
**Kroki reprodukcji**:
1. Wpisz "test" w search
2. Obserwuj Network tab
**Oczekiwane**: 1 request po 500ms
**Aktualne**: 4 requesty (po każdym znaku)
```

---

## Notatki testowe

[Miejsce na własne notatki podczas testowania]

---

**Data wykonania testów**: **\*\*\*\***\_**\*\*\*\***
**Tester**: **\*\*\*\***\_**\*\*\*\***
**Wersja**: **\*\*\*\***\_**\*\*\*\***
**Status**: ☐ PASS / ☐ FAIL (z issues)
