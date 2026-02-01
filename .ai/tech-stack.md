Frontend - Astro z React dla komponentów interaktywnych:

- Astro 5 pozwala na tworzenie szybkich, wydajnych stron i aplikacji z minimalną ilością JavaScript
- React 19 zapewni interaktywność tam, gdzie jest potrzebna
- TypeScript 5 dla statycznego typowania kodu i lepszego wsparcia IDE
- Tailwind 4 pozwala na wygodne stylowanie aplikacji
- Shadcn/ui zapewnia bibliotekę dostępnych komponentów React, na których oprzemy UI

Backend - Supabase jako kompleksowe rozwiązanie backendowe:

- Zapewnia bazę danych PostgreSQL
- Zapewnia SDK w wielu językach, które posłużą jako Backend-as-a-Service
- Jest rozwiązaniem open source, które można hostować lokalnie lub na własnym serwerze
- Posiada wbudowaną autentykację użytkowników

AI - Komunikacja z modelami przez usługę Openrouter.ai:

- Dostęp do szerokiej gamy modeli (OpenAI, Anthropic, Google i wiele innych), które pozwolą nam znaleźć rozwiązanie zapewniające wysoką efektywność i niskie koszta
- Pozwala na ustawianie limitów finansowych na klucze API

Testowanie:

- Vitest do testów jednostkowych i integracyjnych - szybki framework testowy, kompatybilny z Vite/Astro
- @testing-library/react i @testing-library/user-event do testowania komponentów React - umożliwiają testowanie komponentów w sposób zbliżony do rzeczywistego użycia przez użytkowników
- Playwright do testów end-to-end (E2E) - szybki framework do testów E2E z wsparciem dla wielu przeglądarek
- MSW (Mock Service Worker) do mockowania żądań HTTP - pozwala na symulację zewnętrznych API w testach
- @vitest/coverage-v8 do analizy pokrycia kodu testami
- @axe-core/playwright do testów dostępności (a11y) w testach E2E

CI/CD i Hosting:

- Github Actions do tworzenia pipeline'ów CI/CD
- DigitalOcean do hostowania aplikacji za pośrednictwem obrazu docker
