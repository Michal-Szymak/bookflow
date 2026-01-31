# Manual Testing Guide: POST /api/openlibrary/import/edition

## Prerequisites

- Dev server running: `npm run dev`
- Supabase environment variables configured
- Database tables: `works`, `editions`
- RPC function `upsert_edition_from_ol` available
- **Note:** RLS (Row Level Security) policies are **disabled** for local development
- A test user account is available (for auth token)
- Public internet access to OpenLibrary API

## Authentication Setup

This endpoint **requires authentication**. Use an access token or session cookie.

### Using curl with Authorization header

```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"openlibrary_id":"OL7353617M","work_id":"<work_uuid>"}'
```

### Using curl with Session Cookie

```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/edition" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{"openlibrary_id":"OL7353617M","work_id":"<work_uuid>"}'
```

**Note:** Replace `localhost:3000` with your dev server URL if different.

---

## Test Cases

### Test 1: Successful Edition Import (Happy Path)

**Description:** Import an edition from OpenLibrary with valid `openlibrary_id` and an accessible `work_id`.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "openlibrary_id": "OL7353617M",
    "work_id": "<work_uuid>"
  }'
```

**Expected Response:**

- Status: 200 OK
- JSON with `edition` object containing:
  - `id`: UUID
  - `openlibrary_id`: "OL7353617M"
  - `work_id`: `<work_uuid>`
  - `manual`: false
  - `owner_user_id`: null
  - `ol_fetched_at`: ISO timestamp (current time)
  - `ol_expires_at`: ISO timestamp (7 days from `ol_fetched_at`)

**Verification Steps:**

1. Check database: Query `editions` table for the imported edition
   ```sql
   SELECT * FROM editions WHERE openlibrary_id = 'OL7353617M';
   ```
2. Verify fields:
   - `manual` should be `false`
   - `owner_user_id` should be `null`
   - `work_id` should match request
   - `ol_fetched_at` should be recent
   - `ol_expires_at` should be 7 days after `ol_fetched_at`

---

### Test 2: Import with Valid Cache

**Description:** Import an edition that already exists in the database with a valid (non-expired) cache.

**Prerequisites:**

- Run Test 1 first to create a cached edition
- Ensure `ol_expires_at` is in the future

**Request:** Same as Test 1.

**Expected Response:**

- Status: 200 OK
- `ol_fetched_at` and `ol_expires_at` should be the same as from Test 1 (not updated)

**Verification Steps:**

1. Check database: `ol_fetched_at` should NOT be updated
2. Check logs: Should see debug log "Cache hit"

---

### Test 3: Import with Expired Cache

**Description:** Import an edition with expired cache. The endpoint should fetch fresh data from OpenLibrary and update the cache.

**Prerequisites:**

- Run Test 1 first to create a cached edition
- Manually expire the cache in database:
  ```sql
  UPDATE editions
  SET ol_expires_at = NOW() - INTERVAL '1 day'
  WHERE openlibrary_id = 'OL7353617M';
  ```

**Request:** Same as Test 1.

**Expected Response:**

- Status: 200 OK
- `ol_fetched_at` and `ol_expires_at` updated to new values

---

### Test 4: Validation Error - Missing Required Fields

**Description:** Attempt to import without required fields.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{}'
```

**Expected Response:**

- Status: 400 Bad Request
- Error message about missing `openlibrary_id` and/or `work_id`

---

### Test 5: Validation Error - Invalid openlibrary_id Format

**Description:** Attempt to import using long format or leading slash.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "openlibrary_id": "/books/OL7353617M",
    "work_id": "<work_uuid>"
  }'
```

**Expected Response:**

- Status: 400 Bad Request
- Error message about short format requirement

---

### Test 6: Validation Error - Invalid work_id

**Description:** Provide a malformed UUID.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "openlibrary_id": "OL7353617M",
    "work_id": "not-a-uuid"
  }'
```

**Expected Response:**

- Status: 400 Bad Request
- Error message about invalid UUID

---

### Test 7: Work Not Found or Not Accessible

**Description:** Use a work_id that does not exist or is not visible due to RLS.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "openlibrary_id": "OL7353617M",
    "work_id": "<nonexistent_work_uuid>"
  }'
```

**Expected Response:**

- Status: 404 Not Found
- Message: "Work not found or not accessible"

---

### Test 8: Edition Not Found in OpenLibrary

**Description:** Use a valid format `openlibrary_id` that doesn't exist in OpenLibrary.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "openlibrary_id": "OL00000M",
    "work_id": "<work_uuid>"
  }'
```

**Expected Response:**

- Status: 404 Not Found
- Error indicating OpenLibrary edition not found

---

### Test 9: Unauthorized Request

**Description:** Omit authentication.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/edition" \
  -H "Content-Type: application/json" \
  -d '{
    "openlibrary_id": "OL7353617M",
    "work_id": "<work_uuid>"
  }'
```

**Expected Response:**

- Status: 401 Unauthorized

---

### Test 10: OpenLibrary API Unavailable

**Description:** Simulate OpenLibrary being unavailable (disconnect network or block domain).

**Expected Response:**

- Status: 502 Bad Gateway
- Message: "Could not connect to OpenLibrary. Please try again later."

---

### Test 11: Invalid JSON Body

**Description:** Send invalid JSON in the body.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{invalid json}'
```

**Expected Response:**

- Status: 400 Bad Request
- Message: "Invalid JSON in request body"

---

## Database Verification Queries

### Check Edition in Database

```sql
SELECT
  id,
  work_id,
  title,
  openlibrary_id,
  publish_year,
  publish_date,
  publish_date_raw,
  isbn13,
  cover_url,
  language,
  ol_fetched_at,
  ol_expires_at
FROM editions
WHERE openlibrary_id = 'OL7353617M';
```

### Check Cache Expiry

```sql
SELECT
  openlibrary_id,
  ol_fetched_at,
  ol_expires_at,
  CASE
    WHEN ol_expires_at > NOW() THEN 'Valid'
    ELSE 'Expired'
  END as cache_status,
  EXTRACT(EPOCH FROM (ol_expires_at - ol_fetched_at)) / 86400 as days_ttl
FROM editions
WHERE openlibrary_id = 'OL7353617M';
```

---

## Troubleshooting

### Issue: 401 Unauthorized

- **Cause:** Missing or invalid access token/session cookie
- **Solution:** Provide a valid token or session cookie

### Issue: 404 Not Found

- **Cause:** Work not visible (RLS) or edition not found in OpenLibrary
- **Solution:** Verify `work_id` visibility and OpenLibrary ID correctness

### Issue: 400 Validation Error

- **Cause:** Invalid `openlibrary_id` format or invalid `work_id`
- **Solution:** Use short format (e.g., "OL7353617M") and valid UUID

### Issue: 502 Bad Gateway

- **Cause:** OpenLibrary API unavailable or network issue
- **Solution:** Check internet connection, retry later

---

## Additional Notes

- **Cache TTL:** Cache expires after 7 days (`ol_expires_at`). After expiry, data is refreshed from OpenLibrary on next import.
- **Global Catalog:** Imported editions are stored in the global catalog (`owner_user_id = null`, `manual = false`).
- **Idempotency:** Multiple imports of the same edition are safe - RPC handles conflicts using `ON CONFLICT`.
- **Format:** Only short format `openlibrary_id` is accepted (e.g., "OL7353617M"). Long format (e.g., "/books/OL7353617M") is rejected.
