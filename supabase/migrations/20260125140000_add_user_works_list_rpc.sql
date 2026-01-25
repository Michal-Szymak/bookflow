-- Create RPC to list user works with filtering, sorting, and computed publish_year

CREATE OR REPLACE FUNCTION public.get_user_works(
  p_user_id uuid,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 20,
  p_status public.user_work_status_enum[] DEFAULT NULL,
  p_available text DEFAULT NULL,
  p_sort text DEFAULT 'published_desc',
  p_author_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  status public.user_work_status_enum,
  available_in_legimi boolean,
  status_updated_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  work_id uuid,
  work_title text,
  work_openlibrary_id text,
  work_first_publish_year smallint,
  work_primary_edition_id uuid,
  work_manual boolean,
  work_owner_user_id uuid,
  work_created_at timestamptz,
  work_updated_at timestamptz,
  primary_edition_id uuid,
  primary_edition_title text,
  primary_edition_openlibrary_id text,
  primary_edition_publish_year smallint,
  primary_edition_publish_date date,
  primary_edition_publish_date_raw text,
  primary_edition_isbn13 text,
  primary_edition_cover_url text,
  primary_edition_language text,
  publish_year smallint,
  total_count bigint
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    uw.user_id,
    uw.status,
    uw.available_in_legimi,
    uw.status_updated_at,
    uw.created_at,
    uw.updated_at,
    w.id AS work_id,
    w.title AS work_title,
    w.openlibrary_id AS work_openlibrary_id,
    w.first_publish_year AS work_first_publish_year,
    w.primary_edition_id AS work_primary_edition_id,
    w.manual AS work_manual,
    w.owner_user_id AS work_owner_user_id,
    w.created_at AS work_created_at,
    w.updated_at AS work_updated_at,
    e.id AS primary_edition_id,
    e.title AS primary_edition_title,
    e.openlibrary_id AS primary_edition_openlibrary_id,
    e.publish_year AS primary_edition_publish_year,
    e.publish_date AS primary_edition_publish_date,
    e.publish_date_raw AS primary_edition_publish_date_raw,
    e.isbn13 AS primary_edition_isbn13,
    e.cover_url AS primary_edition_cover_url,
    e.language AS primary_edition_language,
    COALESCE(w.first_publish_year, e.publish_year) AS publish_year,
    COUNT(*) OVER() AS total_count
  FROM public.user_works uw
  JOIN public.works w ON w.id = uw.work_id
  LEFT JOIN public.editions e ON e.id = w.primary_edition_id
  LEFT JOIN public.author_works aw ON aw.work_id = w.id AND (p_author_id IS NULL OR aw.author_id = p_author_id)
  WHERE uw.user_id = p_user_id
    AND (p_status IS NULL OR uw.status = ANY(p_status))
    AND (
      p_available IS NULL
      OR (p_available = 'true' AND uw.available_in_legimi = TRUE)
      OR (p_available = 'false' AND uw.available_in_legimi = FALSE)
      OR (p_available = 'null' AND uw.available_in_legimi IS NULL)
    )
    AND (p_search IS NULL OR w.title ILIKE '%' || p_search || '%')
    AND (p_author_id IS NULL OR aw.author_id IS NOT NULL)
  ORDER BY
    CASE WHEN p_sort = 'published_desc' THEN COALESCE(w.first_publish_year, e.publish_year) END DESC NULLS LAST,
    CASE WHEN p_sort = 'published_desc' THEN w.title END ASC,
    CASE WHEN p_sort = 'title_asc' THEN w.title END ASC,
    w.id ASC
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_works(uuid, int, int, public.user_work_status_enum[], text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_works(uuid, int, int, public.user_work_status_enum[], text, text, uuid, text) TO anon;
