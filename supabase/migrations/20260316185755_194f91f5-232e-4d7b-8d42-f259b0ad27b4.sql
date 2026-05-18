-- Create storage bucket for player photos
INSERT INTO storage.buckets (id, name, public) VALUES ('player-photos', 'player-photos', true);

-- Allow anyone to view player photos
CREATE POLICY "Player photos are publicly accessible" ON storage.objects FOR SELECT TO public USING (bucket_id = 'player-photos');

-- Allow authenticated users to upload player photos
CREATE POLICY "Auth users can upload player photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'player-photos' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to update player photos
CREATE POLICY "Auth users can update player photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'player-photos' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete player photos
CREATE POLICY "Auth users can delete player photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'player-photos' AND auth.uid() IS NOT NULL);