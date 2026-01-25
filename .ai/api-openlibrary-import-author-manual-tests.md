# Manual Testing Guide: POST /api/openlibrary/import/author

## Prerequisites
- Dev server running: `npm run dev`
- Supabase environment variables configured
- Database with `authors` table created
- RPC function `upsert_authors_cache` available
- **Note:** RLS (Row Level Security) policies are **disabled** for local development
- Access to OpenLibrary API (internet connection required)

## Authentication Setup

This endpoint does **not require authentication** (anonymous access). However, if you want to track usage in logs, you can optionally provide a session token.

### Optional: Using curl with Session Cookie (for logging)
```bash
# If you want to track requests in logs, you can provide a session cookie:
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{"openlibrary_id": "OL23919A"}'
```

### Using curl without Authentication (default)
```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -d '{"openlibrary_id": "OL23919A"}'
```

**Note:** Replace `localhost:3000` with your dev server URL if different.

---

## Test Cases

### Test 1: Successful Author Import (Happy Path)
**Description:** Import an author from OpenLibrary with a valid `openlibrary_id`. This should fetch the author from OpenLibrary API and store it in the database with cache TTL.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -d '{
    "openlibrary_id": "OL23919A"
  }'
```

**Expected Response:**
- Status: 200 OK
- JSON with `author` object containing:
  - `id`: UUID
  - `name`: Author name from OpenLibrary (e.g., "J.K. Rowling")
  - `openlibrary_id`: "OL23919A" (short format)
  - `manual`: false
  - `owner_user_id`: null
  - `ol_fetched_at`: ISO timestamp (current time)
  - `ol_expires_at`: ISO timestamp (7 days from `ol_fetched_at`)
  - `created_at`: ISO timestamp
  - `updated_at`: ISO timestamp

**Example:**
```json
{
  "author": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "J.K. Rowling",
    "openlibrary_id": "OL23919A",
    "manual": false,
    "owner_user_id": null,
    "ol_fetched_at": "2024-01-20T10:00:00.000Z",
    "ol_expires_at": "2024-01-27T10:00:00.000Z",
    "created_at": "2024-01-20T10:00:00.000Z",
    "updated_at": "2024-01-20T10:00:00.000Z"
  }
}
```

**Verification Steps:**
1. Check database: Query `authors` table for the imported author
   ```sql
   SELECT * FROM authors WHERE openlibrary_id = 'OL23919A';
   ```
2. Verify fields:
   - `manual` should be `false`
   - `owner_user_id` should be `null`
   - `ol_fetched_at` should be recent (within last minute)
   - `ol_expires_at` should be exactly 7 days after `ol_fetched_at`
   - `openlibrary_id` should be in short format (e.g., "OL23919A")
3. Check logs: Should see debug log "Successfully imported/refreshed author"

**Notes:**
- This test requires internet connection to OpenLibrary API
- The author name may vary depending on OpenLibrary data
- First import will create a new record; subsequent imports will update the cache

---

### Test 2: Import with Valid Cache
**Description:** Import an author that already exists in the database with a valid (non-expired) cache. The endpoint should return data from cache without calling OpenLibrary API.

**Prerequisites:**
- Run Test 1 first to create a cached author
- Ensure `ol_expires_at` is in the future (cache is valid)

**Request:**
```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -d '{
    "openlibrary_id": "OL23919A"
  }'
```

**Expected Response:**
- Status: 200 OK
- JSON with `author` object from cache (same data as Test 1)
- `ol_fetched_at` and `ol_expires_at` should be the same as from Test 1 (not updated)

**Verification Steps:**
1. Check database: `ol_fetched_at` should NOT be updated (should match previous value)
2. Check logs: Should see debug log "Cache hit" (not "Cache miss or expired")
3. Verify no OpenLibrary API call was made (check network logs or OpenLibrary API logs if available)

**Notes:**
- Cache is valid if `ol_expires_at > now()`
- The response should be immediate (no network delay from OpenLibrary API)
- Database record should remain unchanged

---

### Test 3: Import with Expired Cache
**Description:** Import an author with expired cache. The endpoint should fetch fresh data from OpenLibrary API and update the cache.

**Prerequisites:**
- Run Test 1 first to create a cached author
- Manually expire the cache in database:
  ```sql
  UPDATE authors 
  SET ol_expires_at = NOW() - INTERVAL '1 day'
  WHERE openlibrary_id = 'OL23919A';
  ```

**Request:**
```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -d '{
    "openlibrary_id": "OL23919A"
  }'
```

**Expected Response:**
- Status: 200 OK
- JSON with `author` object containing:
  - `ol_fetched_at`: Updated to current time
  - `ol_expires_at`: Updated to 7 days from new `ol_fetched_at`
  - Other fields may be updated if OpenLibrary data changed

**Verification Steps:**
1. Check database: `ol_fetched_at` should be updated to current time
2. Check database: `ol_expires_at` should be updated to 7 days from new `ol_fetched_at`
3. Check logs: Should see debug log "Cache miss or expired, fetching from OpenLibrary"
4. Check logs: Should see debug log "Successfully imported/refreshed author"

**Notes:**
- This test requires internet connection to OpenLibrary API
- Cache refresh should happen automatically when `ol_expires_at < now()`

---

### Test 4: Validation Error - Missing openlibrary_id
**Description:** Attempt to import an author without providing `openlibrary_id` field.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
- Status: 400 Bad Request
- JSON with error details:
  ```json
  {
    "error": "Validation error",
    "message": "openlibrary_id is required",
    "details": [
      {
        "path": ["openlibrary_id"],
        "message": "Required"
      }
    ]
  }
  ```

**Verification Steps:**
1. Check response status code: 400
2. Check error message: Should indicate missing `openlibrary_id`
3. Check logs: Should see warn log "Validation failed"

**Notes:**
- This should fail before any database or API calls

---

### Test 5: Validation Error - Invalid openlibrary_id Format
**Description:** Attempt to import an author with invalid `openlibrary_id` format (long format with `/authors/` prefix or leading slash).

**Request (Long Format - Should be Rejected):**
```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -d '{
    "openlibrary_id": "/authors/OL23919A"
  }'
```

**Expected Response:**
- Status: 400 Bad Request
- JSON with error details:
  ```json
  {
    "error": "Validation error",
    "message": "openlibrary_id must be in short format (e.g., 'OL23919A'), not long format (e.g., '/authors/OL23919A')",
    "details": [
      {
        "path": ["openlibrary_id"],
        "message": "openlibrary_id must be in short format (e.g., 'OL23919A'), not long format (e.g., '/authors/OL23919A')"
      }
    ]
  }
  ```

**Request (Leading Slash - Should be Rejected):**
```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -d '{
    "openlibrary_id": "/OL23919A"
  }'
```

**Expected Response:**
- Status: 400 Bad Request
- Similar error message about short format requirement

**Request (Too Long - Should be Rejected):**
```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -d '{
    "openlibrary_id": "OL23919A" + "X".repeat(20)
  }'
```

**Expected Response:**
- Status: 400 Bad Request
- Error message about exceeding 25 character limit

**Verification Steps:**
1. Check response status code: 400 for all invalid formats
2. Check error message: Should indicate format validation failure
3. Check logs: Should see warn log "Validation failed"

**Notes:**
- Only short format (e.g., "OL23919A") should be accepted
- Long format (e.g., "/authors/OL23919A") should be rejected
- Leading slash (e.g., "/OL23919A") should be rejected
- Maximum length is 25 characters

---

### Test 6: Author Not Found in OpenLibrary
**Description:** Attempt to import an author with a valid format `openlibrary_id` that doesn't exist in OpenLibrary.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -d '{
    "openlibrary_id": "OL99999Z"
  }'
```

**Expected Response:**
- Status: 404 Not Found
- JSON with error details:
  ```json
  {
    "error": "Author not found",
    "message": "Author with openlibrary_id 'OL99999Z' not found in OpenLibrary"
  }
  ```

**Verification Steps:**
1. Check response status code: 404
2. Check error message: Should indicate author not found
3. Check logs: Should see warn log "Author not found in OpenLibrary"
4. Check database: No new record should be created

**Notes:**
- This test requires internet connection to OpenLibrary API
- Use a non-existent OpenLibrary ID (format should be valid, e.g., "OL99999Z")
- The endpoint should not create a database record for non-existent authors

---

### Test 7: OpenLibrary API Unavailable
**Description:** Test behavior when OpenLibrary API is unavailable or returns an error. This can be simulated by blocking network access or using an invalid OpenLibrary base URL (requires code modification for testing).

**Note:** This test is difficult to simulate without modifying the code or network configuration. For manual testing, you can:
1. Temporarily disconnect from internet
2. Or modify `OpenLibraryService.baseUrl` to an invalid URL

**Request:**
```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -d '{
    "openlibrary_id": "OL23919A"
  }'
```

**Expected Response (Network Error/Timeout):**
- Status: 502 Bad Gateway
- JSON with error details:
  ```json
  {
    "error": "External service error",
    "message": "Could not connect to OpenLibrary. Please try again later."
  }
  ```

**Verification Steps:**
1. Check response status code: 502
2. Check error message: Should indicate external service error
3. Check logs: Should see error log "OpenLibrary API error"
4. Check database: No new record should be created (or existing record should not be updated)

**Notes:**
- This test simulates network failures, timeouts, or 5xx errors from OpenLibrary
- The endpoint should handle these gracefully without crashing
- User-friendly error message should be returned

---

### Test 8: Invalid JSON Body
**Description:** Attempt to send a request with invalid JSON in the body.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -d '{invalid json}'
```

**Expected Response:**
- Status: 400 Bad Request
- JSON with error details:
  ```json
  {
    "error": "Validation error",
    "message": "Invalid JSON in request body"
  }
  ```

**Verification Steps:**
1. Check response status code: 400
2. Check error message: Should indicate invalid JSON
3. Check logs: Should see warn log "Invalid JSON body"

**Notes:**
- This should fail before any validation or processing

---

### Test 9: Concurrent Imports
**Description:** Test concurrent imports of the same author to verify that RPC handles conflicts safely and no duplicates are created.

**Prerequisites:**
- Clear any existing author with `openlibrary_id = 'OL23919A'`:
  ```sql
  DELETE FROM authors WHERE openlibrary_id = 'OL23919A';
  ```

**Request (Run multiple times simultaneously):**
```bash
# Terminal 1
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -d '{"openlibrary_id": "OL23919A"}' &

# Terminal 2 (run immediately after Terminal 1)
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -d '{"openlibrary_id": "OL23919A"}' &

# Terminal 3 (run immediately after Terminal 2)
curl -X POST "http://localhost:3000/api/openlibrary/import/author" \
  -H "Content-Type: application/json" \
  -d '{"openlibrary_id": "OL23919A"}' &

wait
```

**Expected Response:**
- All requests should return 200 OK
- All responses should contain the same author data
- No database errors should occur

**Verification Steps:**
1. Check database: Should have exactly ONE record with `openlibrary_id = 'OL23919A'`
   ```sql
   SELECT COUNT(*) FROM authors WHERE openlibrary_id = 'OL23919A';
   -- Should return 1
   ```
2. Check database: No duplicate records should exist
3. Check logs: All requests should complete successfully
4. Verify: All responses should have the same `id` (same author record)

**Notes:**
- RPC `upsert_authors_cache` uses `ON CONFLICT` to handle concurrent inserts safely
- This test verifies that the unique constraint on `openlibrary_id` is respected
- All concurrent requests should succeed without errors

---

## Database Verification Queries

### Check Author in Database
```sql
SELECT 
  id,
  name,
  openlibrary_id,
  manual,
  owner_user_id,
  ol_fetched_at,
  ol_expires_at,
  created_at,
  updated_at
FROM authors
WHERE openlibrary_id = 'OL23919A';
```

### Check Cache Expiry
```sql
SELECT 
  openlibrary_id,
  name,
  ol_fetched_at,
  ol_expires_at,
  CASE 
    WHEN ol_expires_at > NOW() THEN 'Valid'
    ELSE 'Expired'
  END as cache_status,
  EXTRACT(EPOCH FROM (ol_expires_at - ol_fetched_at)) / 86400 as days_ttl
FROM authors
WHERE openlibrary_id = 'OL23919A';
```

### Check for Duplicates
```sql
SELECT 
  openlibrary_id,
  COUNT(*) as count
FROM authors
WHERE openlibrary_id IS NOT NULL
GROUP BY openlibrary_id
HAVING COUNT(*) > 1;
-- Should return no rows (no duplicates)
```

### List All OpenLibrary Authors (Global Catalog)
```sql
SELECT 
  id,
  name,
  openlibrary_id,
  ol_fetched_at,
  ol_expires_at
FROM authors
WHERE openlibrary_id IS NOT NULL
  AND owner_user_id IS NULL
  AND manual = false
ORDER BY ol_fetched_at DESC;
```

---

## Troubleshooting

### Issue: 502 Bad Gateway
- **Cause:** OpenLibrary API is unavailable or network issue
- **Solution:** Check internet connection, verify OpenLibrary API is accessible
- **Workaround:** Wait and retry, or check OpenLibrary API status

### Issue: 404 Not Found
- **Cause:** Author doesn't exist in OpenLibrary
- **Solution:** Verify the `openlibrary_id` is correct and exists in OpenLibrary
- **Verification:** Check OpenLibrary directly: `https://openlibrary.org/authors/OL23919A.json`

### Issue: 400 Validation Error
- **Cause:** Invalid `openlibrary_id` format
- **Solution:** Use short format (e.g., "OL23919A"), not long format (e.g., "/authors/OL23919A")
- **Check:** Ensure `openlibrary_id` is max 25 characters and doesn't start with "/"

### Issue: Cache Not Working
- **Cause:** Cache may be expired or not set correctly
- **Solution:** Check `ol_expires_at` in database, verify it's 7 days from `ol_fetched_at`
- **Verification:** Run Test 2 to verify cache hit behavior

### Issue: Database Errors
- **Cause:** RPC function `upsert_authors_cache` may not exist or have wrong permissions
- **Solution:** Verify migration `20260120191003_add_authors_openlibrary_unique_constraint.sql` was applied
- **Check:** Verify RPC function exists:
  ```sql
  SELECT routine_name 
  FROM information_schema.routines 
  WHERE routine_name = 'upsert_authors_cache';
  ```

---

## Additional Notes

- **Cache TTL:** Cache expires after 7 days (`ol_expires_at`). After expiry, data is automatically refreshed from OpenLibrary on next import.
- **Global Catalog:** All imported authors are stored in the global catalog (`owner_user_id = null`, `manual = false`).
- **Idempotency:** Multiple imports of the same author are safe - RPC handles conflicts using `ON CONFLICT`.
- **Format:** Only short format `openlibrary_id` is accepted (e.g., "OL23919A"). Long format (e.g., "/authors/OL23919A") is rejected.
- **Rate Limiting:** Currently no rate limiting is implemented. Consider adding if needed for production.

