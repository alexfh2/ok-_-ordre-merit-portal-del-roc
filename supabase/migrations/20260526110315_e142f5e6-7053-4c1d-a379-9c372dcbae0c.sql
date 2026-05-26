CREATE OR REPLACE VIEW public.players_public AS
SELECT
  id,
  name,
  first_name,
  last_name,
  gender,
  license_number,
  photo_url,
  handicap_actual,
  handicap_updated_at,
  is_subscriber,
  created_at,
  (birth_date IS NOT NULL AND EXTRACT(YEAR FROM birth_date)::int <= (EXTRACT(YEAR FROM CURRENT_DATE)::int - 55)) AS is_senior
FROM public.players;