-- migration: create core bookflow schema for authors, works, editions, user shelves, and counters
-- purpose : implement db-plan entities, constraints, indexes, rls, and helper triggers
-- affected: enum user_work_status_enum; tables profiles, authors, works, editions, author_works, user_authors, user_works; helper functions and policies
-- notes   : uses pgcrypto for gen_random_uuid(); rls enabled on all tables; manual records are owned via owner_user_id while openlibrary records keep owner_user_id null; profile counters enforce per-user limits

-- ensure extensions required for uuid generation are present
create extension if not exists "pgcrypto";

-- enum for tracking user-specific reading status of works
do $$
begin
  create type public.user_work_status_enum as enum ('to_read', 'in_progress', 'read', 'hidden');
exception
  when duplicate_object then null;
end
$$;

-- user profile with soft limits for attached authors/works
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  author_count int not null default 0,
  work_count int not null default 0,
  max_authors int not null default 500,
  max_works int not null default 5000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_author_count_bounds check (author_count >= 0 and author_count <= max_authors),
  constraint profiles_work_count_bounds check (work_count >= 0 and work_count <= max_works)
);

-- global catalog authors; owner_user_id is only set for manual user-owned records
create table if not exists public.authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  openlibrary_id text,
  manual boolean not null default false,
  owner_user_id uuid references auth.users (id) on delete cascade,
  ol_fetched_at timestamptz,
  ol_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint authors_manual_owner check ((manual = false) = (owner_user_id is null)),
  constraint authors_manual_or_ol check (manual = true or openlibrary_id is not null)
);

-- global catalog works; primary_edition_id is linked after editions exist to break circular dependency
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  openlibrary_id text,
  first_publish_year smallint,
  primary_edition_id uuid,
  manual boolean not null default false,
  owner_user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint works_manual_owner check ((manual = false) = (owner_user_id is null)),
  constraint works_manual_or_ol check (manual = true or openlibrary_id is not null)
);

-- editions tied to works; owner_user_id mirrors the owning work when manual
create table if not exists public.editions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id) on delete cascade,
  title text not null,
  openlibrary_id text,
  publish_year smallint,
  publish_date date,
  publish_date_raw text,
  isbn13 text,
  cover_url text,
  language text,
  manual boolean not null default false,
  owner_user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint editions_manual_owner check ((manual = false) = (owner_user_id is null)),
  constraint editions_manual_or_ol check (manual = true or openlibrary_id is not null)
);

-- link works back to their primary edition (nullable, deferrable to avoid circular insert issues)
alter table public.works
  add constraint works_primary_edition_fk
  foreign key (primary_edition_id)
  references public.editions (id)
  on delete set null
  deferrable initially deferred;

-- junction table for authors to works
create table if not exists public.author_works (
  author_id uuid not null references public.authors (id) on delete cascade,
  work_id uuid not null references public.works (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (author_id, work_id)
);

-- user-author relationships for personal library
create table if not exists public.user_authors (
  user_id uuid not null references auth.users (id) on delete cascade,
  author_id uuid not null references public.authors (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, author_id)
);

-- user-work relationships with status and legimi availability flag
create table if not exists public.user_works (
  user_id uuid not null references auth.users (id) on delete cascade,
  work_id uuid not null references public.works (id) on delete cascade,
  status public.user_work_status_enum not null default 'to_read',
  available_in_legimi boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status_updated_at timestamptz,
  primary key (user_id, work_id)
);

-- indexes for performance on frequent lookups and sorts
create index if not exists works_title_idx on public.works (title);
create index if not exists works_first_publish_year_desc_idx on public.works (first_publish_year desc);
create index if not exists editions_publish_year_desc_idx on public.editions (publish_year desc);
create index if not exists editions_work_id_idx on public.editions (work_id);
create index if not exists user_works_user_status_idx on public.user_works (user_id, status);
create index if not exists user_works_user_available_idx on public.user_works (user_id, available_in_legimi);
create index if not exists user_works_work_idx on public.user_works (work_id);
create index if not exists user_authors_user_idx on public.user_authors (user_id);
create index if not exists author_works_author_idx on public.author_works (author_id);
create index if not exists author_works_work_idx on public.author_works (work_id);
create unique index if not exists authors_openlibrary_id_uidx on public.authors (openlibrary_id) where openlibrary_id is not null;
create unique index if not exists works_openlibrary_id_uidx on public.works (openlibrary_id) where openlibrary_id is not null;
create unique index if not exists editions_openlibrary_id_uidx on public.editions (openlibrary_id) where openlibrary_id is not null;
create unique index if not exists editions_isbn13_uidx on public.editions (isbn13) where isbn13 is not null;

-- generic updated_at trigger used for entities with mutable data
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- specialized timestamp maintenance for user_works to capture status changes
create or replace function public.set_user_works_timestamps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();

  if tg_op = 'INSERT' or (new.status is distinct from old.status) then
    new.status_updated_at = now();
  end if;

  return new;
end;
$$;

-- increment author_count with limit enforcement; fails fast on missing profile or overflow
create or replace function public.increment_profile_author_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set author_count = author_count + 1,
         updated_at = now()
   where user_id = new.user_id
     and author_count + 1 <= max_authors;

  if not found then
    raise exception 'profile author limit exceeded or profile missing for user %', new.user_id;
  end if;

  return new;
end;
$$;

-- decrement author_count guarding against underflow; tolerate missing profiles during cascade deletes
create or replace function public.decrement_profile_author_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set author_count = author_count - 1,
         updated_at = now()
   where user_id = old.user_id
     and author_count > 0;

  -- if the profile was already removed (e.g., cascading auth.users delete), skip without raising
  if not found then
    return old;
  end if;

  return old;
end;
$$;

-- increment work_count with limit enforcement; fails fast on missing profile or overflow
create or replace function public.increment_profile_work_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set work_count = work_count + 1,
         updated_at = now()
   where user_id = new.user_id
     and work_count + 1 <= max_works;

  if not found then
    raise exception 'profile work limit exceeded or profile missing for user %', new.user_id;
  end if;

  return new;
end;
$$;

-- decrement work_count guarding against underflow; tolerate missing profiles during cascade deletes
create or replace function public.decrement_profile_work_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set work_count = work_count - 1,
         updated_at = now()
   where user_id = old.user_id
     and work_count > 0;

  -- if the profile was already removed (e.g., cascading auth.users delete), skip without raising
  if not found then
    return old;
  end if;

  return old;
end;
$$;

-- attach timestamp triggers
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger authors_set_updated_at
before update on public.authors
for each row
execute function public.set_updated_at();

create trigger works_set_updated_at
before update on public.works
for each row
execute function public.set_updated_at();

create trigger editions_set_updated_at
before update on public.editions
for each row
execute function public.set_updated_at();

create trigger user_works_set_timestamps
before insert or update on public.user_works
for each row
execute function public.set_user_works_timestamps();

-- attach profile counter triggers for user_authors
create trigger user_authors_increment_count
after insert on public.user_authors
for each row
execute function public.increment_profile_author_count();

create trigger user_authors_decrement_count
after delete on public.user_authors
for each row
execute function public.decrement_profile_author_count();

-- attach profile counter triggers for user_works
create trigger user_works_increment_count
after insert on public.user_works
for each row
execute function public.increment_profile_work_count();

create trigger user_works_decrement_count
after delete on public.user_works
for each row
execute function public.decrement_profile_work_count();

-- enable row level security on all tables
alter table public.profiles enable row level security;
alter table public.authors enable row level security;
alter table public.works enable row level security;
alter table public.editions enable row level security;
alter table public.author_works enable row level security;
alter table public.user_authors enable row level security;
alter table public.user_works enable row level security;

-- rls policies for profiles (owner-only access; inserts typically via signup flow)
create policy profiles_select_authenticated
  on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy profiles_select_anon
  on public.profiles
  for select
  to anon
  using (false);

create policy profiles_insert_authenticated
  on public.profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy profiles_insert_anon
  on public.profiles
  for insert
  to anon
  with check (false);

create policy profiles_update_authenticated
  on public.profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy profiles_update_anon
  on public.profiles
  for update
  to anon
  using (false)
  with check (false);

create policy profiles_delete_authenticated
  on public.profiles
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy profiles_delete_anon
  on public.profiles
  for delete
  to anon
  using (false);

-- rls policies for authors (readable when global or owned; writes only for manual owned records)
create policy authors_select_authenticated
  on public.authors
  for select
  to authenticated
  using (owner_user_id is null or owner_user_id = auth.uid());

create policy authors_select_anon
  on public.authors
  for select
  to anon
  using (false);

create policy authors_insert_authenticated
  on public.authors
  for insert
  to authenticated
  with check (manual = true and owner_user_id = auth.uid());

create policy authors_insert_anon
  on public.authors
  for insert
  to anon
  with check (false);

create policy authors_update_authenticated
  on public.authors
  for update
  to authenticated
  using (manual = true and owner_user_id = auth.uid())
  with check (manual = true and owner_user_id = auth.uid());

create policy authors_update_anon
  on public.authors
  for update
  to anon
  using (false)
  with check (false);

create policy authors_delete_authenticated
  on public.authors
  for delete
  to authenticated
  using (manual = true and owner_user_id = auth.uid());

create policy authors_delete_anon
  on public.authors
  for delete
  to anon
  using (false);

-- rls policies for works (read global or owned; mutate only owned manual rows)
create policy works_select_authenticated
  on public.works
  for select
  to authenticated
  using (owner_user_id is null or owner_user_id = auth.uid());

create policy works_select_anon
  on public.works
  for select
  to anon
  using (false);

create policy works_insert_authenticated
  on public.works
  for insert
  to authenticated
  with check (manual = true and owner_user_id = auth.uid());

create policy works_insert_anon
  on public.works
  for insert
  to anon
  with check (false);

create policy works_update_authenticated
  on public.works
  for update
  to authenticated
  using (manual = true and owner_user_id = auth.uid())
  with check (manual = true and owner_user_id = auth.uid());

create policy works_update_anon
  on public.works
  for update
  to anon
  using (false)
  with check (false);

create policy works_delete_authenticated
  on public.works
  for delete
  to authenticated
  using (manual = true and owner_user_id = auth.uid());

create policy works_delete_anon
  on public.works
  for delete
  to anon
  using (false);

-- rls policies for editions (read global or owned; mutate only owned manual rows)
create policy editions_select_authenticated
  on public.editions
  for select
  to authenticated
  using (owner_user_id is null or owner_user_id = auth.uid());

create policy editions_select_anon
  on public.editions
  for select
  to anon
  using (false);

create policy editions_insert_authenticated
  on public.editions
  for insert
  to authenticated
  with check (manual = true and owner_user_id = auth.uid());

create policy editions_insert_anon
  on public.editions
  for insert
  to anon
  with check (false);

create policy editions_update_authenticated
  on public.editions
  for update
  to authenticated
  using (manual = true and owner_user_id = auth.uid())
  with check (manual = true and owner_user_id = auth.uid());

create policy editions_update_anon
  on public.editions
  for update
  to anon
  using (false)
  with check (false);

create policy editions_delete_authenticated
  on public.editions
  for delete
  to authenticated
  using (manual = true and owner_user_id = auth.uid());

create policy editions_delete_anon
  on public.editions
  for delete
  to anon
  using (false);

-- rls policies for author_works (view any pair where both sides are individually viewable; mutate only owned/manual records)
create policy author_works_select_authenticated
  on public.author_works
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.authors a
      join public.works w on w.id = author_works.work_id
      where a.id = author_works.author_id
        and (a.owner_user_id is null or a.owner_user_id = auth.uid())
        and (w.owner_user_id is null or w.owner_user_id = auth.uid())
    )
  );

create policy author_works_select_anon
  on public.author_works
  for select
  to anon
  using (false);

create policy author_works_insert_authenticated
  on public.author_works
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.authors a
      join public.works w on w.id = author_works.work_id
      where a.id = author_works.author_id
        and a.manual = true
        and w.manual = true
        and a.owner_user_id = auth.uid()
        and w.owner_user_id = auth.uid()
    )
  );

create policy author_works_insert_anon
  on public.author_works
  for insert
  to anon
  with check (false);

create policy author_works_update_authenticated
  on public.author_works
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.authors a
      join public.works w on w.id = author_works.work_id
      where a.id = author_works.author_id
        and a.manual = true
        and w.manual = true
        and a.owner_user_id = auth.uid()
        and w.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.authors a
      join public.works w on w.id = author_works.work_id
      where a.id = author_works.author_id
        and a.manual = true
        and w.manual = true
        and a.owner_user_id = auth.uid()
        and w.owner_user_id = auth.uid()
    )
  );

create policy author_works_update_anon
  on public.author_works
  for update
  to anon
  using (false)
  with check (false);

create policy author_works_delete_authenticated
  on public.author_works
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.authors a
      join public.works w on w.id = author_works.work_id
      where a.id = author_works.author_id
        and a.manual = true
        and w.manual = true
        and a.owner_user_id = auth.uid()
        and w.owner_user_id = auth.uid()
    )
  );

create policy author_works_delete_anon
  on public.author_works
  for delete
  to anon
  using (false);

-- rls policies for user_authors (strictly per-user)
create policy user_authors_select_authenticated
  on public.user_authors
  for select
  to authenticated
  using (user_id = auth.uid());

create policy user_authors_select_anon
  on public.user_authors
  for select
  to anon
  using (false);

create policy user_authors_insert_authenticated
  on public.user_authors
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy user_authors_insert_anon
  on public.user_authors
  for insert
  to anon
  with check (false);

create policy user_authors_update_authenticated
  on public.user_authors
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_authors_update_anon
  on public.user_authors
  for update
  to anon
  using (false)
  with check (false);

create policy user_authors_delete_authenticated
  on public.user_authors
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy user_authors_delete_anon
  on public.user_authors
  for delete
  to anon
  using (false);

-- rls policies for user_works (strictly per-user)
create policy user_works_select_authenticated
  on public.user_works
  for select
  to authenticated
  using (user_id = auth.uid());

create policy user_works_select_anon
  on public.user_works
  for select
  to anon
  using (false);

create policy user_works_insert_authenticated
  on public.user_works
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy user_works_insert_anon
  on public.user_works
  for insert
  to anon
  with check (false);

create policy user_works_update_authenticated
  on public.user_works
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_works_update_anon
  on public.user_works
  for update
  to anon
  using (false)
  with check (false);

create policy user_works_delete_authenticated
  on public.user_works
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy user_works_delete_anon
  on public.user_works
  for delete
  to anon
  using (false);


