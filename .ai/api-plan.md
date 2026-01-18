# REST API Plan

## 1. Resources

- `Auth` (Supabase auth) – session and account management (email/password, session tokens).
- `Profile` ↔ table `profiles`: `user_id` PK/FK auth.users; counters `author_count`, `work_count`; limits `max_authors` (500 default), `max_works` (5000 default); timestamps `created_at`, `updated_at`.
- `Author` ↔ table `authors`: `id` uuid PK; `name`; `openlibrary_id` (partial unique, nullable); `manual` bool; `owner_user_id` FK auth.users (manual rows only); cache `ol_fetched_at`, `ol_expires_at`; timestamps and constraints `authors_manual_owner`, `authors_manual_or_ol`.
- `Work` ↔ table `works`: `id`; `title`; `openlibrary_id` (partial unique); `first_publish_year`; `primary_edition_id` FK editions; `manual`; `owner_user_id`; timestamps; constraints `works_manual_owner`, `works_manual_or_ol`.
- `Edition` ↔ table `editions`: `id`; `work_id` FK works; `title`; `openlibrary_id` (partial unique); `publish_year`; `publish_date`; `publish_date_raw`; `isbn13` (partial unique); `cover_url`; `language`; `manual`; `owner_user_id`; timestamps; constraints `editions_manual_owner`, `editions_manual_or_ol`.
- `AuthorWork` ↔ table `author_works`: composite PK (`author_id`, `work_id`); FKs to authors/works; `created_at`.
- `UserAuthor` ↔ table `user_authors`: composite PK (`user_id`, `author_id`); FKs to auth.users/authors; `created_at`.
- `UserWork` ↔ table `user_works`: composite PK (`user_id`, `work_id`); FKs to auth.users/works; `status` enum (`to_read | in_progress | read | hidden`); `available_in_legimi` tri-state; timestamps `created_at`, `updated_at`, `status_updated_at`.
- `OpenLibrary cache` (implicit, via authors/works/editions with `owner_user_id = null`, `ol_*` TTL fields).
- `Legimi check` (feature-flagged helper; writes `available_in_legimi` + timestamp on `user_works`).

## 2. Endpoints

### Authors (global catalog + manual)

- Purpose: manage global authors (OL-backed or manual) and fetch their works.

- **GET** `/api/authors/search`
  - Description: Search OpenLibrary authors with cached results for selection.
  - Query: `q` (string, required), `limit` (default 10).
  - Uses OpenLibrary search with 7-day cache, returns `{ authors: [{ id?, openlibrary_id, name, ol_fetched_at, ol_expires_at }] }`.
  - Responses: `200`; `502` OL error (with friendly message).

- **POST** `/api/authors`
  - Description: Create a manual author owned by the current user.
  - Body (manual create): `{ "name": string, "manual": true, "owner_user_id": auto, "openlibrary_id": null }`.
  - Validates limit (≤500 authors/user), `authors_manual_owner` and `authors_manual_or_ol`.
  - Responses: `201` `{ author }`; `400` validation; `409` unique/openlibrary_id conflict; `403` if non-owner manual.

- **POST** `/api/openlibrary/import/author`
  - Description: Import or refresh an OpenLibrary author into the shared catalog (cache TTL 7d).
  - Body: `{ "openlibrary_id": string }`
  - SECURITY DEFINER RPC: upsert author (owner null), refresh cache if expired (`ol_*`), optional `ol_expires_at` TTL 7d.
  - Responses: `200` `{ author }`; `502` OL unreachable.

- **GET** `/api/authors/{authorId}`
  - Description: Fetch author metadata from the catalog.
  - Returns author metadata (global); 404 if not visible via RLS.

- **DELETE** `/api/authors/{authorId}`
  - Description: Delete a manual author owned by the caller (cascades owned works/editions).
  - Only allowed when `manual=true` and `owner_user_id = auth.uid()`. Deletes linked editions/works via cascade.
  - Responses: `204`; `403`; `404`.

### Works (global catalog + manual)

- Purpose: manage works linked to authors (manual or OL-imported).

- **GET** `/api/authors/{authorId}/works`
  - Description: List works for an author with pagination and sorting.
  - Query: `page` (default 1), `sort` (`published_desc` default, `title_asc`), `forceRefresh` (bool to bypass cache when permitted).
  - Returns works with primary edition summary and publish year fallback (`COALESCE(work.first_publish_year, edition.publish_year)`).
  - Responses: `200` `{ items, page, total }`.

- **POST** `/api/works`
  - Description: Create a manual work and link it to authors.
  - Body (manual): `{ "title": string, "manual": true, "owner_user_id": auto, "author_ids": [uuid], "first_publish_year": smallint?, "primary_edition_id": uuid? }`.
  - Links authors via `author_works`; validates `works_manual_owner` and `works_manual_or_ol`.
  - Responses: `201` `{ work }`; `400`; `409` uniqueness.

- **POST** `/api/openlibrary/import/work`
  - Description: Import or refresh a work from OpenLibrary and attach to an author.
  - Body: `{ "openlibrary_id": string, "author_id": uuid }`
  - SECURITY DEFINER RPC to upsert work (owner null), maintain `author_works`, set `primary_edition_id` if supplied from OL.
  - Responses: `200`; `404` author not visible; `502` OL error.

- **GET** `/api/works/{workId}`
  - Description: Fetch a work with its primary edition summary.
  - Returns work + primary edition summary. `404` if not visible.

- **POST** `/api/works/{workId}/primary-edition`
  - Description: Set or change the primary edition for a work.
  - Body: `{ "edition_id": uuid }`
  - SECURITY DEFINER RPC `set_primary_edition`; validates edition belongs to work.
  - Responses: `200` `{ work }`; `404`.

### Editions

- Purpose: manage editions of a work (manual or OL-imported).

- **GET** `/api/works/{workId}/editions`
  - Description: List editions for a work sorted by publish year.
  - Lists editions sorted `publish_year desc`.
  - Responses: `200 { items }`.

- **POST** `/api/editions`
  - Description: Create a manual edition for a work.
  - Body (manual): `{ "work_id": uuid, "title": string, "manual": true, "publish_year": smallint?, "publish_date": date?, "publish_date_raw": string?, "isbn13": string?, "cover_url": string?, "language": string? }`.
  - Validates manual/owner and unique `isbn13` partial.
  - Responses: `201 { edition }`; `400`; `409`.

- **POST** `/api/openlibrary/import/edition`
  - Description: Import or refresh an edition from OpenLibrary for a work.
  - Body: `{ "openlibrary_id": string, "work_id": uuid }`
  - SECURITY DEFINER RPC; sets `ol_fetched_at`, `ol_expires_at`.
  - Responses: `200`; `404`; `502`.

### User Authors (profile)

- Purpose: manage the user’s personal set of followed/owned authors.

- **GET** `/api/user/authors`
  - Description: List user-attached authors with search and sort.
  - Query: `page` (default 1), `search` (name contains), `sort` (`name_asc` default, `created_desc`).
  - Uses index `user_authors(user_id)` + `authors(name/title idx)`.
  - Responses: `200 { items, total }`.

- **POST** `/api/user/authors`
  - Description: Attach an author to the user profile (counts toward limits).
  - Body: `{ "author_id": uuid }`
  - Attaches author; increments counters (trigger); enforces limit 500 and rate limit 10/min.
  - Responses: `201`; `400` invalid; `404` author not visible; `409` limit reached; `429` rate limited.

- **DELETE** `/api/user/authors/{authorId}`
  - Description: Detach an author from the user profile (cascades user works for that author).
  - Detaches author from user; cascades `user_works` for that author’s works; decrements counters.
  - Responses: `204`; `404` not attached.

### User Works (profile)

- Purpose: manage the user’s personal bookshelf items and statuses.

- **GET** `/api/user/works`
  - Description: List user-attached works with filters (status, availability) and sorting.
  - Query: `page` (1), `status` (multi enum), `available` (true|false|null), `sort` (`published_desc` default, `title_asc`), `author_id`, `search` (title substring).
  - Uses `user_works(user_id,status)`, `user_works(user_id,available)`, `works(title idx)`, `works(first_publish_year desc)`.
  - Response: `200 { items, total, page }` (items include work, primary edition summary, status, available, `status_updated_at`).

- **POST** `/api/user/works/bulk`
  - Description: Bulk attach works to the user with an initial status.
  - Body: `{ "work_ids": [uuid], "status": "to_read" (default) }`
  - Validates limit 5000, dedups existing, respects RLS (only works visible to user), returns created/ignored ids.
  - Responses: `201 { added, skipped }`; `409` limit exceeded; `400` empty list.

- **PATCH** `/api/user/works/{workId}`
- **POST** `/api/user/works/status-bulk`
  - Description (single): Update status and/or Legimi availability for one work.
  - Description (bulk): Update status/availability for multiple works at once.
  - Body (single): `{ "status"?: enum, "available_in_legimi"?: boolean|null }`
  - Body (bulk): `{ "work_ids": [uuid], "status"?: enum, "available_in_legimi"?: boolean|null }`
  - Updates trigger `status_updated_at` on status change.
  - Responses: `200 { work(s) }`; `404` not attached; `400` invalid enum.

- **DELETE** `/api/user/works/{workId}`
  - Description: Detach a work from the user’s list (does not remove global work).
  - Removes linkage; does not delete global work.
  - `204`; `404`.

### Analytics (server-emitted)

- Events fired internally on: `sign_up`, `add_author`, `add_books_bulk`, `mark_read` (status change to `read`), `check_legimi`. Payload includes counts of authors/works.

## 3. Authentication and Authorization

- Supabase email/password; endpoints expect `Authorization: Bearer <access_token>` or session cookie set by auth endpoints.
- RLS enforces:
  - Global catalog rows (`owner_user_id is null`) readable by all; writable only via SECURITY DEFINER RPCs.
  - Manual rows require `owner_user_id = auth.uid()` for write; read allowed if owner or owner null (per policy).
  - `user_authors` / `user_works` fully scoped to `auth.uid()`.
  - `profiles` accessible only to owner.
- Middleware: reject if no valid session; attach `auth.uid()` to context.
- Feature flags: Legimi check endpoint requires global flag ON.
- Rate limits: at least 10 author additions/min per user; apply to `/api/user/authors` (429).
- HTTPS required; httpOnly, secure cookies for session.

## 4. Validation and Business Logic

- Common validation:
  - UUID format for ids; `page` ≥1.
  - Status enum: `to_read | in_progress | read | hidden`.
  - `available_in_legimi`: boolean or null.
  - `first_publish_year` / `publish_year`: smallint (4-digit year), optional.
  - `name`/`title`: non-empty strings.
  - Manual constraints: when `manual=true`, require `owner_user_id = auth.uid()`; when `manual=false`, require `openlibrary_id` present.
  - Uniqueness: `openlibrary_id` partial unique; `isbn13` partial unique; handle 409 conflicts.
- Limits:
  - Max 500 authors/user; max 5000 works/user. Pre-check in API plus DB checks (profiles counters + triggers).
  - Rate limit 10 authors/min/user.
- Cache/TTL:
  - OpenLibrary imports respect `ol_expires_at` (7d); `forceRefresh` optional for owner-admin paths.
- Sorting/filtering:
  - Default sort for works by publish date desc using `COALESCE(works.first_publish_year, editions.publish_year)`.
  - Title sort uses case-insensitive index where available.
- Triggers/business rules:
  - `status_updated_at` auto-updated on status change.
  - `updated_at` auto-updated on mutations.
  - Counters `profiles.work_count`, `author_count` maintained via triggers/RPC on insert/delete to user\_\*.
  - Deleting `user_authors` cascades to their `user_works`.
- Error handling:
  - Friendly messages for OL/Legimi failures; do not overwrite existing data on external errors.
  - 404 when RLS denies visibility.
  - 422 for validation detail where appropriate.
