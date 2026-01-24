-- Add OpenLibrary cache metadata to editions
ALTER TABLE public.editions
  ADD COLUMN IF NOT EXISTS ol_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS ol_expires_at timestamptz;

