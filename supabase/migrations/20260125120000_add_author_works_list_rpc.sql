-- Create RPC to list author works with computed publish_year and DB sorting

CREATE OR REPLACE FUNCTION public.get_author_works(
  p_author_id uuid,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 20,
  p_sort text DEFAULT 'published_desc'
)
RETURNS TABLE (
  author_id uuid,
  id uuid,
  title text,
  openlibrary_id text,
  first_publish_year smallint,
  primary_edition_id uuid,
  manual boolean,
  owner_user_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
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
    aw.author_id,
    w.id,
    w.title,
    w.openlibrary_id,
    w.first_publish_year,
    w.primary_edition_id,
    w.manual,
    w.owner_user_id,
    w.created_at,
    w.updated_at,
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
  FROM public.author_works aw
  JOIN public.works w ON w.id = aw.work_id
  LEFT JOIN public.editions e ON e.id = w.primary_edition_id
  WHERE aw.author_id = p_author_id
  ORDER BY
    CASE WHEN p_sort = 'published_desc' THEN COALESCE(w.first_publish_year, e.publish_year) END DESC NULLS LAST,
    CASE WHEN p_sort = 'published_desc' THEN w.title END ASC,
    CASE WHEN p_sort = 'title_asc' THEN w.title END ASC,
    w.id ASC
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
$$;

GRANT EXECUTE ON FUNCTION public.get_author_works(uuid, int, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_author_works(uuid, int, int, text) TO anon;

