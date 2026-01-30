# Obsługa błędów - implementacja

## Status implementacji

### ✅ Zaimplementowane

#### 1. Obsługa błędów HTTP w hookach

**useAuthorsList:**
- ✅ 401 Unauthorized → redirect do `/login`
- ✅ 404 Not Found → komunikat błędu + refresh listy
- ✅ Generyczne błędy → wyświetlenie komunikatu
- ✅ Network errors → wyświetlenie komunikatu

**useAuthorSearch:**
- ✅ 502 Bad Gateway → komunikat "OpenLibrary niedostępne" + sugestia ręcznego dodania
- ✅ Generyczne błędy → wyświetlenie w UI

**useManualAuthor:**
- ✅ 400 Validation Error → wyświetlenie komunikatu walidacji
- ✅ 409 Conflict → rozróżnienie limitu vs duplikatu
- ✅ 429 Rate Limit → komunikat z czasem oczekiwania

#### 2. Walidacja po stronie klienta

- ✅ SearchInput: max 200 znaków
- ✅ ManualAuthorTab: 1-500 znaków, required, trimmed
- ✅ Page number: >= 1, <= totalPages
- ✅ Sort parameter: tylko dozwolone wartości

#### 3. Warunkowe renderowanie stanów

- ✅ Loading state (AuthorsListSkeleton)
- ✅ Error state (ErrorDisplay z retry)
- ✅ Empty state (EmptyState)
- ✅ No results state (NoResultsState)

#### 4. Accessibility

- ✅ ARIA labels dla interaktywnych elementów
- ✅ Keyboard navigation (ESC, Tab)
- ✅ Focus management w modalach
- ✅ Error announcements dla screen readers

### 🔶 TODO - Wymaga instalacji Sonner

**System toastów:**
```bash
npm install sonner
```

**Lokalizacje gdzie należy dodać toasty:**

1. **AuthorsListView.tsx** (po zainstalowaniu Sonner):
```typescript
import { toast } from "sonner";

// W handleDeleteConfirm po sukcesie:
toast.success("Autor został usunięty z profilu");

// W handleDeleteConfirm przy błędzie:
toast.error(err.message || "Nie udało się usunąć autora");
```

2. **useAuthorSearch.ts** (opcjonalnie, jeśli toast ma być w hooku):
```typescript
// Po sukcesie addAuthor:
// toast.success("Autor został dodany do profilu");

// Przy błędzie:
// toast.error(komunikat);
```

3. **useManualAuthor.ts** (opcjonalnie):
```typescript
// Po sukcesie:
// toast.success("Autor został utworzony i dodany do profilu");
```

## Mapowanie błędów API → Komunikaty użytkownika

| Status | Endpoint | Hook | Komunikat |
|--------|----------|------|-----------|
| 401 | Wszystkie | useAuthorsList | Redirect do `/login` |
| 400 | GET /api/user/authors | useAuthorsList | "Niepoprawne parametry wyszukiwania" |
| 404 | DELETE /api/user/authors/{id} | useAuthorsList | "Autor nie jest dołączony do profilu" |
| 409 (limit) | POST /api/user/authors | useAuthorSearch, useManualAuthor | "Osiągnięto limit 500 autorów" |
| 409 (duplikat) | POST /api/user/authors | useAuthorSearch | "Autor jest już w Twoim profilu" |
| 429 | POST /api/user/authors | useAuthorSearch, useManualAuthor | "Dodano zbyt wielu autorów. Odczekaj 60 sekund." |
| 502 | GET /api/authors/search | useAuthorSearch | "OpenLibrary jest niedostępne. Dodaj autora ręcznie." |
| 502 | POST /api/openlibrary/import/author | useAuthorSearch | "Nie można zaimportować autora. Spróbuj ponownie." |
| 500 | Wszystkie | Wszystkie | "Wystąpił błąd serwera. Spróbuj ponownie później." |
| Network Error | Wszystkie | Wszystkie | "Brak połączenia z internetem" |

## Edge cases obsługiwane

1. **Równoczesne usuwanie** - Race condition 404 → refresh + komunikat
2. **Limit autorów osiągnięty** - Disabled button + tooltip + 409 handling
3. **Rate limiting** - 429 handling z komunikatem
4. **OpenLibrary niedostępne** - 502 handling + fallback do ręcznego dodania
5. **Brak autorów** - EmptyState z CTA
6. **Brak wyników wyszukiwania** - NoResultsState z clear filters
7. **Błąd profilu** - Nie blokuje wyświetlania listy
8. **Pusta strona paginacji** - Automatyczne ukrycie paginacji

## Strategia odzyskiwania (Recovery)

1. **Retry mechanism** - ErrorDisplay z przyciskiem "Spróbuj ponownie"
2. **Automatic refresh** - Po delete 404 → auto refresh listy
3. **Fallback UI** - Po 502 search → sugestia ręcznego dodania
4. **Graceful degradation** - Profil error nie blokuje listy

## Walidacja kliencka vs serwerowa

### Kliencka (frontend)
- Search query: max 200 znaków
- Manual author name: 1-500 znaków, trimmed
- Page: >= 1
- Sort: enum validation

### Serwerowa (backend - już zaimplementowana)
- Wszystkie parametry walidowane przez Zod schemas
- RLS security
- Rate limiting (10 requests/min na attach)
- Limity użytkownika (500 autorów)

## Testowanie błędów

Po zainstalowaniu Sonner, należy przetestować:
- [ ] Toast sukcesu po dodaniu autora
- [ ] Toast sukcesu po usunięciu autora
- [ ] Toast błędu przy rate limit (429)
- [ ] Toast błędu przy limicie autorów (409)
- [ ] Toast błędu przy duplikacie (409)
- [ ] Toast błędu przy OL down (502)
- [ ] Komunikat przy braku internetu
- [ ] Retry mechanism działanie

