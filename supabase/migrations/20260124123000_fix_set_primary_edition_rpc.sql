-- Fix ambiguous column reference in set_primary_edition RPC

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
  SELECT e.work_id INTO edition_work_id
  FROM public.editions AS e
  WHERE e.id = edition_id;

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

GRANT EXECUTE ON FUNCTION public.set_primary_edition(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_primary_edition(uuid, uuid) TO anon;

