-- Update OpenLibrary edition upsert to include cache metadata
CREATE OR REPLACE FUNCTION public.upsert_edition_from_ol(edition_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edition_id uuid;
  edition_openlibrary_id text;
BEGIN
  edition_openlibrary_id := (edition_data->>'openlibrary_id')::text;

  IF edition_openlibrary_id IS NULL OR length(edition_openlibrary_id) = 0 THEN
    RAISE EXCEPTION 'openlibrary_id is required';
  END IF;

  INSERT INTO public.editions (
    work_id,
    openlibrary_id,
    title,
    publish_year,
    publish_date,
    publish_date_raw,
    isbn13,
    cover_url,
    language,
    ol_fetched_at,
    ol_expires_at,
    manual
  )
  VALUES (
    (edition_data->>'work_id')::uuid,
    edition_openlibrary_id,
    (edition_data->>'title')::text,
    (edition_data->>'publish_year')::smallint,
    (edition_data->>'publish_date')::date,
    (edition_data->>'publish_date_raw')::text,
    (edition_data->>'isbn13')::text,
    (edition_data->>'cover_url')::text,
    (edition_data->>'language')::text,
    (edition_data->>'ol_fetched_at')::timestamptz,
    (edition_data->>'ol_expires_at')::timestamptz,
    false
  )
  ON CONFLICT (openlibrary_id) WHERE openlibrary_id IS NOT NULL
  DO UPDATE SET
    work_id = EXCLUDED.work_id,
    title = EXCLUDED.title,
    publish_year = EXCLUDED.publish_year,
    publish_date = EXCLUDED.publish_date,
    publish_date_raw = EXCLUDED.publish_date_raw,
    isbn13 = EXCLUDED.isbn13,
    cover_url = EXCLUDED.cover_url,
    language = EXCLUDED.language,
    ol_fetched_at = EXCLUDED.ol_fetched_at,
    ol_expires_at = EXCLUDED.ol_expires_at,
    manual = false,
    updated_at = now()
  RETURNING id INTO edition_id;

  RETURN edition_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_edition_from_ol(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_edition_from_ol(jsonb) TO anon;

