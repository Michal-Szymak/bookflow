# Priorytety Testów Jednostkowych - OpenLibrary Service

## Analiza Elementów Wartych Testowania

### 1. 🔴 WYSOKI PRIORYTET - Funkcje Parsowania i Transformacji

#### 1.1. Metody Parsowania Odpowiedzi API (PRYWATNE)

**Elementy do testowania:**
- `parseAuthorResponse(data: unknown)`
- `parseAuthorDetailResponse(data: unknown)`
- `parseAuthorWorksResponse(data: unknown)`
- `parseWorkDetailResponse(data: unknown)`
- `parseEditionDetailResponse(data: unknown)`
- `parseEditionsResponse(data: unknown)`

**Dlaczego warto testować:**
1. **Krytyczna logika biznesowa** - Te metody transformują surowe dane z zewnętrznego API do formatu wewnętrznego
2. **Wysokie ryzyko błędów** - OpenLibrary API może zwracać różne formaty danych, brakujące pola, null values
3. **Trudne do debugowania** - Błędy parsowania mogą być subtelne i ujawniać się tylko w specyficznych przypadkach
4. **Częste zmiany** - Jeśli OpenLibrary zmieni format odpowiedzi, testy szybko to wykryją
5. **Izolacja** - Te metody są czystymi funkcjami (pure functions), łatwe do testowania bez zależności

**Scenariusze testowe:**
- ✅ Prawidłowe odpowiedzi z pełnymi danymi
- ✅ Odpowiedzi z brakującymi opcjonalnymi polami
- ✅ Odpowiedzi z null values
- ✅ Puste tablice (np. autor bez dzieł)
- ✅ Nieprawidłowe formaty (nie obiekt, brak wymaganych pól)
- ✅ Różne formaty dat (rok, pełna data, null)
- ✅ Różne formaty języków (z prefiksem `/languages/` i bez)

**Przykład testu:**
```typescript
describe('parseAuthorDetailResponse', () => {
  it('should parse valid author response', () => {
    const data = {
      key: '/authors/OL23919A',
      name: 'J.K. Rowling'
    };
    const result = service.parseAuthorDetailResponse(data);
    expect(result).toEqual({
      openlibrary_id: 'OL23919A',
      name: 'J.K. Rowling'
    });
  });

  it('should throw error when key is missing', () => {
    const data = { name: 'J.K. Rowling' };
    expect(() => service.parseAuthorDetailResponse(data))
      .toThrow("OpenLibrary response missing required field 'key'");
  });
});
```

#### 1.2. `extractShortIdFromKey(key: string)`

**Dlaczego warto testować:**
1. **Logika normalizacji** - Konwertuje różne formaty ID do jednolitego formatu krótkiego
2. **Wielokrotne użycie** - Używana w wielu miejscach, błąd wpłynie na cały system
3. **Różne formaty wejściowe** - OpenLibrary może zwracać różne formaty kluczy
4. **Edge cases** - Trzeba obsłużyć różne prefiksy, już krótkie ID, nieoczekiwane formaty

**Scenariusze testowe:**
- ✅ `/authors/OL23919A` → `OL23919A`
- ✅ `/works/OL123W` → `OL123W`
- ✅ `/books/OL123M` → `OL123M`
- ✅ `/languages/eng` → `eng`
- ✅ `OL23919A` (już krótki format) → `OL23919A`
- ✅ `/unknown/OL123` → `OL123` (fallback dla nieznanego prefiksu)
- ✅ Pusty string
- ✅ String zaczynający się od `/` bez znanego prefiksu

**Przykład testu:**
```typescript
describe('extractShortIdFromKey', () => {
  it('should extract ID from /authors/ prefix', () => {
    expect(service.extractShortIdFromKey('/authors/OL23919A')).toBe('OL23919A');
  });

  it('should return short ID as-is if already in short format', () => {
    expect(service.extractShortIdFromKey('OL23919A')).toBe('OL23919A');
  });

  it('should handle unknown prefix by removing leading slash', () => {
    expect(service.extractShortIdFromKey('/unknown/OL123')).toBe('unknown/OL123');
  });
});
```

#### 1.3. `parseYearFromDateString(value: string | null)`

**Dlaczego warto testować:**
1. **Ekstrakcja roku z różnych formatów** - OpenLibrary może zwracać różne formaty dat
2. **Regex matching** - Trzeba przetestować różne wzorce dat
3. **Obsługa null/empty** - Musi zwracać null dla nieprawidłowych wartości
4. **Walidacja zakresu** - Regex sprawdza lata 1000-2099

**Scenariusze testowe:**
- ✅ `"2023"` → `2023`
- ✅ `"Published in 2023"` → `2023`
- ✅ `"2023-01-15"` → `2023`
- ✅ `"January 2023"` → `2023`
- ✅ `"1999"` → `1999`
- ✅ `"2100"` → `null` (poza zakresem)
- ✅ `"999"` → `null` (poza zakresem)
- ✅ `null` → `null`
- ✅ `""` → `null`
- ✅ `"no year here"` → `null`

**Przykład testu:**
```typescript
describe('parseYearFromDateString', () => {
  it('should extract year from simple year string', () => {
    expect(service.parseYearFromDateString('2023')).toBe(2023);
  });

  it('should extract year from date string', () => {
    expect(service.parseYearFromDateString('2023-01-15')).toBe(2023);
  });

  it('should return null for years outside valid range', () => {
    expect(service.parseYearFromDateString('2100')).toBeNull();
    expect(service.parseYearFromDateString('999')).toBeNull();
  });

  it('should return null for invalid input', () => {
    expect(service.parseYearFromDateString(null)).toBeNull();
    expect(service.parseYearFromDateString('no year')).toBeNull();
  });
});
```

#### 1.4. `parseDateFromPublishDate(value: string | null)`

**Dlaczego warto testować:**
1. **Konwersja do ISO format** - Musi zwracać datę w formacie ISO (YYYY-MM-DD)
2. **Filtrowanie samych lat** - Tylko rok (np. "2023") powinien zwracać null
3. **Obsługa błędów parsowania** - Nieprawidłowe daty powinny zwracać null
4. **Edge cases** - Różne formaty dat z OpenLibrary

**Scenariusze testowe:**
- ✅ `"2023-01-15"` → `"2023-01-15"`
- ✅ `"January 15, 2023"` → `"2023-01-15"`
- ✅ `"2023"` → `null` (tylko rok)
- ✅ `null` → `null`
- ✅ `"invalid date"` → `null`
- ✅ `"2023-13-45"` → `null` (nieprawidłowa data)

**Przykład testu:**
```typescript
describe('parseDateFromPublishDate', () => {
  it('should parse valid date string to ISO format', () => {
    expect(service.parseDateFromPublishDate('2023-01-15')).toBe('2023-01-15');
  });

  it('should return null for year-only strings', () => {
    expect(service.parseDateFromPublishDate('2023')).toBeNull();
  });

  it('should return null for invalid dates', () => {
    expect(service.parseDateFromPublishDate('invalid')).toBeNull();
    expect(service.parseDateFromPublishDate(null)).toBeNull();
  });
});
```

#### 1.5. `buildCoverUrl(coverId: number)`

**Dlaczego warto testować:**
1. **Prosta funkcja pomocnicza** - Łatwa do testowania, wysoka wartość
2. **Format URL** - Musi generować prawidłowy URL do cover image
3. **Używana w wielu miejscach** - Błąd wpłynie na wyświetlanie okładek

**Scenariusze testowe:**
- ✅ `123456` → `"https://covers.openlibrary.org/b/id/123456-M.jpg"`
- ✅ `0` → `"https://covers.openlibrary.org/b/id/0-M.jpg"`
- ✅ Duże liczby

**Przykład testu:**
```typescript
describe('buildCoverUrl', () => {
  it('should build correct cover URL', () => {
    expect(service.buildCoverUrl(123456))
      .toBe('https://covers.openlibrary.org/b/id/123456-M.jpg');
  });
});
```

---

### 2. 🟡 ŚREDNI PRIORYTET - Metody Publiczne z Mockowaniem HTTP

#### 2.1. Metody Fetch z Mockowaniem `fetch`

**Elementy do testowania:**
- `searchAuthors(query, limit)`
- `fetchAuthorByOpenLibraryId(openlibrary_id)`
- `fetchAuthorWorks(openlibrary_id, limit)`
- `fetchWorkByOpenLibraryId(openlibrary_id)`
- `fetchEditionByOpenLibraryId(openlibrary_id)`
- `fetchWorkEditionsByOpenLibraryId(openlibrary_id, limit)`

**Dlaczego warto testować:**
1. **Integracja z zewnętrznym API** - Muszą poprawnie konstruować URL-e i obsługiwać odpowiedzi
2. **Obsługa błędów** - Timeout, 404, 500, network errors
3. **Walidacja wejścia** - Sprawdzanie formatu ID przed wywołaniem API
4. **Timeout handling** - Weryfikacja, że timeout działa poprawnie

**Uwaga:** Te testy wymagają mockowania `fetch` API (np. używając MSW - Mock Service Worker, który jest już w projekcie).

**Scenariusze testowe dla każdej metody:**
- ✅ Prawidłowa odpowiedź z API
- ✅ 404 Not Found (dla fetch*ById metod)
- ✅ 500 Internal Server Error
- ✅ Timeout (AbortError)
- ✅ Network error
- ✅ Nieprawidłowy format odpowiedzi JSON
- ✅ Pusta odpowiedź
- ✅ Weryfikacja konstrukcji URL (query params, ścieżki)

**Przykład testu z MSW:**
```typescript
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

describe('searchAuthors', () => {
  it('should fetch and parse authors successfully', async () => {
    server.use(
      http.get('https://openlibrary.org/search/authors.json', () => {
        return HttpResponse.json({
          docs: [
            { key: '/authors/OL23919A', name: 'J.K. Rowling' }
          ]
        });
      })
    );

    const result = await service.searchAuthors('Rowling', 10);
    expect(result).toEqual([
      { openlibrary_id: 'OL23919A', name: 'J.K. Rowling' }
    ]);
  });

  it('should handle timeout', async () => {
    server.use(
      http.get('https://openlibrary.org/search/authors.json', async () => {
        await new Promise(resolve => setTimeout(resolve, 15000)); // > 10s timeout
        return HttpResponse.json({});
      })
    );

    await expect(service.searchAuthors('Rowling', 10))
      .rejects.toThrow('OpenLibrary API request timed out');
  });

  it('should handle 404 for non-existent author', async () => {
    server.use(
      http.get('https://openlibrary.org/authors/INVALID.json', () => {
        return HttpResponse.json({}, { status: 404 });
      })
    );

    await expect(service.fetchAuthorByOpenLibraryId('INVALID'))
      .rejects.toThrow("Author with openlibrary_id 'INVALID' not found");
  });
});
```

---

### 3. 🟢 NISKI PRIORYTET - Elementy Mniej Krytyczne

#### 3.1. Logowanie (Logger)

**Dlaczego NIE warto testować jednostkowo:**
- Logger jest zależnością zewnętrzną (`@/lib/logger`)
- Testowanie logowania nie dodaje wartości biznesowej
- Można przetestować w testach integracyjnych, jeśli potrzebne

#### 3.2. Konstruktor i Właściwości

**Dlaczego NIE warto testować osobno:**
- Proste przypisania wartości
- Testowane pośrednio przez testy metod publicznych

---

## Priorytetyzacja Testów

### Faza 1: Fundamenty (Tydzień 1)
1. ✅ `extractShortIdFromKey` - Podstawa normalizacji ID
2. ✅ `parseYearFromDateString` - Często używana funkcja pomocnicza
3. ✅ `parseDateFromPublishDate` - Konwersja formatów dat
4. ✅ `buildCoverUrl` - Prosta, ale ważna funkcja

### Faza 2: Parsowanie (Tydzień 1-2)
1. ✅ `parseAuthorResponse` - Wyszukiwanie autorów
2. ✅ `parseAuthorDetailResponse` - Szczegóły autora
3. ✅ `parseAuthorWorksResponse` - Lista dzieł autora
4. ✅ `parseWorkDetailResponse` - Szczegóły dzieła
5. ✅ `parseEditionDetailResponse` - Szczegóły wydania
6. ✅ `parseEditionsResponse` - Lista wydań

### Faza 3: Integracja HTTP (Tydzień 2-3)
1. ✅ Wszystkie metody `fetch*` z mockowaniem HTTP
2. ✅ Obsługa błędów (404, 500, timeout, network)
3. ✅ Weryfikacja konstrukcji URL

---

## Metryki Sukcesu

### Pokrycie Kodu (Code Coverage)
- **Cel:** Minimum 80% pokrycia dla `OpenLibraryService`
- **Priorytet:** 100% pokrycia dla metod parsowania (prywatnych)
- **Priorytet:** 90% pokrycia dla metod publicznych z mockowaniem HTTP

### Jakość Testów
- Każda metoda parsowania: minimum 5-10 scenariuszy testowych
- Każda metoda fetch: minimum 6 scenariuszy (success, 404, 500, timeout, network error, invalid response)
- Edge cases: wszystkie znane edge cases pokryte testami

---

## Narzędzia i Best Practices

### Framework Testowy
- **Vitest** (już zainstalowany w projekcie)
- **MSW (Mock Service Worker)** - do mockowania HTTP requests (już zainstalowany)

### Struktura Testów
```
src/lib/services/
  openlibrary.service.ts
  __tests__/
    openlibrary.service.test.ts
```

### Przykładowa Struktura Pliku Testowego
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenLibraryService } from '../openlibrary.service';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

describe('OpenLibraryService', () => {
  let service: OpenLibraryService;

  beforeEach(() => {
    service = new OpenLibraryService();
  });

  describe('extractShortIdFromKey', () => {
    // Testy dla extractShortIdFromKey
  });

  describe('parseYearFromDateString', () => {
    // Testy dla parseYearFromDateString
  });

  describe('parseAuthorResponse', () => {
    // Testy dla parseAuthorResponse
  });

  describe('searchAuthors', () => {
    // Testy dla searchAuthors z mockowaniem HTTP
  });

  // ... pozostałe metody
});
```

---

## Podsumowanie

### Najważniejsze Elementy do Testowania:

1. **🔴 WYSOKI PRIORYTET:**
   - Wszystkie metody parsowania (prywatne) - 100% pokrycia
   - `extractShortIdFromKey` - krytyczna funkcja normalizacji
   - `parseYearFromDateString` i `parseDateFromPublishDate` - często używane

2. **🟡 ŚREDNI PRIORYTET:**
   - Metody publiczne `fetch*` z mockowaniem HTTP
   - Obsługa błędów i timeoutów

3. **🟢 NISKI PRIORYTET:**
   - Logger (testowany pośrednio)
   - Konstruktor (testowany pośrednio)

### Korzyści z Testów Jednostkowych:

1. **Szybkie wykrywanie błędów** - Testy jednostkowe działają szybko (< 1s)
2. **Izolacja problemów** - Łatwe zidentyfikowanie, która metoda zawodzi
3. **Refaktoryzacja bezpieczna** - Możliwość zmiany kodu z pewnością, że nic nie zepsujemy
4. **Dokumentacja** - Testy służą jako żywa dokumentacja oczekiwanego zachowania
5. **Regresja** - Zapobieganie ponownemu pojawieniu się znanych błędów

### ROI (Return on Investment):

**Najwyższy ROI:**
- Metody parsowania - łatwe do testowania, wysokie ryzyko błędów
- `extractShortIdFromKey` - używana wszędzie, prosta do testowania

**Średni ROI:**
- Metody fetch z mockowaniem - wymagają więcej setupu, ale testują krytyczną funkcjonalność

**Niski ROI:**
- Logger - testowany pośrednio, niska wartość biznesowa

