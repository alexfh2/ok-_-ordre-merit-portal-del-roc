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

export default function Index() {
  const [top5, setTop5] = useState<Record<string, TopEntry[]>>({});
  const [pairTop5, setPairTop5] = useState<Record<string, TopEntry[]>>({});
  const [playedRounds, setPlayedRounds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetchTop5() {
      const [{ data }, { data: pairData }, { data: tournamentData }] = await Promise.all([
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
          .select('round_number'),
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
        setPlayedRounds(new Set(tournamentData.map((t) => t.round_number)));
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
                Temporada {RANKING_RULES.season} · {RANKING_RULES.totalRounds} proves O.M.
              </div>
              <h1 className="text-4xl sm:text-5xl font-display font-semibold text-foreground mb-4 leading-tight">
                Ordre del Mèrit<br />
                <span className="text-primary italic">Portal del Roc {RANKING_RULES.season}</span>
              </h1>
              <p className="text-lg text-muted-foreground font-sans mb-8 max-w-lg">
                Classificacions oficials de l&apos;Ordre del Mèrit del club. Els {RANKING_RULES.countingRounds} millors resultats compten per a la classificació final. Molta sort!
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
                  const ORDINALS = ['Primera', 'Segona', 'Tercera', 'Quarta', 'Cinquena', 'Sisena', 'Setena', 'Vuitena', 'Novena', 'Desena'];
                  const DATES = [
                    '20260208', '20260315', '20260412', '20260510',
                    '20260628', '20260726', '20260906', '20261004',
                    '20261018', '20261122',
                  ];
                  const location = 'Portal del Roc Pitch & Putt';
                  const nextDay = (dateStr: string) => {
                    const y = parseInt(dateStr.slice(0, 4));
                    const m = parseInt(dateStr.slice(4, 6)) - 1;
                    const day = parseInt(dateStr.slice(6, 8));
                    const d = new Date(y, m, day + 1);
                    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
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
                  DATES.forEach((d, i) => {
                    lines.push(
                      'BEGIN:VEVENT',
                      `DTSTAMP:${stamp}`,
                      `DTSTART;VALUE=DATE:${d}`,
                      `DTEND;VALUE=DATE:${nextDay(d)}`,
                      `SUMMARY:${ORDINALS[i]} Prova O.M. Portal del Roc`,
                      `LOCATION:${location}`,
                      `UID:ordre-merit-portal-del-roc-2026-prova-${i + 1}@portaldelroc`,
                      'END:VEVENT',
                    );
                  });
                  lines.push('END:VCALENDAR');
                  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'ordre-del-merit-portal-del-roc-2026.ics';
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { num: 1, date: '8 feb', month: 'FEB', day: 8 },
                { num: 2, date: '15 mar', month: 'MAR', day: 15 },
                { num: 3, date: '12 abr', month: 'ABR', day: 12 },
                { num: 4, date: '10 mai', month: 'MAI', day: 10 },
                { num: 5, date: '28 jun', month: 'JUN', day: 28 },
                { num: 6, date: '26 jul', month: 'JUL', day: 26 },
                { num: 7, date: '6 set', month: 'SET', day: 6 },
                { num: 8, date: '4 oct', month: 'OCT', day: 4 },
                { num: 9, date: '18 oct', month: 'OCT', day: 18 },
                { num: 10, date: '22 nov', month: 'NOV', day: 22 },
              ].map((p, i) => {
                const done = playedRounds.has(p.num);
                return (
                  <motion.div
                    key={p.num}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.05, duration: 0.3 }}
                    onClick={() => done && setSelectedRound(p.num)}
                    className={`relative bg-card border rounded-lg p-4 text-center transition-all ${
                      done
                        ? 'border-primary/40 bg-primary/5 cursor-pointer hover:shadow-lg hover:scale-105'
                        : 'border-border hover:border-primary/30 hover:shadow-md'
                    }`}
                  >
                    {done && (
                      <span className="absolute top-2 right-2 text-xs font-sans font-medium text-primary">✓</span>
                    )}
                    <div className="font-display text-[10px] font-bold text-primary tracking-widest mb-1">
                      {p.month}
                    </div>
                    <div className="font-display text-2xl font-extrabold text-foreground leading-none mb-1">
                      {p.day}
                    </div>
                    <div className="font-sans text-xs text-muted-foreground">
                      Prova {p.num}
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
            {[{ title: '10', subtitle: 'Proves', desc: 'Circuit complet de la temporada' }, { title: '8', subtitle: 'Millors resultats', desc: 'Es descarten els 2 pitjors' }, { title: '4', subtitle: 'Categories', desc: 'Scratch i Handicap, Masculí i Femení' }].
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
      <footer className="border-t border-border py-8">
        <div className="container text-center text-sm text-muted-foreground font-sans">
          Rànquing Pitch &amp; Putt Vallromanes {new Date().getFullYear()} · Club Pitch &amp; Putt Vallromanes
        </div>
      </footer>
    </div>
  );
}
