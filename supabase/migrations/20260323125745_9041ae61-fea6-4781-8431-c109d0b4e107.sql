
-- Table to store pair members (two players per pair)
CREATE TABLE public.pair_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  license_number text,
  gender text NOT NULL DEFAULT 'M',
  member_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pair_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pair members viewable by everyone" ON public.pair_members FOR SELECT TO public USING (true);
CREATE POLICY "Auth users can insert pair_members" ON public.pair_members FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can update pair_members" ON public.pair_members FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can delete pair_members" ON public.pair_members FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Add player_name to pair_hole_scores to track per-player scores
ALTER TABLE public.pair_hole_scores ADD COLUMN player_name text;
