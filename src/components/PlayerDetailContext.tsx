import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Trophy, User } from 'lucide-react';

interface HoleScore {
  hole_number: number;
  strokes: number;
  scratch_points: number;
  handicap_points: number;
}

interface PlayerTournament {
  tournament_name: string;
  round_number: number;
  date: string | null;
  scratch_score: number | null;
  handicap_score: number | null;
  hole_scores: HoleScore[];
  scratch_position?: number;
  handicap_position?: number;
}

interface PlayerRanking {
  category: string;
  position: number;
  total_points: number;
}

interface PlayerDetail {
  id: string;
  name: string;
  gender: string;
  rankings: PlayerRanking[];
  tournaments: PlayerTournament[];
}

const CATEGORY_LABELS: Record<string, string> = {
  scratch_male: 'Scratch Masculí',
  handicap_male: 'Handicap Masculí',
  scratch_female: 'Scratch Femení',
  handicap_female: 'Handicap Femení',
};

function HoleScoreCell({ strokes }: { strokes: number }) {
  if (strokes === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-[11px] shadow-sm">{strokes}</span>;
  if (strokes === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-primary text-primary font-bold text-[11px]">{strokes}</span>;
  if (strokes === 3) return <span className="inline-flex items-center justify-center w-7 h-7 text-foreground font-semibold text-[11px]">{strokes}</span>;
  if (strokes === 4) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm border-2 border-foreground/40 bg-muted text-foreground font-bold text-[11px]">{strokes}</span>;
  return <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-destructive/10 text-destructive font-bold text-[11px]">{strokes}</span>;
}

function RoundScorecard({ tournament }: { tournament: PlayerTournament }) {
  const [view, setView] = useState<'scratch' | 'handicap'>('scratch');
  const isHcp = view === 'handicap';
  const pointsFor = (h: HoleScore) => (isHcp ? h.handicap_points : h.scratch_points);
  const sumPoints = (from: number, to: number) =>
    tournament.hole_scores
      .filter(h => h.hole_number >= from && h.hole_number <= to)
      .reduce((a, h) => a + pointsFor(h), 0);
  const total = isHcp ? tournament.handicap_score : tournament.scratch_score;

  return (
    <div className="mt-1 border border-t-0 border-primary/20 rounded-b-lg bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="inline-flex rounded-md bg-background border border-border p-0.5">
          <button
            type="button"
            onClick={() => setView('scratch')}
            className={`px-3 py-1 text-[11px] font-display font-bold rounded ${!isHcp ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            Brut
          </button>
          <button
            type="button"
            onClick={() => setView('handicap')}
            className={`px-3 py-1 text-[11px] font-display font-bold rounded ${isHcp ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            Net
          </button>
        </div>
        <div className="text-[11px] font-sans text-muted-foreground">
          <span className="font-display font-extrabold text-primary text-sm tabular-nums">{total ?? '—'}</span>{' '}
          pts {isHcp ? 'amb hàndicap' : 'scratch'}
        </div>
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
            {/* Strokes row */}
            <tr className="border-t border-border/50">
              {Array.from({ length: 9 }, (_, idx) => offset + idx + 1).map(holeNum => {
                const hs = tournament.hole_scores.find(h => h.hole_number === holeNum);
                return (
                  <td key={holeNum} className="py-1.5 px-0 text-center">
                    {hs ? <HoleScoreCell strokes={hs.strokes} /> : <span className="text-muted-foreground/30">·</span>}
                  </td>
                );
              })}
              <td className="py-1.5 px-1 text-center font-display font-extrabold text-muted-foreground text-[11px]">
                cops
              </td>
            </tr>
            {/* Points row */}
            <tr className="border-t border-border/30 bg-primary/[0.03]">
              {Array.from({ length: 9 }, (_, idx) => offset + idx + 1).map(holeNum => {
                const hs = tournament.hole_scores.find(h => h.hole_number === holeNum);
                if (!hs) return <td key={holeNum} className="py-1.5 px-0 text-center text-muted-foreground/30 text-[11px]">·</td>;
                const pts = pointsFor(hs);
                return (
                  <td
                    key={holeNum}
                    className={`py-1.5 px-0 text-center tabular-nums text-[11px] font-display font-bold ${
                      pts >= 3 ? 'text-primary' : pts === 2 ? 'text-foreground' : pts === 1 ? 'text-foreground/70' : 'text-muted-foreground/50'
                    }`}
                  >
                    {pts}
                  </td>
                );
              })}
              <td className="py-1.5 px-1 text-center font-display font-extrabold text-primary text-xs tabular-nums">
                {(() => {
                  if (offset === 9) return total ?? '—';
                  const s = sumPoints(1, 9);
                  return s > 0 ? s : '—';
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      ))}
    </div>
  );
}

interface PlayerDetailContextType {
  openPlayer: (id: string, name: string, gender: string) => void;
}

const PlayerDetailContext = createContext<PlayerDetailContextType | null>(null);

export function usePlayerDetail() {
  const ctx = useContext(PlayerDetailContext);
  if (!ctx) throw new Error('usePlayerDetail must be used within PlayerDetailProvider');
  return ctx;
}

export function PlayerDetailProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [openRound, setOpenRound] = useState<number | null>(null);

  const openPlayer = useCallback(async (id: string, name: string, gender: string) => {
    setOpen(true);
    setLoading(true);
    setPlayer(null);
    setOpenRound(null);

    try {
      const [{ data: rankings }, { data: results }] = await Promise.all([
        supabase.from('rankings').select('category, position, total_points').eq('player_id', id),
        supabase.from('results').select('scratch_score, handicap_score, tournament_id, tournaments(name, round_number, date)').eq('player_id', id),
      ]);

      const tournamentIds = (results || []).map(r => r.tournament_id);

      if (tournamentIds.length > 0) {
        const [allHolesResult, { data: allTournamentResults }] = await Promise.all([
          (async () => {
            const allHoles: Array<{ tournament_id: string; hole_number: number; strokes: number; scratch_points: number | null; handicap_points: number | null }> = [];
            const pageSize = 1000;
            for (let from = 0; ; from += pageSize) {
              const { data } = await supabase
                .from('hole_scores')
                .select('tournament_id, hole_number, strokes, scratch_points, handicap_points')
                .eq('player_id', id)
                .in('tournament_id', tournamentIds)
                .order('hole_number', { ascending: true })
                .range(from, from + pageSize - 1);
              if (!data || data.length === 0) break;
              allHoles.push(...data as any);
              if (data.length < pageSize) break;
            }
            return allHoles;
          })(),
          supabase.from('results').select('player_id, scratch_score, handicap_score, tournament_id, players(gender)').in('tournament_id', tournamentIds),
        ]);

        const holeMap = new Map<string, HoleScore[]>();
        for (const h of allHolesResult) {
          if (!holeMap.has(h.tournament_id)) holeMap.set(h.tournament_id, []);
          holeMap.get(h.tournament_id)!.push({
            hole_number: h.hole_number,
            strokes: h.strokes,
            scratch_points: h.scratch_points ?? 0,
            handicap_points: h.handicap_points ?? 0,
          });
        }

        const positionsMap = new Map<string, { scratch: number; handicap: number }>();
        for (const tid of tournamentIds) {
          const tResults = (allTournamentResults || []).filter(r => r.tournament_id === tid && (r.players as any)?.gender === gender);
          // 2026 OM is Stableford: higher score = better → sort DESC.
          // Use dense ranking so tied scores share the same position.
          const rankDense = (arr: Array<{ player_id: string; score: number }>) => {
            const sorted = [...arr].sort((a, b) => b.score - a.score);
            const posByPlayer = new Map<string, number>();
            let lastScore: number | null = null;
            let lastRank = 0;
            sorted.forEach((r, idx) => {
              const rank = lastScore !== null && r.score === lastScore ? lastRank : idx + 1;
              posByPlayer.set(r.player_id, rank);
              lastScore = r.score;
              lastRank = rank;
            });
            return posByPlayer.get(id) ?? 0;
          };
          const scratchArr = tResults
            .filter(r => r.scratch_score !== null)
            .map(r => ({ player_id: r.player_id as string, score: r.scratch_score as number }));
          const handicapArr = tResults
            .filter(r => r.handicap_score !== null)
            .map(r => ({ player_id: r.player_id as string, score: r.handicap_score as number }));
          positionsMap.set(tid, {
            scratch: rankDense(scratchArr),
            handicap: rankDense(handicapArr),
          });
        }

        setPlayer({
          id, name, gender,
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
        setPlayer({
          id, name, gender,
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

  return (
    <PlayerDetailContext.Provider value={{ openPlayer }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Fitxa del Jugador
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {player && (
            <div className="space-y-4 mt-2">
              {/* Header */}
              <div className="bg-primary/5 border-2 border-primary/20 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    <User className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground">{player.name}</h3>
                    <p className="text-xs text-muted-foreground font-sans">
                      {player.tournaments.length} {player.tournaments.length === 1 ? 'prova disputada' : 'proves disputades'}
                    </p>
                  </div>
                </div>
                {player.rankings.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {player.rankings.map(r => (
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
              </div>

              {/* Average positions */}
              {player.tournaments.length > 0 && (() => {
                const scratchPositions = player.tournaments.filter(t => t.scratch_position && t.scratch_position > 0).map(t => t.scratch_position!);
                const handicapPositions = player.tournaments.filter(t => t.handicap_position && t.handicap_position > 0).map(t => t.handicap_position!);
                const avgScratchPos = scratchPositions.length > 0 ? (scratchPositions.reduce((a, b) => a + b, 0) / scratchPositions.length).toFixed(1) : null;
                const avgHandicapPos = handicapPositions.length > 0 ? (handicapPositions.reduce((a, b) => a + b, 0) / handicapPositions.length).toFixed(1) : null;
                if (!avgScratchPos && !avgHandicapPos) return null;
                return (
                  <div className="grid grid-cols-2 gap-2">
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

              {/* Stats */}
              {player.tournaments.length > 0 && (() => {
                const tournsWithHoles = player.tournaments.filter(t => t.hole_scores.length > 0);
                const n = tournsWithHoles.length;
                if (n === 0) return null;
                const scratchScores = player.tournaments.filter(t => t.scratch_score !== null).map(t => t.scratch_score!).sort((a, b) => b - a);
                const best8Scratch = scratchScores.slice(0, 8);
                const avgPoints = best8Scratch.length > 0 ? (best8Scratch.reduce((a, b) => a + b, 0) / best8Scratch.length).toFixed(1) : '—';
                let birdies = 0, pars = 0, bogeys = 0, doublePlus = 0;
                for (const t of tournsWithHoles) for (const h of t.hole_scores) {
                  if (!h.strokes || h.strokes <= 0) continue; // picked up
                  if (h.strokes <= 2) birdies++;
                  else if (h.strokes === 3) pars++;
                  else if (h.strokes === 4) bogeys++;
                  else doublePlus++;
                }
                const stats = [
                  { label: 'Mitj. punts', value: avgPoints, icon: '⭐' },
                  { label: 'Birdies/ronda', value: (birdies / n).toFixed(1), icon: '🐦' },
                  { label: 'Pars/ronda', value: (pars / n).toFixed(1), icon: '✅' },
                  { label: 'Bogeys/ronda', value: (bogeys / n).toFixed(1), icon: '📦' },
                  { label: '5+ cops/ronda', value: (doublePlus / n).toFixed(1), icon: '💥' },
                ];
                return (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <h4 className="font-display font-bold text-sm text-foreground mb-3">Estadístiques</h4>
                    <div className="grid grid-cols-5 gap-2">
                      {stats.map(s => (
                        <div key={s.label} className="text-center">
                          <div className="text-lg">{s.icon}</div>
                          <div className="font-display font-extrabold text-base text-primary tabular-nums">{s.value}</div>
                          <div className="text-[10px] font-sans text-muted-foreground leading-tight">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Tournaments */}
              {player.tournaments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-display font-bold text-sm text-foreground">Proves disputades</h4>
                  {player.tournaments.map((t) => (
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
                        <RoundScorecard tournament={t} />
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PlayerDetailContext.Provider>
  );
}

// Clickable player name component
export function ClickablePlayerName({ playerId, name, gender, className }: { playerId: string; name: string; gender: string; className?: string }) {
  const { openPlayer } = usePlayerDetail();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); openPlayer(playerId, name, gender); }}
      className={`hover:text-primary hover:underline underline-offset-2 transition-colors text-left cursor-pointer truncate max-w-full block ${className || ''}`}
    >
      {name}
    </button>
  );
}
