1. Lista tabel, kolumn, typów i ograniczeń
   - enums
     - user_work_status_enum: to_read | in_progress | read | hidden
       This table is managed by Supabase Auth:
   - profiles (PK user_id uuid references auth.users on delete cascade)
     - author_count int not null default 0 check (author_count >= 0 and author_count <= max_authors)
     - work_count int not null default 0 check (work_count >= 0 and work_count <= max_works)
     - max_authors int not null default 500
     - max_works int not null default 5000
     - created_at timestamptz not null default now()
     - updated_at timestamptz not null default now()
   - authors (PK id uuid default gen_random_uuid())
     - name text not null
     - openlibrary_id text unique where openlibrary_id is not null
     - manual boolean not null default false
     - owner_user_id uuid references auth.users on delete cascade
     - ol_fetched_at timestamptz
     - ol_expires_at timestamptz
     - created_at timestamptz not null default now()
     - updated_at timestamptz not null default now()
     - constraint authors_manual_owner check ((manual = false) = (owner_user_id is null))
     - constraint authors_manual_or_ol check (manual = true or openlibrary_id is not null)
   - works (PK id uuid default gen_random_uuid())
     - title text not null
     - openlibrary_id text unique where openlibrary_id is not null
     - first_publish_year smallint
     - primary_edition_id uuid references editions(id)
     - manual boolean not null default false
     - owner_user_id uuid references auth.users on delete cascade
     - created_at timestamptz not null default now()
     - updated_at timestamptz not null default now()
     - constraint works_manual_owner check ((manual = false) = (owner_user_id is null))
     - constraint works_manual_or_ol check (manual = true or openlibrary_id is not null)
   - editions (PK id uuid default gen_random_uuid())
     - work_id uuid not null references works(id) on delete cascade
     - title text not null
     - openlibrary_id text unique where openlibrary_id is not null
     - publish_year smallint
     - publish_date date
     - publish_date_raw text
     - isbn13 text unique where isbn13 is not null
     - cover_url text
     - language text
     - manual boolean not null default false
     - owner_user_id uuid references auth.users on delete cascade
     - created_at timestamptz not null default now()
     - updated_at timestamptz not null default now()
     - constraint editions_manual_owner check ((manual = false) = (owner_user_id is null))
     - constraint editions_manual_or_ol check (manual = true or openlibrary_id is not null)
   - author_works (PK author_id, work_id)
     - author_id uuid not null references authors(id) on delete cascade
     - work_id uuid not null references works(id) on delete cascade
     - created_at timestamptz not null default now()
   - user_authors (PK user_id, author_id)
     - user_id uuid not null references auth.users on delete cascade
     - author_id uuid not null references authors(id) on delete cascade
     - created_at timestamptz not null default now()
   - user_works (PK user_id, work_id)
     - user_id uuid not null references auth.users on delete cascade
     - work_id uuid not null references works(id) on delete cascade
     - status user_work_status_enum not null default 'to_read'
     - available_in_legimi boolean
     - created_at timestamptz not null default now()
     - updated_at timestamptz not null default now()
     - status_updated_at timestamptz

2. Relacje (kardynalność)
   - auth.users 1:1 profiles (PK/FK user_id).
   - authors M:N works przez author_works.
   - works 1:N editions (editions.work_id).
   - works 0..1 -> editions (primary_edition_id).
   - users M:N authors przez user_authors.
   - users M:N works przez user_works.

3. Indeksy
   - works(title); works(first_publish_year desc).
   - editions(publish_year desc); editions(work_id).
   - user_works(user_id, status); user_works(user_id, available_in_legimi); user_works(work_id).
   - user_authors(user_id); author_works(author_id); author_works(work_id).
   - authors(openlibrary_id) partial where not null; works(openlibrary_id) partial where not null; editions(openlibrary_id) partial where not null.
   - editions(isbn13) partial where not null.

4. Zasady PostgreSQL (RLS)
   - Enable RLS on all tables.
   - Global katalog (authors, works, editions, author_works):
     - SELECT policy: owner_user_id is null OR owner_user_id = auth.uid().
     - INSERT/UPDATE/DELETE policy: owner_user_id = auth.uid() (pozwala tylko na własne rekordy manualne); rekordy OL (owner_user_id is null) modyfikowane wyłącznie via RPC SECURITY DEFINER.
   - user_authors, user_works:
     - SELECT/INSERT/UPDATE/DELETE policy: user_id = auth.uid().
   - profiles:
     - SELECT/UPDATE policy: user_id = auth.uid(); INSERT handled by signup flow; DELETE cascades z auth.users.

5. Dodatkowe uwagi
   - Triggery: aktualizacja updated_at na mutacjach; status_updated_at tylko przy zmianie status w user_works; liczniki profiles aktualizowane w triggerach/RPC przy insert/delete do user_authors/user_works (walidacja limitów max_authors/max_works).
   - RPC SECURITY DEFINER dla katalogu globalnego: upsert_author_from_ol, upsert_work_from_ol, upsert_edition_from_ol, link_author_work, set_primary_edition, import_author_works. Walidują owner_user_id/manual spójność.
   - Cache OpenLibrary: authors.ol_fetched_at i ol_expires_at (TTL 7 dni) aktualizowane tylko przy imporcie OL.
   - published date sort: UI używa COALESCE(works.first_publish_year, editions.publish_year) (dla primary_edition_id).
   - available_in_legimi w user_works jako tri-state (NULL = nieoznaczone).
