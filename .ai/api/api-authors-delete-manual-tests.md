# Manual Testing Guide: DELETE /api/authors/{authorId}

## Prerequisites

- Dev server running: `npm run dev`
- Supabase environment variables configured
- Database with `authors`, `author_works`, `user_authors`, `works`, and `editions` tables created
- **User account created and authenticated** (profile should exist in `profiles` table)
- Authentication token/session available
- **Note:** RLS (Row Level Security) policies are **disabled** for local development

## Authentication Setup

This endpoint **requires authentication**. You need to obtain a valid session token.

### Option 1: Using Supabase Auth (Browser/Postman)

1. Sign up or sign in via Supabase Auth UI or API
2. The session cookie will be automatically set
3. For curl, extract the session token from browser cookies or use `Authorization: Bearer <token>` header

### Option 2: Using curl with Session Cookie

```bash
# First, sign in and get session cookie
# Then use it in subsequent requests:
curl -X DELETE "http://localhost:3000/api/authors/{authorId}" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>"
```

### Option 3: Using Bearer Token (if supported)

```bash
curl -X DELETE "http://localhost:3000/api/authors/{authorId}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>"
```

**Note:** Replace `<session-token>` or `<access-token>` with actual token from your Supabase session. Replace `{authorId}` with actual UUID of the author to delete.

---

## Test Cases

### Test 1: Successful Author Deletion (Happy Path)

**Description:** Delete a manual author owned by the authenticated user

**Prerequisites:**

- Authenticated user session
- Create a manual author owned by the current user:
  ```sql
  INSERT INTO authors (name, manual, owner_user_id)
  VALUES ('Test Author for Deletion', true, '<your-user-id>')
  RETURNING id;
  ```
- Save the returned `id` as `{authorId}`

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/authors/{authorId}" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>"
```

**Expected Response:**

- Status: 204 No Content
- No response body
- Header: `Content-Length: 0` (or no Content-Length header)

**Verification Steps:**

1. Check that the author was deleted from the database:

   ```sql
   SELECT * FROM authors WHERE id = '{authorId}';
   ```

   Should return 0 rows.

2. Check that all related `author_works` records were deleted:

   ```sql
   SELECT * FROM author_works WHERE author_id = '{authorId}';
   ```

   Should return 0 rows.

3. Check that all related `user_authors` records were deleted:
   ```sql
   SELECT * FROM user_authors WHERE author_id = '{authorId}';
   ```
   Should return 0 rows.

**Notes:**

- Cascading deletions are handled by the database
- The operation is irreversible

---

### Test 2: Missing Authentication (401 Unauthorized)

**Description:** Attempt to delete author without authentication

**Prerequisites:**

- A manual author exists in the database (owned by any user)

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/authors/{authorId}" \
  -H "Content-Type: application/json"
```

**Expected Response:**

- Status: 401 Unauthorized
- JSON error response:

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**Verification Steps:**

1. Verify that the author still exists in the database
2. Check server logs for authentication warning

---

### Test 3: Invalid UUID Format (400 Bad Request)

**Description:** Attempt to delete author with invalid UUID format

**Prerequisites:**

- Authenticated user session

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/authors/invalid-uuid-format" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>"
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

1. Check server logs for validation warning
2. Verify that no database operations were attempted

---

### Test 4: Missing authorId Parameter (400 Bad Request)

**Description:** Attempt to delete author without providing authorId (edge case)

**Note:** This test may not be applicable if the route structure prevents this scenario, but it's good to verify.

**Request:**

```bash
# This would require a malformed route, which may not be possible
# But if the route allows it, test with empty or missing parameter
```

**Expected Response:**

- Status: 400 Bad Request
- JSON error response:

```json
{
  "error": "Validation error",
  "message": "authorId parameter is required"
}
```

---

### Test 5: Author Not Found (404 Not Found)

**Description:** Attempt to delete a non-existent author

**Prerequisites:**

- Authenticated user session
- Use a valid UUID format that doesn't exist in the database:
  ```bash
  # Example: 00000000-0000-0000-0000-000000000000
  ```

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/authors/00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>"
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

1. Check server logs - should not log as error (normal scenario)
2. Verify that no database operations were attempted beyond the SELECT query

---

### Test 6: Attempt to Delete Non-Manual Author (403 Forbidden)

**Description:** Attempt to delete an author that is not manual (from OpenLibrary)

**Prerequisites:**

- Authenticated user session
- Create or find a global author (from OpenLibrary):
  ```sql
  INSERT INTO authors (name, openlibrary_id, manual, owner_user_id)
  VALUES ('Global Author', 'OL12345A', false, NULL)
  RETURNING id;
  ```
- Save the returned `id` as `{authorId}`

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/authors/{authorId}" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>"
```

**Expected Response:**

- Status: 403 Forbidden
- JSON error response:

```json
{
  "error": "Forbidden",
  "message": "Only manual authors owned by the current user can be deleted"
}
```

**Verification Steps:**

1. Verify that the author still exists in the database
2. Check server logs for warning about non-manual author
3. Verify that `manual` field is `false` for this author

---

### Test 7: Attempt to Delete Author Owned by Another User (403 Forbidden)

**Description:** Attempt to delete a manual author owned by a different user

**Prerequisites:**

- Authenticated user session (User A)
- Create a manual author owned by a different user (User B):
  ```sql
  -- First, get another user's ID (or create a test user)
  -- Then create author for that user:
  INSERT INTO authors (name, manual, owner_user_id)
  VALUES ('Other User Author', true, '<other-user-id>')
  RETURNING id;
  ```
- Save the returned `id` as `{authorId}`

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/authors/{authorId}" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token-for-user-a>"
```

**Expected Response:**

- Status: 403 Forbidden
- JSON error response:

```json
{
  "error": "Forbidden",
  "message": "Only manual authors owned by the current user can be deleted"
}
```

**Verification Steps:**

1. Verify that the author still exists in the database
2. Check server logs for warning about ownership mismatch
3. Verify that `owner_user_id` does not match the current user's ID

---

### Test 8: Cascading Deletion - Author with Related Records

**Description:** Delete an author that has related records in `author_works` and `user_authors`

**Prerequisites:**

- Authenticated user session
- Create a manual author owned by the current user:
  ```sql
  INSERT INTO authors (name, manual, owner_user_id)
  VALUES ('Author with Relations', true, '<your-user-id>')
  RETURNING id;
  ```
- Save the returned `id` as `{authorId}`
- Create related records:
  ```sql
  -- Create a manual work owned by the same user
  INSERT INTO works (title, manual, owner_user_id)
  VALUES ('Test Work', true, '<your-user-id>')
  RETURNING id;
  ```
- Save the returned work `id` as `{workId}`
- Link author to work:
  ```sql
  INSERT INTO author_works (author_id, work_id)
  VALUES ('{authorId}', '{workId}');
  ```
- Link author to user (if not already linked):
  ```sql
  INSERT INTO user_authors (user_id, author_id)
  VALUES ('<your-user-id>', '{authorId}');
  ```

**Request:**

```bash
curl -X DELETE "http://localhost:3000/api/authors/{authorId}" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>"
```

**Expected Response:**

- Status: 204 No Content
- No response body

**Verification Steps:**

1. Verify that the author was deleted:

   ```sql
   SELECT * FROM authors WHERE id = '{authorId}';
   ```

   Should return 0 rows.

2. Verify that `author_works` records were deleted:

   ```sql
   SELECT * FROM author_works WHERE author_id = '{authorId}';
   ```

   Should return 0 rows.

3. Verify that `user_authors` records were deleted:

   ```sql
   SELECT * FROM user_authors WHERE author_id = '{authorId}';
   ```

   Should return 0 rows.

4. **Note:** The work itself should still exist (works are not automatically deleted when author is deleted, only the relationship in `author_works` is removed)

---

### Test 9: Database Error Handling (500 Internal Server Error)

**Description:** Test error handling when database operation fails

**Prerequisites:**

- Authenticated user session
- This test may require simulating a database error (e.g., temporarily breaking the connection)

**Note:** This test is difficult to perform manually without breaking the database connection. It's primarily for automated testing or when database issues occur naturally.

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

1. Check server logs for detailed error information
2. Verify that error details are not exposed to the client

---

## Summary of Expected Status Codes

| Scenario                     | Status Code | Response Body           |
| ---------------------------- | ----------- | ----------------------- |
| Successful deletion          | 204         | No content              |
| Missing authentication       | 401         | Error JSON              |
| Invalid UUID format          | 400         | Error JSON with details |
| Missing authorId parameter   | 400         | Error JSON              |
| Author not found             | 404         | Error JSON              |
| Non-manual author            | 403         | Error JSON              |
| Author owned by another user | 403         | Error JSON              |
| Database error               | 500         | Error JSON              |

---

## Additional Notes

### Cascading Deletions

The database handles cascading deletions automatically:

- `author_works` records are deleted when the author is deleted (FK constraint: `on delete cascade`)
- `user_authors` records are deleted when the author is deleted (FK constraint: `on delete cascade`)
- **Note:** Works (`works`) are NOT automatically deleted when an author is deleted. Only the relationship in `author_works` is removed. If you need to delete works when an author is deleted, this would require additional logic or database triggers.

### RLS Policies

In production, RLS policies control access:

- Users can only delete authors they own (`owner_user_id = auth.uid()`)
- Only manual authors can be deleted by users
- Global authors (from OpenLibrary) cannot be deleted by users

For local development, RLS policies are disabled, but the endpoint still enforces these rules at the application level.

### Testing Checklist

- [ ] Test 1: Successful deletion
- [ ] Test 2: Missing authentication
- [ ] Test 3: Invalid UUID format
- [ ] Test 4: Missing authorId parameter
- [ ] Test 5: Author not found
- [ ] Test 6: Non-manual author
- [ ] Test 7: Author owned by another user
- [ ] Test 8: Cascading deletion with related records
- [ ] Test 9: Database error handling

---

## Troubleshooting

### Issue: 401 Unauthorized even with valid session

- Check that the session token is correctly extracted from browser cookies
- Verify that the session hasn't expired
- Ensure the cookie name matches your Supabase project reference

### Issue: 403 Forbidden for own author

- Verify that `manual = true` for the author
- Verify that `owner_user_id` matches the authenticated user's ID
- Check database directly to confirm author properties

### Issue: Cascading deletions not working

- Verify that foreign key constraints have `on delete cascade` in the database schema
- Check database logs for constraint violations
- Ensure RLS policies allow the deletion operation

### Issue: Author still exists after 204 response

- Check if there are any database triggers that might be preventing deletion
- Verify that the deletion query actually matched a row (check Supabase response)
- Check for any transaction rollbacks in database logs
