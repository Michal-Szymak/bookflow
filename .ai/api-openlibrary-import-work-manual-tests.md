# Manual Testing Guide: POST /api/openlibrary/import/work

## Prerequisites
- Dev server running: `npm run dev`
- Supabase environment variables configured
- Database tables: `authors`, `works`, `editions`, `author_works`
- **Note:** RLS (Row Level Security) policies are **disabled** for local development
- A test user account is available (for auth token)
- Public internet access to OpenLibrary API

## Authentication Setup

This endpoint **requires authentication**. Use an access token or session cookie.

### Using curl with Authorization header
```bash
curl -X POST "http://localhost:4321/api/openlibrary/import/work" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"openlibrary_id":"OL82563W","author_id":"<author_uuid>"}'
```

### Using curl with Session Cookie
```bash
curl -X POST "http://localhost:4321/api/openlibrary/import/work" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{"openlibrary_id":"OL82563W","author_id":"<author_uuid>"}'
```

**Note:** Replace `localhost:4321` with your dev server URL if different.

---

## Test Cases

### Test 1: Successful Import and Link
**Description:** Import a work from OpenLibrary and link it to a visible author.

**Request:**
```bash
curl -X POST "http://localhost:4321/api/openlibrary/import/work" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "openlibrary_id": "OL82563W",
    "author_id": "<author_uuid>"
  }'
```

**Expected Response:**
- Status: 200 OK
- JSON with `work` object containing:
  - `openlibrary_id`: "OL82563W"
  - `primary_edition`: object or null

**Verification Steps:**
1. Check `works` table for the imported work.
2. Check `author_works` table for the author-work link.
3. If `primary_edition` is present, verify `editions` row exists.
4. If `primary_edition` is present, verify `editions.ol_fetched_at` is recent and `ol_expires_at` is ~7 days later.

---

### Test 2: Import Same Work Twice (Idempotent)
**Description:** Repeat the same request to ensure it updates/returns existing data.

**Request:** Same as Test 1.

**Expected Response:**
- Status: 200 OK
- Same `work.id` as previous import (no duplicates).

---

### Test 3: Validation Error - Invalid openlibrary_id Format
**Description:** Provide a long-format or malformed ID.

**Request:**
```bash
curl -X POST "http://localhost:4321/api/openlibrary/import/work" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "openlibrary_id": "/works/OL82563W",
    "author_id": "<author_uuid>"
  }'
```

**Expected Response:**
- Status: 400 Bad Request
- Error message about short format requirement.

---

### Test 4: Author Not Found or Not Accessible
**Description:** Use an author_id that does not exist or is not visible due to RLS.

**Request:**
```bash
curl -X POST "http://localhost:4321/api/openlibrary/import/work" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "openlibrary_id": "OL82563W",
    "author_id": "<nonexistent_author_uuid>"
  }'
```

**Expected Response:**
- Status: 404 Not Found
- Message: "Author not found or not accessible"

---

### Test 5: OpenLibrary Work Not Found
**Description:** Use a non-existent OpenLibrary work ID.

**Request:**
```bash
curl -X POST "http://localhost:4321/api/openlibrary/import/work" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "openlibrary_id": "OL00000W",
    "author_id": "<author_uuid>"
  }'
```

**Expected Response:**
- Status: 404 Not Found
- Error indicating OpenLibrary work not found.

---

### Test 6: OpenLibrary Timeout or Network Error
**Description:** Simulate OpenLibrary being unavailable (disconnect network or block domain).

**Expected Response:**
- Status: 502 Bad Gateway
- Message: "Could not connect to OpenLibrary. Please try again later."

---

### Test 7: Unauthorized Request
**Description:** Omit authentication.

**Request:**
```bash
curl -X POST "http://localhost:4321/api/openlibrary/import/work" \
  -H "Content-Type: application/json" \
  -d '{
    "openlibrary_id": "OL82563W",
    "author_id": "<author_uuid>"
  }'
```

**Expected Response:**
- Status: 401 Unauthorized

---

### Test 8: Work Without Editions
**Description:** Use a work that has no editions in OpenLibrary.

**Expected Response:**
- Status: 200 OK
- `work.primary_edition` is `null`

---

### Test 9: Primary Edition Fallback by Latest Publish Date
**Description:** Use a work without `primary_edition` in OL response but with editions.

**Expected Response:**
- Status: 200 OK
- Primary edition selected from edition list with latest publish date.

