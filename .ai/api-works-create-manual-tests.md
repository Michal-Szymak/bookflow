# Manual Testing Guide: POST /api/works

## Prerequisites
- Dev server running: `npm run dev`
- Supabase environment variables configured
- Database tables: `works`, `authors`, `author_works`, `profiles`
- **Note:** RLS (Row Level Security) policies are **disabled** for local development
- A test user account is available (for auth token)

## Authentication Setup

This endpoint **requires authentication**. Use an access token or session cookie.

### Using curl with Authorization header
```bash
curl -X POST "http://localhost:4321/api/works" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"title":"Test Work","manual":true,"author_ids":["<author_uuid>"]}'
```

### Using curl with Session Cookie
```bash
curl -X POST "http://localhost:4321/api/works" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>" \
  -d '{"title":"Test Work","manual":true,"author_ids":["<author_uuid>"]}'
```

**Note:** Replace `localhost:4321` with your dev server URL if different.

---

## Test Cases

### Test 1: Successful Work Creation (Single Author)
**Description:** Create a manual work with a valid title and a single author ID.

**Request:**
```bash
curl -X POST "http://localhost:4321/api/works" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "title": "My First Work",
    "manual": true,
    "author_ids": ["<author_uuid>"]
  }'
```

**Expected Response:**
- Status: 201 Created
- JSON with `work` object containing:
  - `id`: UUID
  - `title`: "My First Work"
  - `manual`: true
  - `owner_user_id`: current user ID
  - `primary_edition_id`: null
  - `primary_edition`: null

**Verification Steps:**
1. Check `works` table for the new work.
2. Check `author_works` table for the author-work link.

---

### Test 2: Successful Work Creation (Multiple Authors)
**Description:** Create a manual work linked to multiple authors.

**Request:**
```bash
curl -X POST "http://localhost:4321/api/works" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "title": "Collaborative Work",
    "manual": true,
    "author_ids": ["<author_uuid_1>", "<author_uuid_2>"]
  }'
```

**Expected Response:**
- Status: 201 Created
- `work` returned with `primary_edition` null

**Verification Steps:**
1. Check `author_works` table: two rows for the new work.

---

### Test 3: Successful Work Creation with `first_publish_year`
**Description:** Create a work with a valid `first_publish_year`.

**Request:**
```bash
curl -X POST "http://localhost:4321/api/works" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "title": "Vintage Work",
    "manual": true,
    "author_ids": ["<author_uuid>"],
    "first_publish_year": 1998
  }'
```

**Expected Response:**
- Status: 201 Created
- `work.first_publish_year` equals `1998`

---

### Test 4: Invalid `primary_edition_id`
**Description:** Provide a `primary_edition_id` that does not belong to the created work.

**Request:**
```bash
curl -X POST "http://localhost:4321/api/works" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "title": "Work With Wrong Edition",
    "manual": true,
    "author_ids": ["<author_uuid>"],
    "primary_edition_id": "<edition_uuid_from_other_work>"
  }'
```

**Expected Response:**
- Status: 400 Bad Request
- Error message indicating invalid `primary_edition_id`

**Notes:**
- A successful `primary_edition_id` scenario requires an edition already linked to the newly created work.
- If needed, validate this via direct DB setup or by setting primary edition later with `POST /api/works/{workId}/primary-edition`.

---

### Test 5: Validation Error - Empty Title
**Description:** Provide an empty title.

**Request:**
```bash
curl -X POST "http://localhost:4321/api/works" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "title": "   ",
    "manual": true,
    "author_ids": ["<author_uuid>"]
  }'
```

**Expected Response:**
- Status: 400 Bad Request
- Error message about title validation

---

### Test 6: Validation Error - Empty `author_ids`
**Description:** Provide an empty array of authors.

**Request:**
```bash
curl -X POST "http://localhost:4321/api/works" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "title": "No Authors Work",
    "manual": true,
    "author_ids": []
  }'
```

**Expected Response:**
- Status: 400 Bad Request
- Error message about author_ids validation

---

### Test 7: Unauthorized Request
**Description:** Omit authentication.

**Request:**
```bash
curl -X POST "http://localhost:4321/api/works" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Unauthorized Work",
    "manual": true,
    "author_ids": ["<author_uuid>"]
  }'
```

**Expected Response:**
- Status: 401 Unauthorized

---

### Test 8: Author Not Found
**Description:** Provide a non-existent author ID.

**Request:**
```bash
curl -X POST "http://localhost:4321/api/works" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "title": "Unknown Author Work",
    "manual": true,
    "author_ids": ["00000000-0000-0000-0000-000000000000"]
  }'
```

**Expected Response:**
- Status: 404 Not Found
- Error message listing invalid author IDs

---

### Test 9: Work Limit Exceeded
**Description:** Force user profile to reach `max_works` and attempt creation.

**Setup (example SQL):**
```sql
UPDATE profiles
SET work_count = max_works
WHERE user_id = '<user_uuid>';
```

**Request:**
```bash
curl -X POST "http://localhost:4321/api/works" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "title": "Limit Work",
    "manual": true,
    "author_ids": ["<author_uuid>"]
  }'
```

**Expected Response:**
- Status: 409 Conflict
- Error message about work limit reached

