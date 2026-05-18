import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, format, style, data } = await req.json();
    // type: 'tournament' | 'ranking' | 'news'
    // format: 'whatsapp' | 'instagram' | 'noticia'
    // style: 'esportiu' | 'formal' | 'festiu' | 'cronica' (only for news)
    // data: object with rankings, results, etc.

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let systemPrompt = `Ets un redactor esportiu del Centre de Golf Pitch & Putt El Vendrell. Escrius en català.
IMPORTANT: Cada vegada que generis un text, ha de ser DIFERENT dels anteriors. Varia l'estructura, les expressions, les metàfores, l'ordre de la informació i el to dins del format demanat.
NO repeteixis mai les mateixes frases o estructures. Sigues creatiu i original.
Utilitza **negreta** (amb **) per destacar noms de jugadors/parelles i resultats importants.
Inclou sempre el hashtag final: #PitchAndPutt #ElVendrell #Golf #Ranking2026 #PPElVendrell
La URL de classificacions: https://ranquing.pitchandputtvendrell.com/rankings`;

    let userPrompt = '';

    if (type === 'tournament') {
      const { tournamentName, tournamentDate, roundNumber, results, isPairs } = data;
      const modeLabel = isPairs ? 'Parelles' : 'Individual';
      const participantLabel = isPairs ? 'parelles' : 'jugadors';
      const scoreUnit = isPairs ? 'punts' : 'cops';

      let dataDescription = `Prova: ${tournamentName}\n`;
      if (tournamentDate) dataDescription += `Data: ${tournamentDate}\n`;
      dataDescription += `Número de prova: ${roundNumber}\n`;
      dataDescription += `Mode: ${modeLabel}\n`;
      dataDescription += `Total ${participantLabel}: ${results.length}\n\n`;

      // Build sections
      if (isPairs) {
        const scratch = results.filter((r: any) => r.scratch_score !== null).sort((a: any, b: any) => (b.scratch_score ?? 0) - (a.scratch_score ?? 0));
        const hcp = results.filter((r: any) => r.handicap_score !== null).sort((a: any, b: any) => (b.handicap_score ?? 0) - (a.handicap_score ?? 0));
        if (scratch.length > 0) {
          dataDescription += `Scratch Parelles (top 5):\n`;
          scratch.slice(0, 5).forEach((r: any, i: number) => { dataDescription += `${i + 1}. ${r.player_name} – ${r.scratch_score} ${scoreUnit}\n`; });
          dataDescription += '\n';
        }
        if (hcp.length > 0) {
          dataDescription += `Handicap Parelles (top 5):\n`;
          hcp.slice(0, 5).forEach((r: any, i: number) => { dataDescription += `${i + 1}. ${r.player_name} – ${r.handicap_score} ${scoreUnit}\n`; });
          dataDescription += '\n';
        }
      } else {
        const maleResults = results.filter((r: any) => r.player_gender === 'male');
        const femaleResults = results.filter((r: any) => r.player_gender === 'female');
        const sections = [
          { label: 'Scratch Masculí', data: maleResults.filter((r: any) => r.scratch_score !== null).sort((a: any, b: any) => (a.scratch_score ?? 999) - (b.scratch_score ?? 999)), key: 'scratch_score' },
          { label: 'Handicap Masculí', data: maleResults.filter((r: any) => r.handicap_score !== null).sort((a: any, b: any) => (a.handicap_score ?? 999) - (b.handicap_score ?? 999)), key: 'handicap_score' },
          { label: 'Scratch Femení', data: femaleResults.filter((r: any) => r.scratch_score !== null).sort((a: any, b: any) => (a.scratch_score ?? 999) - (b.scratch_score ?? 999)), key: 'scratch_score' },
          { label: 'Handicap Femení', data: femaleResults.filter((r: any) => r.handicap_score !== null).sort((a: any, b: any) => (a.handicap_score ?? 999) - (b.handicap_score ?? 999)), key: 'handicap_score' },
        ];
        for (const sec of sections) {
          if (sec.data.length === 0) continue;
          dataDescription += `${sec.label} (top 5):\n`;
          sec.data.slice(0, 5).forEach((r: any, i: number) => { dataDescription += `${i + 1}. ${r.player_name} – ${r[sec.key]} ${scoreUnit}\n`; });
          dataDescription += '\n';
        }
      }

      // HIO details
      const hioDetails: string[] = [];
      for (const r of results) {
        for (const h of (r.hole_scores || [])) {
          if (h.strokes === 1) hioDetails.push(`${r.player_name} al forat ${h.hole_number}`);
        }
      }
      if (hioDetails.length > 0) {
        dataDescription += `Hole-in-One: ${hioDetails.join(', ')}\n\n`;
      }

      const formatInstructions: Record<string, string> = {
        whatsapp: `Format WhatsApp: text complet amb emojis (⛳🏆🥇🥈🥉👏📊), llistes amb medalles pels 3 primers i números pels demés. Inclou totes les categories amb els 5 primers.`,
        instagram: `Format Instagram: text més curt i visual, amb emojis. Només top 3 per categoria. Acaba amb punts separadors (.\n.\n.) abans dels hashtags.`,
        noticia: `Format notícia formal per diari: text narratiu sense emojis, estil periodístic esportiu. Usa **negreta** per destacar noms i resultats. Redacció fluida i professional.`,
      };

      userPrompt = `Genera un post sobre els resultats de la ${roundNumber}a prova del Rànquing ${modeLabel} 2026 del Centre de Golf P&P El Vendrell.

${formatInstructions[format] || formatInstructions.whatsapp}

Dades:
${dataDescription}

IMPORTANT: Genera un text ÚNIC i ORIGINAL. No segueixis cap plantilla fixa. Varia l'ordre, les expressions i l'estructura. Número aleatori per forçar variació: ${Math.random().toString(36).slice(2, 8)}`;

    } else if (type === 'ranking') {
      const { mode, category, rankings, playedRounds, holeInOnes, bestRound } = data;
      const isPairs = mode === 'pairs';
      const modeLabel = isPairs ? 'Parelles' : 'Individual';

      let dataDescription = `Mode: ${modeLabel}\n`;
      dataDescription += `Proves disputades: ${playedRounds}\n\n`;

      if (isPairs) {
        for (const key of ['scratch_pairs', 'handicap_pairs']) {
          const entries = rankings[key] || [];
          if (entries.length === 0) continue;
          const label = key === 'scratch_pairs' ? 'Scratch Parelles' : 'Handicap Parelles';
          dataDescription += `${label} (top 10):\n`;
          entries.slice(0, 10).forEach((e: any, i: number) => { dataDescription += `${i + 1}. ${e.name} – ${e.total_points} punts\n`; });
          dataDescription += '\n';
        }
      } else {
        const isFemale = category.includes('female');
        const genderLabel = isFemale ? 'Femení' : 'Masculí';
        const scratchCat = isFemale ? 'scratch_female' : 'scratch_male';
        const hcpCat = isFemale ? 'handicap_female' : 'handicap_male';
        for (const key of [scratchCat, hcpCat]) {
          const entries = rankings[key] || [];
          if (entries.length === 0) continue;
          const label = key.startsWith('scratch') ? `Scratch ${genderLabel}` : `Handicap ${genderLabel}`;
          dataDescription += `${label} (top 10):\n`;
          entries.slice(0, 10).forEach((e: any, i: number) => { dataDescription += `${i + 1}. ${e.name} – ${e.total_points} punts\n`; });
          dataDescription += '\n';
        }
      }

      if (holeInOnes && holeInOnes.length > 0) {
        dataDescription += `Hole-in-Ones:\n`;
        for (const h of holeInOnes) dataDescription += `- ${h.playerName} al forat ${h.hole} (${h.tournament})\n`;
        dataDescription += '\n';
      }
      if (bestRound) {
        dataDescription += `Millor targeta: ${bestRound.name} amb ${bestRound.score} cops a la Prova ${bestRound.round}\n\n`;
      }

      const formatInstructions: Record<string, string> = {
        whatsapp: `Format WhatsApp: text complet amb emojis (⛳🏆🥇🥈🥉👏📊🔥), llistes amb medalles pels 3 primers. Inclou top 10.`,
        instagram: `Format Instagram: text curt i visual amb emojis. Només top 3 per categoria. Acaba amb punts separadors (.\n.\n.) abans dels hashtags.`,
        noticia: `Format notícia formal per diari: text narratiu sense emojis, estil periodístic. Usa **negreta** per noms i resultats destacats.`,
      };

      userPrompt = `Genera un post sobre la classificació acumulada del Rànquing ${modeLabel} 2026 del Centre de Golf P&P El Vendrell.

${formatInstructions[format] || formatInstructions.whatsapp}

Dades:
${dataDescription}

IMPORTANT: Genera un text ÚNIC i ORIGINAL. Varia l'estructura, expressions i to. Número aleatori: ${Math.random().toString(36).slice(2, 8)}`;

    } else if (type === 'news') {
      const { rankings, sponsors, mentions, photoCount } = data;
      const styleLabels: Record<string, string> = {
        esportiu: 'esportiu i dinàmic, amb emojis',
        formal: 'formal i seriós, com per a un diari, sense emojis',
        festiu: 'festiu, entusiasta i celebratori, amb molts emojis',
        cronica: 'crònica narrativa per a la web del club, text fluid sense llistes',
      };

      let dataDescription = '';
      for (const [key, entries] of Object.entries(rankings || {})) {
        if (!(entries as any[]).length) continue;
        const labels: Record<string, string> = {
          scratch_male: 'Scratch Masculí', handicap_male: 'Handicap Masculí',
          scratch_female: 'Scratch Femení', handicap_female: 'Handicap Femení',
          scratch_pairs: 'Scratch Parelles', handicap_pairs: 'Handicap Parelles',
        };
        dataDescription += `${labels[key] || key} (top 5):\n`;
        (entries as any[]).slice(0, 5).forEach((e: any, i: number) => {
          dataDescription += `${i + 1}. ${e.name} – ${e.total_points} punts\n`;
        });
        dataDescription += '\n';
      }

      const playedRounds = (rankings?.scratch_male?.[0] as any)?.rounds?.filter((r: any) => r !== null).length || 0;

      userPrompt = `Genera una notícia/crònica esportiva completa sobre el Rànquing 2026 del Centre de Golf Pitch & Putt El Vendrell.

Estil: ${styleLabels[style || 'esportiu'] || 'esportiu i dinàmic'}

Proves disputades: ${playedRounds}

Classificacions:
${dataDescription}`;

      if (sponsors && sponsors.length > 0) {
        userPrompt += `\nPatrocinadors a mencionar: ${sponsors.join(', ')}`;
      }
      if (mentions) {
        userPrompt += `\nMencions especials a incloure: ${mentions}`;
      }
      if (photoCount && photoCount > 0) {
        userPrompt += `\nMenciona que hi ha ${photoCount} fotos adjuntes.`;
      }

      userPrompt += `\n\nIMPORTANT: Genera un text ÚNIC i ORIGINAL cada vegada. Varia frases, estructura i metàfores. Número aleatori: ${Math.random().toString(36).slice(2, 8)}`;
    }

    // Call AI
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errText}`);
    }

    const result = await response.json();
    const generatedText = result.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({ text: generatedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
