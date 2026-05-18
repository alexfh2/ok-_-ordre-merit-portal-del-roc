
-- backups_log table
create table if not exists public.backups_log (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  storage_path text not null,
  size_bytes bigint,
  tipo text not null check (tipo in ('manual','automatico','pre-restauracion')),
  estado text not null default 'exitoso' check (estado in ('exitoso','error')),
  tablas_incluidas text[] not null default '{}',
  total_registros integer,
  error_mensaje text,
  created_by uuid,
  drive_file_id text,
  drive_uploaded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_backups_log_created_at on public.backups_log (created_at desc);
create index if not exists idx_backups_log_tipo on public.backups_log (tipo);

alter table public.backups_log enable row level security;

drop policy if exists "Auth users can view backups_log" on public.backups_log;
create policy "Auth users can view backups_log" on public.backups_log
  for select to authenticated using (auth.uid() is not null);

drop policy if exists "Auth users can insert backups_log" on public.backups_log;
create policy "Auth users can insert backups_log" on public.backups_log
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "Auth users can update backups_log" on public.backups_log;
create policy "Auth users can update backups_log" on public.backups_log
  for update to authenticated using (auth.uid() is not null);

drop policy if exists "Auth users can delete backups_log" on public.backups_log;
create policy "Auth users can delete backups_log" on public.backups_log
  for delete to authenticated using (auth.uid() is not null);

-- drive_settings (singleton with id=1)
create table if not exists public.drive_settings (
  id integer primary key default 1,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  connected_email text,
  connected_at timestamptz,
  folder_id text,
  folder_name text,
  updated_at timestamptz not null default now(),
  constraint drive_settings_singleton check (id = 1)
);

insert into public.drive_settings (id) values (1) on conflict (id) do nothing;

alter table public.drive_settings enable row level security;

drop policy if exists "Auth users can view drive_settings" on public.drive_settings;
create policy "Auth users can view drive_settings" on public.drive_settings
  for select to authenticated using (auth.uid() is not null);

drop policy if exists "Auth users can update drive_settings" on public.drive_settings;
create policy "Auth users can update drive_settings" on public.drive_settings
  for update to authenticated using (auth.uid() is not null);

drop policy if exists "Auth users can insert drive_settings" on public.drive_settings;
create policy "Auth users can insert drive_settings" on public.drive_settings
  for insert to authenticated with check (auth.uid() is not null);

-- Reprogram daily cron: invoke new create-backup function
do $$
declare jid bigint;
begin
  for jid in select jobid from cron.job where jobname in ('daily-backup', 'daily-create-backup')
  loop
    perform cron.unschedule(jid);
  end loop;
end $$;

select cron.schedule(
  'daily-create-backup',
  '0 3 * * *',
  $$
  select net.http_post(
    url:='https://akurrwgwerzxpbbhjnab.supabase.co/functions/v1/create-backup',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrdXJyd2d3ZXJ6eHBiYmhqbmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjc5NjMsImV4cCI6MjA4OTc0Mzk2M30.VG5gLcUdR_Oz0lZgjPMFfgLIRXkGGRDGAwQI-Pd2Rac"}'::jsonb,
    body:='{"tipo":"automatico"}'::jsonb
  );
  $$
);
