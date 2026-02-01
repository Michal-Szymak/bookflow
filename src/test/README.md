# Test Setup

This directory contains test configuration and utilities.

## Structure

- `setup.ts` - Global test setup for Vitest (includes @testing-library/jest-dom)
- `msw/` - Mock Service Worker configuration for mocking HTTP requests
  - `handlers.ts` - Define your API mock handlers here
  - `server.ts` - MSW server instance
  - `setup.ts` - MSW setup hooks for Vitest

## Usage

### Unit Tests with Vitest

Tests should be placed next to the code they test or in `__tests__` directories:

```
src/
  components/
    Button.tsx
    __tests__/
      Button.test.tsx
  lib/
    utils.ts
    __tests__/
      utils.test.ts
```

Run tests:

- `npm test` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report

### E2E Tests with Playwright

E2E tests are located in `tests/e2e/`:

```
tests/
  e2e/
    auth.spec.ts
    books.spec.ts
```

Run E2E tests:

- `npm run test:e2e` - Run all E2E tests
- `npm run test:e2e:ui` - Run with Playwright UI
- `npm run test:e2e:debug` - Run in debug mode
- `npm run test:e2e:codegen` - Generate tests using codegen

### Mocking HTTP Requests with MSW

To use MSW in your tests, import the setup in your test file:

```typescript
import { server } from "@/test/msw/server";
import { http, HttpResponse } from "msw";

// In your test
server.use(
  http.get("/api/books", () => {
    return HttpResponse.json([{ id: 1, title: "Test Book" }]);
  })
);
```

Or add handlers to `src/test/msw/handlers.ts` for global mocks.
