
-- Switch view back to security_invoker so it doesn't trigger the linter
ALTER VIEW public.players_public SET (security_invoker = true);

-- Allow public read access on players table, but only on safe columns via column-level grants
CREATE POLICY "Players public can read"
ON public.players
FOR SELECT
TO anon
USING (true);

-- Revoke broad access and grant only non-sensitive columns to anon
REVOKE SELECT ON public.players FROM anon;
GRANT SELECT (id, name, first_name, last_name, gender, handicap_actual, handicap_updated_at, photo_url, license_number, is_subscriber, subscriber_updated_at, created_at) ON public.players TO anon;

-- Ensure view itself is readable
GRANT SELECT ON public.players_public TO anon, authenticated;
