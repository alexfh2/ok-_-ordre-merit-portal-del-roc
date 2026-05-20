// Process inscrits (registrations) Excel: extracts gender, birth date, license
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import * as XLSX from 'npm:xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseDate(raw: any): string | null {
  if (raw == null || raw === '') return null;
  // Excel date number
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(raw).trim();
  // ISO: YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  // M/D/YY or M/D/YYYY (also D/M/YY ambiguous — assume M/D/YY, US style as in source)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let mo = parseInt(m[1]);
    let da = parseInt(m[2]);
    let yr = parseInt(m[3]);
    // If looks like D/M (day > 12), swap
    if (mo > 12 && da <= 12) {
      [mo, da] = [da, mo];
    }
    if (yr < 100) yr = yr <= 30 ? 2000 + yr : 1900 + yr;
    return `${yr}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { fileName } = await req.json();
    if (!fileName) throw new Error('fileName required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: file, error: dlErr } = await supabase.storage
      .from('excel-uploads')
      .download(fileName);
    if (dlErr) throw dlErr;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });

    // Find sheet
    const sheetName = wb.SheetNames.find((n) => /individual|inscri/i.test(n)) || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

    // Find header row
    let headerRow = -1;
    let cols = { ins: -1, lic: -1, name: -1, sex: -1, birth: -1, hcp: -1 };
    for (let i = 0; i < Math.min(20, rows.length); i++) {
      const r = rows[i] || [];
      const upper = r.map((c) => String(c ?? '').toUpperCase().trim());
      const lic = upper.indexOf('ASOCIADO');
      const name = upper.indexOf('NOMBRE');
      const sex = upper.indexOf('SEXO');
      const birth = upper.findIndex((c) => /FECHA|NACIM/.test(c));
      if (lic >= 0 && name >= 0 && sex >= 0 && birth >= 0) {
        headerRow = i;
        cols = {
          ins: upper.indexOf('INSCRIPCION'),
          lic, name, sex, birth,
          hcp: upper.indexOf('HCP'),
        };
        break;
      }
    }
    if (headerRow < 0) throw new Error('No s\'ha trobat la capçalera (ASOCIADO/NOMBRE/SEXO/FECHA_NACIMIENTO)');

    type Entry = {
      license: string; name: string; gender: 'male' | 'female'; birth_date: string | null; is_subscriber: boolean;
    };
    const entries: Entry[] = [];

    for (let i = headerRow + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const lic = String(r[cols.lic] ?? '').trim();
      const name = String(r[cols.name] ?? '').trim();
      const sexRaw = String(r[cols.sex] ?? '').trim().toUpperCase();
      if (!name || !sexRaw) continue;
      const gender = sexRaw.startsWith('F') ? 'female' : 'male';
      const birth = parseDate(r[cols.birth]);
      const isSubscriber = /^ACPP/i.test(lic);
      entries.push({
        license: lic,
        name,
        gender,
        birth_date: birth,
        is_subscriber: isSubscriber,
      });
    }

    let updated = 0;
    let inserted = 0;
    let seniors = 0;
    const skipped: string[] = [];

    for (const e of entries) {
      // Only persist players with an ACPP license (real associated players)
      if (!/^ACPP/i.test(e.license)) {
        skipped.push(`${e.name} (sense llicència)`);
        continue;
      }

      const payload: any = {
        license_number: e.license,
        name: e.name,
        gender: e.gender,
        is_subscriber: e.is_subscriber,
        subscriber_updated_at: new Date().toISOString(),
      };
      if (e.birth_date) payload.birth_date = e.birth_date;

      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('license_number', e.license)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from('players').update(payload).eq('id', existing.id);
        if (error) console.error('Update error', e.license, error.message);
        else updated++;
      } else {
        const { error } = await supabase.from('players').insert(payload);
        if (error) console.error('Insert error', e.license, error.message);
        else inserted++;
      }

      // Senior: turns >= 55 during 2026 (born in 1971 or earlier)
      if (e.birth_date && parseInt(e.birth_date.slice(0, 4)) <= 1971) seniors++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: { total: entries.length, inserted, updated, seniors, skipped: skipped.length },
        skipped_sample: skipped.slice(0, 5),
        sheet: sheetName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('process-inscrits error:', err);
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
