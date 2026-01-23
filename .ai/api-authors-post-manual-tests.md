# Manual Testing Guide: POST /api/authors

## Prerequisites
- Dev server running: `npm run dev`
- Supabase environment variables configured
- Database with `authors` and `profiles` tables created
- **User account created and authenticated** (profile should exist in `profiles` table)
- Authentication token/session available
- **Note:** RLS (Row Level Security) policies are **disabled** for local development

## Authentication Setup

This endpoint requires authentication. You need to obtain a valid session token.

### Option 1: Using Supabase Auth (Browser/Postman)
1. Sign up or sign in via Supabase Auth UI or API
2. The session cookie will be automatically set
3. For curl, extract the session token from browser cookies or use `Authorization: Bearer <token>` header

### Option 2: Using curl with Session Cookie
```bash
# First, sign in and get session cookie
# Then use it in subsequent requests:
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{"name": "Test Author", "manual": true}'
```

### Option 3: Using Bearer Token (if supported)
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"name": "Test Author", "manual": true}'
```

**Note:** Replace `<session-token>` or `<access-token>` with actual token from your Supabase session.

---

## Test Cases

### Test 1: Successful Author Creation (Happy Path)
**Description:** Create a manual author with valid data

**Request:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{
    "name": "John Doe",
    "manual": true
  }'
```

**Expected Response:**
- Status: 201 Created
- JSON with `author` object containing:
  - `id`: UUID
  - `name`: "John Doe"
  - `manual`: true
  - `owner_user_id`: Current user's ID
  - `openlibrary_id`: null
  - `ol_fetched_at`: null
  - `ol_expires_at`: null
  - `created_at`: ISO timestamp
  - `updated_at`: ISO timestamp
- Header: `Location: /api/authors/{authorId}`

**Example:**
```json
{
  "author": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
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

---

### Test 2: Missing Authentication (401 Unauthorized)
**Description:** Attempt to create author without authentication

**Request:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "manual": true
  }'
```

**Expected Response:**
- Status: 401 Unauthorized
- Error message about authentication required

**Example:**
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

---

### Test 3: Missing Required Field 'name' (400 Bad Request)
**Description:** Validation error when name is missing

**Request:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{
    "manual": true
  }'
```

**Expected Response:**
- Status: 400 Bad Request
- Error message about missing name

**Example:**
```json
{
  "error": "Validation error",
  "message": "Name is required",
  "details": [
    {
      "path": ["name"],
      "message": "Name is required"
    }
  ]
}
```

---

### Test 4: Empty Name (400 Bad Request)
**Description:** Validation error when name is empty or only whitespace

**Request:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{
    "name": "",
    "manual": true
  }'
```

**Expected Response:**
- Status: 400 Bad Request
- Error about empty name

**Example:**
```json
{
  "error": "Validation error",
  "message": "Name cannot be empty",
  "details": [...]
}
```

**Also test with whitespace only:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{
    "name": "   ",
    "manual": true
  }'
```

---

### Test 5: Name Too Long (400 Bad Request)
**Description:** Validation error when name exceeds 500 characters

**Request:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d "{
    \"name\": \"$(printf 'a%.0s' {1..501})\",
    \"manual\": true
  }"
```

**Expected Response:**
- Status: 400 Bad Request
- Error about name length exceeding 500 characters

---

### Test 6: Missing 'manual' Field (400 Bad Request)
**Description:** Validation error when manual is missing

**Request:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{
    "name": "John Doe"
  }'
```

**Expected Response:**
- Status: 400 Bad Request
- Error about missing manual field

---

### Test 7: 'manual' Not True (400 Bad Request)
**Description:** Validation error when manual is not true

**Request:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{
    "name": "John Doe",
    "manual": false
  }'
```

**Expected Response:**
- Status: 400 Bad Request
- Error message: "Manual must be true for manual authors"

**Example:**
```json
{
  "error": "Validation error",
  "message": "Manual must be true for manual authors",
  "details": [...]
}
```

---

### Test 8: Invalid 'openlibrary_id' (400 Bad Request)
**Description:** Validation error when openlibrary_id is provided but not null

**Request:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{
    "name": "John Doe",
    "manual": true,
    "openlibrary_id": "OL12345A"
  }'
```

**Expected Response:**
- Status: 400 Bad Request
- Error message: "openlibrary_id must be null for manual authors"

---

### Test 9: Valid 'openlibrary_id' as Null
**Description:** Should accept openlibrary_id as null (optional field)

**Request:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{
    "name": "John Doe",
    "manual": true,
    "openlibrary_id": null
  }'
```

**Expected Response:**
- Status: 201 Created
- Author created successfully (same as Test 1)

---

### Test 10: Invalid JSON Body (400 Bad Request)
**Description:** Validation error when request body is not valid JSON

**Request:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{ invalid json }'
```

**Expected Response:**
- Status: 400 Bad Request
- Error message: "Invalid JSON in request body"

---

### Test 11: Author Limit Exceeded (409 Conflict)
**Description:** Error when user has reached the maximum number of authors (500)

**Prerequisites:**
- User must have `author_count >= max_authors` (typically 500) in `profiles` table

**Request:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{
    "name": "John Doe",
    "manual": true
  }'
```

**Expected Response:**
- Status: 409 Conflict
- Error message about author limit reached

**Example:**
```json
{
  "error": "Conflict",
  "message": "Author limit reached (500 authors per user)"
}
```

**Note:** To test this, you may need to manually update the `profiles` table:
```sql
UPDATE profiles 
SET author_count = max_authors 
WHERE user_id = '<your-user-id>';
```

---

### Test 12: Profile Not Found (500 Internal Server Error)
**Description:** Error when user profile doesn't exist (should not happen in normal flow)

**Prerequisites:**
- User exists in `auth.users` but profile is missing from `profiles` table

**Request:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{
    "name": "John Doe",
    "manual": true
  }'
```

**Expected Response:**
- Status: 500 Internal Server Error
- Error message about profile not found

**Note:** This scenario should be rare - profiles should be created during user registration.

---

### Test 13: Name with Special Characters
**Description:** Verify that names with special characters are handled correctly

**Request:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{
    "name": "José María García-López",
    "manual": true
  }'
```

**Expected Response:**
- Status: 201 Created
- Author created with special characters preserved

---

### Test 14: Name with Leading/Trailing Whitespace
**Description:** Verify that name is trimmed before saving

**Request:**
```bash
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{
    "name": "  John Doe  ",
    "manual": true
  }'
```

**Expected Response:**
- Status: 201 Created
- Author created with trimmed name: "John Doe" (whitespace removed)

---

### Test 15: Multiple Authors with Same Name
**Description:** Verify that multiple authors can have the same name (no uniqueness constraint on name)

**Request:**
```bash
# Create first author
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{
    "name": "John Doe",
    "manual": true
  }'

# Create second author with same name
curl -X POST "http://localhost:4321/api/authors" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{
    "name": "John Doe",
    "manual": true
  }'
```

**Expected Response:**
- Status: 201 Created for both requests
- Both authors created successfully (different IDs)
- Same name is allowed for manual authors

---

## Testing Checklist

Before considering the endpoint complete, verify:

- [ ] Test 1: Successful creation works
- [ ] Test 2: Unauthorized access is rejected (401)
- [ ] Test 3: Missing name is rejected (400)
- [ ] Test 4: Empty name is rejected (400)
- [ ] Test 5: Name too long is rejected (400)
- [ ] Test 6: Missing manual is rejected (400)
- [ ] Test 7: Manual not true is rejected (400)
- [ ] Test 8: Invalid openlibrary_id is rejected (400)
- [ ] Test 9: Null openlibrary_id is accepted
- [ ] Test 10: Invalid JSON is rejected (400)
- [ ] Test 11: Limit exceeded is rejected (409)
- [ ] Test 12: Missing profile returns 500 (edge case)
- [ ] Test 13: Special characters are preserved
- [ ] Test 14: Name trimming works correctly
- [ ] Test 15: Duplicate names are allowed

---

## Notes

1. **Authentication**: Make sure you have a valid Supabase session before testing. The easiest way is to sign in through the Supabase Auth UI and copy the session cookie.

2. **Profile Creation**: Ensure your test user has a profile in the `profiles` table. If not, create one manually:
   ```sql
   INSERT INTO profiles (user_id, author_count, work_count, max_authors, max_works)
   VALUES ('<user-id>', 0, 0, 500, 5000);
   ```

3. **Database State**: Some tests (like limit exceeded) require specific database state. Reset the database state between test runs if needed.

4. **Port**: Default Astro dev server runs on port 4321. Adjust the URL if your server runs on a different port.

5. **Error Messages**: Verify that error messages are user-friendly and don't expose internal implementation details.

