-- Habilita extensions necessàries per executar cron jobs HTTP
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Esborra el job si ja existia (per re-crear net)
DO $$
BEGIN
  PERFORM cron.unschedule('daily-backup-3am');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Programa la còpia automàtica diària a les 3:00 (UTC)
SELECT cron.schedule(
  'daily-backup-3am',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://akurrwgwerzxpbbhjnab.supabase.co/functions/v1/create-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrdXJyd2d3ZXJ6eHBiYmhqbmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjc5NjMsImV4cCI6MjA4OTc0Mzk2M30.VG5gLcUdR_Oz0lZgjPMFfgLIRXkGGRDGAwQI-Pd2Rac'
    ),
    body := jsonb_build_object('tipo', 'automatico', 'cron_secret', 'auto-cron')
  );
  $$
);