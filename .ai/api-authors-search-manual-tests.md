# Manual Testing Guide: GET /api/authors/search

## Prerequisites
- Dev server running: `npm run dev`
- Supabase environment variables configured
- Database with `authors` table created

## Test Cases

### Test 1: Basic Search (Happy Path)
**Description:** Search for a well-known author with default limit

**Request:**
```bash
curl "http://localhost:3000/api/authors/search?q=tolkien"
```

**Expected Response:** 
- Status: 200
- JSON with `authors` array
- Each author should have: `openlibrary_id`, `name`, `ol_fetched_at`, `ol_expires_at`
- May include `id` if author exists in DB

**Example:**
```json
{
  "authors": [
    {
      "openlibrary_id": "OL23919A",
      "name": "J.R.R. Tolkien",
      "ol_fetched_at": "2026-01-19T00:00:00.000Z",
      "ol_expires_at": "2026-01-26T00:00:00.000Z"
    }
  ]
}
```

---

### Test 2: Search with Custom Limit
**Description:** Limit results to specific number

**Request:**
```bash
curl "http://localhost:3000/api/authors/search?q=king&limit=3"
```

**Expected Response:**
- Status: 200
- Maximum 3 authors in results

---

### Test 3: Missing Required Parameter 'q'
**Description:** Validation error when query parameter is missing

**Request:**
```bash
curl "http://localhost:3000/api/authors/search"
```

**Expected Response:**
- Status: 400
- Error message about missing query parameter

**Example:**
```json
{
  "error": "Validation error",
  "message": "Search query is required",
  "details": [...]
}
```

---

### Test 4: Empty Query String
**Description:** Validation error when query is empty or only whitespace

**Request:**
```bash
curl "http://localhost:3000/api/authors/search?q="
curl "http://localhost:3000/api/authors/search?q=%20%20%20"
```

**Expected Response:**
- Status: 400
- Error about empty query

---

### Test 5: Query Too Long
**Description:** Validation error when query exceeds 200 characters

**Request:**
```bash
curl "http://localhost:3000/api/authors/search?q=$(printf 'a%.0s' {1..201})"
```

**Expected Response:**
- Status: 400
- Error message: "Search query cannot exceed 200 characters"

---

### Test 6: Invalid Limit (Too Low)
**Description:** Validation error when limit < 1

**Request:**
```bash
curl "http://localhost:3000/api/authors/search?q=test&limit=0"
```

**Expected Response:**
- Status: 400
- Error about limit minimum value

---

### Test 7: Invalid Limit (Too High)
**Description:** Validation error when limit > 50

**Request:**
```bash
curl "http://localhost:3000/api/authors/search?q=test&limit=100"
```

**Expected Response:**
- Status: 400
- Error message: "Limit cannot exceed 50"

---

### Test 8: Invalid Limit (Not a Number)
**Description:** Validation error when limit is not an integer

**Request:**
```bash
curl "http://localhost:3000/api/authors/search?q=test&limit=abc"
```

**Expected Response:**
- Status: 400
- Error about limit type

---

### Test 9: Cache Behavior
**Description:** Second request should use cached data (with `id` field)

**Step 1 - First Request:**
```bash
curl "http://localhost:3000/api/authors/search?q=asimov&limit=1"
```
- Should fetch from OpenLibrary
- May not have `id` field if author doesn't exist in DB
- Note the `ol_fetched_at` and `ol_expires_at` timestamps

**Step 2 - Second Request (immediately after):**
```bash
curl "http://localhost:3000/api/authors/search?q=asimov&limit=1"
```
- Should include `id` field (author now cached in DB)
- Same `ol_fetched_at` and `ol_expires_at` as first request
- Cache expires after 7 days

**Verification:**
- Check database: `SELECT * FROM authors WHERE openlibrary_id LIKE 'OL%' AND name ILIKE '%asimov%';`
- Should see the cached author with `ol_expires_at` = `ol_fetched_at` + 7 days

---

### Test 10: No Results Found
**Description:** Valid query but no matching authors in OpenLibrary

**Request:**
```bash
curl "http://localhost:3000/api/authors/search?q=xyzxyzxyznonexistent123456"
```

**Expected Response:**
- Status: 200
- Empty authors array

**Example:**
```json
{
  "authors": []
}
```

---

## Browser Testing (Optional)

You can also test in browser by navigating to:
- http://localhost:3000/api/authors/search?q=tolkien
- http://localhost:3000/api/authors/search?q=king&limit=5

The response should be displayed as JSON.

---

## Database Verification Queries

After running tests, verify cache behavior:

```sql
-- Check all cached authors from OpenLibrary
SELECT 
  id, 
  name, 
  openlibrary_id, 
  ol_fetched_at, 
  ol_expires_at,
  manual
FROM authors 
WHERE openlibrary_id IS NOT NULL
ORDER BY ol_fetched_at DESC;

-- Check cache expiry calculation (should be ~7 days)
SELECT 
  name,
  openlibrary_id,
  ol_fetched_at,
  ol_expires_at,
  ol_expires_at - ol_fetched_at as cache_duration
FROM authors 
WHERE openlibrary_id IS NOT NULL
ORDER BY ol_fetched_at DESC
LIMIT 10;

-- Check if manual flag is false for OL authors
SELECT COUNT(*) as cached_ol_authors
FROM authors 
WHERE openlibrary_id IS NOT NULL AND manual = false;
```

---

## Expected Console Logs

### Successful Request:
- No errors
- Cache update happens in background (not blocking response)

### OpenLibrary API Error:
```
OpenLibrary API error: [error details]
```

### Cache Lookup Failed (graceful degradation):
```
Cache lookup failed, proceeding without cache: [error details]
```

### Cache Update Failed (background operation):
```
Failed to update authors cache: [error details]
```

### Unexpected Error:
```
Unexpected error in /api/authors/search: [error details]
```

---

## Performance Expectations

- **Cached results:** < 500ms response time
- **Fresh OpenLibrary fetch:** < 2s response time
- **OpenLibrary timeout:** 10s maximum
- **Cache duration:** 7 days

---

## Test Summary Checklist

- [ ] Test 1: Basic search works
- [ ] Test 2: Custom limit works
- [ ] Test 3: Missing 'q' returns 400
- [ ] Test 4: Empty query returns 400
- [ ] Test 5: Query too long returns 400
- [ ] Test 6: Limit too low returns 400
- [ ] Test 7: Limit too high returns 400
- [ ] Test 8: Invalid limit type returns 400
- [ ] Test 9: Cache behavior works (second request has `id`)
- [ ] Test 10: No results returns empty array
- [ ] Database has cached entries with correct expiry
- [ ] Console logs are appropriate (no unexpected errors)

---

## Notes

- The endpoint is **public** (no authentication required)
- Background cache updates don't block the response
- Graceful degradation: if cache DB fails, still returns OL results
- OpenLibrary API may be slow or rate-limited, test accordingly

