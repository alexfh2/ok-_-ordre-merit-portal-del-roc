DROP VIEW IF EXISTS public.players_public;
CREATE VIEW public.players_public
WITH (security_invoker = off) AS
SELECT id, name, first_name, last_name, gender, photo_url, handicap_actual, is_subscriber
FROM public.players;
GRANT SELECT ON public.players_public TO anon, authenticated;