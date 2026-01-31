# Manual Testing Guide: POST /api/editions

## Prerequisites

- Dev server running: `npm run dev`
- Supabase environment variables configured
- Database tables: `works`, `editions`
- **Note:** RLS (Row Level Security) policies are **disabled** for local development
- An existing work owned by the authenticated user (`work_id`)

## Authentication Setup

This endpoint **requires authentication**.

### Using curl with Authorization header

```bash
curl -X POST "http://localhost:3000/api/editions" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Using curl with Session Cookie

```bash
curl -X POST "http://localhost:3000/api/editions" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Note:** Replace `localhost:3000` with your dev server URL if different.

---

## Test Cases

### Test 1: Successful Manual Edition Creation

**Description:** Create a manual edition with minimal required fields.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/editions" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "work_id": "<work_uuid>",
    "title": "Example Edition",
    "manual": true
  }'
```

**Expected Response:**

- Status: 201 Created
- JSON with `edition`
- `edition.manual = true`
- Header `Location: /api/editions/<edition_uuid>`

---

### Test 2: Validation Error - Invalid Payload

**Description:** Use invalid fields (e.g., missing title, invalid UUID).

**Request:**

```bash
curl -X POST "http://localhost:3000/api/editions" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "work_id": "not-a-uuid",
    "manual": true
  }'
```

**Expected Response:**

- Status: 400 Bad Request
- Error message about invalid `work_id` or missing `title`

---

### Test 3: Unauthorized Request

**Description:** Call endpoint without authentication.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/editions" \
  -H "Content-Type: application/json" \
  -d '{
    "work_id": "<work_uuid>",
    "title": "Example Edition",
    "manual": true
  }'
```

**Expected Response:**

- Status: 401 Unauthorized
- Message: "Authentication required"

---

### Test 4: Work Not Found or Not Accessible

**Description:** Use a `work_id` that does not exist or is blocked by RLS.

**Request:**

```bash
curl -X POST "http://localhost:3000/api/editions" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "work_id": "<missing_work_uuid>",
    "title": "Example Edition",
    "manual": true
  }'
```

**Expected Response:**

- Status: 404 Not Found
- Message: "Work not found or not accessible"

---

### Test 5: ISBN Conflict

**Description:** Create two editions with the same `isbn13`.

**Request 1:**

```bash
curl -X POST "http://localhost:3000/api/editions" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "work_id": "<work_uuid>",
    "title": "Edition A",
    "manual": true,
    "isbn13": "9781234567890"
  }'
```

**Request 2:**

```bash
curl -X POST "http://localhost:3000/api/editions" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "work_id": "<work_uuid>",
    "title": "Edition B",
    "manual": true,
    "isbn13": "9781234567890"
  }'
```

**Expected Response:**

- Request 1: 201 Created
- Request 2: 409 Conflict
- Message about ISBN conflict or constraint violation
