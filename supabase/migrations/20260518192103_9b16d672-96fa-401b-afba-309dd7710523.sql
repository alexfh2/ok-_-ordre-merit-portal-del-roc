
-- Hide sensitive personal data from anonymous clients via column-level privileges.
-- Anonymous role can SELECT only non-sensitive columns; authenticated keeps full access (admin).
REVOKE SELECT ON public.players FROM anon;
GRANT SELECT (
  id,
  name,
  license_number,
  gender,
  handicap_actual,
  handicap_updated_at,
  photo_url,
  is_subscriber,
  created_at
) ON public.players TO anon;

-- Ensure authenticated retains full SELECT (admin reads birth_date for senior logic).
GRANT SELECT ON public.players TO authenticated;
