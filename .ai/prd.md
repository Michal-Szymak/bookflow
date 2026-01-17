# Dokument wymagań produktu (PRD) - BookFlow
## 1. Przegląd produktu
- Cel: webowa aplikacja (PL) pomagająca zaawansowanym użytkownikom Legimi zarządzać dużą listą autorów i książek, śledzić status przeczytania oraz dostępność w Legimi.
- Grupa docelowa: użytkownicy Legimi z co najmniej 20 autorami i 100 tytułami.
- Platforma: responsywny web, brak PWA i aplikacji mobilnych.
- Integracje: OpenLibrary (wyszukiwanie autora i pobieranie pełnej listy works). Legimi tylko manualne oznaczanie dostępności.
- Technologia i bezpieczeństwo: Supabase (auth, RLS, szyfrowanie, HTTPS), TypeScript/Astro/React/Tailwind, dane z identyfikatorami OpenLibrary.
- Harmonogram MVP: 6–7 tygodni, 1 developer; etapy T1–T6 (auth i model, backend/API + OL, UI autor/książka, filtry/cache, analityka/testy).

## 2. Problem użytkownika
- Przy dużej liczbie autorów i książek w Legimi trudno śledzić, co już przeczytano i co można dodać na półkę.
- Brak jednego widoku łączącego dane autora/książki z informacją o dostępności w Legimi i statusem czytania.

## 3. Wymagania funkcjonalne
- Uwierzytelnianie: rejestracja i logowanie e-mail + hasło; sesja użytkownika; wylogowanie; usuwanie konta i danych; brak SSO/Legimi.
- Model danych: User, Author, Work, Edition; relacje User–Author M2M, Author–Work M2M, Work–Edition 1:N; pola statusu książki (Do przeczytania, W trakcie, Przeczytana, Ukryj), availableInLegimi (boolean), manual (boolean); identyfikatory OpenLibrary.
- Integracja OpenLibrary: wyszukiwanie autora po imieniu/nazwisku, wybór kanonicznego author_id; pobranie pełnej listy works dla autora; cache/TTL 7 dni; sortowanie po first_publish_date z fallbackiem do edition.publish_date (rok); domyślne sortowanie od najnowszych; w UI używanie pól edition (tytuł, autor, ISBN, okładka, język), sort po dacie z work/edition.
- Dodawanie autorów i książek: zapisywanie, odczytywanie, przeglądanie i usuwanie autorów; dodawanie książek autora do profilu (bulk); paginacja 30 pozycji na stronę; limity 500 autorów i 5000 książek na użytkownika.
- Statusy i operacje na książkach: zmiana statusu pojedynczo i hurtowo (checkboxy/bulk); status Ukryj ukrywa tytuł z widoku domyślnego; brak wirtualizacji list w MVP.
- Dostępność w Legimi: w MVP tylko manualne oznaczanie availableInLegimi.
- Ręczne dodawanie: możliwość ręcznego dodania autora/książki z flagą manual, gdy brak w OpenLibrary; brak edycji/konsolidacji rekordów OL w MVP.
- Filtry i sortowanie: filtry po statusie i dostępności w Legimi; sortowanie po tytule A–Z oraz po dacie publikacji od najnowszych; daty prezentowane jako rok.
- UX flow: Dodaj autora → wybór kanoniczny → pobranie i lista works → szybkie oznaczanie statusów/bulk → filtry/sort; brak powiadomień push/e-mail.
- Komunikaty przyjazne użytkownikowi przy błędach API; logi techniczne dla developera.
- Analityka: eventy sign_up, add_author, add_books_bulk, mark_read, cele aktywacyjne zgodnie z kryteriami sukcesu.
- Wydajność i cache: cache OpenLibrary TTL 7 dni; paginacja 30/strona; brak wirtualizacji list w MVP.
- Bezpieczeństwo/prywatność: Supabase auth + RLS; szyfrowanie i HTTPS; dane nieudostępniane stronom trzecim; możliwość usunięcia konta i danych.
- Testy: unit dla krytycznych funkcji (walidacje, logika first_publish_date); E2E główny flow Dodaj autora → lista → oznacz jako przeczytane; pokrycie 20–30%, reszta manualnie.

## 4. Granice produktu
- Poza zakresem: PWA, aplikacje mobilne, funkcje społecznościowe i współdzielenie danych, integracje inne niż OpenLibrary, sprawdzanie dostępności w Legimi i automatyczne dodawanie tytułów na półkę w Legimi, pełna a11y (tylko podstawy), wirtualizacja list, zaawansowane rate limiting, edycja/konsolidacja rekordów z OL, powiadomienia.

## 5. Historyjki użytkowników
- US-001 Rejestracja e-mail/hasło
  - Opis: Jako nowy użytkownik chcę założyć konto przez e-mail i hasło, aby korzystać z aplikacji.
  - Kryteria akceptacji: mogę wprowadzić e-mail i hasło, po rejestracji jestem zalogowany, błędne dane pokazują komunikat, dane są zapisywane w Supabase.
- US-002 Logowanie i wylogowanie
  - Opis: Jako istniejący użytkownik chcę zalogować się i wylogować, aby chronić dostęp do mojej listy.
  - Kryteria akceptacji: poprawne dane logują i tworzą sesję, błędne dane pokazują komunikat, wylogowanie usuwa sesję, sesja wymaga aktywnego zalogowania do dostępu do profilu.
- US-003 Usunięcie konta i danych
  - Opis: Jako użytkownik chcę usunąć konto i wszystkie moje dane.
  - Kryteria akceptacji: po potwierdzeniu konto i powiązane dane autorów/książek są usuwane, sesja wygasa, pokazany jest komunikat potwierdzający.
- US-004 Dodanie autora z OpenLibrary
  - Opis: Jako użytkownik chcę wyszukać autora po imieniu/nazwisku i wybrać kanoniczny author_id.
  - Kryteria akceptacji: mogę wpisać zapytanie, lista wyników pochodzi z OL, wybór zapisuje autora na moim profilu z jego OL id, błędy OL są komunikowane i nie psują sesji.
- US-005 Pobranie i sortowanie prac autora
  - Opis: Jako użytkownik chcę zobaczyć pełną listę works autora posortowaną po dacie publikacji z cache 7 dni.
  - Kryteria akceptacji: po wyborze autora lista prac jest pobrana (work + edition), domyślnie sortowana od najnowszych wg first_publish_date z fallbackiem edition.publish_date, cache 7 dni jest respektowane, daty pokazane jako rok.
- US-006 Dodanie książek autora hurtowo
  - Opis: Jako użytkownik chcę zaznaczyć wiele prac i dodać je do profilu jedną akcją.
  - Kryteria akceptacji: mogę zaznaczyć wiele pozycji i zapisać, status domyślny Do przeczytania, potwierdzenie pokazane po sukcesie, limit 5000 książek nie jest przekraczany.
- US-007 Zmiana statusu pojedynczej książki
  - Opis: Jako użytkownik chcę ustawić status książki na Do przeczytania, W trakcie, Przeczytana lub Ukryj.
  - Kryteria akceptacji: każda zmiana zapisuje się natychmiast, status Ukryj usuwa tytuł z widoku domyślnego, zmiana jest widoczna po odświeżeniu listy.
- US-008 Zmiana statusu wielu książek jednocześnie
  - Opis: Jako użytkownik chcę hurtowo zmienić status zaznaczonych książek.
  - Kryteria akceptacji: mogę zaznaczyć wiele pozycji, wybrać nowy status, wszystkie zaznaczone rekordy zmieniają status, brak zmian dla niezaznaczonych.
- US-009 Filtry i sortowanie listy
  - Opis: Jako użytkownik chcę filtrować po statusie i dostępności w Legimi oraz sortować po tytule lub dacie.
  - Kryteria akceptacji: mogę wybrać statusy i dostępność jako filtry, mogę sortować tytuł A–Z lub data od najnowszych, kombinacje filtrów i sortu działają jednocześnie, wynik jest paginowany 30/strona.
- US-010 Oznaczenie dostępności w Legimi ręcznie
  - Opis: Jako użytkownik chcę ręcznie ustawić dostępność książki w Legimi.
  - Kryteria akceptacji: pole availableInLegimi można ustawić true/false, zmiana zapisuje się w profilu, brak auto-refresh, zmiana jest widoczna w filtrach.
- US-011 Ręczne dodanie autora lub książki
  - Opis: Jako użytkownik chcę dodać autora/książkę ręcznie, gdy brak w OpenLibrary.
  - Kryteria akceptacji: mogę wprowadzić dane ręcznie, rekord jest oznaczony manual=true, ręcznie dodane pozycje mogą mieć statusy i dostępność jak inne, brak łączenia z OL w MVP.
- US-012 Usuwanie autora i jego książek z profilu
  - Opis: Jako użytkownik chcę usunąć autora wraz z przypisanymi książkami z mojego profilu.
  - Kryteria akceptacji: potwierdzenie przed usunięciem, usunięty autor znika z listy, jego książki są usunięte lub odłączone od użytkownika, limit autorów aktualizuje się.
- US-013 Ukrywanie i przywracanie tytułów
  - Opis: Jako użytkownik chcę ukrywać tytuły, aby nie zasłaniały listy, i móc je przywrócić.
  - Kryteria akceptacji: ustawienie statusu Ukryj usuwa tytuł z widoku domyślnego, filtr statusu umożliwia podgląd i przywrócenie innego statusu, zmiana zapisuje się.
- US-014 Przegląd profilu z paginacją i limitami
  - Opis: Jako użytkownik chcę przeglądać autorów i książki w paginacji 30/strona z limitami 500 autorów i 5000 książek.
  - Kryteria akceptacji: lista jest paginowana 30 pozycji, dodanie powyżej limitu jest blokowane z komunikatem, przełączanie stron zachowuje filtry i sort.
- US-015 Walidacja tempa dodawania autorów
  - Opis: Jako użytkownik chcę otrzymać informację, gdy próbuję dodać zbyt wielu autorów w krótkim czasie.
  - Kryteria akceptacji: przy próbie dodania ponad 10 autorów/min otrzymuję komunikat, dotychczas dodani autorzy pozostają, po odczekaniu mogę dodać kolejne.
- US-016 Obsługa błędów i komunikaty
  - Opis: Jako użytkownik chcę jasne komunikaty, gdy API OpenLibrary jest niedostępne.
  - Kryteria akceptacji: błędy wyświetlają przyjazny komunikat, dane niepobrane nie nadpisują istniejących, oferowany jest fallback ręczny dla autora/książki.
- US-017 Analityka zdarzeń
  - Opis: Jako właściciel produktu chcę rejestrować kluczowe zdarzenia, aby mierzyć aktywację i retencję.
  - Kryteria akceptacji: eventy sign_up, add_author, add_books_bulk, mark_read są wysyłane z identyfikacją użytkownika, dane zawierają podstawowe parametry (liczba autorów/książek), błędne wysłanie nie blokuje akcji użytkownika.

## 6. Metryki sukcesu
- Aktywacja: 90% użytkowników ma w profilu co najmniej 1 autora z minimum 3 książkami (D30).
- Retencja dodatków: 75% użytkowników dodaje co najmniej 5 nowych książek w ciągu 12 miesięcy.
- Zaangażowanie: MAU, retention D30, liczba akcji na sesję (dodanie autora, dodanie książek, zmiana statusu).
- Wydajność danych: cache OpenLibrary aktualizowane co 7 dni.
- Jakość doświadczenia: czas dodania autora do listy z pełnym pobraniem works poniżej ustalonego SLA MVP (np. kilka sekund), brak krytycznych błędów uniemożliwiających główny flow E2E.