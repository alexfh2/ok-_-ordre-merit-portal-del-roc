// Individual Stableford Excel parser with preview + import modes.
// Replaces the rigid logic of process-excel for new uploads while keeping
// the same DB structure (players, tournaments, results, hole_scores, rankings).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------- helpers ----------
function normName(v: any): string {
  return String(v ?? '')
    .normalize('NFC')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function normKey(v: any): string {
  return normName(v)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, '');
}
function toNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  let s = String(v).trim();
  if (!s || s.toUpperCase() === 'N' || s.startsWith('#')) return null;
  // Plus-handicap notation in federation Excels: "(+)1" or "(+)0,9" means a
  // negative handicap (player gives strokes back). Convert to a real negative.
  let negative = false;
  if (/\(\+\)/.test(s)) { negative = true; s = s.replace(/\(\+\)/g, ''); }
  s = s.replace(',', '.').replace(/[^\d.\-]/g, '');
  if (!s || s === '-' || s === '.') return null;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return negative ? -Math.abs(n) : n;
}
function toInt(v: any): number | null {
  const n = toNum(v);
  return n === null ? null : Math.round(n);
}
function parseDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let y = parseInt(m[3]);
    if (y < 100) y += y < 30 ? 2000 : 1900;
    return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
  return null;
}

// Header alias map
const ALIASES = {
  license: ['ASOCIADO', 'LICENCIA', 'LICENSE', 'N ASOCIADO', 'NUM LICENCIA', 'LIC'],
  name: ['NOMBRE', 'JUGADOR', 'PLAYER', 'NOM'],
  gender: ['SEXO', 'GENERO', 'GENDER', 'GENERE'],
  birth: ['FECHA NACIMIENTO', 'F NACIMIENTO', 'NAIXEMENT', 'BIRTH', 'FECHANAC', 'DATA NAIXEMENT'],
  hpj: ['HPJ', 'HCP JUEGO', 'HANDICAP JUEGO', 'HJ', 'PLAYING HANDICAP'],
  hcp: ['HCP', 'HANDICAP', 'HCPI', 'HPE'],
  bruto: ['BRUTO', 'GROSS', 'TOTAL GROSS'],
  neto: ['NETO', 'NET'],
  stbScratch: ['PTS BRUTO', 'STB BRUTO', 'PUNTOS BRUTO', 'STABLEFORD BRUTO', 'STABLEFORD GROSS'],
  stbHandicap: ['PTS NETO', 'STB NETO', 'PUNTOS NETO', 'STABLEFORD NETO', 'STABLEFORD NET'],
};
function findCol(headers: string[], aliases: string[]): number {
  const upper = headers.map(h => normKey(h));
  for (const a of aliases) {
    const want = normKey(a);
    const i = upper.indexOf(want);
    if (i !== -1) return i;
  }
  // partial
  for (const a of aliases) {
    const want = normKey(a);
    const i = upper.findIndex(h => h.includes(want));
    if (i !== -1) return i;
  }
  return -1;
}

// Detect hole columns: accepts "1".."18", "H1".."H18", "HOYO 1", "HOLE 1"
function detectHoleCols(headerRow: any[]): Map<number, number> {
  const map = new Map<number, number>();
  for (let j = 0; j < headerRow.length; j++) {
    const raw = String(headerRow[j] ?? '').trim();
    if (!raw) continue;
    let h = NaN;
    if (/^\d{1,2}$/.test(raw)) h = parseInt(raw);
    else {
      const m = raw.toUpperCase().match(/^(?:H|HOYO|HOLE|FORAT)\s*0?(\d{1,2})$/);
      if (m) h = parseInt(m[1]);
    }
    if (!isNaN(h) && h >= 1 && h <= 18 && !map.has(h)) map.set(h, j);
  }
  return map;
}

interface ParsedPlayer {
  license: string;
  name: string;
  gender: 'male' | 'female' | null;
  birth_date: string | null;
  hpj: number | null;
  holes: (number | null)[]; // 18 entries, strokes
  stbHole: (number | null)[]; // 18 entries if present
  bruto: number | null;
  neto: number | null;
  stbScratchTotal: number | null;
  stbHandicapTotal: number | null;
  is_subscriber: boolean;
  warnings: string[];
}

// Yellow-highlight detection from cell style
function isYellowFill(cell: any): boolean {
  if (!cell || !cell.s) return false;
  const f = cell.s.fill || cell.s;
  const tryColors = [f?.fgColor, f?.bgColor, cell.s?.fgColor, cell.s?.bgColor].filter(Boolean);
  for (const c of tryColors) {
    const rgb = (c.rgb || '').toString().toUpperCase().replace(/^FF/, '');
    if (!rgb || rgb.length < 6) continue;
    const r = parseInt(rgb.slice(0, 2), 16);
    const g = parseInt(rgb.slice(2, 4), 16);
    const b = parseInt(rgb.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) continue;
    // bright/medium yellow: R high, G high, B low
    if (r >= 200 && g >= 180 && b <= 140 && r >= b + 60 && g >= b + 60) return true;
  }
  return false;
}

function parseWorkbook(buf: Uint8Array) {
  const wb = XLSX.read(buf, { type: 'array', codepage: 65001, cellDates: true, cellStyles: true });

  // Build per-license registry from "INDIVIDUAL" / inscripcions sheet
  const registry = new Map<string, { name: string; gender: 'male' | 'female' | null; birth: string | null; hcp: number | null }>();
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    // find header row with ASOCIADO + NOMBRE + SEXO
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const r = rows[i];
      if (!r) continue;
      const hk = r.map(c => normKey(c));
      const asocCol = findCol(r, ALIASES.license);
      const nameCol = findCol(r, ALIASES.name);
      const sexoCol = findCol(r, ALIASES.gender);
      const birthCol = findCol(r, ALIASES.birth);
      if (asocCol !== -1 && nameCol !== -1 && sexoCol !== -1) {
        for (let k = i + 1; k < rows.length; k++) {
          const rr = rows[k];
          if (!rr) continue;
          const lic = normName(rr[asocCol]);
          const nm = normName(rr[nameCol]);
          if (!lic || !nm || !/^ACPP/i.test(lic)) continue;
          const sx = String(rr[sexoCol] ?? '').trim().toUpperCase();
          registry.set(lic, {
            name: nm,
            gender: sx === 'F' ? 'female' : sx === 'M' ? 'male' : null,
            birth: parseDate(rr[birthCol]),
            hcp: null,
          });
        }
        break;
      }
    }
    if (registry.size) break;
  }

  // Find the results sheet: the one with hole columns 1..18 (or H1..H18) AND name/license
  let resultsSheet: string | null = null;
  let resultsRows: any[][] = [];
  let resultsWs: any = null;
  let headerIdx = -1;
  let holeColMap = new Map<number, number>();
  let cols: Record<string, number> = {};

  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const r = rows[i];
      if (!r) continue;
      const hm = detectHoleCols(r);
      // Need at least 9 holes
      let hasNine = true;
      for (let h = 1; h <= 9; h++) if (!hm.has(h)) { hasNine = false; break; }
      if (!hasNine) continue;
      const nameCol = findCol(r, ALIASES.name);
      const licCol = findCol(r, ALIASES.license);
      if (nameCol === -1 || licCol === -1) continue;
      resultsSheet = sn;
      resultsRows = rows;
      resultsWs = ws;
      headerIdx = i;
      holeColMap = hm;
      cols = {
        name: nameCol,
        license: licCol,
        hpj: findCol(r, ALIASES.hpj),
        hcp: findCol(r, ALIASES.hcp),
        bruto: findCol(r, ALIASES.bruto),
        neto: findCol(r, ALIASES.neto),
        stbScratch: findCol(r, ALIASES.stbScratch),
        stbHandicap: findCol(r, ALIASES.stbHandicap),
        gender: findCol(r, ALIASES.gender),
        birth: findCol(r, ALIASES.birth),
      };
      break;
    }
    if (resultsSheet) break;
  }

  // Detect per-hole stableford columns (STB1..STB18 / PTS1..PTS18)
  const stbHoleColMap = new Map<number, number>();
  if (headerIdx !== -1) {
    const hr = resultsRows[headerIdx];
    for (let j = 0; j < hr.length; j++) {
      const raw = String(hr[j] ?? '').trim().toUpperCase();
      const m = raw.match(/^(?:STB|PTS|PUNTOS)\s*0?(\d{1,2})$/);
      if (m) {
        const h = parseInt(m[1]);
        if (h >= 1 && h <= 18) stbHoleColMap.set(h, j);
      }
    }
  }

  // Tournament metadata
  let tournamentName = '';
  let detectedDate: string | null = null;
  let detectedRound: number | null = null;
  for (const sn of wb.SheetNames) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
    for (const r of rows.slice(0, 8)) {
      for (const c of r) {
        const s = normName(c);
        if (!s) continue;
        if (!tournamentName && (/prova|torneig|torneo|ranqui|ranking/i.test(s))) {
          tournamentName = s;
          const m = s.match(/(\d+)\s*[aª]/);
          if (m) detectedRound = parseInt(m[1]);
        }
        if (!detectedDate) {
          const d = parseDate(s);
          if (d) detectedDate = d;
        }
      }
    }
    if (tournamentName) break;
  }

  // Parse rows
  const players: ParsedPlayer[] = [];
  if (headerIdx !== -1) {
    const maxHole = Math.max(...holeColMap.keys());
    for (let i = headerIdx + 1; i < resultsRows.length; i++) {
      const r = resultsRows[i];
      if (!r) continue;
      const name = normName(r[cols.name]);
      const license = normName(r[cols.license]);
      if (!name || !license) continue;
      // Skip section/title rows
      if (/^total|^subtotal|^classifi/i.test(name)) continue;

      const holes: (number | null)[] = [];
      const stb: (number | null)[] = [];
      let hasAnyHole = false;
      for (let h = 1; h <= 18; h++) {
        const col = holeColMap.get(h);
        const v = col !== undefined ? toInt(r[col]) : null;
        if (v !== null && v > 0 && v < 20) {
          holes.push(v);
          hasAnyHole = true;
        } else holes.push(null);
        const sc = stbHoleColMap.get(h);
        stb.push(sc !== undefined ? toInt(r[sc]) : null);
      }

      const reg = registry.get(license);
      const sexoCell = cols.gender !== -1 ? String(r[cols.gender] ?? '').trim().toUpperCase() : '';
      const gender: 'male' | 'female' | null = sexoCell === 'F' ? 'female'
        : sexoCell === 'M' ? 'male'
        : reg?.gender ?? null;
      const birth = (cols.birth !== -1 ? parseDate(r[cols.birth]) : null) ?? reg?.birth ?? null;

      // Detect yellow highlight on name (and license) cell → subscriber for OM ranking
      const nameCellAddr = XLSX.utils.encode_cell({ r: i, c: cols.name });
      const licCellAddr = XLSX.utils.encode_cell({ r: i, c: cols.license });
      const isSub = isYellowFill(resultsWs?.[nameCellAddr]) || isYellowFill(resultsWs?.[licCellAddr]);

      const warnings: string[] = [];
      if (!reg) warnings.push('Llicència no trobada al full INDIVIDUAL');
      if (!hasAnyHole) warnings.push('Sense resultats forat a forat (N.P.)');
      if (!gender) warnings.push('Sexe desconegut');
      if (!isSub) warnings.push('No abonat (no compta per O.M.)');

      players.push({
        license,
        name,
        gender,
        birth_date: birth,
        hpj: cols.hpj !== -1 ? toInt(r[cols.hpj]) : null,
        holes,
        stbHole: stb,
        bruto: cols.bruto !== -1 ? toInt(r[cols.bruto]) : null,
        neto: cols.neto !== -1 ? toInt(r[cols.neto]) : null,
        stbScratchTotal: cols.stbScratch !== -1 ? toInt(r[cols.stbScratch]) : null,
        stbHandicapTotal: cols.stbHandicap !== -1 ? toInt(r[cols.stbHandicap]) : null,
        is_subscriber: isSub,
        warnings,
      });
    }
  }

  return {
    workbook: wb,
    resultsSheet,
    tournamentName,
    detectedDate,
    detectedRound,
    headerIdx,
    holeCount: holeColMap.size,
    hasStablefordHoles: stbHoleColMap.size > 0,
    players,
  };
}

// Stableford computation
function stableford(par: number, strokes: number): number {
  if (!strokes || strokes <= 0) return 0;
  return Math.max(0, 2 + par - strokes);
}
function strokesOnHole(hpj: number, si: number): number {
  if (hpj <= 0) return 0;
  const base = Math.floor(hpj / 18);
  return base + ((hpj % 18) >= si ? 1 : 0);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { fileName, roundNumber, mode } = await req.json();
    if (!fileName) {
      return new Response(JSON.stringify({ error: 'fileName required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: fileData, error: dlErr } = await supabase.storage
      .from('excel-uploads').download(fileName);
    if (dlErr || !fileData) throw new Error('Download failed: ' + dlErr?.message);

    const buf = new Uint8Array(await fileData.arrayBuffer());
    const parsed = parseWorkbook(buf);

    // ---- Preview mode ----
    if (mode === 'preview') {
      return new Response(JSON.stringify({
        success: true,
        tournament_name: parsed.tournamentName,
        detected_round: parsed.detectedRound,
        detected_date: parsed.detectedDate,
        results_sheet: parsed.resultsSheet,
        hole_count: parsed.holeCount,
        has_stableford_holes: parsed.hasStablefordHoles,
        players: parsed.players,
        summary: {
          total: parsed.players.length,
          with_results: parsed.players.filter(p => p.holes.some(h => h !== null)).length,
          females: parsed.players.filter(p => p.gender === 'female').length,
          males: parsed.players.filter(p => p.gender === 'male').length,
          subscribers: parsed.players.filter(p => p.is_subscriber).length,
          non_subscribers: parsed.players.filter(p => !p.is_subscriber).length,
          warnings: parsed.players.filter(p => p.warnings.length > 0).length,
        },
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---- Import mode ----
    const round = roundNumber ?? parsed.detectedRound ?? 1;
    const tName = parsed.tournamentName || `Prova ${round}`;

    // Upsert tournament
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .upsert({
        name: tName,
        round_number: round,
        season: 2026,
        ...(parsed.detectedDate ? { date: parsed.detectedDate } : {}),
      }, { onConflict: 'season,round_number' })
      .select().single();
    if (tErr) throw new Error('Tournament: ' + tErr.message);

    // Upsert players (license-first dedup). is_subscriber is determined by the
    // yellow highlight on the player's name cell in the Excel.
    const playerUpserts = parsed.players.map(p => ({
      license_number: p.license,
      name: p.name,
      gender: p.gender ?? 'male',
      ...(p.birth_date ? { birth_date: p.birth_date } : {}),
      is_subscriber: p.is_subscriber,
      subscriber_updated_at: new Date().toISOString(),
    }));
    if (playerUpserts.length) {
      const { error } = await supabase
        .from('players')
        .upsert(playerUpserts, { onConflict: 'license_number' });
      if (error) throw new Error('Players: ' + error.message);
    }

    // Get id map
    const { data: dbPlayers } = await supabase
      .from('players')
      .select('id, license_number, name');

    const idByLicense = new Map<string, string>();
    const idByName = new Map<string, string>();
    for (const p of dbPlayers || []) {
      if (p.license_number) idByLicense.set(p.license_number, p.id);
      idByName.set(normKey(p.name), p.id);
    }

    // Course holes (par + SI)
    const { data: courseHoles } = await supabase
      .from('course_holes')
      .select('hole_number, par, stroke_index')
      .eq('course_name', 'Portal del Roc Pitch & Putt');
    const parByHole = new Map<number, number>();
    const siByHole = new Map<number, number>();
    for (const h of courseHoles || []) {
      parByHole.set(h.hole_number, h.par);
      siByHole.set(h.hole_number, h.stroke_index);
    }

    // Reset prior data for this tournament
    await supabase.from('hole_scores').delete().eq('tournament_id', tournament.id);
    await supabase.from('results').delete().eq('tournament_id', tournament.id);

    const resultsToInsert: any[] = [];
    const holeScoresToInsert: any[] = [];

    for (const p of parsed.players) {
      const playerId = idByLicense.get(p.license) ?? idByName.get(normKey(p.name));
      if (!playerId) continue;
      const hpj = p.hpj ?? 0;

      let scratchPts = 0;
      let netPts = 0;
      let hasAny = false;

      for (let i = 0; i < 18; i++) {
        const holeNum = i + 1;
        const strokes = p.holes[i];
        if (strokes !== null && strokes > 0) {
          hasAny = true;
          const par = parByHole.get(holeNum) ?? 3;
          const si = siByHole.get(holeNum) ?? holeNum;
          const stbS = p.stbHole[i] ?? stableford(par, strokes);
          const stbN = stableford(par + strokesOnHole(hpj, si), strokes);
          scratchPts += stbS;
          netPts += stbN;
          holeScoresToInsert.push({
            player_id: playerId,
            tournament_id: tournament.id,
            hole_number: holeNum,
            strokes,
          });
        }
      }

      if (!hasAny && p.stbScratchTotal === null && p.stbHandicapTotal === null) continue;

      resultsToInsert.push({
        player_id: playerId,
        tournament_id: tournament.id,
        scratch_score: p.stbScratchTotal ?? scratchPts,
        handicap_score: p.stbHandicapTotal ?? netPts,
        points: p.stbHandicapTotal ?? netPts,
        stableford_scratch_total: p.stbScratchTotal ?? scratchPts,
        stableford_handicap_total: p.stbHandicapTotal ?? netPts,
      });
    }

    if (resultsToInsert.length) {
      const { error } = await supabase.from('results').insert(resultsToInsert);
      if (error) throw new Error('Results: ' + error.message);
    }
    for (let i = 0; i < holeScoresToInsert.length; i += 500) {
      const batch = holeScoresToInsert.slice(i, i + 500);
      await supabase.from('hole_scores').insert(batch);
    }

    // Recalculate rankings via existing function logic (call sibling fn)
    await supabase.functions.invoke('process-excel', { body: { recalculateOnly: true } });

    return new Response(JSON.stringify({
      success: true,
      tournament: tName,
      round,
      stats: {
        total_players: playerUpserts.length,
        total_results: resultsToInsert.length,
        hole_scores: holeScoresToInsert.length,
      },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('process-stableford-excel error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
