-- Create players table
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_number TEXT,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(license_number)
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players are viewable by everyone" ON public.players FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert players" ON public.players FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update players" ON public.players FOR UPDATE TO authenticated USING (true);

-- Create tournaments table
CREATE TABLE public.tournaments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  round_number INTEGER NOT NULL CHECK (round_number >= 1 AND round_number <= 10),
  date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(round_number)
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tournaments are viewable by everyone" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage tournaments" ON public.tournaments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create results table
CREATE TABLE public.results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  scratch_score INTEGER,
  handicap_score INTEGER,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(player_id, tournament_id)
);

ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Results are viewable by everyone" ON public.results FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage results" ON public.results FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create rankings table
CREATE TABLE public.rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('scratch_male', 'scratch_female', 'handicap_male', 'handicap_female')),
  total_points INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(player_id, category)
);

ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rankings are viewable by everyone" ON public.rankings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage rankings" ON public.rankings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create storage bucket for Excel uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('excel-uploads', 'excel-uploads', false);

CREATE POLICY "Authenticated users can upload excel files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'excel-uploads');
CREATE POLICY "Authenticated users can read excel files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'excel-uploads');