ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS is_senior boolean NOT NULL DEFAULT false;

UPDATE public.players
SET is_senior = CASE
  WHEN birth_date IS NULL THEN false
  ELSE EXTRACT(YEAR FROM age(CURRENT_DATE, birth_date)) >= 55
END;

CREATE OR REPLACE FUNCTION public.sync_player_is_senior()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.is_senior := CASE
    WHEN NEW.birth_date IS NULL THEN false
    ELSE EXTRACT(YEAR FROM age(CURRENT_DATE, NEW.birth_date)) >= 55
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_player_is_senior_trigger ON public.players;
CREATE TRIGGER sync_player_is_senior_trigger
BEFORE INSERT OR UPDATE OF birth_date
ON public.players
FOR EACH ROW
EXECUTE FUNCTION public.sync_player_is_senior();

DROP VIEW IF EXISTS public.players_public;
CREATE VIEW public.players_public
WITH (security_invoker = on) AS
SELECT
  id,
  name,
  first_name,
  last_name,
  gender,
  license_number,
  photo_url,
  handicap_actual,
  handicap_updated_at,
  is_subscriber,
  subscriber_updated_at,
  created_at,
  is_senior
FROM public.players;

GRANT SELECT ON public.players_public TO anon, authenticated;
GRANT SELECT (id, name, first_name, last_name, gender, handicap_actual, handicap_updated_at, photo_url, license_number, is_subscriber, subscriber_updated_at, created_at, is_senior) ON public.players TO anon;