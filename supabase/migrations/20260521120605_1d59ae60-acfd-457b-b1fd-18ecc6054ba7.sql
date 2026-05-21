DROP POLICY IF EXISTS "Allow public insert news-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update news-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete news-photos" ON storage.objects;

CREATE POLICY "Authenticated can insert news-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'news-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update news-photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'news-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete news-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'news-photos' AND auth.uid() IS NOT NULL);