-- Add UNIQUE constraint on authors.openlibrary_id for Supabase Client upsert support
-- This constraint works alongside the existing partial unique index (authors_openlibrary_id_uidx)
-- which remains for performance optimization.

-- Note: UNIQUE constraint does not allow multiple NULL values (unlike partial unique index),
-- but since we're using this for OpenLibrary cache entries, openlibrary_id should never be NULL
-- for cached entries.

ALTER TABLE public.authors 
ADD CONSTRAINT authors_openlibrary_id_unique 
UNIQUE (openlibrary_id);

-- Create RPC function to upsert authors cache, bypassing RLS
-- This function uses SECURITY DEFINER to allow inserting/updating OpenLibrary cache entries
-- (manual=false, owner_user_id=null) which are blocked by RLS policies.
CREATE OR REPLACE FUNCTION public.upsert_authors_cache(
  authors_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.authors (
    openlibrary_id,
    name,
    ol_fetched_at,
    ol_expires_at,
    manual
  )
  SELECT
    (item->>'openlibrary_id')::text,
    (item->>'name')::text,
    (item->>'ol_fetched_at')::timestamptz,
    (item->>'ol_expires_at')::timestamptz,
    false
  FROM jsonb_array_elements(authors_data) AS item
  ON CONFLICT (openlibrary_id) 
  DO UPDATE SET
    name = EXCLUDED.name,
    ol_fetched_at = EXCLUDED.ol_fetched_at,
    ol_expires_at = EXCLUDED.ol_expires_at,
    manual = false,
    updated_at = now();
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.upsert_authors_cache(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_authors_cache(jsonb) TO anon;
