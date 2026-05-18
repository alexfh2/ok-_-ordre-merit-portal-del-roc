
-- Create private 'backups' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies on storage.objects for backups bucket
CREATE POLICY "Auth users can read backups"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'backups');

CREATE POLICY "Auth users can upload backups"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'backups');

CREATE POLICY "Auth users can delete backups"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'backups');

CREATE POLICY "Service role can manage backups"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'backups')
WITH CHECK (bucket_id = 'backups');

-- Enable required extensions for cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
