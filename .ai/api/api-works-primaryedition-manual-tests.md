# Manual Testing Guide: POST /api/works/{workId}/primary-edition

## Prerequisites

- Dev server running: `npm run dev`
- Supabase environment variables configured
- Database tables: `works`, `editions`
- **Note:** RLS (Row Level Security) policies are **disabled** for local development
- A test user account is available (for auth token)
- A work with at least one edition (same work_id)
- A second edition that belongs to a different work (for mismatch test)

## Authentication Setup

This endpoint **requires authentication**. Use an access token or session cookie.

### Using curl with Authorization header

```bash
curl -X POST "http://localhost:3000/api/works/<work_uuid>/primary-edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"edition_id":"<edition_uuid>"}'
```

### Using curl with Session Cookie

```bash
curl -X POST "http://localhost:3000/api/works/<work_uuid>/primary-edition" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{"edition_id":"<edition_uuid>"}'
```

**Note:** Replace `localhost:3000` with your dev server URL if different.

---

## Test Cases

### Test 1: Successful Primary Edition Update

**Description:** Set primary edition for a work using a valid edition that belongs to it.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/works/<work_uuid>/primary-edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "edition_id": "<edition_uuid>"
  }'
```

**Expected Response:**

- Status: 200 OK
- JSON with `work` object containing:
  - `id`: matches `<work_uuid>`
  - `primary_edition_id`: matches `<edition_uuid>`
  - `primary_edition`: object with edition summary

**Verification Steps:**

1. Check `works.primary_edition_id` updated to `<edition_uuid>`.
2. Confirm `work.primary_edition` matches the edition row.

---

### Test 2: Idempotent Update (Same Edition)

**Description:** Repeat the same request to ensure no errors and consistent response.

**Request:** Same as Test 1.

**Expected Response:**

- Status: 200 OK
- `primary_edition_id` remains `<edition_uuid>`

---

### Test 3: Validation Error - Invalid workId

**Description:** Use an invalid UUID in the path.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/works/not-a-uuid/primary-edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"edition_id":"<edition_uuid>"}'
```

**Expected Response:**

- Status: 400 Bad Request
- Error message about invalid `workId`

---

### Test 4: Validation Error - Invalid edition_id

**Description:** Provide an invalid UUID in the body.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/works/<work_uuid>/primary-edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"edition_id":"not-a-uuid"}'
```

**Expected Response:**

- Status: 400 Bad Request
- Error message about invalid `edition_id`

---

### Test 5: Validation Error - Invalid JSON

**Description:** Send malformed JSON in the request body.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/works/<work_uuid>/primary-edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"edition_id":'
```

**Expected Response:**

- Status: 400 Bad Request
- Message: "Invalid JSON in request body"

---

### Test 6: Work Not Found or Not Accessible

**Description:** Use a workId that does not exist or is blocked by RLS.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/works/<missing_work_uuid>/primary-edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"edition_id":"<edition_uuid>"}'
```

**Expected Response:**

- Status: 404 Not Found
- Message: "Work not found or not accessible"

---

### Test 7: Edition Not Found or Not Accessible

**Description:** Use an edition_id that does not exist or is blocked by RLS.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/works/<work_uuid>/primary-edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"edition_id":"<missing_edition_uuid>"}'
```

**Expected Response:**

- Status: 404 Not Found
- Message: "Edition not found or not accessible"

---

### Test 8: Validation Error - Edition Belongs to Another Work

**Description:** Use an edition_id that belongs to a different work.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/works/<work_uuid>/primary-edition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"edition_id":"<edition_uuid_from_other_work>"}'
```

**Expected Response:**

- Status: 400 Bad Request
- Message: "edition_id does not belong to workId"

---

### Test 9: Unauthorized Request

**Description:** Omit authentication.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/works/<work_uuid>/primary-edition" \
  -H "Content-Type: application/json" \
  -d '{"edition_id":"<edition_uuid>"}'
```

**Expected Response:**

- Status: 401 Unauthorized
