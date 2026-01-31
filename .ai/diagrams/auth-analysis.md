<authentication_analysis>

## Przepływy autentykacji (z PRD i auth-spec)

- Rejestracja e-mail/hasło (US-001)
- Logowanie e-mail/hasło (US-002)
- Wylogowanie (US-002)
- Ochrona tras `/app/*` (wymuszanie logowania + redirect_to)
- Przekierowanie z ekranów auth dla zalogowanych (np. login, register)
- Odzyskiwanie hasła (wymagane przez Supabase Auth)
- Reset hasła z tokenem recovery (i automatyczne zalogowanie)
- Usunięcie konta i danych (US-003)
- Reakcja na wygaśnięcie sesji (SSR i API) oraz odświeżanie tokenu

## Aktorzy i interakcje

- Przeglądarka: renderuje UI, wysyła żądania stron i API, przechowuje sesję
- Middleware: uruchamia się przed SSR, chroni trasy, robi przekierowania
- Astro API: endpointy auth i user, walidacja danych, mapowanie błędów
- Supabase Auth: rejestracja, logowanie, sesja, reset hasła, weryfikacja

## Weryfikacja i odświeżanie tokenów

- Weryfikacja:
  - Middleware i Astro API weryfikują użytkownika przez Supabase Auth.
  - Brak sesji lub błąd weryfikacji skutkuje 401 lub przekierowaniem.
- Odświeżanie:
  - Po stronie klienta Supabase może automatycznie odświeżać sesję.
  - Przy wygaśnięciu tokenu SSR/API odmawiają dostępu i wymuszają login.

## Krótki opis kroków (happy path i błędy)

- Rejestracja: formularz → API → Supabase Auth → sesja → zapis sesji → redirect
- Logowanie: formularz → API → Supabase Auth → sesja → zapis sesji → redirect
- Wylogowanie: akcja UI → API/Auth → unieważnienie sesji → redirect do logowania
- Ochrona tras: żądanie strony → middleware → weryfikacja → albo SSR, albo redirect
- Odzyskiwanie hasła: formularz → API → Supabase Auth → komunikat sukcesu
- Reset hasła: link recovery → ustawienie sesji recovery → zmiana hasła → sesja
- Usunięcie konta: potwierdzenie → API → weryfikacja → admin delete → sesja znika
  </authentication_analysis>
