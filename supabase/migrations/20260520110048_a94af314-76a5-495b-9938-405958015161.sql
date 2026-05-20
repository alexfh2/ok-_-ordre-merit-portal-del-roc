
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_round_number_check;
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_round_number_key;
ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_round_number_check CHECK (round_number >= 1 AND round_number <= 20);
ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_season_round_key UNIQUE (season, round_number);
