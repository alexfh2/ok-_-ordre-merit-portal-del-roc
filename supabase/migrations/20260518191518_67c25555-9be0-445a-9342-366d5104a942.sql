
-- 1. Extend players (birth_date NOT exposed publicly via app conventions; column-level read still allowed by RLS but app must avoid selecting it on public views)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_subscriber boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS subscriber_updated_at timestamptz;

-- 2. Extend tournaments
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS is_om boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS season integer NOT NULL DEFAULT 2026;
-- Note: season default is provisional; app passes season explicitly from config.

-- 3. course_holes
CREATE TABLE IF NOT EXISTS public.course_holes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_name text NOT NULL,
  hole_number integer NOT NULL,
  par integer NOT NULL,
  stroke_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_name, hole_number)
);

ALTER TABLE public.course_holes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Course holes viewable by everyone" ON public.course_holes FOR SELECT USING (true);
CREATE POLICY "Auth users can insert course_holes" ON public.course_holes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can update course_holes" ON public.course_holes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can delete course_holes" ON public.course_holes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- 4. stableford_hole_scores
CREATE TABLE IF NOT EXISTS public.stableford_hole_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  player_id uuid NOT NULL,
  hole_number integer NOT NULL,
  strokes integer NOT NULL,
  stableford_points integer,
  par integer,
  stroke_index integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, player_id, hole_number)
);

ALTER TABLE public.stableford_hole_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stableford hole scores viewable by everyone" ON public.stableford_hole_scores FOR SELECT USING (true);
CREATE POLICY "Auth users can insert stableford_hole_scores" ON public.stableford_hole_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can update stableford_hole_scores" ON public.stableford_hole_scores FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can delete stableford_hole_scores" ON public.stableford_hole_scores FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_stableford_hole_scores_tournament ON public.stableford_hole_scores(tournament_id);
CREATE INDEX IF NOT EXISTS idx_stableford_hole_scores_player ON public.stableford_hole_scores(player_id);

-- 5. Extend results with computed totals
ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS stableford_handicap_total integer,
  ADD COLUMN IF NOT EXISTS stableford_scratch_total integer,
  ADD COLUMN IF NOT EXISTS counting_points integer,
  ADD COLUMN IF NOT EXISTS ranking_points integer;
