/**
 * Ordre del Mèrit Portal del Roc — utilitats de càlcul i imports.
 *
 * IMPORTANT:
 * - Només les proves amb `tournaments.is_om = true` compten per a l'O.M.
 * - Només els jugadors amb `players.is_subscriber = true` apareixen al rànquing O.M.
 *   Els no abonats poden tenir resultats guardats, però NO han d'aparèixer
 *   al rànquing públic ni optar a premis.
 * - Aquestes funcions són esquelets segurs: no s'executen automàticament
 *   ni esborren dades. Pendent de validar amb l'Excel real.
 */

import { RANKING_RULES } from "@/config/rankingRules";

export interface HoleInput {
  strokes: number;
  par: number;
  strokeIndex: number; // 1..18
  /** Hàndicap de joc del jugador per a aquesta prova (enter, ja convertit). */
  playingHandicap: number;
}

/**
 * Calcula els punts Stableford d'un hoyo segons regla estàndard:
 *   net = strokes - extraStrokesOnHole
 *   diff = par - net
 *   punts = max(0, 2 + diff)  (bogey=1, par=2, birdie=3, eagle=4, ...)
 *
 * Extra strokes per hoyo segons stroke index i hàndicap de joc.
 */
export function calculateStablefordForHole(input: HoleInput): number {
  const { strokes, par, strokeIndex, playingHandicap } = input;
  if (!Number.isFinite(strokes) || strokes <= 0) return 0;

  const hcp = Math.max(0, Math.floor(playingHandicap));
  // 18 hoyos: cada hoyo amb stroke_index <= hcp rep 1 cop. Si hcp > 18, els que tinguin si <= hcp-18 reben un segon cop, etc.
  let extra = 0;
  let remaining = hcp;
  while (remaining >= 18) {
    extra += 1;
    remaining -= 18;
  }
  if (strokeIndex <= remaining) extra += 1;

  const net = strokes - extra;
  const diff = par - net;
  return Math.max(0, 2 + diff);
}

export function calculatePlayerStablefordTotal(
  holes: Array<{ stableford_points: number | null }>,
): number {
  return holes.reduce((sum, h) => sum + (h.stableford_points ?? 0), 0);
}

/**
 * Bonus per participació: a partir de 11 proves jugades.
 * Retorna els punts addicionals a sumar al total comptable.
 */
export function applyExtraPointsForRoundsPlayed(
  basePoints: number,
  roundsPlayed: number,
): number {
  const extra = RANKING_RULES.extraPointsByRoundsPlayed[roundsPlayed] ?? 0;
  return basePoints + extra;
}

/**
 * STUBS d'import d'Excel. Encara no parsegem el format real.
 * En el futur, l'Excel únic tindrà 2 sheets: Abonats + Resultats.
 */
export interface ParsedSubscriber {
  name: string;
  license_number?: string | null;
  gender?: "M" | "F" | null;
  birth_date?: string | null;
  handicap_actual?: number | null;
  is_senior?: boolean | null; // explícit des de l'Excel
}

export interface ParsedHoleResult {
  player_name: string;
  license_number?: string | null;
  round_number: number;
  hole_number: number;
  strokes: number;
}

export function parseSubscribersSheet(_rows: unknown[]): ParsedSubscriber[] {
  // TODO: implementar quan tinguem un Excel real de referència.
  throw new Error("parseSubscribersSheet: pendent de validació amb Excel real");
}

export function parseResultsSheet(_rows: unknown[]): ParsedHoleResult[] {
  // TODO: implementar quan tinguem un Excel real de referència.
  throw new Error("parseResultsSheet: pendent de validació amb Excel real");
}

/**
 * Recàlcul del rànquing O.M. (esquelet — NO executar automàticament).
 *
 * Passos previstos:
 *  1) Carregar tournaments WHERE is_om = true AND season = RANKING_RULES.season.
 *  2) Carregar results d'aquests tournaments.
 *  3) Filtrar players WHERE is_subscriber = true.   ⚠️ Crític: no abonats fora.
 *  4) Per a cada jugador: agafar els millors `countingRounds` (10).
 *  5) Aplicar `applyExtraPointsForRoundsPlayed`.
 *  6) Aplicar minimumRoundsForPrizes per separar elegibles vs. no elegibles.
 *  7) Aplicar tieBreakRules per categoria.
 *  8) Escriure a `rankings`.
 */
export async function recalculatePortalDelRocRankings(): Promise<void> {
  throw new Error(
    "recalculatePortalDelRocRankings: pendent. Validar abans amb Excel real.",
  );
}
