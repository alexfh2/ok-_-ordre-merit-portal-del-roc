import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const cp1252ReverseMap: Record<number, number> = {
  0x20AC: 0x80,
  0x201A: 0x82,
  0x0192: 0x83,
  0x201E: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02C6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8A,
  0x2039: 0x8B,
  0x0152: 0x8C,
  0x017D: 0x8E,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201C: 0x93,
  0x201D: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02DC: 0x98,
  0x2122: 0x99,
  0x0161: 0x9A,
  0x203A: 0x9B,
  0x0153: 0x9C,
  0x017E: 0x9E,
  0x0178: 0x9F,
};

function decodeUtf8Mojibake(value: string): string {
  if (!/[ÃÂâ]/.test(value)) return value;

  try {
    const bytes: number[] = [];

    for (const char of value) {
      const code = char.codePointAt(0);
      if (code === undefined) continue;

      if (code <= 0xFF) {
        bytes.push(code);
        continue;
      }

      const mapped = cp1252ReverseMap[code];
      if (mapped === undefined) return value;
      bytes.push(mapped);
    }

    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
    return decoded.includes('�') ? value : decoded;
  } catch {
    return value;
  }
}

function normalizeImportedName(value: string): string {
  return decodeUtf8Mojibake(String(value ?? ''))
    .normalize('NFC')
    .replace(/\u00A0/g, ' ')
    .replace(/(^|[\s,])M(?:\s*\.\s*)?ª\.?($|[\s,])/gi, (_match, prefix, suffix) => `${prefix}MARIA${suffix}`)
    .replace(/\s+/g, ' ')
    .trim();
}

async function normalizeStoredPlayerNames(supabase: any) {
  const { data: players, error } = await supabase
    .from('players')
    .select('id, name');

  if (error || !players?.length) {
    if (error) console.error('Players fetch for normalization error:', error);
    return;
  }

  let normalizedCount = 0;

  for (const player of players) {
    const normalizedName = normalizeImportedName(player.name);
    if (!normalizedName || normalizedName === player.name) continue;

    const { error: updateError } = await supabase
      .from('players')
      .update({ name: normalizedName })
      .eq('id', player.id);

    if (updateError) {
      console.error(`Player name normalization error for ${player.id}:`, updateError);
      continue;
    }

    normalizedCount += 1;
  }

  if (normalizedCount > 0) {
    console.log(`Normalized ${normalizedCount} stored player names`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { fileName, tournamentName, roundNumber, recalculateOnly } = await req.json();

    // Allow recalculate-only mode
    if (recalculateOnly) {
      const supabaseUrl2 = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey2 = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase2 = createClient(supabaseUrl2, supabaseServiceKey2);
      await normalizeStoredPlayerNames(supabase2);
      await recalculateRankings(supabase2);
      return new Response(JSON.stringify({ success: true, message: 'Rankings recalculated' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!fileName) {
      return new Response(JSON.stringify({ error: 'fileName is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('excel-uploads')
      .download(fileName);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: 'Failed to download file: ' + downloadError?.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse Excel
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', codepage: 65001 });

    console.log('Sheet names:', workbook.SheetNames);

    // Find classification sheets by scanning content
    const classificationData: Record<string, any[]> = {
      scratch_male: [],
      scratch_female: [],
      handicap_male: [],
      handicap_female: [],
      handicap_mixed: [],
    };

    // Helper: find column index by checking header names flexibly
    function findCol(headers: string[], ...aliases: string[]): number {
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i].toUpperCase().trim();
        for (const alias of aliases) {
          if (h === alias || h.includes(alias)) return i;
        }
      }
      return -1;
    }

    for (const sheetName of workbook.SheetNames) {
      // Only process classification sheets
      const sheetNameUpper = sheetName.toUpperCase();
      if (!sheetNameUpper.includes('CLASIFICACION') && !sheetNameUpper.includes('CLASSIFICACIO')) continue;

      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      // Detect sheet type by scanning header rows for gender + type info
      let sheetType: string | null = null;
      let headerRowIdx = -1;
      let detectedGender: string | null = null;
      let detectedMode: string | null = null;

      for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const rowStr = rows[i]?.map((c: any) => String(c)).join(' ').toUpperCase() || '';
        
        if (rowStr.includes('MASCULIN') || rowStr.includes('MASCULI')) {
          detectedGender = 'male';
        } else if (rowStr.includes('FEMENIN') || rowStr.includes('FEMENI')) {
          detectedGender = 'female';
        }
        
        if (rowStr.includes('SCRATCH') && !rowStr.includes('HANDICAP')) {
          detectedMode = 'scratch';
        } else if (rowStr.includes('HANDICAP') || rowStr.includes('CON HANDICAP')) {
          detectedMode = 'handicap';
        }

        if (!rows[i]) continue;
        const cells = rows[i].map((c: any) => String(c).toUpperCase().trim());
        const hasPos = cells.some((c: string) => c === 'POSICION' || c === 'POS' || c === 'POS.');
        const hasName = cells.some((c: string) => c === 'NOMBRE' || c === 'ASOCIADO' || c === 'JUGADOR');
        if (hasPos && hasName) {
          headerRowIdx = i;
        }
      }

      if (detectedMode && detectedGender) {
        sheetType = `${detectedMode}_${detectedGender}`;
      } else if (detectedMode === 'scratch' && !detectedGender) {
        sheetType = 'scratch_male';
      } else if (detectedMode === 'handicap' && !detectedGender) {
        sheetType = 'handicap_mixed';
      }

      if (!sheetType || headerRowIdx === -1) {
        console.log(`Skipping sheet ${sheetName}: type=${sheetType}, header=${headerRowIdx}`);
        continue;
      }

      const headerCells = rows[headerRowIdx].map((c: any) => String(c).toUpperCase().trim());
      const posCol = findCol(headerCells, 'POSICION', 'POS', 'POS.');
      const asocCol = findCol(headerCells, 'ASOCIADO', 'LICENCIA', 'Nº ASOCIADO', 'NUM');
      const nameCol = findCol(headerCells, 'NOMBRE', 'JUGADOR', 'PLAYER');
      const brutoCol = findCol(headerCells, 'BRUTO', 'GROSS');
      const netoCol = findCol(headerCells, 'NETO', 'NET');

      console.log(`Sheet ${sheetName}: type=${sheetType}, header=${headerRowIdx}, cols: pos=${posCol} asoc=${asocCol} name=${nameCol} bruto=${brutoCol} neto=${netoCol}`);

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

        if (!posicion || !nombre || nombre === '') continue;
        if (posicion === 'No presentado' || posicion.toUpperCase() === 'NP') continue;
        
        const posNum = parseInt(posicion);
        if (isNaN(posNum)) continue;

        const brutoScore = bruto === null || bruto === '--' || bruto === '' ? null : parseInt(String(bruto));
        const netoScore = neto === null || neto === '--' || neto === '' ? null : parseInt(String(neto));

        if (brutoScore === null && netoScore === null) continue;

        classificationData[sheetType as keyof typeof classificationData].push({
          position: posNum,
          license: asociado,
          name: nombre,
          bruto: brutoScore,
          neto: netoScore,
        });
      }
    }

    console.log('Parsed results:', {
      scratch_male: classificationData.scratch_male.length,
      scratch_female: classificationData.scratch_female.length,
      handicap_male: classificationData.handicap_male.length,
      handicap_female: classificationData.handicap_female.length,
      handicap_mixed: classificationData.handicap_mixed.length,
    });

    // ===== Fallback: build classification from RESULTADOS_* sheets =====
    // Medal Play format (e.g. Elbe / Portal del Roc): the RESULTADOS sheet
    // contains TOTAL (scratch strokes) + HPJ (handicap juego). Neto = TOTAL - HPJ.
    // Lower strokes = better, sorted ascending.
    const totalParsed =
      classificationData.scratch_male.length +
      classificationData.scratch_female.length +
      classificationData.handicap_male.length +
      classificationData.handicap_female.length +
      classificationData.handicap_mixed.length;

    if (totalParsed === 0) {
      console.log('No CLASIFICACION sheets found — using RESULTADOS fallback (Medal Play)');

      function parseStrokes(value: any): number | null {
        if (value === null || value === undefined || value === '' || value === '--') return null;
        const str = String(value).trim();
        if (!str || str.toUpperCase() === 'N' || str.startsWith('#')) return null;
        const cleaned = str.replace(/\(\+\)/g, '-').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : Math.round(num);
      }

      for (const sheetName of workbook.SheetNames) {
        const sheetNameUpper = sheetName.toUpperCase();
        if (!sheetNameUpper.includes('RESULTADO') && !sheetNameUpper.includes('RESULTAT')) continue;

        const sheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Locate header row: must contain ASOCIADO + NOMBRE + TOTAL
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 30); i++) {
          if (!rows[i]) continue;
          const cells = rows[i].map((c: any) => String(c).toUpperCase().trim());
          const hasAsoc = cells.some(c => c === 'ASOCIADO' || c === 'LICENCIA');
          const hasName = cells.some(c => c === 'NOMBRE' || c === 'JUGADOR');
          const hasTotal = cells.some(c => c === 'TOTAL');
          if (hasAsoc && hasName && hasTotal) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) continue;

        const headerCells = rows[headerRowIdx].map((c: any) => String(c).toUpperCase().trim());
        const asocCol = findCol(headerCells, 'ASOCIADO', 'LICENCIA');
        const nameCol = findCol(headerCells, 'NOMBRE', 'JUGADOR');
        const totalCol = findCol(headerCells, 'TOTAL');
        const hpjCol = findCol(headerCells, 'HPJ');
        const hppCol = findCol(headerCells, 'HPP');
        const handicapCol = hpjCol !== -1 ? hpjCol : hppCol;

        console.log(`Fallback ${sheetName}: header=${headerRowIdx} asoc=${asocCol} name=${nameCol} total=${totalCol} hcp=${handicapCol}`);

        if (asocCol === -1 || nameCol === -1 || totalCol === -1) continue;

        type Entry = { license: string; name: string; bruto: number | null; neto: number | null };
        const entries: Entry[] = [];

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;

          const license = String(row[asocCol] ?? '').trim();
          const name = normalizeImportedName(String(row[nameCol] ?? ''));
          if (!license || !name) continue;

          const bruto = parseStrokes(row[totalCol]); // scratch strokes
          const hcp = handicapCol !== -1 ? parseStrokes(row[handicapCol]) : null;
          const neto = (bruto !== null && hcp !== null) ? (bruto - hcp) : null;

          if (bruto === null && neto === null) continue;

          entries.push({ license, name, bruto, neto });
        }

        // Medal Play: sort by neto ascending (lower strokes = better)
        entries.sort((a, b) => (a.neto ?? Infinity) - (b.neto ?? Infinity));

        entries.forEach((e, idx) => {
          classificationData.handicap_mixed.push({
            position: idx + 1,
            license: e.license,
            name: e.name,
            bruto: e.bruto,
            neto: e.neto,
          });
        });

        console.log(`Fallback parsed ${entries.length} entries from ${sheetName}`);
        break;
      }

      console.log('After fallback:', { handicap_mixed: classificationData.handicap_mixed.length });
    }

    // ===== Parse hole-by-hole scores from "Resultados" sheet =====
    const holeScoresByLicense = new Map<string, number[]>(); // license -> [hole1, hole2, ..., hole9]

    for (const sheetName of workbook.SheetNames) {
      const sheetNameUpper = sheetName.toUpperCase();
      if (!sheetNameUpper.includes('RESULTADO') && !sheetNameUpper.includes('RESULTAT')) continue;

      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      console.log(`Parsing hole scores from sheet: ${sheetName}, rows: ${rows.length}`);

      // Find header row with hole numbers and map each hole to its column index
      // This handles gap columns (OUT, IN, TOT) between holes
      let headerRowIdx = -1;
      const holeColMap = new Map<number, number>(); // hole_number -> column_index
      let nameCol = -1;
      let asocCol = -1;

      for (let i = 0; i < Math.min(rows.length, 30); i++) {
        if (!rows[i]) continue;
        const cells = rows[i].map((c: any) => String(c).trim());
        
        // Scan for cells that are numbers 1-18
        const foundHoleCols = new Map<number, number>();
        for (let j = 0; j < cells.length; j++) {
          const num = parseInt(cells[j]);
          if (!isNaN(num) && num >= 1 && num <= 18 && String(num) === cells[j]) {
            foundHoleCols.set(num, j);
          }
        }

        // Check if we found at least holes 1-9
        let hasAll9 = true;
        for (let h = 1; h <= 9; h++) {
          if (!foundHoleCols.has(h)) { hasAll9 = false; break; }
        }

        if (hasAll9) {
          headerRowIdx = i;
          for (const [hole, col] of foundHoleCols) {
            holeColMap.set(hole, col);
          }
          // Find name and license columns
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

      const totalHoles = holeColMap.size;
      console.log(`Hole scores header: row=${headerRowIdx}, totalHoles=${totalHoles}, holeColumns=${JSON.stringify(Object.fromEntries(holeColMap))}, nameCol=${nameCol}, asocCol=${asocCol}`);

      if (headerRowIdx === -1 || totalHoles === 0) {
        console.log(`Could not find hole columns in sheet ${sheetName}`);
        continue;
      }

      // Parse player rows after header
      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        const name = nameCol !== -1 ? String(row[nameCol] ?? '').trim() : '';
        const license = asocCol !== -1 ? String(row[asocCol] ?? '').trim() : '';
        
        if (!name && !license) continue;

        // Extract hole scores using column mapping (handles gap columns)
        const maxHole = Math.max(...holeColMap.keys());
        const holes: number[] = [];
        let hasValidHoles = false;
        for (let h = 1; h <= maxHole; h++) {
          const col = holeColMap.get(h);
          if (col === undefined) {
            holes.push(0);
            continue;
          }
          const val = row[col];
          const strokes = parseInt(String(val ?? ''));
          if (!isNaN(strokes) && strokes > 0 && strokes < 20) {
            holes.push(strokes);
            hasValidHoles = true;
          } else {
            holes.push(0);
          }
        }

        if (hasValidHoles && license) {
          holeScoresByLicense.set(license, holes);
        }
      }

      console.log(`Parsed ${holeScoresByLicense.size} players with hole scores`);
      break; // Only process first Resultados sheet
    }

    // Detect tournament info from first sheet
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const firstRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
    
    let detectedTournamentName = tournamentName || '';
    let detectedRound = roundNumber || 1;
    let detectedDate: string | null = null;
    
    for (const row of firstRows.slice(0, 10)) {
      const rowStr = row.join(' ');
      if (rowStr.includes('TORNEO') || rowStr.includes('Prova') || rowStr.includes('Rànquing')) {
        for (const cell of row) {
          const cellStr = String(cell).trim();
          if (cellStr.includes('Prova') || cellStr.includes('Rànquing')) {
            detectedTournamentName = cellStr;
            const roundMatch = cellStr.match(/(\d+)[aª]/);
            if (roundMatch) detectedRound = parseInt(roundMatch[1]);
            break;
          }
        }
      }
    }

    // Try to extract date from "Procesos" sheet
    for (const sheetName of workbook.SheetNames) {
      if (sheetName.toUpperCase().includes('PROCESO') || sheetName.toUpperCase().includes('INSCRI')) {
        const procesosSheet = workbook.Sheets[sheetName];
        const procesosRows: any[][] = XLSX.utils.sheet_to_json(procesosSheet, { header: 1, defval: '', raw: false });
        
        for (const row of procesosRows.slice(0, 30)) {
          for (const cell of row) {
            const cellStr = String(cell).trim();
            const dateMatch = cellStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
            if (dateMatch) {
              const day = parseInt(dateMatch[1]);
              const month = parseInt(dateMatch[2]);
              let year = parseInt(dateMatch[3]);
              if (year < 100) year += 2000;
              if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                detectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                console.log(`Detected date from Procesos sheet: ${detectedDate}`);
                break;
              }
            }
          }
          if (detectedDate) break;
        }
        break;
      }
    }

    if (!detectedDate) {
      for (const row of firstRows.slice(0, 15)) {
        for (const cell of row) {
          const cellStr = String(cell).trim();
          const dateMatch = cellStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
          if (dateMatch) {
            const day = parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]);
            let year = parseInt(dateMatch[3]);
            if (year < 100) year += 2000;
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
              detectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              break;
            }
          }
        }
        if (detectedDate) break;
      }
    }

    if (!detectedTournamentName) {
      detectedTournamentName = `Prova ${detectedRound}`;
    }

    // Fix common mojibake: "RÃ nquing" -> "Rànquing"
    detectedTournamentName = detectedTournamentName
      .replace(/RÃ\s*nquing/g, 'Rànquing')
      .replace(/Rànquing/g, 'Rànquing');

    console.log(`Tournament: ${detectedTournamentName}, Round: ${detectedRound}, Date: ${detectedDate}`);

    // Create or get tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .upsert({
        name: detectedTournamentName,
        round_number: detectedRound,
        season: 2026,
        ...(detectedDate ? { date: detectedDate } : {}),
      }, { onConflict: 'season,round_number' })
      .select()
      .single();

    if (tournamentError) {
      console.error('Tournament error:', tournamentError);
      throw new Error('Failed to create tournament: ' + tournamentError.message);
    }

    // Collect all unique players
    const allPlayers = new Map<string, { name: string; gender: string }>();

    for (const entry of classificationData.scratch_male) {
      allPlayers.set(entry.license, { name: entry.name, gender: 'male' });
    }
    for (const entry of classificationData.handicap_male) {
      if (!allPlayers.has(entry.license)) {
        allPlayers.set(entry.license, { name: entry.name, gender: 'male' });
      }
    }
    for (const entry of classificationData.scratch_female) {
      allPlayers.set(entry.license, { name: entry.name, gender: 'female' });
    }
    for (const entry of classificationData.handicap_female) {
      if (!allPlayers.has(entry.license)) {
        allPlayers.set(entry.license, { name: entry.name, gender: 'female' });
      }
    }
    for (const entry of classificationData.handicap_mixed) {
      if (!allPlayers.has(entry.license)) {
        allPlayers.set(entry.license, { name: entry.name, gender: 'male' });
      }
    }

    // Also try to get gender from the player registry sheet (ASOCIADOS)
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
            if (allPlayers.has(license)) {
              const player = allPlayers.get(license)!;
              player.gender = sexo === 'F' ? 'female' : 'male';
            }
          }
          break;
        }
      }
    }

    // Split handicap_mixed
    for (const entry of classificationData.handicap_mixed) {
      const player = allPlayers.get(entry.license);
      const gender = player?.gender || 'male';
      if (gender === 'female') {
        classificationData.handicap_female.push(entry);
      } else {
        classificationData.handicap_male.push(entry);
      }
    }

    // Upsert all players
    const playerUpserts = Array.from(allPlayers.entries()).map(([license, data]) => ({
      license_number: license,
      name: data.name,
      gender: data.gender,
    }));

    if (playerUpserts.length > 0) {
      const { error: playersError } = await supabase
        .from('players')
        .upsert(playerUpserts, { onConflict: 'license_number' });

      if (playersError) {
        console.error('Players upsert error:', playersError);
        throw new Error('Failed to upsert players: ' + playersError.message);
      }
    }

    await normalizeStoredPlayerNames(supabase);

    await normalizeStoredPlayerNames(supabase);

    // Get all players to map license -> id
    const { data: dbPlayers } = await supabase
      .from('players')
      .select('id, license_number');

    const playerMap = new Map<string, string>();
    for (const p of dbPlayers || []) {
      playerMap.set(p.license_number, p.id);
    }

    // Delete existing results and hole_scores for this tournament
    await supabase.from('hole_scores').delete().eq('tournament_id', tournament.id);
    await supabase.from('results').delete().eq('tournament_id', tournament.id);

    // Build results
    const resultsMap = new Map<string, any>();

    const allScratch = classificationData.scratch_male.concat(classificationData.scratch_female);
    for (const entry of allScratch) {
      const playerId = playerMap.get(entry.license);
      if (!playerId) continue;
      
      resultsMap.set(playerId, {
        player_id: playerId,
        tournament_id: tournament.id,
        scratch_score: entry.bruto,
        handicap_score: null,
        points: 0,
      });
    }

    const allHandicap = classificationData.handicap_male.concat(classificationData.handicap_female);
    for (const entry of allHandicap) {
      const playerId = playerMap.get(entry.license);
      if (!playerId) continue;
      
      if (!resultsMap.has(playerId)) {
        resultsMap.set(playerId, {
          player_id: playerId,
          tournament_id: tournament.id,
          scratch_score: null,
          handicap_score: entry.neto,
          points: 0,
        });
      } else {
        resultsMap.get(playerId).handicap_score = entry.neto;
      }
    }

    const resultsToInsert = Array.from(resultsMap.values());

    if (resultsToInsert.length > 0) {
      const { error: resultsError } = await supabase
        .from('results')
        .insert(resultsToInsert);

      if (resultsError) {
        console.error('Results insert error:', resultsError);
        throw new Error('Failed to insert results: ' + resultsError.message);
      }
    }

    // Insert hole-by-hole scores
    const holeScoresToInsert: any[] = [];
    for (const [license, holes] of holeScoresByLicense) {
      const playerId = playerMap.get(license);
      if (!playerId) continue;

      for (let h = 0; h < holes.length; h++) {
        if (holes[h] > 0) {
          holeScoresToInsert.push({
            player_id: playerId,
            tournament_id: tournament.id,
            hole_number: h + 1,
            strokes: holes[h],
          });
        }
      }
    }

    if (holeScoresToInsert.length > 0) {
      // Insert in batches of 500 to avoid payload limits
      for (let i = 0; i < holeScoresToInsert.length; i += 500) {
        const batch = holeScoresToInsert.slice(i, i + 500);
        const { error: holeError } = await supabase
          .from('hole_scores')
          .insert(batch);

        if (holeError) {
          console.error('Hole scores insert error:', holeError);
        }
      }
      console.log(`Inserted ${holeScoresToInsert.length} hole scores`);
    }

    console.log(`Inserted ${resultsToInsert.length} results`);

    // Recalculate all rankings
    await recalculateRankings(supabase);

    return new Response(JSON.stringify({
      success: true,
      tournament: detectedTournamentName,
      round: detectedRound,
      stats: {
        scratch_male: classificationData.scratch_male.length,
        scratch_female: classificationData.scratch_female.length,
        handicap_male: classificationData.handicap_male.length,
        handicap_female: classificationData.handicap_female.length,
        handicap_mixed: classificationData.handicap_mixed.length,
        total_players: playerUpserts.length,
        total_results: resultsToInsert.length,
        hole_scores: holeScoresToInsert.length,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Process error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function recalculateRankings(supabase: any) {
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, gender');

  if (playersError) {
    console.error('Players fetch error:', playersError);
    return;
  }

  const { data: allResults, error: resultsError } = await supabase
    .from('results')
    .select('player_id, tournament_id, scratch_score, handicap_score');

  if (resultsError) {
    console.error('Results fetch error:', resultsError);
    return;
  }

  if (!players || players.length === 0 || !allResults || allResults.length === 0) {
    return;
  }

  const playerGender = new Map<string, string>();
  for (const player of players) {
    playerGender.set(player.id, player.gender);
  }

  const categories = ['scratch_male', 'scratch_female', 'handicap_male', 'handicap_female'] as const;
  const rankingEntries = new Map<string, { player_id: string; total_points: number }[]>();
  for (const category of categories) {
    rankingEntries.set(category, []);
  }

  for (const category of categories) {
    const isScratch = category.startsWith('scratch_');
    const wantsFemale = category.endsWith('_female');

    // Collect scores per player across tournaments
    const scoresByPlayer = new Map<string, number[]>();

    for (const result of allResults) {
      const gender = playerGender.get(result.player_id);
      const isFemale = gender === 'female';
      const rawScore = isScratch ? result.scratch_score : result.handicap_score;

      if (rawScore === null) continue;
      if (wantsFemale !== isFemale) continue;

      if (!scoresByPlayer.has(result.player_id)) {
        scoresByPlayer.set(result.player_id, []);
      }
      scoresByPlayer.get(result.player_id)!.push(rawScore);
    }

    for (const [playerId, scores] of scoresByPlayer) {
      // Sort ascending (best = lowest in golf)
      const sorted = [...scores].sort((a, b) => a - b);
      // Keep all if <= 8 tournaments, otherwise discard the 2 worst (highest)
      const kept = sorted.length > 8 ? sorted.slice(0, sorted.length - 2) : sorted;
      const totalScore = kept.reduce((sum, s) => sum + s, 0);

      rankingEntries.get(category)!.push({
        player_id: playerId,
        total_points: totalScore,
        rounds_played: scores.length,
      });
    }
  }

  // Fixed: use gte with position 0 instead of neq with empty string UUID
  await supabase.from('rankings').delete().gte('position', 0);

  const COUNTING_ROUNDS = 8;
  for (const [category, entries] of rankingEntries) {
    // Qualified (>=8 rounds) first sorted by total_points ASC, then non-qualified by rounds DESC then total_points ASC
    entries.sort((a, b) => {
      const aQ = a.rounds_played >= COUNTING_ROUNDS ? 0 : 1;
      const bQ = b.rounds_played >= COUNTING_ROUNDS ? 0 : 1;
      if (aQ !== bQ) return aQ - bQ;
      if (aQ === 0) return a.total_points - b.total_points || b.rounds_played - a.rounds_played;
      return b.rounds_played - a.rounds_played || a.total_points - b.total_points;
    });

    const toInsert = entries.map((entry, index) => ({
      player_id: entry.player_id,
      category,
      total_points: entry.total_points,
      position: index + 1,
      updated_at: new Date().toISOString(),
    }));

    if (toInsert.length > 0) {
      const { error } = await supabase.from('rankings').insert(toInsert);
      if (error) {
        console.error(`Rankings insert error for ${category}:`, error);
      }
    }

    console.log(`${category}: ${toInsert.length} entries recalculated`);
  }
}
