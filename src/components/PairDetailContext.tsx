import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Trophy, Users } from 'lucide-react';

interface PlayerHoleScore {
  hole_number: number;
  points: number;
  player_name: string;
}

interface PairTournament {
  tournament_name: string;
  round_number: number;
  date: string | null;
  scratch_score: number | null;
  handicap_score: number | null;
  hole_scores: PlayerHoleScore[];
  scratch_position?: number;
  handicap_position?: number;
}

interface PairRanking {
  category: string;
  position: number;
  total_points: number;
}

interface PairMember {
  player_name: string;
  license_number: string | null;
  gender: string;
  member_order: number;
}

interface PairDetail {
  id: string;
  name: string;
  members: PairMember[];
  rankings: PairRanking[];
  tournaments: PairTournament[];
}

const CATEGORY_LABELS: Record<string, string> = {
  scratch_pairs: 'Scratch Parelles',
  handicap_pairs: 'Handicap Parelles',
};

function PairHoleScoreCell({ points }: { points: number }) {
  // Strokes: 1=HiO, 2=Berdie, 3=Par, 4=Bogey, 0 or 5+=Doble+
  if (points === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-[11px] shadow-sm">{points}</span>;
  if (points === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-primary text-primary font-bold text-[11px]">{points}</span>;
  if (points === 3) return <span className="inline-flex items-center justify-center w-7 h-7 text-foreground font-semibold text-[11px]">{points}</span>;
  if (points === 4) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm border-2 border-foreground/40 bg-muted text-foreground font-bold text-[11px]">{points}</span>;
  return <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-destructive/10 text-destructive font-bold text-[11px]">{points >= 5 ? `${points}` : '0'}</span>;
}

interface PairDetailContextType {
  openPair: (id: string, name: string) => void;
}

const PairDetailContext = createContext<PairDetailContextType | null>(null);

export function usePairDetail() {
  const ctx = useContext(PairDetailContext);
  if (!ctx) throw new Error('usePairDetail must be used within PairDetailProvider');
  return ctx;
}

export function PairDetailProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pair, setPair] = useState<PairDetail | null>(null);
  const [openRound, setOpenRound] = useState<number | null>(null);

  const openPair = useCallback(async (id: string, name: string) => {
    setOpen(true);
    setLoading(true);
    setPair(null);
    setOpenRound(null);

    try {
      const [{ data: rankings }, { data: results }, { data: members }] = await Promise.all([
        supabase.from('pair_rankings').select('category, position, total_points').eq('pair_id', id),
        supabase.from('pair_results').select('scratch_score, handicap_score, tournament_id, tournaments(name, round_number, date)').eq('pair_id', id),
        supabase.from('pair_members').select('player_name, license_number, gender, member_order').eq('pair_id', id).order('member_order'),
      ]);

      const tournamentIds = (results || []).map(r => r.tournament_id);

      if (tournamentIds.length > 0) {
        const [allHolesResult, { data: allPairResults }] = await Promise.all([
          (async () => {
            const allHoles: Array<{ tournament_id: string; hole_number: number; points: number; player_name: string | null }> = [];
            const pageSize = 1000;
            for (let from = 0; ; from += pageSize) {
              const { data } = await supabase
                .from('pair_hole_scores')
                .select('tournament_id, hole_number, points, player_name')
                .eq('pair_id', id)
                .in('tournament_id', tournamentIds)
                .order('hole_number', { ascending: true })
                .range(from, from + pageSize - 1);
              if (!data || data.length === 0) break;
              allHoles.push(...(data as any));
              if (data.length < pageSize) break;
            }
            return allHoles;
          })(),
          supabase.from('pair_results').select('pair_id, scratch_score, handicap_score, tournament_id').in('tournament_id', tournamentIds),
        ]);

        const holeMap = new Map<string, PlayerHoleScore[]>();
        for (const h of allHolesResult) {
          if (!holeMap.has(h.tournament_id)) holeMap.set(h.tournament_id, []);
          holeMap.get(h.tournament_id)!.push({ hole_number: h.hole_number, points: h.points, player_name: h.player_name || '' });
        }

        const positionsMap = new Map<string, { scratch: number; handicap: number }>();
        for (const tid of tournamentIds) {
          const tResults = (allPairResults || []).filter(r => r.tournament_id === tid);
          const scratchSorted = tResults.filter(r => r.scratch_score !== null).sort((a, b) => (b.scratch_score ?? 0) - (a.scratch_score ?? 0));
          const handicapSorted = tResults.filter(r => r.handicap_score !== null).sort((a, b) => (b.handicap_score ?? 0) - (a.handicap_score ?? 0));
          positionsMap.set(tid, {
            scratch: scratchSorted.findIndex(r => r.pair_id === id) + 1 || 0,
            handicap: handicapSorted.findIndex(r => r.pair_id === id) + 1 || 0,
          });
        }

        setPair({
          id, name,
          members: members || [],
          rankings: (rankings || []).map(r => ({ category: r.category, position: r.position, total_points: r.total_points })),
          tournaments: (results || []).map(r => {
            const pos = positionsMap.get(r.tournament_id);
            return {
              tournament_name: (r.tournaments as any)?.name || '',
              round_number: (r.tournaments as any)?.round_number || 0,
              date: (r.tournaments as any)?.date || null,
              scratch_score: r.scratch_score,
              handicap_score: r.handicap_score,
              hole_scores: holeMap.get(r.tournament_id) || [],
              scratch_position: pos?.scratch || 0,
              handicap_position: pos?.handicap || 0,
            };
          }).sort((a, b) => a.round_number - b.round_number),
        });
      } else {
        setPair({
          id, name,
          members: members || [],
          rankings: (rankings || []).map(r => ({ category: r.category, position: r.position, total_points: r.total_points })),
          tournaments: [],
        });
      }
    } catch {
      // ok
    } finally {
      setLoading(false);
    }
  }, []);

  // Compute stats: avg strokes from best ball per hole (same as individual)
  function computeStats(pair: PairDetail) {
    const tournsWithHoles = pair.tournaments.filter(t => t.hole_scores.length > 0);
    const n = tournsWithHoles.length;
    if (n === 0) return null;

    // Calculate best-ball strokes per tournament and per hole
    const tournStrokesList: number[] = [];
    let birdies = 0, pars = 0, bogeys = 0, doublePlus = 0;

    for (const t of tournsWithHoles) {
      let tournStrokes = 0;
      for (let hole = 1; hole <= 18; hole++) {
        const holeScores = t.hole_scores.filter(h => h.hole_number === hole);
        if (holeScores.length === 0) continue;
        // Best ball: take the best (highest) points, convert to strokes
        const bestPoints = Math.max(...holeScores.map(h => h.points));
        const strokes = bestPoints === 0 ? 5 : Math.max(1, 5 - bestPoints);
        tournStrokes += strokes;
        // Count by strokes (best ball)
        if (strokes <= 2) birdies++;
        else if (strokes === 3) pars++;
        else if (strokes === 4) bogeys++;
        else doublePlus++;
      }
      tournStrokesList.push(tournStrokes);
    }

    // Sort ascending (best first) and take best 8
    tournStrokesList.sort((a, b) => a - b);
    const best8 = tournStrokesList.slice(0, 8);
    const avgStrokes = (best8.reduce((sum, s) => sum + s, 0) / best8.length).toFixed(1);

    return {
      avgStrokes,
      stats: [
        { label: 'Mitjana cops', value: avgStrokes, icon: '⛳' },
        { label: 'Birdies/ronda', value: (birdies / n).toFixed(1), icon: '🐦' },
        { label: 'Pars/ronda', value: (pars / n).toFixed(1), icon: '✅' },
        { label: 'Bogeys/ronda', value: (bogeys / n).toFixed(1), icon: '📦' },
        { label: '5+ cops/ronda', value: (doublePlus / n).toFixed(1), icon: '💥' },
      ],
    };
  }

  return (
    <PairDetailContext.Provider value={{ openPair }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Fitxa de la Parella
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {pair && (
            <div className="space-y-4 mt-2">
              {/* Header */}
              <div className="bg-primary/5 border-2 border-primary/20 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground">{pair.name}</h3>
                    <p className="text-xs text-muted-foreground font-sans">
                      {pair.tournaments.length} {pair.tournaments.length === 1 ? 'prova disputada' : 'proves disputades'}
                    </p>
                  </div>
                </div>

                {pair.rankings.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {pair.rankings.map(r => (
                      <div key={r.category} className="bg-card rounded-lg p-3 border border-border">
                        <div className="text-[10px] font-sans text-muted-foreground uppercase tracking-wider mb-1">
                          {CATEGORY_LABELS[r.category] || r.category}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-primary" />
                            <span className="font-display font-extrabold text-lg text-primary">{r.position}º</span>
                          </div>
                          <span className="font-display font-bold text-sm text-foreground tabular-nums">{r.total_points} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Average positions */}
                {pair.tournaments.length > 0 && (() => {
                  const scratchPositions = pair.tournaments.filter(t => t.scratch_position && t.scratch_position > 0).map(t => t.scratch_position!);
                  const handicapPositions = pair.tournaments.filter(t => t.handicap_position && t.handicap_position > 0).map(t => t.handicap_position!);
                  const avgScratchPos = scratchPositions.length > 0 ? (scratchPositions.reduce((a, b) => a + b, 0) / scratchPositions.length).toFixed(1) : null;
                  const avgHandicapPos = handicapPositions.length > 0 ? (handicapPositions.reduce((a, b) => a + b, 0) / handicapPositions.length).toFixed(1) : null;
                  if (!avgScratchPos && !avgHandicapPos) return null;
                  return (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {avgScratchPos && (
                        <div className="bg-card rounded-lg p-3 border border-border">
                          <div className="text-[10px] font-sans text-muted-foreground uppercase tracking-wider mb-1">Pos. Mitjana Scratch</div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Trophy className="w-3.5 h-3.5 text-primary" />
                              <span className="font-display font-extrabold text-lg text-primary">{avgScratchPos}º</span>
                            </div>
                            <span className="font-sans text-xs text-muted-foreground">{scratchPositions.length} proves</span>
                          </div>
                        </div>
                      )}
                      {avgHandicapPos && (
                        <div className="bg-card rounded-lg p-3 border border-border">
                          <div className="text-[10px] font-sans text-muted-foreground uppercase tracking-wider mb-1">Pos. Mitjana Handicap</div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Trophy className="w-3.5 h-3.5 text-primary" />
                              <span className="font-display font-extrabold text-lg text-primary">{avgHandicapPos}º</span>
                            </div>
                            <span className="font-sans text-xs text-muted-foreground">{handicapPositions.length} proves</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Tournaments */}
              {pair.tournaments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-display font-bold text-sm text-foreground">Proves disputades</h4>
                  {pair.tournaments.map((t) => {
                    const playerNames = [...new Set(t.hole_scores.map(h => h.player_name).filter(Boolean))];

                    return (
                      <Collapsible key={t.round_number} open={openRound === t.round_number} onOpenChange={(isOpen) => setOpenRound(isOpen ? t.round_number : null)}>
                        <CollapsibleTrigger className={`w-full flex items-center justify-between rounded-lg px-4 py-3 transition-all border ${
                          openRound === t.round_number ? 'bg-primary/5 border-primary/40' : 'bg-card border-border hover:border-primary/30'
                        }`}>
                          <div className="flex items-center gap-3">
                            <span className={`font-display font-bold text-xs w-8 h-8 flex items-center justify-center rounded-md ${
                              openRound === t.round_number ? 'bg-primary text-primary-foreground' : 'bg-accent text-primary'
                            }`}>P{t.round_number}</span>
                            <div className="text-left">
                              <div className="font-sans font-medium text-sm text-foreground">{t.tournament_name}</div>
                              <div className="flex items-center gap-3 mt-0.5">
                                {t.date && <span className="text-xs text-muted-foreground font-sans">{new Date(t.date).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long' })}</span>}
                                <span className="text-xs font-sans font-semibold text-foreground tabular-nums">Brut: {t.scratch_score ?? '—'} · Net: {t.handicap_score ?? '—'}</span>
                              </div>
                            </div>
                          </div>
                          <ChevronDown className={`w-4 h-4 transition-transform ${openRound === t.round_number ? 'rotate-180 text-primary' : 'text-muted-foreground'}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-1 border border-t-0 border-primary/20 rounded-b-lg bg-card">
                            {playerNames.length > 0 ? (
                              playerNames.map((playerName, pIdx) => {
                                const playerHoles = t.hole_scores.filter(h => h.player_name === playerName);
                                return (
                                  <div key={pIdx} className={pIdx > 0 ? 'border-t border-border/50' : ''}>
                                    <div className="px-3 py-1.5 bg-muted/30">
                                      <span className="text-[11px] font-sans font-semibold text-foreground">{playerName}</span>
                                    </div>
                                    {[0, 9].map(offset => (
                                      <table key={offset} className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-primary/5">
                                            {Array.from({ length: 9 }, (_, i) => offset + i + 1).map(h => (
                                              <th key={h} className="py-1.5 px-0 text-center font-bold text-muted-foreground text-[11px]" style={{ width: '10%' }}>{h}</th>
                                            ))}
                                            <th className="py-1.5 px-1 text-center font-display font-extrabold text-primary text-[11px]" style={{ width: '10%' }}>
                                              {offset === 9 ? 'Tot' : 'Out'}
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          <tr className="border-t border-border/50">
                                            {Array.from({ length: 9 }, (_, idx) => offset + idx + 1).map(holeNum => {
                                              const hs = playerHoles.find(h => h.hole_number === holeNum);
                                              return (
                                                <td key={holeNum} className="py-1.5 px-0 text-center">
                                                  {hs ? <PairHoleScoreCell points={hs.points} /> : <span className="text-muted-foreground/30">·</span>}
                                                </td>
                                              );
                                            })}
                                            <td className="py-1.5 px-1 text-center font-display font-extrabold text-primary text-xs">
                                              {offset === 9
                                                ? playerHoles.reduce((a, h) => a + h.points, 0)
                                                : (() => {
                                                    const sum = playerHoles.filter(h => h.hole_number <= 9).reduce((a, h) => a + h.points, 0);
                                                    return sum > 0 ? sum : '—';
                                                  })()
                                              }
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    ))}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="px-4 py-3 text-sm text-muted-foreground font-sans">Sense dades hoyo a hoyo</div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PairDetailContext.Provider>
  );
}

export function ClickablePairName({ pairId, name, className }: { pairId: string; name: string; className?: string }) {
  const { openPair } = usePairDetail();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); openPair(pairId, name); }}
      className={`hover:text-primary hover:underline underline-offset-2 transition-colors text-left cursor-pointer truncate max-w-full block ${className || ''}`}
    >
      {name}
    </button>
  );
}
