
-- Switch view to security_invoker so it respects querying user's permissions
ALTER VIEW public.players_public SET (security_invoker = on);

-- Allow anon to read ONLY safe columns from players (birth_date excluded)
GRANT SELECT (id, name, first_name, last_name, gender, license_number, photo_url, handicap_actual, handicap_updated_at, is_subscriber, subscriber_updated_at, created_at, is_senior) ON public.players TO anon;

-- RLS policy so anon can SELECT rows (column privileges still gate what's visible)
DROP POLICY IF EXISTS "Anon can view public player columns" ON public.players;
CREATE POLICY "Anon can view public player columns"
ON public.players
FOR SELECT
TO anon
USING (true);
