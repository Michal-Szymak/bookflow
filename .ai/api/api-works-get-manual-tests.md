# Manual Testing Guide: GET /api/works/{workId}

## Prerequisites
- Dev server running: `npm run dev`
- Supabase environment variables configured
- Database tables: `works`, `editions`
- **Note:** RLS (Row Level Security) policies are **disabled** for local development
- At least one work with a primary edition
- At least one work without a primary edition (optional but recommended)

## Authentication Setup

This endpoint does **not** require authentication, but results are filtered by RLS.
If you want to validate user-specific visibility, use an access token or session cookie.

### Using curl with Authorization header (optional)
```bash
curl -X GET "http://localhost:3000/api/works/<work_uuid>" \
  -H "Authorization: Bearer <access_token>"
```

### Using curl with Session Cookie (optional)
```bash
curl -X GET "http://localhost:3000/api/works/<work_uuid>" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>"
```

**Note:** Replace `localhost:3000` with your dev server URL if different.

---

## Test Cases

### Test 1: Work exists with primary edition
**Description:** Fetch a work that has a primary edition.

**Request:**
```bash
curl -X GET "http://localhost:3000/api/works/<work_with_primary_edition_uuid>"
```

**Expected Response:**
- Status: 200 OK
- JSON contains `work`
- `work.primary_edition_id` is not null
- `work.primary_edition` is an object with edition summary fields (e.g., `id`, `title`)

---

### Test 2: Work exists without primary edition
**Description:** Fetch a work that has no primary edition assigned.

**Request:**
```bash
curl -X GET "http://localhost:3000/api/works/<work_without_primary_edition_uuid>"
```

**Expected Response:**
- Status: 200 OK
- JSON contains `work`
- `work.primary_edition_id` is null
- `work.primary_edition` is null

---

### Test 3: Invalid workId format
**Description:** Provide an invalid UUID to validate input handling.

**Request:**
```bash
curl -X GET "http://localhost:3000/api/works/not-a-uuid"
```

**Expected Response:**
- Status: 400 Bad Request
- Error message indicates invalid `workId`

---

### Test 4: Work not found
**Description:** Provide a UUID that does not exist in the database.

**Request:**
```bash
curl -X GET "http://localhost:3000/api/works/00000000-0000-0000-0000-000000000000"
```

**Expected Response:**
- Status: 404 Not Found
- Message: "Work not found or not accessible"

---

### Test 5: RLS restricted work (optional)
**Description:** Ensure a work not accessible to the current user is hidden.

**Setup:** Create a work owned by another user and enable RLS locally (or test in an environment with RLS enabled).

**Request:**
```bash
curl -X GET "http://localhost:3000/api/works/<restricted_work_uuid>" \
  -H "Authorization: Bearer <access_token_of_user_without_access>"
```

**Expected Response:**
- Status: 404 Not Found
- Message: "Work not found or not accessible"

