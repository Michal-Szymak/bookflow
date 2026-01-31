# Manual Testing Guide: GET /api/authors/{authorId}/works

## Prerequisites

- Dev server running: `npm run dev`
- Supabase environment variables configured
- Database tables: `authors`, `works`, `editions`, `author_works`
- **Note:** RLS (Row Level Security) policies are **disabled** for local development
- An author with linked works and primary editions
- An OpenLibrary author (has `openlibrary_id`) with linked works

## Authentication Setup

This endpoint does **not** require authentication, but results are filtered by RLS.
If you want to validate user-specific visibility, use an access token or session cookie.

### Using curl with Authorization header (optional)

```bash
curl -X GET "http://localhost:3000/api/authors/<author_uuid>/works" \
  -H "Authorization: Bearer <access_token>"
```

### Using curl with Session Cookie (optional)

```bash
curl -X GET "http://localhost:3000/api/authors/<author_uuid>/works" \
  -H "Cookie: sb-<project-ref>-auth-token=<session-token>"
```

**Note:** Replace `localhost:3000` with your dev server URL if different.

---

## Test Cases

### Test 1: Default Pagination and Sorting

**Description:** Fetch works using default parameters.

**Request:**

```bash
curl -X GET "http://localhost:3000/api/authors/<author_uuid>/works"
```

**Expected Response:**

- Status: 200 OK
- JSON with `items`, `page`, `total`
- `page` is `1`
- `items` sorted by `published_desc` (year descending)

---

### Test 2: Pagination - Page 2

**Description:** Request a non-default page.

**Request:**

```bash
curl -X GET "http://localhost:3000/api/authors/<author_uuid>/works?page=2"
```

**Expected Response:**

- Status: 200 OK
- `page` is `2`
- `items` are different from page 1 (if enough data)

---

### Test 3: Sort by Title Ascending

**Description:** Request sorting by title.

**Request:**

```bash
curl -X GET "http://localhost:3000/api/authors/<author_uuid>/works?sort=title_asc"
```

**Expected Response:**

- Status: 200 OK
- `items` sorted by `title` ascending

---

### Test 4: published_desc with Missing first_publish_year

**Description:** Ensure sorting uses `publish_year` computed from primary edition when `first_publish_year` is null.

**Setup:**

- Work A: `first_publish_year = null`, primary edition `publish_year = 2020`
- Work B: `first_publish_year = 2015`, primary edition `publish_year = 2012`
- Both linked to the same author

**Request:**

```bash
curl -X GET "http://localhost:3000/api/authors/<author_uuid>/works?sort=published_desc"
```

**Expected Response:**

- Status: 200 OK
- Work A appears before Work B (2020 > 2015)

---

### Test 5: Validation Error - Invalid authorId

**Description:** Use an invalid UUID in path.

**Request:**

```bash
curl -X GET "http://localhost:3000/api/authors/not-a-uuid/works"
```

**Expected Response:**

- Status: 400 Bad Request
- Error message about invalid `authorId`

---

### Test 6: Validation Error - Invalid page

**Description:** Use an invalid page value.

**Request:**

```bash
curl -X GET "http://localhost:3000/api/authors/<author_uuid>/works?page=0"
```

**Expected Response:**

- Status: 400 Bad Request
- Error message about invalid `page`

---

### Test 7: Validation Error - Invalid sort

**Description:** Use an unsupported sort value.

**Request:**

```bash
curl -X GET "http://localhost:3000/api/authors/<author_uuid>/works?sort=invalid"
```

**Expected Response:**

- Status: 400 Bad Request
- Error message about invalid `sort`

---

### Test 8: Author Not Found or Not Accessible

**Description:** Use an authorId that does not exist or is blocked by RLS.

**Request:**

```bash
curl -X GET "http://localhost:3000/api/authors/<missing_author_uuid>/works"
```

**Expected Response:**

- Status: 404 Not Found
- Message: "Author not found or not accessible"

---

### Test 9: forceRefresh for OpenLibrary Author

**Description:** Force refresh OpenLibrary author data.

**Request:**

```bash
curl -X GET "http://localhost:3000/api/authors/<ol_author_uuid>/works?forceRefresh=true"
```

**Expected Response:**

- Status: 200 OK
- Works list returned
- Server logs show refresh attempt (warns only on failure)

---

### Test 10: forceRefresh Ignored for Manual Author

**Description:** forceRefresh on manual author should be ignored.

**Request:**

```bash
curl -X GET "http://localhost:3000/api/authors/<manual_author_uuid>/works?forceRefresh=true"
```

**Expected Response:**

- Status: 200 OK
- Works list returned
- No error; refresh is ignored
