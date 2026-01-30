# Manual Testing Guide: GET /api/authors/{authorId}

## Prerequisites
- Dev server running: `npm run dev`
- Supabase environment variables configured
- Database with `authors` table created
- **Note:** RLS (Row Level Security) policies are **disabled** for local development
- At least one author in the database (global or manual) for testing

## Authentication Setup

This endpoint is **public** (does not require authentication). However, RLS policies control access:
- **Global authors** (`owner_user_id IS NULL`) - visible to everyone
- **Manual authors** (`owner_user_id = auth.uid()`) - visible only to the owner

For testing RLS behavior, you can optionally provide authentication:
- Without auth: Only global authors are accessible
- With auth: Global authors + your own manual authors are accessible

### Using curl without Authentication (default)
```bash
curl -X GET "http://localhost:3000/api/authors/{authorId}" \
  -H "Content-Type: application/json"
```

### Using curl with Session Cookie (for RLS testing)
```bash
curl -X GET "http://localhost:3000/api/authors/{authorId}" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>"
```

### Using Bearer Token (if supported)
```bash
curl -X GET "http://localhost:3000/api/authors/{authorId}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>"
```

**Note:** Replace `localhost:3000` with your dev server URL if different. Replace `{authorId}` with actual UUID.

---

## Test Cases

### Test 1: Successful Retrieval - Global Author (Happy Path)
**Description:** Retrieve a global author (from OpenLibrary catalog) by valid UUID. Global authors are visible to everyone.

**Prerequisites:**
- At least one global author exists in database (`owner_user_id IS NULL`)
- Get the author's UUID from database:
  ```sql
  SELECT id, name, openlibrary_id FROM authors WHERE owner_user_id IS NULL LIMIT 1;
  ```

**Request:**
```bash
curl -X GET "http://localhost:3000/api/authors/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json"
```

**Expected Response:**
- Status: 200 OK
- JSON with `author` object containing:
  - `id`: UUID (matches requested authorId)
  - `name`: Author name
  - `openlibrary_id`: OpenLibrary ID (string or null)
  - `manual`: false (for global authors)
  - `owner_user_id`: null (for global authors)
  - `ol_fetched_at`: ISO timestamp or null
  - `ol_expires_at`: ISO timestamp or null
  - `created_at`: ISO timestamp
  - `updated_at`: ISO timestamp

**Example:**
```json
{
  "author": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "J.K. Rowling",
    "openlibrary_id": "OL23919A",
    "manual": false,
    "owner_user_id": null,
    "ol_fetched_at": "2024-01-15T10:30:00.000Z",
    "ol_expires_at": "2024-01-22T10:30:00.000Z",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Verification Steps:**
1. Check that `owner_user_id` is `null` (global author)
2. Check that `manual` is `false` (from OpenLibrary)
3. Verify all required fields are present
4. Verify UUID matches the requested `authorId`

---

### Test 2: Successful Retrieval - Manual Author (as Owner)
**Description:** Retrieve a manual author by valid UUID when authenticated as the owner. Manual authors are only visible to their owner.

**Prerequisites:**
- User account created and authenticated
- At least one manual author owned by the authenticated user exists
- Get the author's UUID from database:
  ```sql
  SELECT id, name, owner_user_id FROM authors 
  WHERE manual = true AND owner_user_id = '<your-user-id>' 
  LIMIT 1;
  ```

**Request:**
```bash
curl -X GET "http://localhost:3000/api/authors/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>"
```

**Expected Response:**
- Status: 200 OK
- JSON with `author` object containing:
  - `id`: UUID (matches requested authorId)
  - `name`: Author name
  - `openlibrary_id`: null (for manual authors)
  - `manual`: true
  - `owner_user_id`: Current user's UUID
  - `ol_fetched_at`: null
  - `ol_expires_at`: null
  - `created_at`: ISO timestamp
  - `updated_at`: ISO timestamp

**Example:**
```json
{
  "author": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "openlibrary_id": null,
    "manual": true,
    "owner_user_id": "user-uuid-here",
    "ol_fetched_at": null,
    "ol_expires_at": null,
    "created_at": "2024-01-20T10:00:00.000Z",
    "updated_at": "2024-01-20T10:00:00.000Z"
  }
}
```

**Verification Steps:**
1. Check that `owner_user_id` matches the authenticated user's ID
2. Check that `manual` is `true`
3. Check that `openlibrary_id` is `null`
4. Verify all required fields are present

**Notes:**
- This test requires authentication
- In local dev with RLS disabled, this may work without auth (depending on RLS configuration)

---

### Test 3: Manual Author - Access Denied (as Different User)
**Description:** Attempt to retrieve a manual author owned by another user. Should return 404 Not Found due to RLS filtering.

**Prerequisites:**
- Two user accounts: User A (owner) and User B (different user)
- At least one manual author owned by User A
- Authenticated as User B
- Get the author's UUID from database:
  ```sql
  SELECT id, name, owner_user_id FROM authors 
  WHERE manual = true AND owner_user_id != '<user-b-id>' 
  LIMIT 1;
  ```

**Request:**
```bash
curl -X GET "http://localhost:3000/api/authors/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<user-b-session-token>"
```

**Expected Response:**
- Status: 404 Not Found
- JSON error response:
  ```json
  {
    "error": "Not found",
    "message": "Author not found or not accessible"
  }
  ```

**Verification Steps:**
1. Verify status code is 404
2. Verify error message is clear and doesn't reveal that author exists
3. Check logs: Should see warning/error log about author not found

**Notes:**
- This test verifies RLS policy enforcement
- In local dev with RLS disabled, this test may not work as expected (author may be accessible)
- The endpoint should not reveal whether author exists but is inaccessible (security best practice)

---

### Test 4: Invalid UUID Format (400 Bad Request)
**Description:** Attempt to retrieve an author with invalid UUID format. Should return 400 Bad Request.

**Request:**
```bash
curl -X GET "http://localhost:3000/api/authors/invalid-uuid" \
  -H "Content-Type: application/json"
```

**Expected Response:**
- Status: 400 Bad Request
- JSON error response:
  ```json
  {
    "error": "Validation error",
    "message": "authorId must be a valid UUID",
    "details": [
      {
        "path": ["authorId"],
        "message": "authorId must be a valid UUID"
      }
    ]
  }
  ```

**Verification Steps:**
1. Verify status code is 400
2. Verify error message indicates UUID validation failure
3. Verify `details` array contains validation error information
4. Check logs: Should see warning log about validation failure

**Additional Test Cases:**
- Test with empty string: `/api/authors/`
- Test with non-UUID string: `/api/authors/12345`
- Test with malformed UUID: `/api/authors/550e8400-e29b-41d4-a716` (missing part)
- Test with UUID with invalid characters: `/api/authors/550e8400-e29b-41d4-a716-44665544000g` (invalid hex)

---

### Test 5: Non-Existent Author (404 Not Found)
**Description:** Attempt to retrieve an author with valid UUID format that doesn't exist in the database. Should return 404 Not Found.

**Request:**
```bash
curl -X GET "http://localhost:3000/api/authors/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json"
```

**Note:** Use a valid UUID format that doesn't exist in your database. You can generate one:
```bash
# Generate a random UUID (Linux/Mac)
uuidgen

# Or use a known non-existent UUID
550e8400-e29b-41d4-a716-446655440000
```

**Expected Response:**
- Status: 404 Not Found
- JSON error response:
  ```json
  {
    "error": "Not found",
    "message": "Author not found or not accessible"
  }
  ```

**Verification Steps:**
1. Verify status code is 404
2. Verify error message is clear
3. Verify the UUID format is valid (not a validation error)
4. Check logs: Should see appropriate log entry

**Notes:**
- The error message should be the same as for inaccessible authors (security)
- This prevents information leakage about whether an author exists

---

### Test 6: Missing authorId Parameter (400 Bad Request)
**Description:** Attempt to access endpoint without authorId parameter. This should be handled by Astro routing, but included for completeness.

**Request:**
```bash
curl -X GET "http://localhost:3000/api/authors/" \
  -H "Content-Type: application/json"
```

**Expected Response:**
- Status: 400 Bad Request or 404 Not Found (depending on Astro routing)
- If handled by endpoint, JSON error response:
  ```json
  {
    "error": "Validation error",
    "message": "authorId parameter is required"
  }
  ```

**Notes:**
- This may be handled by Astro's routing system before reaching the endpoint
- If the endpoint is reached, it should return 400 with appropriate message

---

## Edge Cases and Additional Scenarios

### Test 7: Very Long UUID String
**Description:** Test with an extremely long string (potential DoS attempt)

**Request:**
```bash
curl -X GET "http://localhost:3000/api/authors/$(python3 -c 'print("a" * 1000)')" \
  -H "Content-Type: application/json"
```

**Expected Response:**
- Status: 400 Bad Request (UUID validation should fail)

---

### Test 8: Special Characters in UUID
**Description:** Test with special characters that might bypass validation

**Request:**
```bash
curl -X GET "http://localhost:3000/api/authors/550e8400-e29b-41d4-a716-446655440000'; DROP TABLE authors;--" \
  -H "Content-Type: application/json"
```

**Expected Response:**
- Status: 400 Bad Request (UUID validation should fail)
- No SQL injection should occur (Supabase uses parameterized queries)

---

### Test 9: Database Connection Error
**Description:** Simulate database connection failure (requires database to be down or connection issues)

**Expected Response:**
- Status: 500 Internal Server Error
- JSON error response:
  ```json
  {
    "error": "Internal server error",
    "message": "An unexpected error occurred"
  }
  ```

**Verification Steps:**
1. Check logs: Should see detailed error log with context
2. Verify user-facing message doesn't expose sensitive information

---

## Performance Testing

### Test 10: Response Time
**Description:** Measure response time for valid requests

**Request:**
```bash
time curl -X GET "http://localhost:3000/api/authors/{valid-author-id}" \
  -H "Content-Type: application/json" \
  -o /dev/null -s -w "%{time_total}\n"
```

**Expected:**
- Response time should be < 100ms for cached/optimized queries
- Database query should use index on `id` column (primary key)

---

## Summary Checklist

- [ ] Test 1: Global author retrieval (200 OK)
- [ ] Test 2: Manual author retrieval as owner (200 OK)
- [ ] Test 3: Manual author access denied as different user (404)
- [ ] Test 4: Invalid UUID format (400)
- [ ] Test 5: Non-existent author (404)
- [ ] Test 6: Missing authorId parameter (400/404)
- [ ] Test 7: Very long UUID string (400)
- [ ] Test 8: Special characters in UUID (400)
- [ ] Test 9: Database connection error (500)
- [ ] Test 10: Response time performance

---

## Notes

1. **RLS Behavior:** In local development, RLS policies may be disabled. Test RLS behavior in a staging/production environment with RLS enabled.

2. **Security:** The endpoint should not reveal whether an author exists but is inaccessible. Both non-existent and inaccessible authors should return 404.

3. **Caching:** This endpoint doesn't implement HTTP caching, but you can add `Cache-Control` headers for global authors if needed.

4. **Logging:** All errors should be logged with appropriate context (authorId, error type) for debugging and monitoring.

5. **Database Index:** The `id` column (primary key) is automatically indexed, ensuring fast lookups.

