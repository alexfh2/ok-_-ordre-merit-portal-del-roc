-- Historic seasons table
CREATE TABLE public.historic_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL UNIQUE CHECK (year >= 1993 AND year <= 2025),
  total_rounds integer NOT NULL DEFAULT 10,
  counting_rounds integer NOT NULL DEFAULT 8,
  modality text NOT NULL DEFAULT 'medalplay' CHECK (modality IN ('stableford', 'medalplay')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.historic_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Historic seasons viewable by everyone" ON public.historic_seasons FOR SELECT TO public USING (true);
CREATE POLICY "Auth users can insert historic_seasons" ON public.historic_seasons FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can update historic_seasons" ON public.historic_seasons FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can delete historic_seasons" ON public.historic_seasons FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Historic results table (per player, per round, per season)
CREATE TABLE public.historic_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.historic_seasons(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  player_name text NOT NULL,
  license_number text,
  gender text NOT NULL DEFAULT 'male',
  scratch_score integer,
  handicap_score integer,
  round_date date,
  round_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.historic_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Historic results viewable by everyone" ON public.historic_results FOR SELECT TO public USING (true);
CREATE POLICY "Auth users can insert historic_results" ON public.historic_results FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can update historic_results" ON public.historic_results FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can delete historic_results" ON public.historic_results FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_historic_results_season ON public.historic_results(season_id);
CREATE INDEX idx_historic_results_round ON public.historic_results(season_id, round_number);

-- Historic rankings table (calculated per category per season)
CREATE TABLE public.historic_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.historic_seasons(id) ON DELETE CASCADE,
  category text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  player_name text NOT NULL,
  license_number text,
  total_points integer NOT NULL DEFAULT 0,
  rounds_played integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.historic_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Historic rankings viewable by everyone" ON public.historic_rankings FOR SELECT TO public USING (true);
CREATE POLICY "Auth users can insert historic_rankings" ON public.historic_rankings FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can update historic_rankings" ON public.historic_rankings FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can delete historic_rankings" ON public.historic_rankings FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_historic_rankings_season ON public.historic_rankings(season_id);

-- Historic winners table (top 3 per category with optional photo)
CREATE TABLE public.historic_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.historic_seasons(id) ON DELETE CASCADE,
  category text NOT NULL,
  position integer NOT NULL CHECK (position >= 1 AND position <= 3),
  player_name text NOT NULL,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(season_id, category, position)
);

ALTER TABLE public.historic_winners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Historic winners viewable by everyone" ON public.historic_winners FOR SELECT TO public USING (true);
CREATE POLICY "Auth users can insert historic_winners" ON public.historic_winners FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can update historic_winners" ON public.historic_winners FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can delete historic_winners" ON public.historic_winners FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Storage bucket for winner photos
INSERT INTO storage.buckets (id, name, public) VALUES ('winner-photos', 'winner-photos', true);

CREATE POLICY "Winner photos are publicly accessible" ON storage.objects FOR SELECT TO public USING (bucket_id = 'winner-photos');
CREATE POLICY "Auth users can upload winner photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'winner-photos');
CREATE POLICY "Auth users can update winner photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'winner-photos');
CREATE POLICY "Auth users can delete winner photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'winner-photos');