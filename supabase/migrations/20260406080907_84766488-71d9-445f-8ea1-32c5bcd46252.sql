CREATE TABLE public.historic_hole_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL,
  round_number INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  license_number TEXT,
  hole_number INTEGER NOT NULL,
  strokes INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.historic_hole_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Historic hole scores viewable by everyone" ON public.historic_hole_scores FOR SELECT TO public USING (true);
CREATE POLICY "Auth users can insert historic_hole_scores" ON public.historic_hole_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can delete historic_hole_scores" ON public.historic_hole_scores FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_historic_hole_scores_season_round ON public.historic_hole_scores (season_id, round_number);