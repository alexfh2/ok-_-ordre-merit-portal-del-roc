-- Create a public-safe view for players excluding birth_date
CREATE OR REPLACE VIEW public.players_public
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
  created_at
FROM public.players;

GRANT SELECT ON public.players_public TO anon, authenticated;

-- Restrict direct SELECT on base players table to authenticated users only
DROP POLICY IF EXISTS "Players are viewable by everyone" ON public.players;

CREATE POLICY "Players viewable by authenticated"
ON public.players
FOR SELECT
TO authenticated
USING (true);