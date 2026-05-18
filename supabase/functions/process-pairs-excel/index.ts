import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function parseSpanishHCP(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  let s = String(val).trim();
  const isPlus = s.startsWith('(+)');
  if (isPlus) s = s.substring(3);
  s = s.replace(',', '.');
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return isPlus ? -n : n;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileName, roundNumber } = await req.json();
    if (!fileName || !roundNumber) throw new Error('fileName and roundNumber are required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('excel-uploads')
      .download(fileName);
    if (downloadError) throw downloadError;

    const XLSX = await import("npm:xlsx@0.18.5");
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

    // ── Parse PAREJAS sheet ──
    const parejasSheet = workbook.Sheets['PAREJAS'];
    if (!parejasSheet) throw new Error("No s'ha trobat la pestanya PAREJAS");
    const parejasRows: any[][] = XLSX.utils.sheet_to_json(parejasSheet, { header: 1 });

    const pairsMap = new Map<number, { members: { name: string; license: string; gender: string }[] }>();

    for (let i = 1; i < parejasRows.length; i++) {
      const row = parejasRows[i];
      const inscripcion = parseInt(String(row[2]));
      if (isNaN(inscripcion)) continue;
      const license = String(row[3] || '').trim();
      const name = String(row[4] || '').trim();
      const sex = String(row[5] || 'M').trim().toUpperCase();
      if (!name) continue;

      if (!pairsMap.has(inscripcion)) pairsMap.set(inscripcion, { members: [] });
      pairsMap.get(inscripcion)!.members.push({ name, license, gender: sex === 'F' ? 'F' : 'M' });
    }

    // ── Parse RESULTADOS_v1 sheet ──
    const resultadosSheet = workbook.Sheets['RESULTADOS_v1'];
    if (!resultadosSheet) throw new Error("No s'ha trobat la pestanya RESULTADOS_v1");
    const resultadosRows: any[][] = XLSX.utils.sheet_to_json(resultadosSheet, { header: 1 });

    let headerRow = -1;
    for (let i = 0; i < Math.min(10, resultadosRows.length); i++) {
      const row = resultadosRows[i];
      if (row && row.some((c: any) => String(c).includes('INSCRIPCION'))) {
        headerRow = i;
        break;
      }
    }
    if (headerRow === -1) throw new Error("No s'ha trobat la capçalera a RESULTADOS_v1");

    const headers = resultadosRows[headerRow];
    const colIdx: Record<string, number> = {};
    for (let c = 0; c < headers.length; c++) {
      const h = String(headers[c] || '').trim();
      if (h) colIdx[h] = c;
    }

    const inscCol = colIdx['INSCRIPCION'] ?? 1;
    const nameCol = colIdx['NOMBRE'] ?? 3;
    const nhpCol = colIdx['NHP'] ?? 28;
    const holeStartCol = colIdx['1'] ?? 9;
    const brutoCol = colIdx['BRUTO'] ?? 30;
    const netoCol = colIdx['NETO'] ?? 31;

    interface PlayerResult {
      name: string;
      holes: { hole: number; points: number }[];
      bruto: number | null;
      neto: number | null;
      nhp: number;
    }

    const resultsMap = new Map<number, PlayerResult[]>();

    for (let i = headerRow + 1; i < resultadosRows.length; i++) {
      const row = resultadosRows[i];
      if (!row || row.length === 0) continue;

      const inscripcion = parseInt(String(row[inscCol]));
      if (isNaN(inscripcion)) continue;

      const playerName = String(row[nameCol] || '').trim();
      if (!playerName) continue;

      const holes: { hole: number; points: number }[] = [];
      for (let h = 0; h < 18; h++) {
        const val = parseFloat(String(row[holeStartCol + h] || '0'));
        holes.push({ hole: h + 1, points: isNaN(val) ? 0 : val });
      }

      const brutoVal = row[brutoCol];
      const netoVal = row[netoCol];
      const bruto = brutoVal !== undefined && brutoVal !== null && brutoVal !== '' ? parseInt(String(brutoVal)) : null;
      const neto = netoVal !== undefined && netoVal !== null && netoVal !== '' ? parseInt(String(netoVal)) : null;
      const nhp = parseSpanishHCP(row[nhpCol]);

      if (!resultsMap.has(inscripcion)) resultsMap.set(inscripcion, []);
      resultsMap.get(inscripcion)!.push({ name: playerName, holes, bruto, neto, nhp });
    }

    // ── Get or create tournament ──
    let { data: tournament } = await supabase
      .from('tournaments')
      .select('id')
      .eq('round_number', roundNumber)
      .single();

    if (!tournament) {
      const { data: newT, error: tErr } = await supabase
        .from('tournaments')
        .insert({ name: `Prova ${roundNumber}`, round_number: roundNumber })
        .select('id')
        .single();
      if (tErr) throw tErr;
      tournament = newT;
    }

    const tournamentId = tournament!.id;

    // ── Delete existing pair data for this tournament ──
    await supabase.from('pair_hole_scores').delete().eq('tournament_id', tournamentId);
    await supabase.from('pair_results').delete().eq('tournament_id', tournamentId);

    let totalPairs = 0;
    let totalResults = 0;

    // ── Process each pair ──
    for (const [inscripcion, pairInfo] of pairsMap) {
      const playerResults = resultsMap.get(inscripcion);
      if (!playerResults || playerResults.length === 0) continue;

      // Sort member names alphabetically to ensure consistent pair naming
      const sortedMembers = [...pairInfo.members].sort((a, b) => a.name.localeCompare(b.name));
      const pairName = sortedMembers.map(m => m.name).join(' / ');

      let { data: existingPair } = await supabase
        .from('pairs')
        .select('id')
        .eq('name', pairName)
        .single();

      let pairId: string;
      if (existingPair) {
        pairId = existingPair.id;
      } else {
        const { data: newPair, error: pErr } = await supabase
          .from('pairs')
          .insert({ name: pairName })
          .select('id')
          .single();
        if (pErr) throw pErr;
        pairId = newPair!.id;
      }

      // Upsert pair members
      await supabase.from('pair_members').delete().eq('pair_id', pairId);
      const membersToInsert = pairInfo.members.map((m, idx) => ({
        pair_id: pairId,
        player_name: m.name,
        license_number: m.license,
        gender: m.gender,
        member_order: idx + 1,
      }));
      await supabase.from('pair_members').insert(membersToInsert);

      // Pair scores come from the first player's row (same for both)
      const bruto = playerResults[0].bruto;
      const neto = playerResults[0].neto;
      // Combined NHP for tiebreaker (stored as points * 10 to keep precision as int)
      const combinedNHP = playerResults.reduce((sum, p) => sum + p.nhp, 0);
      const nhpInt = Math.round(combinedNHP * 10);

      const { error: rErr } = await supabase.from('pair_results').insert({
        pair_id: pairId,
        tournament_id: tournamentId,
        scratch_score: bruto,
        handicap_score: neto,
        points: nhpInt,
      });
      if (rErr) throw rErr;

      // Insert hole scores for each player
      const holeScoresToInsert: any[] = [];
      for (const pr of playerResults) {
        for (const h of pr.holes) {
          holeScoresToInsert.push({
            pair_id: pairId,
            tournament_id: tournamentId,
            hole_number: h.hole,
            points: h.points,
            player_name: pr.name,
          });
        }
      }

      if (holeScoresToInsert.length > 0) {
        for (let b = 0; b < holeScoresToInsert.length; b += 500) {
          const batch = holeScoresToInsert.slice(b, b + 500);
          const { error: hErr } = await supabase.from('pair_hole_scores').insert(batch);
          if (hErr) throw hErr;
        }
      }

      totalPairs++;
      totalResults++;
    }

    // ── Recalculate pair rankings ──
    await supabase.from('pair_rankings').delete().gte('position', 0);

    const { data: allPairResults } = await supabase
      .from('pair_results')
      .select('pair_id, scratch_score, handicap_score, points');

    if (allPairResults && allPairResults.length > 0) {
      const pairScores = new Map<string, { scratch: number[]; handicap: number[]; nhpSum: number; nhpCount: number }>();
      for (const r of allPairResults) {
        if (!pairScores.has(r.pair_id)) pairScores.set(r.pair_id, { scratch: [], handicap: [], nhpSum: 0, nhpCount: 0 });
        const ps = pairScores.get(r.pair_id)!;
        if (r.scratch_score !== null) ps.scratch.push(r.scratch_score);
        if (r.handicap_score !== null) ps.handicap.push(r.handicap_score);
        ps.nhpSum += (r.points || 0); // points stores NHP * 10
        ps.nhpCount++;
      }

      // Best 8 of 10 (Stableford: higher = better)
      function bestOf(scores: number[], count: number): number {
        const sorted = [...scores].sort((a, b) => b - a);
        return sorted.slice(0, count).reduce((sum, s) => sum + s, 0);
      }

      const scratchRanking: { pair_id: string; total: number; avgNHP: number }[] = [];
      const handicapRanking: { pair_id: string; total: number; avgNHP: number }[] = [];

      for (const [pairId, scores] of pairScores) {
        const avgNHP = scores.nhpCount > 0 ? scores.nhpSum / scores.nhpCount : 0;
        if (scores.scratch.length > 0) {
          scratchRanking.push({ pair_id: pairId, total: bestOf(scores.scratch, 8), avgNHP });
        }
        if (scores.handicap.length > 0) {
          handicapRanking.push({ pair_id: pairId, total: bestOf(scores.handicap, 8), avgNHP });
        }
      }

      // Scratch: higher total wins, tiebreaker = higher NHP (higher handicap pair)
      scratchRanking.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return b.avgNHP - a.avgNHP;
      });
      // Handicap: higher total wins, tiebreaker = lower NHP (lower handicap pair)
      handicapRanking.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.avgNHP - b.avgNHP;
      });

      const rankingsToInsert: any[] = [];
      scratchRanking.forEach((r, i) => {
        rankingsToInsert.push({
          pair_id: r.pair_id,
          category: 'scratch_pairs',
          position: i + 1,
          total_points: r.total,
        });
      });
      handicapRanking.forEach((r, i) => {
        rankingsToInsert.push({
          pair_id: r.pair_id,
          category: 'handicap_pairs',
          position: i + 1,
          total_points: r.total,
        });
      });

      if (rankingsToInsert.length > 0) {
        for (let b = 0; b < rankingsToInsert.length; b += 500) {
          const batch = rankingsToInsert.slice(b, b + 500);
          await supabase.from('pair_rankings').insert(batch);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: { total_pairs: totalPairs, total_results: totalResults },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
