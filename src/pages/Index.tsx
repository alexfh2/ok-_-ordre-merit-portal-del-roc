import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, CalendarPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { RANKING_RULES } from '@/config/rankingRules';
import Navbar from '@/components/Navbar';
import TournamentDetailDialog from '@/components/TournamentDetailDialog';

const CATEGORY_LABELS: Record<string, string> = {
  scratch_male: 'Scratch Masc.',
  scratch_female: 'Scratch Fem.',
  handicap_male: 'Hcp Masc.',
  handicap_female: 'Hcp Fem.',
};

const PAIR_CATEGORY_LABELS: Record<string, string> = {
  scratch_pairs: 'Scratch Parelles',
  handicap_pairs: 'Handicap Parelles',
};

interface TopEntry {
  position: number;
  name: string;
  total_points: number;
}

interface TournamentRow {
  round_number: number;
  name: string;
  date: string | null;
}

const MONTHS_CA = ['GEN', 'FEB', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OCT', 'NOV', 'DES'];

function fixEncoding(s: string): string {
  if (!s) return s;
  return s
    .replace(/Ã­/g, 'í').replace(/Ã³/g, 'ó').replace(/Ã©/g, 'é').replace(/Ã¡/g, 'á').replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ').replace(/Ã¨/g, 'è').replace(/Ã²/g, 'ò').replace(/Ã /g, 'à').replace(/Ã§/g, 'ç')
    .replace(/Ã/g, 'í').replace(/Âª/g, 'ª').replace(/Âº/g, 'º').replace(/Â·/g, '·').replace(/Â/g, '');
}

function cleanTournamentName(name: string): string {
  return fixEncoding(name)
    .replace(/\s*-\s*Individual\s*-\s*Stableford\s*$/i, '')
    .replace(/\s*\(O\.M\.\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function Index() {
  const [top5, setTop5] = useState<Record<string, TopEntry[]>>({});
  const [pairTop5, setPairTop5] = useState<Record<string, TopEntry[]>>({});
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [playedRounds, setPlayedRounds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetchTop5() {
      const [{ data }, { data: pairData }, { data: tournamentData }, { data: resultRows }] = await Promise.all([
        supabase
          .from('rankings')
          .select('position, total_points, category, players(name)')
          .order('position', { ascending: true })
          .lte('position', 5),
        supabase
          .from('pair_rankings')
          .select('position, total_points, category, pairs(name)')
          .order('position', { ascending: true })
          .lte('position', 5),
        supabase
          .from('tournaments')
          .select('round_number, name, date')
          .eq('season', RANKING_RULES.season)
          .order('round_number', { ascending: true }),
        supabase
          .from('results')
          .select('tournament_id, tournaments!inner(round_number, season)')
          .eq('tournaments.season', RANKING_RULES.season),
      ]);

      if (data) {
        const grouped: Record<string, TopEntry[]> = {};
        for (const row of data) {
          const cat = row.category;
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push({
            position: row.position,
            name: (row.players as any)?.name || 'Desconegut',
            total_points: row.total_points,
          });
        }
        setTop5(grouped);
      }

      if (pairData) {
        const grouped: Record<string, TopEntry[]> = {};
        for (const row of pairData) {
          const cat = row.category;
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push({
            position: row.position,
            name: (row.pairs as any)?.name || 'Desconegut',
            total_points: row.total_points,
          });
        }
        setPairTop5(grouped);
      }
      if (tournamentData) {
        setTournaments(tournamentData as TournamentRow[]);
      }
      if (resultRows) {
        const played = new Set<number>();
        for (const r of resultRows as any[]) {
          const rn = r.tournaments?.round_number;
          if (typeof rn === 'number') played.add(rn);
        }
        setPlayedRounds(played);
      }
    }
    fetchTop5();
  }, []);

  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const hasData = Object.keys(top5).length > 0;
  const hasPairData = Object.keys(pairTop5).length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar showSearch />

      {/* Hero + Top 5 Preview */}
      <section className="py-16 sm:py-24">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Left: Hero text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-sans font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Esport i Natura · Temporada {RANKING_RULES.season} · {RANKING_RULES.totalRounds} proves O.M.
              </div>
              <h1 className="text-4xl sm:text-5xl font-display font-semibold text-foreground mb-4 leading-tight">
                Ordre del Mèrit<br />
                <span className="text-primary italic">Portal del Roc {RANKING_RULES.season}</span>
              </h1>
              <p className="text-lg text-muted-foreground font-sans mb-8 max-w-lg">
                Consulta el rànquing, el calendari de proves i l&apos;evolució dels abonats al llarg de la temporada. Els {RANKING_RULES.countingRounds} millors resultats compten per a la classificació final.
              </p>
              <div className="flex flex-col gap-3">
                <Link to="/rankings">
                  <Button size="sm" className="font-display font-semibold">
                    Class. Acumulades
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
                <Link to="/proves">
                  <Button size="sm" className="font-display font-semibold">
                    Prova a Prova
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Right: Top 5 preview */}
            {(hasData || hasPairData) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                {hasData && (
                  <>
                    <h2 className="font-display text-lg font-bold text-foreground mb-3">Top 5 Individual</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                      {['scratch_male', 'scratch_female', 'handicap_male', 'handicap_female'].map((cat) => {
                        const entries = top5[cat] || [];
                        if (entries.length === 0) return null;
                        return (
                          <div key={cat} className="bg-card border border-border rounded-lg p-4">
                            <h3 className="font-display font-bold text-xs text-primary mb-3 uppercase tracking-wide">
                              {CATEGORY_LABELS[cat]}
                            </h3>
                            <div className="space-y-1.5">
                              {entries.map((entry) => (
                                <div key={entry.position} className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`font-display font-bold text-xs w-5 text-center shrink-0 ${
                                      entry.position <= 3 ? 'text-primary' : 'text-muted-foreground'
                                    }`}>
                                      {entry.position}
                                    </span>
                                    <span className="font-sans text-xs text-foreground truncate">
                                      {entry.name}
                                    </span>
                                  </div>
                                  <span className="font-bold tabular-nums text-xs text-foreground shrink-0">
                                    {entry.total_points}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {hasPairData && (
                  <>
                    <h2 className="font-display text-lg font-bold text-foreground mb-3">Top 5 Parelles</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {['scratch_pairs', 'handicap_pairs'].map((cat) => {
                        const entries = pairTop5[cat] || [];
                        if (entries.length === 0) return null;
                        return (
                          <div key={cat} className="bg-card border border-border rounded-lg p-4">
                            <h3 className="font-display font-bold text-xs text-primary mb-3 uppercase tracking-wide">
                              {PAIR_CATEGORY_LABELS[cat]}
                            </h3>
                            <div className="space-y-1.5">
                              {entries.map((entry) => (
                                <div key={entry.position} className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`font-display font-bold text-xs w-5 text-center shrink-0 ${
                                      entry.position <= 3 ? 'text-primary' : 'text-muted-foreground'
                                    }`}>
                                      {entry.position}
                                    </span>
                                    <span className="font-sans text-xs text-foreground truncate">
                                      {entry.name}
                                    </span>
                                  </div>
                                  <span className="font-bold tabular-nums text-xs text-foreground shrink-0">
                                    {entry.total_points}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Calendar */}
      <section className="pb-16">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
                📆 Calendari de Proves
              </h2>
              <Button
                size="sm"
                variant="outline"
                className="font-sans text-xs gap-1.5"
                onClick={() => {
                  const location = 'Portal del Roc Pitch & Putt';
                  const toIcsDate = (iso: string) => iso.replace(/-/g, '');
                  const nextDay = (iso: string) => {
                    const [y, m, d] = iso.split('-').map(Number);
                    const dt = new Date(y, m - 1, d + 1);
                    return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
                  };
                  const now = new Date();
                  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}00Z`;
                  const lines = [
                    'BEGIN:VCALENDAR',
                    'VERSION:2.0',
                    'PRODID:-//Ordre del Mèrit Portal del Roc//CA',
                    'X-WR-CALNAME:Ordre del Mèrit Portal del Roc',
                    'CALSCALE:GREGORIAN',
                    'METHOD:PUBLISH',
                  ];
                  tournaments.forEach((t) => {
                    if (!t.date) return;
                    lines.push(
                      'BEGIN:VEVENT',
                      `DTSTAMP:${stamp}`,
                      `DTSTART;VALUE=DATE:${toIcsDate(t.date)}`,
                      `DTEND;VALUE=DATE:${nextDay(t.date)}`,
                      `SUMMARY:Prova ${t.round_number} O.M. — ${cleanTournamentName(t.name)}`,
                      `LOCATION:${location}`,
                      `UID:ordre-merit-portal-del-roc-${RANKING_RULES.season}-prova-${t.round_number}@portaldelroc`,
                      'END:VEVENT',
                    );
                  });
                  lines.push('END:VCALENDAR');
                  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ordre-del-merit-portal-del-roc-${RANKING_RULES.season}.ics`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Afegir a Google Calendar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground font-sans mb-6">
              {RANKING_RULES.totalRounds} proves durant la temporada per demostrar la regularitat i competir amb els millors jugadors del club.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {tournaments.map((t, i) => {
                const done = playedRounds.has(t.round_number);
                const dateObj = t.date ? new Date(t.date + 'T00:00:00') : null;
                const month = dateObj ? MONTHS_CA[dateObj.getMonth()] : '—';
                const day = dateObj ? dateObj.getDate() : '—';
                const cleanName = cleanTournamentName(t.name);
                const tooltip = dateObj
                  ? `Prova ${t.round_number} · ${day} ${month.toLowerCase()} ${dateObj.getFullYear()}\n${cleanName}`
                  : `Prova ${t.round_number} · ${cleanName}`;
                return (
                  <motion.div
                    key={t.round_number}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.03, duration: 0.3 }}
                    onClick={() => done && setSelectedRound(t.round_number)}
                    title={tooltip}
                    className={`relative bg-card border rounded-lg p-3 text-center transition-all ${
                      done
                        ? 'border-primary/40 bg-primary/5 cursor-pointer hover:shadow-lg hover:scale-105'
                        : 'border-border hover:border-primary/30 hover:shadow-md'
                    }`}
                  >
                    {done && (
                      <span className="absolute top-1.5 right-1.5 text-[10px] font-sans font-medium text-primary">✓</span>
                    )}
                    <div className="font-display text-[10px] font-bold text-primary tracking-widest mb-1">
                      {month}
                    </div>
                    <div className="font-display text-2xl font-extrabold text-foreground leading-none mb-1">
                      {day}
                    </div>
                    <div className="font-sans text-[11px] text-muted-foreground">
                      Prova {t.round_number}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>


      {/* Info Cards */}
      <section className="pb-24">
        <div className="container">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[{ title: String(RANKING_RULES.totalRounds), subtitle: 'Proves', desc: 'Temporada completa O.M.' }, { title: String(RANKING_RULES.countingRounds), subtitle: 'Millors resultats', desc: `Es descarten els ${RANKING_RULES.totalRounds - RANKING_RULES.countingRounds} pitjors i suma de punts per cada campionat a partir de l'11è (consultar bases).` }, { title: String(RANKING_RULES.categories.length), subtitle: 'Categories', desc: 'Scratch i Handicap, Masculí, Femení  \nSènior Indistint' }].
            map((card, i) =>
            <motion.div
              key={card.subtitle}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="bg-card border border-border rounded-lg p-6">
                <div className="font-display text-3xl font-extrabold text-primary mb-1">{card.title}</div>
                <div className="font-display font-semibold text-foreground mb-1">{card.subtitle}</div>
                <div className="text-sm text-muted-foreground font-sans">{card.desc}</div>
              </motion.div>
            )}
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 bg-primary/10 border-2 border-primary/30 rounded-lg p-6 text-center"
          >
            <div className="font-display text-xl sm:text-2xl font-extrabold text-primary mb-2">
              🏆 1 ANY D'ABONAMENT GRATUÏT PER AL CAMPIÓ!
            </div>
            <p className="text-sm sm:text-base text-muted-foreground font-sans">
              Premis per als tres primers classificats de cada categoria individual i per a la primera parella classificada.
            </p>
          </motion.div>
        </div>
      </section>

      <TournamentDetailDialog
        roundNumber={selectedRound}
        open={selectedRound !== null}
        onOpenChange={(open) => !open && setSelectedRound(null)}
      />

      {/* Footer */}
      <footer className="border-t border-border bg-card/40 py-8 mt-8">
        <div className="container text-center text-sm text-muted-foreground font-sans space-y-1">
          <div className="font-display text-base text-foreground">Portal del Roc Pitch &amp; Putt</div>
          <div>Ordre del Mèrit {new Date().getFullYear()} · Esport i Natura</div>
        </div>
      </footer>
    </div>
  );
}
