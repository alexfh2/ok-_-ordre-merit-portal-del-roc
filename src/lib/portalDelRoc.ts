/**
 * Ordre del Mèrit Portal del Roc — utilitats de càlcul i imports.
 *
 * IMPORTANT:
 * - Només les proves amb `tournaments.is_om = true` compten per a l'O.M.
 * - Només els jugadors amb `players.is_subscriber = true` apareixen al rànquing O.M.
 * - Aquestes funcions són esquelets segurs: no s'executen automàticament
 *   ni esborren dades. Pendent de validar amb l'Excel real (resultats).
 */

import { RANKING_RULES } from "@/config/rankingRules";

export interface HoleInput {
  strokes: number;
  par: number;
  strokeIndex: number;
  playingHandicap: number;
}

export function calculateStablefordForHole(input: HoleInput): number {
  const { strokes, par, strokeIndex, playingHandicap } = input;
  if (!Number.isFinite(strokes) || strokes <= 0) return 0;
  const hcp = Math.max(0, Math.floor(playingHandicap));
  let extra = 0;
  let remaining = hcp;
  while (remaining >= 18) { extra += 1; remaining -= 18; }
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

export function applyExtraPointsForRoundsPlayed(
  basePoints: number,
  roundsPlayed: number,
): number {
  const extra = RANKING_RULES.extraPointsByRoundsPlayed[roundsPlayed] ?? 0;
  return basePoints + extra;
}

// ---------- Subscribers Excel parser ----------

export interface ParsedSubscriber {
  name: string;
  license_number: string | null;
  gender: "M" | "F" | null;
  birth_date: string | null; // ISO YYYY-MM-DD
  handicap_actual: number | null;
  is_subscriber: boolean;
  _rowIndex: number; // for error reporting (1-based, excluding header)
}

/** Normalitza per comparar noms (sense accents, majúscules, espais col·lapsats). */
export function normalizeName(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function pickKey(row: Record<string, unknown>, aliases: string[]): unknown {
  const keys = Object.keys(row);
  const normKeys = keys.map((k) => normalizeName(k).replace(/[._-]/g, " "));
  for (const alias of aliases) {
    const a = normalizeName(alias).replace(/[._-]/g, " ");
    const idx = normKeys.findIndex((k) => k === a || k.includes(a));
    if (idx !== -1) return row[keys[idx]];
  }
  return undefined;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function parseGender(v: unknown): "M" | "F" | null {
  const s = toStr(v).toUpperCase();
  if (!s) return null;
  if (["M", "H", "MASCULI", "MASCULINO", "MASC", "MALE", "HOMBRE", "HOME"].some(x => s.startsWith(x))) return "M";
  if (["F", "D", "FEMENI", "FEMENINO", "FEM", "FEMALE", "MUJER", "DONA"].some(x => s.startsWith(x))) return "F";
  return null;
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(",", ".").replace(/[^\d.+\-]/g, "");
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parseBool(v: unknown): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (["si", "sí", "yes", "y", "true", "1", "x", "abonat", "abonado"].includes(s)) return true;
  if (["no", "n", "false", "0", "-"].includes(s)) return false;
  return null;
}

/** Excel date serial or string -> ISO yyyy-mm-dd, or null. */
function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    // Excel serial date (days since 1899-12-30)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return null;
  // dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, dd, mm, yy] = m;
    let year = parseInt(yy);
    if (year < 100) year += year < 30 ? 2000 : 1900;
    const day = String(parseInt(dd)).padStart(2, "0");
    const mon = String(parseInt(mm)).padStart(2, "0");
    return `${year}-${mon}-${day}`;
  }
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/**
 * Parser flexible per a la sheet d'abonats. Rep files com a objectes
 * (resultat de XLSX.utils.sheet_to_json({ defval: "" })).
 *
 * Si la columna "abonat" no existeix, marca tothom com a is_subscriber = true.
 */
export function parseSubscribersSheet(rows: Record<string, unknown>[]): ParsedSubscriber[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const out: ParsedSubscriber[] = [];
  rows.forEach((row, i) => {
    // Try a single full-name column first
    let name = toStr(
      pickKey(row, ["nombre completo", "nom complet", "full name", "full_name", "nombre y apellidos", "nom i cognoms", "nombre", "nom", "name", "jugador", "player"]),
    );
    // If not found, combine first name + surname columns
    if (!name) {
      const first = toStr(pickKey(row, ["nombre", "nom", "first name", "first_name", "given name"]));
      const last = toStr(pickKey(row, ["apellidos", "apellido", "cognoms", "cognom", "surname", "last name", "last_name"]));
      name = [first, last].filter(Boolean).join(" ").trim();
    }
    if (!name) return;
    // Collapse whitespace
    name = name.replace(/\s+/g, " ").trim();
    out.push({
      name,
      license_number: null,
      gender: null,
      birth_date: null,
      handicap_actual: null,
      is_subscriber: true,
      _rowIndex: i + 1,
    });
  });
  return out;
}

// ---------- Stubs reservats per a fases futures ----------

export interface ParsedHoleResult {
  player_name: string;
  license_number?: string | null;
  round_number: number;
  hole_number: number;
  strokes: number;
}

export function parseResultsSheet(_rows: unknown[]): ParsedHoleResult[] {
  throw new Error("parseResultsSheet: pendent de la següent fase (Excel de resultats real)");
}

export async function recalculatePortalDelRocRankings(): Promise<void> {
  throw new Error("recalculatePortalDelRocRankings: pendent. Validar abans amb Excel real.");
}
