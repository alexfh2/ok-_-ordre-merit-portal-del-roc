ALTER TABLE public.rankings DROP CONSTRAINT IF EXISTS rankings_category_check;
ALTER TABLE public.rankings ADD CONSTRAINT rankings_category_check
  CHECK (category = ANY (ARRAY['scratch_male'::text, 'scratch_female'::text, 'handicap_male'::text, 'handicap_female'::text, 'handicap_senior'::text]));

DELETE FROM public.rankings WHERE category = 'handicap_senior';

INSERT INTO public.rankings (player_id, category, total_points, position, updated_at)
WITH senior_players AS (
  SELECT id FROM public.players
  WHERE is_subscriber = true
    AND birth_date IS NOT NULL
    AND EXTRACT(YEAR FROM birth_date) <= 1971
),
scored AS (
  SELECT r.player_id, r.handicap_score,
    ROW_NUMBER() OVER (PARTITION BY r.player_id ORDER BY r.handicap_score DESC NULLS LAST) AS rn
  FROM public.results r
  JOIN senior_players sp ON sp.id = r.player_id
  WHERE r.handicap_score IS NOT NULL
),
agg AS (
  SELECT player_id,
    SUM(CASE WHEN rn <= 10 THEN handicap_score ELSE 0 END)::int AS total_points,
    COUNT(*)::int AS rounds_played
  FROM scored
  GROUP BY player_id
),
ranked AS (
  SELECT player_id, total_points, rounds_played,
    (ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN rounds_played >= 8 THEN 0 ELSE 1 END,
        total_points DESC,
        rounds_played DESC
    ))::int AS position
  FROM agg
)
SELECT player_id, 'handicap_senior', total_points, position, now() FROM ranked;