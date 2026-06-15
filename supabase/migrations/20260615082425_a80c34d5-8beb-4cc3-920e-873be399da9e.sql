DROP POLICY IF EXISTS "Players public can read" ON public.players;
REVOKE SELECT ON public.players FROM anon;