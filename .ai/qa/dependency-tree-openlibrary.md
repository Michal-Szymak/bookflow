# Drzewo zależności - OpenLibrary Service

```
src/lib/services/openlibrary.service.ts
│
├── ZALEŻNOŚCI (importy)
│   └── @/lib/logger
│       └── logger (singleton instance)
│           └── (brak zależności - używa tylko import.meta.env)
│
├── EKSPORTY
│   ├── OpenLibraryService (klasa)
│   ├── OpenLibraryAuthor (interface)
│   ├── OpenLibraryWork (interface)
│   └── OpenLibraryEdition (interface)
│
└── UŻYCIA (gdzie jest importowany)
    │
    ├── API ENDPOINTS (używają OpenLibraryService)
    │   │
    │   ├── src/pages/api/authors/search.ts
    │   │   ├── OpenLibraryService
    │   │   ├── AuthorsService
    │   │   │   └── SupabaseClient (@/db/supabase.client)
    │   │   ├── AuthorSearchQuerySchema (@/lib/validation/author-search.schema)
    │   │   └── logger (@/lib/logger)
    │   │
    │   ├── src/pages/api/authors/[authorId]/works.ts
    │   │   ├── OpenLibraryService
    │   │   ├── AuthorsService
    │   │   │   └── SupabaseClient (@/db/supabase.client)
    │   │   ├── WorksService
    │   │   │   └── SupabaseClient (@/db/supabase.client)
    │   │   └── logger (@/lib/logger)
    │   │
    │   ├── src/pages/api/openlibrary/import/author.ts
    │   │   ├── OpenLibraryService
    │   │   ├── AuthorsService
    │   │   │   └── SupabaseClient (@/db/supabase.client)
    │   │   ├── ImportAuthorSchema (@/lib/validation/import-author.schema)
    │   │   └── logger (@/lib/logger)
    │   │
    │   ├── src/pages/api/openlibrary/import/work.ts
    │   │   ├── OpenLibraryService
    │   │   ├── WorksService
    │   │   │   └── SupabaseClient (@/db/supabase.client)
    │   │   ├── AuthorsService
    │   │   │   └── SupabaseClient (@/db/supabase.client)
    │   │   ├── ImportWorkSchema (@/lib/validation/import-work.schema)
    │   │   └── logger (@/lib/logger)
    │   │
    │   └── src/pages/api/openlibrary/import/edition.ts
    │       ├── OpenLibraryService
    │       ├── WorksService
    │       │   └── SupabaseClient (@/db/supabase.client)
    │       ├── EditionsService
    │       │   └── SupabaseClient (@/db/supabase.client)
    │       ├── ImportEditionSchema (@/lib/validation/import-edition.schema)
    │       └── logger (@/lib/logger)
    │
    └── SERWISY (używają typów z OpenLibraryService)
        │
        └── src/lib/services/authors.service.ts
            ├── OpenLibraryAuthor (tylko typ, nie klasa)
            ├── SupabaseClient (@/db/supabase.client)
            └── types (@/types)
                └── AuthorRow, UserAuthorDto
```

## Szczegółowa struktura OpenLibraryService

```
OpenLibraryService
│
├── WŁAŚCIWOŚCI
│   ├── baseUrl: "https://openlibrary.org"
│   ├── coversBaseUrl: "https://covers.openlibrary.org"
│   ├── timeout: 10000 (10 sekund)
│   └── logger: Logger (fork z kontekstem "OpenLibraryService")
│
├── METODY PUBLICZNE
│   ├── searchAuthors(query: string, limit: number)
│   │   └── Zwraca: Promise<OpenLibraryAuthor[]>
│   │
│   ├── fetchAuthorByOpenLibraryId(openlibrary_id: string)
│   │   └── Zwraca: Promise<OpenLibraryAuthor>
│   │
│   ├── fetchAuthorWorks(openlibrary_id: string, limit?: number)
│   │   └── Zwraca: Promise<OpenLibraryWork[]>
│   │
│   ├── fetchWorkByOpenLibraryId(openlibrary_id: string)
│   │   └── Zwraca: Promise<OpenLibraryWork>
│   │
│   ├── fetchEditionByOpenLibraryId(openlibrary_id: string)
│   │   └── Zwraca: Promise<OpenLibraryEdition>
│   │
│   └── fetchWorkEditionsByOpenLibraryId(openlibrary_id: string, limit?: number)
│       └── Zwraca: Promise<OpenLibraryEdition[]>
│
└── METODY PRYWATNE
    ├── parseAuthorResponse(data: unknown)
    ├── parseAuthorDetailResponse(data: unknown)
    ├── parseAuthorWorksResponse(data: unknown)
    ├── parseWorkDetailResponse(data: unknown)
    ├── parseEditionDetailResponse(data: unknown)
    ├── parseEditionsResponse(data: unknown)
    ├── extractShortIdFromKey(key: string)
    ├── parseYearFromDateString(value: string | null)
    ├── parseDateFromPublishDate(value: string | null)
    └── buildCoverUrl(coverId: number)
```

## Przepływ danych

```
┌─────────────────────────────────────────────────────────────┐
│                    API ENDPOINTS                              │
│  (authors/search, openlibrary/import/*, authors/[id]/works)  │
└────────────────┬──────────────────────────────────────────────┘
                 │
                 │ tworzy instancję
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              OpenLibraryService                              │
│  - searchAuthors()                                          │
│  - fetchAuthorByOpenLibraryId()                             │
│  - fetchAuthorWorks()                                       │
│  - fetchWorkByOpenLibraryId()                               │
│  - fetchEditionByOpenLibraryId()                            │
│  - fetchWorkEditionsByOpenLibraryId()                       │
└────────────────┬──────────────────────────────────────────────┘
                 │
                 │ wykonuje HTTP requesty
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              OpenLibrary API                                 │
│  https://openlibrary.org                                    │
│  https://covers.openlibrary.org                             │
└─────────────────────────────────────────────────────────────┘
                 │
                 │ zwraca dane
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              OpenLibraryService                              │
│  - parsuje odpowiedzi                                        │
│  - normalizuje formaty ID                                    │
│  - waliduje dane                                             │
└────────────────┬──────────────────────────────────────────────┘
                 │
                 │ zwraca znormalizowane dane
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              API ENDPOINTS                                    │
│  - używają danych do aktualizacji bazy                      │
│  - zwracają odpowiedzi do klienta                            │
└─────────────────────────────────────────────────────────────┘
```

## Zależności zewnętrzne

```
OpenLibraryService
│
├── ZEWNĘTRZNE API
│   ├── https://openlibrary.org/search/authors.json
│   ├── https://openlibrary.org/authors/{id}.json
│   ├── https://openlibrary.org/authors/{id}/works.json
│   ├── https://openlibrary.org/works/{id}.json
│   ├── https://openlibrary.org/works/{id}/editions.json
│   ├── https://openlibrary.org/books/{id}.json
│   └── https://covers.openlibrary.org/b/id/{id}-M.jpg
│
└── BIBLIOTEKI
    └── fetch API (natywny JavaScript/TypeScript)
        └── AbortController (timeout handling)
```

## Interfejsy eksportowane

```
OpenLibraryAuthor
├── openlibrary_id: string (format krótki, np. "OL23919A")
└── name: string

OpenLibraryWork
├── openlibrary_id: string (format krótki, np. "OL123W")
├── title: string
├── first_publish_year: number | null
└── primary_edition_openlibrary_id: string | null

OpenLibraryEdition
├── openlibrary_id: string (format krótki, np. "OL123M")
├── title: string
├── publish_year: number | null
├── publish_date: string | null (ISO format)
├── publish_date_raw: string | null
├── isbn13: string | null
├── cover_url: string | null
└── language: string | null
```
