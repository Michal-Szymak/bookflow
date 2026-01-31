<user_journey_analysis>

## Ścieżki użytkownika (z PRD i auth-spec)

- Wejście na stronę główną jako niezalogowany użytkownik
- Przejście do logowania
- Przejście do rejestracji
- Rejestracja konta i wejście do aplikacji
- Logowanie do istniejącego konta i wejście do aplikacji
- Odzyskiwanie hasła (prośba o reset)
- Reset hasła i powrót do aplikacji
- Próba wejścia do części aplikacji bez sesji (wymuszenie logowania)
- Wylogowanie i powrót do ekranu logowania
- Usunięcie konta z ustawień (potwierdzenie) i powrót do stanu niezalogowanego

## Główne podróże i stany

- Publiczne: Strona główna, Logowanie, Rejestracja, Odzyskiwanie hasła, Reset hasła
- Chronione: Aplikacja (np. lista autorów), Ustawienia konta
- Stany systemowe: Wymuszenie logowania, Błąd danych, Sesja wygasła

## Punkty decyzyjne i alternatywne ścieżki

- Czy użytkownik jest zalogowany?
- Czy dane w formularzu są poprawne?
- Czy logowanie się powiodło?
- Czy rejestracja się powiodła?
- Czy włączona jest weryfikacja e-mail?
- Czy token resetu jest poprawny?
- Czy użytkownik potwierdził usunięcie konta?

## Cel każdego stanu (skrót)

- Strona główna: wejście i wybór akcji (login lub rejestracja)
- Logowanie: uzyskanie dostępu do aplikacji
- Rejestracja: utworzenie konta i rozpoczęcie korzystania
- Odzyskiwanie/Reset: odzyskanie dostępu do konta
- Aplikacja: korzystanie z głównej funkcjonalności po zalogowaniu
- Ustawienia konta: zarządzanie sesją i kontem (wylogowanie, usunięcie)
  </user_journey_analysis>
