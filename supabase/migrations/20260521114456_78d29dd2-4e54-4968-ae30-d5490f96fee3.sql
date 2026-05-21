ALTER TABLE public.hole_scores
  ADD COLUMN IF NOT EXISTS scratch_points integer,
  ADD COLUMN IF NOT EXISTS handicap_points integer;