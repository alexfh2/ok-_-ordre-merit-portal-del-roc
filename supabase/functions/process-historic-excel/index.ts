import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const cp1252ReverseMap: Record<number, number> = {
  0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,
  0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,
  0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,
  0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,
  0x0153:0x9C,0x017E:0x9E,0x0178:0x9F,
};

function decodeUtf8Mojibake(value: string): string {
  if (!/[ÃÂâ]/.test(value)) return value;
  try {
    const bytes: number[] = [];
    for (const char of value) {
      const code = char.codePointAt(0);
      if (code === undefined) continue;
      if (code <= 0xFF) { bytes.push(code); continue; }
      const mapped = cp1252ReverseMap[code];
      if (mapped === undefined) return value;
      bytes.push(mapped);
    }
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
    return decoded.includes('�') ? value : decoded;
  } catch { return value; }
}

function normalizeImportedName(value: string): string {
  return decodeUtf8Mojibake(String(value ?? ''))
    .normalize('NFC')
    .replace(/\u00A0/g, ' ')
    .replace(/(^|[\s,])M(?:\s*\.\s*)?ª\.?($|[\s,])/gi, (_m, p, s) => `${p}MARIA${s}`)
    .replace(/\s+/g, ' ')
    .trim();
}

function findCol(headers: string[], ...aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toUpperCase().trim();
    for (const alias of aliases) {
      if (h === alias || h.includes(alias)) return i;
    }
  }
  return -1;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { verifyAuth } = await import('../_shared/auth.ts');
    const authResult = await verifyAuth(req, corsHeaders);
    if (authResult instanceof Response) return authResult;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { fileName, seasonId, roundNumber, recalculateOnly } = await req.json();

    // ── Recalculate-only mode ──
    if (recalculateOnly && seasonId) {
      await recalculateHistoricRankings(supabase, seasonId);
      return new Response(JSON.stringify({ success: true, message: 'Rankings recalculated' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!fileName || !seasonId || !roundNumber) {
      return new Response(JSON.stringify({ error: 'fileName, seasonId and roundNumber are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get season config
    const { data: season, error: seasonError } = await supabase
      .from('historic_seasons')
      .select('*')
      .eq('id', seasonId)
      .single();

    if (seasonError || !season) throw new Error('Season not found');

    // Download file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('excel-uploads')
      .download(fileName);
    if (downloadError || !fileData) throw new Error('Failed to download file: ' + downloadError?.message);

    // Parse Excel
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', codepage: 65001 });

    const classificationData: Record<string, any[]> = {
      scratch_male: [], scratch_female: [], handicap_male: [], handicap_female: [], handicap_mixed: [],
    };

    let detectedDate: string | null = null;
    let detectedName: string | null = null;

    // ── Parse classification sheets ──
    for (const sheetName of workbook.SheetNames) {
      const sheetNameUpper = sheetName.toUpperCase();
      if (!sheetNameUpper.includes('CLASIFICACION') && !sheetNameUpper.includes('CLASSIFICACIO')) continue;

      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      let sheetType: string | null = null;
      let headerRowIdx = -1;
      let detectedGender: string | null = null;
      let detectedMode: string | null = null;

      for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const rowStr = rows[i]?.map((c: any) => String(c)).join(' ').toUpperCase() || '';
        if (rowStr.includes('MASCULIN') || rowStr.includes('MASCULI')) detectedGender = 'male';
        else if (rowStr.includes('FEMENIN') || rowStr.includes('FEMENI')) detectedGender = 'female';
        if (rowStr.includes('SCRATCH') && !rowStr.includes('HANDICAP')) detectedMode = 'scratch';
        else if (rowStr.includes('HANDICAP') || rowStr.includes('CON HANDICAP')) detectedMode = 'handicap';

        if (!rows[i]) continue;
        const cells = rows[i].map((c: any) => String(c).toUpperCase().trim());
        const hasPos = cells.some((c: string) => c === 'POSICION' || c === 'POS' || c === 'POS.');
        const hasName = cells.some((c: string) => c === 'NOMBRE' || c === 'ASOCIADO' || c === 'JUGADOR');
        if (hasPos && hasName) headerRowIdx = i;
      }

      if (detectedMode && detectedGender) sheetType = `${detectedMode}_${detectedGender}`;
      else if (detectedMode === 'scratch' && !detectedGender) sheetType = 'scratch_male';
      else if (detectedMode === 'handicap' && !detectedGender) sheetType = 'handicap_mixed';

      if (!sheetType || headerRowIdx === -1) continue;

      const headerCells = rows[headerRowIdx].map((c: any) => String(c).toUpperCase().trim());
      const posCol = findCol(headerCells, 'POSICION', 'POS', 'POS.');
      const asocCol = findCol(headerCells, 'ASOCIADO', 'LICENCIA', 'Nº ASOCIADO', 'NUM');
      const nameCol = findCol(headerCells, 'NOMBRE', 'JUGADOR', 'PLAYER');
      const brutoCol = findCol(headerCells, 'BRUTO', 'GROSS');
      const netoCol = findCol(headerCells, 'NETO', 'NET');

      if (posCol === -1 || nameCol === -1) continue;
      if (!(sheetType in classificationData)) continue;

      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 3) continue;
        const posicion = String(row[posCol] ?? '').trim();
        const asociado = asocCol !== -1 ? String(row[asocCol] ?? '').trim() : '';
        const nombre = normalizeImportedName(String(row[nameCol] ?? ''));
        const bruto = brutoCol !== -1 ? row[brutoCol] : null;
        const neto = netoCol !== -1 ? row[netoCol] : null;
        if (!posicion || !nombre) continue;
        if (posicion === 'No presentado' || posicion.toUpperCase() === 'NP') continue;
        const posNum = parseInt(posicion);
        if (isNaN(posNum)) continue;
        const brutoScore = bruto === null || bruto === '--' || bruto === '' ? null : parseInt(String(bruto));
        const netoScore = neto === null || neto === '--' || neto === '' ? null : parseInt(String(neto));
        if (brutoScore === null && netoScore === null) continue;

        classificationData[sheetType].push({ position: posNum, license: asociado, name: nombre, bruto: brutoScore, neto: netoScore });
      }
    }

    // ── Parse hole-by-hole scores from "Resultados" sheet ──
    const holeScoresByLicense = new Map<string, { name: string; holes: number[] }>();

    for (const sheetName of workbook.SheetNames) {
      const sheetNameUpper = sheetName.toUpperCase();
      if (!sheetNameUpper.includes('RESULTADO') && !sheetNameUpper.includes('RESULTAT')) continue;

      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      let headerRowIdx = -1;
      const holeColMap = new Map<number, number>();
      let nameCol = -1;
      let asocCol = -1;

      for (let i = 0; i < Math.min(rows.length, 30); i++) {
        if (!rows[i]) continue;
        const cells = rows[i].map((c: any) => String(c).trim());

        const foundHoleCols = new Map<number, number>();
        for (let j = 0; j < cells.length; j++) {
          const num = parseInt(cells[j]);
          if (!isNaN(num) && num >= 1 && num <= 18 && String(num) === cells[j]) {
            foundHoleCols.set(num, j);
          }
        }

        let hasAll9 = true;
        for (let h = 1; h <= 9; h++) {
          if (!foundHoleCols.has(h)) { hasAll9 = false; break; }
        }

        if (hasAll9) {
          headerRowIdx = i;
          for (const [hole, col] of foundHoleCols) {
            holeColMap.set(hole, col);
          }
          const headerCells = cells.map(c => c.toUpperCase());
          for (let j = 0; j < headerCells.length; j++) {
            if (headerCells[j].includes('NOMBRE') || headerCells[j].includes('JUGADOR')) nameCol = j;
            if (headerCells[j].includes('ASOCIADO') || headerCells[j].includes('LICENCIA') || headerCells[j] === 'Nº ASOCIADO') asocCol = j;
          }
          if ((nameCol === -1 || asocCol === -1) && i > 0) {
            const prevCells = (rows[i - 1] || []).map((c: any) => String(c).trim().toUpperCase());
            for (let j = 0; j < prevCells.length; j++) {
              if (nameCol === -1 && (prevCells[j].includes('NOMBRE') || prevCells[j].includes('JUGADOR'))) nameCol = j;
              if (asocCol === -1 && (prevCells[j].includes('ASOCIADO') || prevCells[j].includes('LICENCIA'))) asocCol = j;
            }
          }
          break;
        }
      }

      console.log(`Historic hole scores: sheet=${sheetName}, header=${headerRowIdx}, holes=${holeColMap.size}, nameCol=${nameCol}, asocCol=${asocCol}`);

      if (headerRowIdx === -1 || holeColMap.size === 0) continue;

      const maxHole = Math.max(...holeColMap.keys());
      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        const name = nameCol !== -1 ? normalizeImportedName(String(row[nameCol] ?? '')) : '';
        const license = asocCol !== -1 ? String(row[asocCol] ?? '').trim() : '';

        if (!name && !license) continue;

        const holes: number[] = [];
        let hasValidHoles = false;
        for (let h = 1; h <= maxHole; h++) {
          const col = holeColMap.get(h);
          if (col === undefined) { holes.push(0); continue; }
          const val = row[col];
          const strokes = parseInt(String(val ?? ''));
          if (!isNaN(strokes) && strokes > 0 && strokes < 20) {
            holes.push(strokes);
            hasValidHoles = true;
          } else {
            holes.push(0);
          }
        }

        if (hasValidHoles) {
          const key = license || name;
          holeScoresByLicense.set(key, { name, holes });
        }
      }

      console.log(`Parsed ${holeScoresByLicense.size} players with hole scores`);
      break;
    }

    // Detect date & name from first sheet
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const firstRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
    for (const row of firstRows.slice(0, 15)) {
      for (const cell of row) {
        const cellStr = String(cell).trim();
        if (!detectedName && (cellStr.includes('Prova') || cellStr.includes('Torneo') || cellStr.includes('Rànquing'))) {
          detectedName = cellStr;
        }
        const dateMatch = cellStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (dateMatch && !detectedDate) {
          const day = parseInt(dateMatch[1]), month = parseInt(dateMatch[2]);
          let year = parseInt(dateMatch[3]);
          if (year < 100) year += 2000;
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            detectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }
      }
    }

    // Detect gender for mixed handicap
    const allPlayers = new Map<string, { name: string; gender: string }>();
    for (const entry of classificationData.scratch_male) allPlayers.set(entry.license, { name: entry.name, gender: 'male' });
    for (const entry of classificationData.scratch_female) allPlayers.set(entry.license, { name: entry.name, gender: 'female' });
    for (const entry of classificationData.handicap_male) if (!allPlayers.has(entry.license)) allPlayers.set(entry.license, { name: entry.name, gender: 'male' });
    for (const entry of classificationData.handicap_female) if (!allPlayers.has(entry.license)) allPlayers.set(entry.license, { name: entry.name, gender: 'female' });

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (rows.length > 1) {
        const header = rows[0]?.map((h: any) => String(h).trim().toUpperCase()) || [];
        const asocIdx = header.indexOf('ASOCIADO');
        const sexoIdx = header.indexOf('SEXO');
        if (asocIdx !== -1 && sexoIdx !== -1) {
          for (let i = 1; i < rows.length; i++) {
            const license = String(rows[i][asocIdx]).trim();
            const sexo = String(rows[i][sexoIdx]).trim().toUpperCase();
            if (allPlayers.has(license)) allPlayers.get(license)!.gender = sexo === 'F' ? 'female' : 'male';
          }
          break;
        }
      }
    }

    // Split mixed handicap
    for (const entry of classificationData.handicap_mixed) {
      const player = allPlayers.get(entry.license);
      const gender = player?.gender || 'male';
      if (gender === 'female') classificationData.handicap_female.push(entry);
      else classificationData.handicap_male.push(entry);
    }

    // Delete existing results and hole scores for this round
    await supabase.from('historic_hole_scores').delete().eq('season_id', seasonId).eq('round_number', roundNumber);
    await supabase.from('historic_results').delete().eq('season_id', seasonId).eq('round_number', roundNumber);

    // Insert results
    const resultsToInsert: any[] = [];
    const processedPlayers = new Set<string>();

    for (const category of ['scratch_male', 'scratch_female', 'handicap_male', 'handicap_female']) {
      const isScratch = category.startsWith('scratch_');
      const entries = classificationData[category];

      for (const entry of entries) {
        const key = `${entry.license || entry.name}_${isScratch ? 'scratch' : 'handicap'}`;
        if (processedPlayers.has(key)) continue;
        processedPlayers.add(key);

        const gender = category.endsWith('_female') ? 'female' : 'male';
        const existing = resultsToInsert.find(r =>
          r.player_name === entry.name && r.license_number === entry.license && r.gender === gender
        );

        if (existing) {
          if (isScratch) existing.scratch_score = entry.bruto;
          else existing.handicap_score = entry.neto;
        } else {
          resultsToInsert.push({
            season_id: seasonId,
            round_number: roundNumber,
            player_name: entry.name,
            license_number: entry.license || null,
            gender,
            scratch_score: isScratch ? entry.bruto : null,
            handicap_score: !isScratch ? entry.neto : null,
            round_date: detectedDate,
            round_name: detectedName || `Prova ${roundNumber}`,
          });
        }
      }
    }

    if (resultsToInsert.length > 0) {
      for (let b = 0; b < resultsToInsert.length; b += 500) {
        const batch = resultsToInsert.slice(b, b + 500);
        const { error } = await supabase.from('historic_results').insert(batch);
        if (error) throw new Error('Failed to insert results: ' + error.message);
      }
    }

    // Insert hole-by-hole scores
    const holeScoresToInsert: any[] = [];
    for (const [key, data] of holeScoresByLicense) {
      // Try to find the player name from results (match by license or name)
      const matchedResult = resultsToInsert.find(r => r.license_number === key || r.player_name === key || r.player_name === data.name);
      const playerName = matchedResult?.player_name || data.name;
      const licenseNumber = matchedResult?.license_number || (key !== data.name ? key : null);

      for (let h = 0; h < data.holes.length; h++) {
        if (data.holes[h] > 0) {
          holeScoresToInsert.push({
            season_id: seasonId,
            round_number: roundNumber,
            player_name: playerName,
            license_number: licenseNumber,
            hole_number: h + 1,
            strokes: data.holes[h],
          });
        }
      }
    }

    if (holeScoresToInsert.length > 0) {
      for (let b = 0; b < holeScoresToInsert.length; b += 500) {
        const batch = holeScoresToInsert.slice(b, b + 500);
        const { error } = await supabase.from('historic_hole_scores').insert(batch);
        if (error) console.error('Failed to insert hole scores:', error.message);
      }
    }

    console.log(`Inserted ${holeScoresToInsert.length} hole scores for round ${roundNumber}`);

    // Recalculate rankings
    await recalculateHistoricRankings(supabase, seasonId);

    return new Response(JSON.stringify({
      success: true,
      stats: {
        scratch_male: classificationData.scratch_male.length,
        scratch_female: classificationData.scratch_female.length,
        handicap_male: classificationData.handicap_male.length,
        handicap_female: classificationData.handicap_female.length,
        total_results: resultsToInsert.length,
        hole_scores: holeScoresToInsert.length,
      },
      round_name: detectedName,
      round_date: detectedDate,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Process error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function recalculateHistoricRankings(supabase: any, seasonId: string) {
  const { data: season } = await supabase
    .from('historic_seasons')
    .select('counting_rounds, modality')
    .eq('id', seasonId)
    .single();

  const countingRounds = season?.counting_rounds || 8;
  const isStableford = season?.modality === 'stableford';

  const { data: allResults } = await supabase
    .from('historic_results')
    .select('*')
    .eq('season_id', seasonId);

  if (!allResults || allResults.length === 0) return;

  await supabase.from('historic_rankings').delete().eq('season_id', seasonId);

  const categories = ['scratch_male', 'scratch_female', 'handicap_male', 'handicap_female'];

  for (const category of categories) {
    const isScratch = category.startsWith('scratch_');
    const wantsFemale = category.endsWith('_female');

    const scoresByPlayer = new Map<string, { scores: number[]; license: string | null }>();

    for (const result of allResults) {
      const isFemale = result.gender === 'female';
      if (wantsFemale !== isFemale) continue;
      const rawScore = isScratch ? result.scratch_score : result.handicap_score;
      if (rawScore === null) continue;

      const key = result.player_name;
      if (!scoresByPlayer.has(key)) scoresByPlayer.set(key, { scores: [], license: result.license_number });
      scoresByPlayer.get(key)!.scores.push(rawScore);
    }

    const entries: any[] = [];
    for (const [playerName, data] of scoresByPlayer) {
      // Stableford: best = highest, so sort descending; Medalplay: best = lowest, sort ascending
      const sorted = isStableford
        ? [...data.scores].sort((a, b) => b - a)
        : [...data.scores].sort((a, b) => a - b);
      const kept = sorted.length > countingRounds ? sorted.slice(0, countingRounds) : sorted;
      const totalScore = kept.reduce((sum, s) => sum + s, 0);

      entries.push({
        player_name: playerName,
        license_number: data.license,
        total_points: totalScore,
        rounds_played: data.scores.length,
      });
    }

    // Qualified first (>= countingRounds), then rest by rounds_played DESC
    // Stableford: higher total = better (descending); Medalplay: lower total = better (ascending)
    entries.sort((a, b) => {
      const aQualified = a.rounds_played >= countingRounds ? 0 : 1;
      const bQualified = b.rounds_played >= countingRounds ? 0 : 1;
      if (aQualified !== bQualified) return aQualified - bQualified;
      if (isStableford) {
        if (aQualified === 0) return b.total_points - a.total_points || b.rounds_played - a.rounds_played;
        return b.rounds_played - a.rounds_played || b.total_points - a.total_points;
      } else {
        if (aQualified === 0) return a.total_points - b.total_points || b.rounds_played - a.rounds_played;
        return b.rounds_played - a.rounds_played || a.total_points - b.total_points;
      }
    });

    const toInsert = entries.map((entry, index) => ({
      season_id: seasonId,
      category,
      position: index + 1,
      player_name: entry.player_name,
      license_number: entry.license_number,
      total_points: entry.total_points,
      rounds_played: entry.rounds_played,
      updated_at: new Date().toISOString(),
    }));

    if (toInsert.length > 0) {
      for (let b = 0; b < toInsert.length; b += 500) {
        await supabase.from('historic_rankings').insert(toInsert.slice(b, b + 500));
      }
    }
  }

  // Auto-generate winners (top 3 per category)
  await supabase.from('historic_winners').delete().eq('season_id', seasonId);
  const { data: rankings } = await supabase
    .from('historic_rankings')
    .select('*')
    .eq('season_id', seasonId)
    .lte('position', 3)
    .order('position', { ascending: true });

  if (rankings && rankings.length > 0) {
    const names = [...new Set(rankings.map((r: any) => r.player_name))];
    const { data: players } = await supabase
      .from('players')
      .select('name, photo_url')
      .in('name', names);

    const photoMap = new Map<string, string>();
    for (const p of players || []) {
      if (p.photo_url) photoMap.set(p.name, p.photo_url);
    }

    const winnersToInsert = rankings.map((r: any) => ({
      season_id: seasonId,
      category: r.category,
      position: r.position,
      player_name: r.player_name,
      photo_url: photoMap.get(r.player_name) || null,
    }));

    for (let b = 0; b < winnersToInsert.length; b += 500) {
      await supabase.from('historic_winners').insert(winnersToInsert.slice(b, b + 500));
    }
  }
}
