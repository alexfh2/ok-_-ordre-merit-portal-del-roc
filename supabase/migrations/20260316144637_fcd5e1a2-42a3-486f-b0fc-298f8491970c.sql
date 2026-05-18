CREATE TABLE public.hole_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  hole_number integer NOT NULL,
  strokes integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (player_id, tournament_id, hole_number)
);

ALTER TABLE public.hole_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hole scores viewable by everyone" ON public.hole_scores FOR SELECT TO public USING (true);
CREATE POLICY "Auth users can insert hole_scores" ON public.hole_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can update hole_scores" ON public.hole_scores FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can delete hole_scores" ON public.hole_scores FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);