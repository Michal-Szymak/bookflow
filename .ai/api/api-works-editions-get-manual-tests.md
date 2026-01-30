# Manual Testing Guide: GET /api/works/{workId}/editions

## Prerequisites
- Dev server running: `npm run dev`
- Supabase environment variables configured
- Database tables: `works`, `editions`
- **Note:** If RLS is enabled, results may be filtered based on the current session

## Authentication Setup (Optional)

This endpoint does **not** require authentication, but RLS may restrict visibility.

### Using curl with Authorization header (if needed)
```bash
curl -X GET "http://localhost:3000/api/works/<work_uuid>/editions" \
  -H "Authorization: Bearer <access_token>"
```

### Using curl with Session Cookie (if needed)
```bash
curl -X GET "http://localhost:3000/api/works/<work_uuid>/editions" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>"
```

**Note:** Replace `localhost:3000` with your dev server URL if different.

---

## Test Cases

### Test 1: Success - Work with Editions
**Description:** Fetch editions for an existing work that has at least one edition.

**Request:**
```bash
curl -X GET "http://localhost:3000/api/works/<work_with_editions_uuid>/editions"
```

**Expected Response:**
- Status: 200 OK
- JSON with `items` array of editions
- Editions ordered by `publish_year` descending, with `null` publish years last

**Verification Steps:**
1. Confirm `items` is not empty.
2. Check that the first item has the highest `publish_year` value.
3. If any `publish_year` is null, verify they appear at the end of the list.

---

### Test 2: Success - Work Exists but No Editions
**Description:** Fetch editions for a work that exists but has no editions.

**Request:**
```bash
curl -X GET "http://localhost:3000/api/works/<work_without_editions_uuid>/editions"
```

**Expected Response:**
- Status: 200 OK
- JSON with `items: []`

---

### Test 3: Validation Error - Invalid workId
**Description:** Use an invalid UUID in the path.

**Request:**
```bash
curl -X GET "http://localhost:3000/api/works/not-a-uuid/editions"
```

**Expected Response:**
- Status: 400 Bad Request
- Error message about invalid `workId` format

---

### Test 4: Not Found - Work Does Not Exist
**Description:** Use a valid UUID that does not exist in the database.

**Request:**
```bash
curl -X GET "http://localhost:3000/api/works/00000000-0000-4000-8000-000000000000/editions"
```

**Expected Response:**
- Status: 404 Not Found
- Message: "Work not found or not accessible"

---

### Test 5: RLS - Work Not Accessible (If Enabled)
**Description:** Use a workId that exists but is hidden by RLS for the current session.

**Request:**
```bash
curl -X GET "http://localhost:3000/api/works/<restricted_work_uuid>/editions"
```

**Expected Response:**
- Status: 404 Not Found
- Message: "Work not found or not accessible"

