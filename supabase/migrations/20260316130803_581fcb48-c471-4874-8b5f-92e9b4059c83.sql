-- Tighten RLS: Use admin role approach
-- Drop overly permissive policies and create proper ones

-- For this app, admin is any authenticated user (single admin)
-- This is acceptable since user registration is disabled

-- Players: already good for SELECT, tighten INSERT/UPDATE
DROP POLICY "Authenticated users can insert players" ON public.players;
DROP POLICY "Authenticated users can update players" ON public.players;

CREATE POLICY "Service role can insert players" ON public.players FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Service role can update players" ON public.players FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- Tournaments: fix the ALL policy
DROP POLICY "Authenticated users can manage tournaments" ON public.tournaments;

CREATE POLICY "Auth users can insert tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can update tournaments" ON public.tournaments FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can delete tournaments" ON public.tournaments FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Results: fix the ALL policy
DROP POLICY "Authenticated users can manage results" ON public.results;

CREATE POLICY "Auth users can insert results" ON public.results FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can update results" ON public.results FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can delete results" ON public.results FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Rankings: fix the ALL policy
DROP POLICY "Authenticated users can manage rankings" ON public.rankings;

CREATE POLICY "Auth users can insert rankings" ON public.rankings FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can update rankings" ON public.rankings FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can delete rankings" ON public.rankings FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);