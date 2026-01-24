-- Create RPC functions for OpenLibrary work/edition import and linking

CREATE OR REPLACE FUNCTION public.upsert_work_from_ol(work_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  work_id uuid;
  work_openlibrary_id text;
BEGIN
  work_openlibrary_id := (work_data->>'openlibrary_id')::text;

  IF work_openlibrary_id IS NULL OR length(work_openlibrary_id) = 0 THEN
    RAISE EXCEPTION 'openlibrary_id is required';
  END IF;

  INSERT INTO public.works (
    openlibrary_id,
    title,
    first_publish_year,
    manual
  )
  VALUES (
    work_openlibrary_id,
    (work_data->>'title')::text,
    (work_data->>'first_publish_year')::smallint,
    false
  )
  ON CONFLICT (openlibrary_id) WHERE openlibrary_id IS NOT NULL
  DO UPDATE SET
    title = EXCLUDED.title,
    first_publish_year = EXCLUDED.first_publish_year,
    manual = false,
    updated_at = now()
  RETURNING id INTO work_id;

  RETURN work_id;
END;
$$;

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
    manual = false,
    updated_at = now()
  RETURNING id INTO edition_id;

  RETURN edition_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_author_work(author_id uuid, work_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.author_works (author_id, work_id)
  VALUES (author_id, work_id)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_primary_edition(work_id uuid, edition_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edition_work_id uuid;
  updated_rows int;
BEGIN
  SELECT work_id INTO edition_work_id FROM public.editions WHERE id = edition_id;

  IF edition_work_id IS NULL THEN
    RAISE EXCEPTION 'Edition % not found', edition_id;
  END IF;

  IF edition_work_id <> work_id THEN
    RAISE EXCEPTION 'Edition % does not belong to work %', edition_id, work_id;
  END IF;

  UPDATE public.works
  SET primary_edition_id = edition_id,
      updated_at = now()
  WHERE id = work_id;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows = 0 THEN
    RAISE EXCEPTION 'Work % not found', work_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_work_from_ol(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_work_from_ol(jsonb) TO anon;

GRANT EXECUTE ON FUNCTION public.upsert_edition_from_ol(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_edition_from_ol(jsonb) TO anon;

GRANT EXECUTE ON FUNCTION public.link_author_work(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_author_work(uuid, uuid) TO anon;

GRANT EXECUTE ON FUNCTION public.set_primary_edition(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_primary_edition(uuid, uuid) TO anon;

