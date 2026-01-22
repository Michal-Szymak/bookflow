-- migration: disable all RLS policies for local development
-- purpose : drop all row-level security policies to simplify local development
-- affected: all tables with RLS policies (profiles, authors, works, editions, author_works, user_authors, user_works)
-- notes   : this migration drops all policies and disables RLS on all tables for easier local development

-- Drop all policies for profiles
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_select_anon on public.profiles;
drop policy if exists profiles_insert_authenticated on public.profiles;
drop policy if exists profiles_insert_anon on public.profiles;
drop policy if exists profiles_update_authenticated on public.profiles;
drop policy if exists profiles_update_anon on public.profiles;
drop policy if exists profiles_delete_authenticated on public.profiles;
drop policy if exists profiles_delete_anon on public.profiles;

-- Drop all policies for authors
drop policy if exists authors_select_authenticated on public.authors;
drop policy if exists authors_select_anon on public.authors;
drop policy if exists authors_insert_authenticated on public.authors;
drop policy if exists authors_insert_anon on public.authors;
drop policy if exists authors_update_authenticated on public.authors;
drop policy if exists authors_update_anon on public.authors;
drop policy if exists authors_delete_authenticated on public.authors;
drop policy if exists authors_delete_anon on public.authors;

-- Drop all policies for works
drop policy if exists works_select_authenticated on public.works;
drop policy if exists works_select_anon on public.works;
drop policy if exists works_insert_authenticated on public.works;
drop policy if exists works_insert_anon on public.works;
drop policy if exists works_update_authenticated on public.works;
drop policy if exists works_update_anon on public.works;
drop policy if exists works_delete_authenticated on public.works;
drop policy if exists works_delete_anon on public.works;

-- Drop all policies for editions
drop policy if exists editions_select_authenticated on public.editions;
drop policy if exists editions_select_anon on public.editions;
drop policy if exists editions_insert_authenticated on public.editions;
drop policy if exists editions_insert_anon on public.editions;
drop policy if exists editions_update_authenticated on public.editions;
drop policy if exists editions_update_anon on public.editions;
drop policy if exists editions_delete_authenticated on public.editions;
drop policy if exists editions_delete_anon on public.editions;

-- Drop all policies for author_works
drop policy if exists author_works_select_authenticated on public.author_works;
drop policy if exists author_works_select_anon on public.author_works;
drop policy if exists author_works_insert_authenticated on public.author_works;
drop policy if exists author_works_insert_anon on public.author_works;
drop policy if exists author_works_update_authenticated on public.author_works;
drop policy if exists author_works_update_anon on public.author_works;
drop policy if exists author_works_delete_authenticated on public.author_works;
drop policy if exists author_works_delete_anon on public.author_works;

-- Drop all policies for user_authors
drop policy if exists user_authors_select_authenticated on public.user_authors;
drop policy if exists user_authors_select_anon on public.user_authors;
drop policy if exists user_authors_insert_authenticated on public.user_authors;
drop policy if exists user_authors_insert_anon on public.user_authors;
drop policy if exists user_authors_update_authenticated on public.user_authors;
drop policy if exists user_authors_update_anon on public.user_authors;
drop policy if exists user_authors_delete_authenticated on public.user_authors;
drop policy if exists user_authors_delete_anon on public.user_authors;

-- Drop all policies for user_works
drop policy if exists user_works_select_authenticated on public.user_works;
drop policy if exists user_works_select_anon on public.user_works;
drop policy if exists user_works_insert_authenticated on public.user_works;
drop policy if exists user_works_insert_anon on public.user_works;
drop policy if exists user_works_update_authenticated on public.user_works;
drop policy if exists user_works_update_anon on public.user_works;
drop policy if exists user_works_delete_authenticated on public.user_works;
drop policy if exists user_works_delete_anon on public.user_works;

-- Disable RLS on all tables for local development
alter table public.profiles disable row level security;
alter table public.authors disable row level security;
alter table public.works disable row level security;
alter table public.editions disable row level security;
alter table public.author_works disable row level security;
alter table public.user_authors disable row level security;
alter table public.user_works disable row level security;

