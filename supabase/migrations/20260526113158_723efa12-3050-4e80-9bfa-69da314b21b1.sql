ALTER VIEW public.players_public SET (security_invoker = false);
GRANT SELECT ON public.players_public TO anon, authenticated;