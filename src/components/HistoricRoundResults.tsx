import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, Flag, CheckCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface HoleScore {
  hole_number: number;
  strokes: number;
}

interface HistoricResult {
  player_name: string;
  gender: string;
  scratch_score: number | null;
  handicap_score: number | null;
  license_number: string | null;
  hole_scores: HoleScore[];
}

interface HistoricRound {
  round_number: number;
  round_name: string | null;
  round_date: string | null;
  results: HistoricResult[];
}

const CATEGORIES = [
  { value: 'scratch_male', label: 'Scratch Masculí', scoreKey: 'scratch_score' as const, gender: 'male' },
  { value: 'handicap_male', label: 'Handicap Masculí', scoreKey: 'handicap_score' as const, gender: 'male' },
  { value: 'scratch_female', label: 'Scratch Femení', scoreKey: 'scratch_score' as const, gender: 'female' },
  { value: 'handicap_female', label: 'Handicap Femení', scoreKey: 'handicap_score' as const, gender: 'female' },
];

function PositionBadge({ position }: { position: number }) {
  if (position === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[hsl(var(--gold))] font-display font-bold text-foreground text-xs shadow-sm">1</span>;
  if (position === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[hsl(var(--silver))] font-display font-bold text-primary-foreground text-xs">2</span>;
  if (position === 3) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[hsl(var(--bronze))] font-display font-bold text-primary-foreground text-xs">3</span>;
  return <span className="inline-flex items-center justify-center w-7 h-7 font-display font-bold text-muted-foreground text-xs tabular-nums">{position}</span>;
}

function HoleScoreCell({ strokes }: { strokes: number }) {
  if (strokes === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-[11px] shadow-sm">{strokes}</span>;
  if (strokes === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-primary text-primary font-bold text-[11px]">{strokes}</span>;
  if (strokes === 3) return <span className="inline-flex items-center justify-center w-7 h-7 text-foreground font-semibold text-[11px]">{strokes}</span>;
  if (strokes === 4) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm border-2 border-foreground/40 bg-muted text-foreground font-bold text-[11px]">{strokes}</span>;
  return <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-destructive/10 text-destructive font-bold text-[11px]">{strokes}</span>;
}

/* ── Mobile list ── */
function MobileResultsList({ filtered, cat }: { filtered: HistoricResult[]; cat: typeof CATEGORIES[number] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (filtered.length === 0) {
    return <div className="px-5 py-6 text-sm text-muted-foreground text-center font-sans">Sense resultats per aquesta categoria</div>;
  }

  return (
    <div>
      {filtered.map((r, i) => {
        const isTop3 = i < 3;
        const hasHoles = r.hole_scores.length > 0;
        const isOpen = expanded === `${r.player_name}-${i}`;
        const holeLookup = new Map(r.hole_scores.map(s => [s.hole_number, s]));
        return (
          <div key={`${r.player_name}-${i}`}>
            <button
              onClick={() => hasHoles ? setExpanded(isOpen ? null : `${r.player_name}-${i}`) : null}
              className={`w-full flex items-center gap-2 py-3 px-3 border-b border-border/50 text-left transition-colors ${hasHoles ? 'active:bg-muted/50 cursor-pointer' : ''} ${isTop3 ? 'bg-accent/10' : ''}`}
            >
              <PositionBadge position={i + 1} />
              <div className="flex-1 min-w-0">
                <span className={`font-sans text-sm truncate block ${isTop3 ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                  {r.player_name}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-[9px] font-display text-muted-foreground">SCR</div>
                  <div className={`tabular-nums font-display text-sm ${cat.scoreKey === 'scratch_score' ? 'font-extrabold text-primary' : 'font-bold text-foreground/70'}`}>
                    {r.scratch_score ?? '-'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-display text-muted-foreground">HCP</div>
                  <div className={`tabular-nums font-display text-sm ${cat.scoreKey === 'handicap_score' ? 'font-extrabold text-primary' : 'font-bold text-foreground/70'}`}>
                    {r.handicap_score ?? '-'}
                  </div>
                </div>
              </div>
              {hasHoles && <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
            </button>
            <AnimatePresence>
              {isOpen && hasHoles && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden bg-muted/20 border-b border-border/50">
                  <div className="px-3 py-3">
                    <div className="text-[10px] font-display font-bold text-muted-foreground mb-1">Forats 1-9</div>
                    <div className="grid grid-cols-9 gap-1 mb-3">
                      {Array.from({ length: 9 }, (_, idx) => { const holeNum = idx + 1; const hs = holeLookup.get(holeNum); return (
                        <div key={holeNum} className="text-center">
                          <div className="text-[9px] font-bold text-muted-foreground mb-0.5">{holeNum}</div>
                          {hs ? <HoleScoreCell strokes={hs.strokes} /> : <span className="text-muted-foreground/30 text-xs">·</span>}
                        </div>
                      ); })}
                    </div>
                    <div className="text-[10px] font-display font-bold text-muted-foreground mb-1">Forats 10-18</div>
                    <div className="grid grid-cols-9 gap-1">
                      {Array.from({ length: 9 }, (_, idx) => { const holeNum = idx + 10; const hs = holeLookup.get(holeNum); return (
                        <div key={holeNum} className="text-center">
                          <div className="text-[9px] font-bold text-muted-foreground mb-0.5">{holeNum}</div>
                          {hs ? <HoleScoreCell strokes={hs.strokes} /> : <span className="text-muted-foreground/30 text-xs">·</span>}
                        </div>
                      ); })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export default function HistoricRoundResults({ seasonId }: { seasonId: string }) {
  const [rounds, setRounds] = useState<HistoricRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [category, setCategory] = useState('scratch_male');

  useEffect(() => {
    (async () => {
      setLoading(true);

      // Fetch results
      const allResults: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from('historic_results')
          .select('round_number, round_name, round_date, player_name, gender, scratch_score, handicap_score, license_number')
          .eq('season_id', seasonId)
          .order('round_number')
          .order('scratch_score', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        allResults.push(...data);
        if (data.length < pageSize) break;
      }

      // Fetch hole scores
      const allHoleScores: any[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from('historic_hole_scores')
          .select('round_number, player_name, license_number, hole_number, strokes')
          .eq('season_id', seasonId)
          .order('round_number')
          .order('hole_number')
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        allHoleScores.push(...data);
        if (data.length < pageSize) break;
      }

      // Build hole score lookup: round_number -> player_name -> HoleScore[]
      const holeMap = new Map<string, HoleScore[]>();
      for (const hs of allHoleScores) {
        const key = `${hs.round_number}:${hs.player_name}`;
        if (!holeMap.has(key)) holeMap.set(key, []);
        holeMap.get(key)!.push({ hole_number: hs.hole_number, strokes: hs.strokes });
      }

      const roundMap = new Map<number, HistoricRound>();
      for (const r of allResults) {
        if (!roundMap.has(r.round_number)) {
          roundMap.set(r.round_number, {
            round_number: r.round_number,
            round_name: r.round_name,
            round_date: r.round_date,
            results: [],
          });
        }
        const holeKey = `${r.round_number}:${r.player_name}`;
        roundMap.get(r.round_number)!.results.push({
          player_name: r.player_name,
          gender: r.gender,
          scratch_score: r.scratch_score,
          handicap_score: r.handicap_score,
          license_number: r.license_number,
          hole_scores: holeMap.get(holeKey) || [],
        });
      }

      setRounds(Array.from(roundMap.values()).sort((a, b) => a.round_number - b.round_number));
      setLoading(false);
    })();
  }, [seasonId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
    );
  }

  if (rounds.length === 0) {
    return <p className="text-sm text-muted-foreground font-sans text-center py-4">No hi ha resultats prova a prova per aquesta temporada.</p>;
  }

  const cat = CATEGORIES.find(c => c.value === category)!;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Flag className="w-4 h-4 text-primary" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-60 border-primary/30 bg-card font-sans font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {rounds.map((round) => {
          const filtered = round.results
            .filter(r => r.gender === cat.gender && r[cat.scoreKey] !== null)
            .sort((a, b) => (a[cat.scoreKey] ?? 999) - (b[cat.scoreKey] ?? 999));

          const hasResults = filtered.length > 0;
          const isOpen = openId === round.round_number;
          const anyHasHoles = filtered.some(r => r.hole_scores.length > 0);

          return (
            <Collapsible key={round.round_number} open={isOpen} onOpenChange={(open) => hasResults ? setOpenId(open ? round.round_number : null) : null}>
              <CollapsibleTrigger className={`w-full flex items-center justify-between rounded-xl px-5 py-4 transition-all group border-2 ${
                isOpen ? 'bg-primary/5 border-primary shadow-md'
                : hasResults ? 'bg-card border-border hover:border-primary/40 hover:shadow-sm cursor-pointer'
                : 'bg-muted/30 border-border/40 opacity-50 cursor-default'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg font-display font-extrabold text-sm ${
                    isOpen ? 'bg-primary text-primary-foreground' : hasResults ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground'
                  }`}>P{round.round_number}</div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-sans font-semibold text-sm text-foreground">{round.round_name || `Prova ${round.round_number}`}</span>
                      {hasResults && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-sans font-semibold">
                          <CheckCircle className="w-3 h-3" /> Disputada
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {round.round_date && (
                        <span className="text-sm font-sans text-muted-foreground">
                          {new Date(round.round_date).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      )}
                      {hasResults && (
                        <span className="text-xs text-muted-foreground/70 font-sans">
                          · {filtered.length} jugadors
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {hasResults && <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : 'text-muted-foreground'}`} />}
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="mt-1 rounded-b-xl border-2 border-t-0 border-primary/20 bg-card overflow-hidden">
                  {/* Mobile view */}
                  <div className="block lg:hidden">
                    <MobileResultsList filtered={filtered} cat={cat} />
                  </div>

                  {/* Desktop view with hole-by-hole */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-primary/5">
                          <th className="py-2.5 px-2 text-center font-display font-bold text-primary text-[11px] w-9 sticky left-0 bg-primary/5 z-10">#</th>
                          <th className="py-2.5 px-3 text-left font-display font-bold text-primary text-[11px] min-w-[130px] sticky left-9 bg-primary/5 z-10">Jugador</th>
                          {anyHasHoles && Array.from({ length: 18 }, (_, i) => (
                            <th key={i} className="py-2.5 px-0 text-center font-display font-bold text-muted-foreground text-[10px] w-8">{i + 1}</th>
                          ))}
                          <th className="py-2.5 px-3 text-center font-display font-extrabold text-primary text-xs w-16">SCR</th>
                          <th className="py-2.5 px-3 text-center font-display font-extrabold text-primary text-xs w-16">HCP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r, i) => {
                          const isTop3 = i < 3;
                          const holeLookup = new Map(r.hole_scores.map(s => [s.hole_number, s]));
                          return (
                            <tr key={`${r.player_name}-${i}`} className={`border-b border-border/50 transition-colors hover:bg-accent/20 ${isTop3 ? 'bg-accent/10' : ''}`}>
                              <td className="py-2 px-1 text-center sticky left-0 bg-card z-10"><PositionBadge position={i + 1} /></td>
                              <td className={`py-2 px-3 text-left font-sans truncate max-w-[160px] sticky left-9 bg-card z-10 ${isTop3 ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                                {r.player_name}
                              </td>
                              {anyHasHoles && Array.from({ length: 18 }, (_, idx) => {
                                const hs = holeLookup.get(idx + 1);
                                return (
                                  <td key={idx} className="py-1 px-0 text-center">
                                    {hs ? <HoleScoreCell strokes={hs.strokes} /> : <span className="text-muted-foreground/30">·</span>}
                                  </td>
                                );
                              })}
                              <td className={`py-2 px-3 text-center tabular-nums font-display ${cat.scoreKey === 'scratch_score' ? 'font-extrabold text-primary text-sm' : 'font-bold text-foreground text-sm'}`}>
                                {r.scratch_score ?? '-'}
                              </td>
                              <td className={`py-2 px-3 text-center tabular-nums font-display ${cat.scoreKey === 'handicap_score' ? 'font-extrabold text-primary text-sm' : 'font-bold text-foreground text-sm'}`}>
                                {r.handicap_score ?? '-'}
                              </td>
                            </tr>
                          );
                        })}
                        {filtered.length === 0 && (
                          <tr><td colSpan={anyHasHoles ? 22 : 4} className="px-5 py-6 text-sm text-muted-foreground text-center font-sans">Sense resultats per aquesta categoria</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
