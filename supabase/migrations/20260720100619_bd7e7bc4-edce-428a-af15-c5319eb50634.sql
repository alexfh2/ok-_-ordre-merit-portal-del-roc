CREATE OR REPLACE FUNCTION public.recalculate_rankings_2026()
RETURNS void
LANGUAGE sql
SET search_path TO 'public'
AS $function$
  DELETE FROM public.rankings WHERE position >= 0;

  INSERT INTO public.rankings (player_id, category, total_points, position, updated_at)
  WITH category_defs(category, score_kind, gender_filter, senior_only) AS (
    VALUES
      ('scratch_male'::text, 'scratch'::text, 'male'::text, false),
      ('scratch_female'::text, 'scratch'::text, 'female'::text, false),
      ('handicap_male'::text, 'handicap'::text, 'male'::text, false),
      ('handicap_female'::text, 'handicap'::text, 'female'::text, false),
      ('handicap_senior'::text, 'handicap'::text, NULL::text, true)
  ), eligible_scores AS (
    SELECT
      cd.category,
      r.player_id,
      CASE WHEN cd.score_kind = 'scratch' THEN r.scratch_score ELSE r.handicap_score END AS score
    FROM category_defs cd
    JOIN public.results r ON true
    JOIN public.tournaments t ON t.id = r.tournament_id AND t.season = 2026
    JOIN public.players p ON p.id = r.player_id
    WHERE p.is_subscriber IS TRUE
      AND CASE WHEN cd.score_kind = 'scratch' THEN r.scratch_score ELSE r.handicap_score END IS NOT NULL
      AND (
        (cd.senior_only IS TRUE AND p.is_senior IS TRUE)
        OR (cd.senior_only IS FALSE AND p.gender = cd.gender_filter)
      )
  ), numbered_scores AS (
    SELECT
      category,
      player_id,
      score,
      row_number() OVER (PARTITION BY category, player_id ORDER BY score DESC) AS score_rank,
      count(*) OVER (PARTITION BY category, player_id) AS rounds_played
    FROM eligible_scores
  ), player_totals AS (
    SELECT
      category,
      player_id,
      sum(score) FILTER (WHERE score_rank <= 10)::integer AS base_points,
      max(rounds_played)::integer AS rounds_played
    FROM numbered_scores
    GROUP BY category, player_id
  ), with_bonus AS (
    SELECT
      category,
      player_id,
      base_points,
      rounds_played,
      CASE
        WHEN rounds_played >= 16 THEN 12
        WHEN rounds_played = 15 THEN 10
        WHEN rounds_played = 14 THEN 8
        WHEN rounds_played = 13 THEN 6
        WHEN rounds_played = 12 THEN 4
        WHEN rounds_played = 11 THEN 2
        ELSE 0
      END AS bonus_points
    FROM player_totals
  ), ordered_totals AS (
    SELECT
      player_id,
      category,
      (base_points + bonus_points)::integer AS total_points,
      row_number() OVER (
        PARTITION BY category
        ORDER BY
          CASE WHEN rounds_played >= 10 THEN 0 ELSE 1 END,
          (base_points + bonus_points) DESC,
          rounds_played DESC,
          player_id
      )::integer AS position
    FROM with_bonus
  )
  SELECT player_id, category, total_points, position, now()
  FROM ordered_totals;
$function$;

SELECT public.recalculate_rankings_2026();