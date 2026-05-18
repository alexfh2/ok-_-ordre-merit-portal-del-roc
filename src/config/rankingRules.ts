/**
 * Ordre del Mèrit Portal del Roc 2026 — Reglament centralitzat.
 *
 * Aquest fitxer és la font única de veritat per a regles del rànquing.
 * No hardcodejar 16 / 10 / 8 en components; importar d'aquí sempre.
 */

export type CategoryKey =
  | "scratch_male"
  | "scratch_female"
  | "handicap_male"
  | "handicap_female"
  | "handicap_senior";

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  type: "scratch" | "handicap";
  gender?: "M" | "F";
  senior?: boolean;
}

export const RANKING_RULES = {
  season: 2026,
  competition: "Ordre del Mèrit Portal del Roc",
  modality: "individual_stableford" as const,

  totalRounds: 16,
  countingRounds: 10,
  minimumRoundsForPrizes: 10,

  /**
   * Punts extra per participació, a partir de la prova 11.
   * Clau = nombre de proves jugades, valor = punts extra acumulats.
   */
  extraPointsByRoundsPlayed: {
    11: 2,
    12: 4,
    13: 6,
    14: 8,
    15: 10,
    16: 12,
  } as Record<number, number>,

  /**
   * Edat sénior: PENDENT DE CONFIRMACIÓ.
   * No es calcula sénior automàticament fins que:
   *   a) El club confirmi el criteri d'edat, o
   *   b) El propi Excel d'abonats marqui la condició de sénior.
   * Mentrestant `senior` ha d'arribar explícit a l'app.
   */
  seniorMinAge: null as number | null,
  seniorEligibility: "pending_confirmation" as const,

  categories: [
    { key: "scratch_male",    label: "Scratch masculí",  type: "scratch",  gender: "M" },
    { key: "scratch_female",  label: "Scratch femení",   type: "scratch",  gender: "F" },
    { key: "handicap_male",   label: "Hàndicap masculí", type: "handicap", gender: "M" },
    { key: "handicap_female", label: "Hàndicap femení",  type: "handicap", gender: "F" },
    { key: "handicap_senior", label: "Hàndicap sènior",  type: "handicap", senior: true },
  ] satisfies CategoryDef[],

  tieBreakRules: {
    /** En hàndicap, guanya el jugador amb hàndicap més baix. */
    handicap: "lower_handicap_wins" as const,
    /** En scratch, guanya el jugador amb hàndicap més alt. */
    scratch: "higher_handicap_wins" as const,
  },
} as const;

export type RankingRules = typeof RANKING_RULES;
