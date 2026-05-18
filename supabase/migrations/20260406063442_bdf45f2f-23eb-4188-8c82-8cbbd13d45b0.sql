ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS handicap_actual real,
ADD COLUMN IF NOT EXISTS handicap_updated_at timestamptz;