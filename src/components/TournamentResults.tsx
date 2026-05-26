import React, { useEffect, useState } from 'react';
import { ChevronDown, Trophy, Flag, CheckCircle, Calendar } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ClickablePlayerName } from './PlayerDetailContext';
import { ClickablePairName } from './PairDetailContext';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TournamentPostGenerator from './TournamentPostGenerator';
import TournamentImageGenerator from './TournamentImageGenerator';
import type { Mode } from './ModeToggle';

interface HoleScore {
  hole_number: number;
  strokes: number;
}

interface PairPlayerHoleScore {
  hole_number: number;
  points: number;
  player_name: string;
}

interface TournamentResult {
  player_name: string;
  player_gender: string;
  player_id: string;
  scratch_score: number | null;
  handicap_score: number | null;
  hole_scores: HoleScore[];
  photo_url: string | null;
  is_subscriber: boolean;
  is_senior: boolean;
}

interface PairTournamentResult {
  pair_name: string;
  pair_id: string;
  scratch_score: number | null;
  handicap_score: number | null;
  nhp_tiebreak: number;
  hole_scores: PairPlayerHoleScore[];
}

interface Tournament {
  id: string;
  name: string;
  round_number: number;
  date: string | null;
  results: TournamentResult[];
  pairResults: PairTournamentResult[];
}

type IndividualCategory = {
  value: string;
  label: string;
  shortLabel: string;
  scoreKey: 'scratch_score' | 'handicap_score';
  gender: 'male' | 'female' | 'any';
  seniorOnly?: boolean;
};

const INDIVIDUAL_CATEGORIES: IndividualCategory[] = [
  { value: 'handicap_male', label: 'Handicap Masculí', shortLabel: 'Hcp M', scoreKey: 'handicap_score', gender: 'male' },
  { value: 'handicap_female', label: 'Handicap Femení', shortLabel: 'Hcp F', scoreKey: 'handicap_score', gender: 'female' },
  { value: 'scratch_male', label: 'Scratch Masculí', shortLabel: 'Scr M', scoreKey: 'scratch_score', gender: 'male' },
  { value: 'scratch_female', label: 'Scratch Femení', shortLabel: 'Scr F', scoreKey: 'scratch_score', gender: 'female' },
  { value: 'handicap_senior', label: 'Hàndicap Sènior', shortLabel: 'Sènior', scoreKey: 'handicap_score', gender: 'any', seniorOnly: true },
];

const PAIR_CATEGORIES = [
  { value: 'scratch_pairs', label: 'Scratch Parelles', scoreKey: 'scratch_score' as const },
  { value: 'handicap_pairs', label: 'Handicap Parelles', scoreKey: 'handicap_score' as const },
];

function IndividualHoleScoreCell({ strokes }: { strokes: number }) {
  if (strokes === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-[11px] shadow-sm">{strokes}</span>;
  if (strokes === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-primary text-primary font-bold text-[11px]">{strokes}</span>;
  if (strokes === 3) return <span className="inline-flex items-center justify-center w-7 h-7 text-foreground font-semibold text-[11px]">{strokes}</span>;
  if (strokes === 4) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm border-2 border-foreground/40 bg-muted text-foreground font-bold text-[11px]">{strokes}</span>;
  return <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-destructive/10 text-destructive font-bold text-[11px]">{strokes}</span>;
}

function PairHoleScoreCell({ points }: { points: number }) {
  // points here represents strokes: 1=HiO, 2=Berdie, 3=Par, 4=Bogey, 0 or 5+=Doble+
  if (points === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-[11px] shadow-sm">{points}</span>;
  if (points === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-primary text-primary font-bold text-[11px]">{points}</span>;
  if (points === 3) return <span className="inline-flex items-center justify-center w-7 h-7 text-foreground font-semibold text-[11px]">{points}</span>;
  if (points === 4) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm border-2 border-foreground/40 bg-muted text-foreground font-bold text-[11px]">{points}</span>;
  return <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-destructive/10 text-destructive font-bold text-[11px]">{points >= 5 ? `${points}` : '0'}</span>;
}

function PositionBadge({ position }: { position: number }) {
  if (position === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[hsl(var(--gold))] font-display font-bold text-foreground text-xs shadow-sm">1</span>;
  if (position === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[hsl(var(--silver))] font-display font-bold text-primary-foreground text-xs">2</span>;
  if (position === 3) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[hsl(var(--bronze))] font-display font-bold text-primary-foreground text-xs">3</span>;
  return <span className="inline-flex items-center justify-center w-7 h-7 font-display font-bold text-muted-foreground text-xs tabular-nums">{position}</span>;
}

/* ── Individual mobile list ── */
function MobileResultsList({ filtered, cat }: { filtered: TournamentResult[]; cat: typeof INDIVIDUAL_CATEGORIES[number] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (filtered.length === 0) {
    return <div className="px-5 py-6 text-sm text-muted-foreground text-center font-sans">Sense resultats per aquesta categoria</div>;
  }

  return (
    <div>
      {filtered.map((r, i) => {
        const isTop3 = i < 3;
        const isOpen = expanded === r.player_id;
        const holeLookup = new Map(r.hole_scores.map(s => [s.hole_number, s]));
        return (
          <div key={r.player_id}>
            <button
              onClick={() => setExpanded(isOpen ? null : r.player_id)}
              className={`w-full flex items-center gap-2 py-3 px-3 border-b border-border/50 text-left transition-colors active:bg-muted/50 ${isTop3 ? 'bg-accent/10' : ''}`}
            >
              <PositionBadge position={i + 1} />
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <ClickablePlayerName playerId={r.player_id} name={r.player_name} gender={r.player_gender}
                  className={`font-sans text-sm truncate block ${isTop3 ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'} ${!r.is_subscriber ? 'italic text-foreground/60' : ''}`} />
                {!r.is_subscriber && (
                  <span title="No abonat — no compta per a l'Ordre del Mèrit" className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                )}
              </div>
              <span className={`tabular-nums font-display shrink-0 ${isTop3 ? 'font-extrabold text-primary text-base' : 'font-bold text-foreground text-sm'}`}>{r[cat.scoreKey]}</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden bg-muted/20 border-b border-border/50">
                  <div className="px-3 py-3">
                    <div className="text-[10px] font-display font-bold text-muted-foreground mb-1">Forats 1-9</div>
                    <div className="grid grid-cols-9 gap-1 mb-3">
                      {Array.from({ length: 9 }, (_, idx) => { const holeNum = idx + 1; const hs = holeLookup.get(holeNum); return (
                        <div key={holeNum} className="text-center">
                          <div className="text-[9px] font-bold text-muted-foreground mb-0.5">{holeNum}</div>
                          {hs ? <IndividualHoleScoreCell strokes={hs.strokes} /> : <span className="text-muted-foreground/30 text-xs">·</span>}
                        </div>
                      ); })}
                    </div>
                    <div className="text-[10px] font-display font-bold text-muted-foreground mb-1">Forats 10-18</div>
                    <div className="grid grid-cols-9 gap-1">
                      {Array.from({ length: 9 }, (_, idx) => { const holeNum = idx + 10; const hs = holeLookup.get(holeNum); return (
                        <div key={holeNum} className="text-center">
                          <div className="text-[9px] font-bold text-muted-foreground mb-0.5">{holeNum}</div>
                          {hs ? <IndividualHoleScoreCell strokes={hs.strokes} /> : <span className="text-muted-foreground/30 text-xs">·</span>}
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

/* ── Pair mobile list with per-player holes ── */
function MobilePairResultsList({ filtered, scoreKey }: { filtered: PairTournamentResult[]; scoreKey: 'scratch_score' | 'handicap_score' }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (filtered.length === 0) {
    return <div className="px-5 py-6 text-sm text-muted-foreground text-center font-sans">Sense resultats per aquesta categoria</div>;
  }

  return (
    <div>
      {filtered.map((r, i) => {
        const isTop3 = i < 3;
        const isOpen = expanded === r.pair_id;
        const playerNames = [...new Set(r.hole_scores.map(h => h.player_name).filter(Boolean))];
        return (
          <div key={r.pair_id}>
            <button
              onClick={() => setExpanded(isOpen ? null : r.pair_id)}
              className={`w-full flex items-center gap-2 py-3 px-3 border-b border-border/50 text-left transition-colors active:bg-muted/50 ${isTop3 ? 'bg-accent/10' : ''}`}
            >
              <PositionBadge position={i + 1} />
              <div className="flex-1 min-w-0">
                <ClickablePairName pairId={r.pair_id} name={r.pair_name}
                  className={`font-sans text-sm truncate block ${isTop3 ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`} />
              </div>
              <span className={`tabular-nums font-display shrink-0 ${isTop3 ? 'font-extrabold text-primary text-base' : 'font-bold text-foreground text-sm'}`}>{r[scoreKey]}</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden bg-muted/20 border-b border-border/50">
                  <div className="px-3 py-3">
                    {playerNames.map((playerName, pIdx) => {
                      const playerHoles = r.hole_scores.filter(h => h.player_name === playerName);
                      return (
                        <div key={pIdx} className={pIdx > 0 ? 'mt-3 pt-3 border-t border-border/50' : ''}>
                          <div className="text-[11px] font-sans font-semibold text-foreground mb-2">{playerName}</div>
                          <div className="text-[10px] font-display font-bold text-muted-foreground mb-1">Forats 1-9</div>
                          <div className="grid grid-cols-9 gap-1 mb-2">
                            {Array.from({ length: 9 }, (_, idx) => {
                              const holeNum = idx + 1;
                              const hs = playerHoles.find(h => h.hole_number === holeNum);
                              return (
                                <div key={holeNum} className="text-center">
                                  <div className="text-[9px] font-bold text-muted-foreground mb-0.5">{holeNum}</div>
                                  {hs ? <PairHoleScoreCell points={hs.points} /> : <span className="text-muted-foreground/30 text-xs">·</span>}
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-[10px] font-display font-bold text-muted-foreground mb-1">Forats 10-18</div>
                          <div className="grid grid-cols-9 gap-1">
                            {Array.from({ length: 9 }, (_, idx) => {
                              const holeNum = idx + 10;
                              const hs = playerHoles.find(h => h.hole_number === holeNum);
                              return (
                                <div key={holeNum} className="text-center">
                                  <div className="text-[9px] font-bold text-muted-foreground mb-0.5">{holeNum}</div>
                                  {hs ? <PairHoleScoreCell points={hs.points} /> : <span className="text-muted-foreground/30 text-xs">·</span>}
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-right text-xs font-display font-bold text-primary mt-1">
                            Total: {playerHoles.reduce((a, h) => a + h.points, 0)}
                          </div>
                        </div>
                      );
                    })}
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

export default function TournamentResults({ showAdminTools = false, mode = 'individual' as Mode }: { showAdminTools?: boolean; mode?: Mode }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tournamentCategory, setTournamentCategory] = useState<Record<string, string>>({});
  const [pairCategory, setPairCategory] = useState('scratch_pairs');

  useEffect(() => {
    fetchTournaments();
  }, []);

  async function fetchTournaments() {
    setLoading(true);
    try {
      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('id, name, round_number, date')
        .order('round_number', { ascending: true });

      if (tournamentsError) throw tournamentsError;
      if (!tournamentsData || tournamentsData.length === 0) { setLoading(false); return; }

      const tournamentIds = tournamentsData.map(t => t.id);

      const [{ data: resultsData, error: resultsError }, holeData, { data: pairResultsData, error: pairResultsError }, pairHoleData, { data: pairsData, error: pairsError }] = await Promise.all([
        supabase.from('results').select('tournament_id, player_id, scratch_score, handicap_score').in('tournament_id', tournamentIds),
        (async () => {
          const allHoleRows: Array<{ tournament_id: string; player_id: string; hole_number: number; strokes: number }> = [];
          const pageSize = 1000;
          for (let from = 0; ; from += pageSize) {
            const { data, error } = await supabase.from('hole_scores').select('tournament_id, player_id, hole_number, strokes').in('tournament_id', tournamentIds).order('tournament_id').order('player_id').order('hole_number').range(from, from + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allHoleRows.push(...data);
            if (data.length < pageSize) break;
          }
          return allHoleRows;
        })(),
        supabase.from('pair_results').select('tournament_id, pair_id, scratch_score, handicap_score, points').in('tournament_id', tournamentIds),
        (async () => {
          const allRows: Array<{ tournament_id: string; pair_id: string; hole_number: number; points: number; player_name: string | null }> = [];
          const pageSize = 1000;
          for (let from = 0; ; from += pageSize) {
            const { data, error } = await supabase.from('pair_hole_scores').select('tournament_id, pair_id, hole_number, points, player_name').in('tournament_id', tournamentIds).order('tournament_id').order('pair_id').order('hole_number').range(from, from + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allRows.push(...data);
            if (data.length < pageSize) break;
          }
          return allRows;
        })(),
        supabase.from('pairs').select('id, name'),
      ]);

      const playerIdsAll = [...new Set((resultsData || []).map((r: any) => r.player_id).filter(Boolean))];
      const { data: playersInfo } = playerIdsAll.length
        ? await supabase.from('players_public').select('id, name, gender, photo_url, is_subscriber, is_senior').in('id', playerIdsAll)
        : { data: [] as any[] };
      const playerInfoById = new Map((playersInfo || []).map((p: any) => [p.id, p]));

      if (resultsError) throw resultsError;
      if (pairResultsError) throw pairResultsError;
      if (pairsError) throw pairsError;

      const holeMap = new Map<string, HoleScore[]>();
      for (const h of holeData || []) {
        const key = `${h.tournament_id}:${h.player_id}`;
        if (!holeMap.has(key)) holeMap.set(key, []);
        holeMap.get(key)!.push({ hole_number: h.hole_number, strokes: h.strokes });
      }

      const pairHoleMap = new Map<string, PairPlayerHoleScore[]>();
      for (const h of pairHoleData || []) {
        const key = `${h.tournament_id}:${h.pair_id}`;
        if (!pairHoleMap.has(key)) pairHoleMap.set(key, []);
        pairHoleMap.get(key)!.push({ hole_number: h.hole_number, points: h.points, player_name: h.player_name || '' });
      }

      const pairNameById = new Map((pairsData || []).map((p) => [p.id, p.name]));

      const mapped: Tournament[] = tournamentsData.map(t => ({
        ...t,
        results: (resultsData || []).filter(r => r.tournament_id === t.id).map(r => {
          const p = playerInfoById.get(r.player_id) as any;
          return {
            player_name: p?.name || 'Desconegut',
            player_gender: p?.gender || 'M',
            player_id: r.player_id,
            scratch_score: r.scratch_score,
            handicap_score: r.handicap_score,
            hole_scores: holeMap.get(`${t.id}:${r.player_id}`) || [],
            photo_url: p?.photo_url || null,
            is_subscriber: p?.is_subscriber === true,
            is_senior: p?.is_senior === true,
          };
        }),
        pairResults: (pairResultsData || []).filter(r => r.tournament_id === t.id).map(r => ({
          pair_name: pairNameById.get(r.pair_id) || 'Desconegut',
          pair_id: r.pair_id,
          scratch_score: r.scratch_score,
          handicap_score: r.handicap_score,
          nhp_tiebreak: r.points ?? 0,
          hole_scores: pairHoleMap.get(`${t.id}:${r.pair_id}`) || [],
        })),
      }));

      setTournaments(mapped);
    } catch {
      // ok
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (tournaments.length === 0) {
    return <p className="text-sm text-muted-foreground font-sans text-center py-8">Encara no hi ha proves registrades.</p>;
  }

  const isIndividual = mode === 'individual';
  const pCat = !isIndividual ? PAIR_CATEGORIES.find(c => c.value === pairCategory)! : null;

  const individualLegend = (
    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
      <span className="text-[10px] font-sans text-muted-foreground flex items-center gap-1">
        <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary text-primary-foreground font-bold text-[8px] sm:text-[9px]">1</span> <span className="hidden sm:inline">Hole-in-one</span><span className="sm:hidden">HiO</span>
      </span>
      <span className="text-[10px] font-sans text-muted-foreground flex items-center gap-1">
        <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-primary text-primary font-bold text-[8px] sm:text-[9px]">2</span> <span className="hidden sm:inline">Birdie</span><span className="sm:hidden">Bir</span>
      </span>
      <span className="text-[10px] font-sans text-muted-foreground flex items-center gap-1">
        <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 text-foreground font-semibold text-[8px] sm:text-[9px]">3</span> Par
      </span>
      <span className="text-[10px] font-sans text-muted-foreground flex items-center gap-1">
        <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-sm border-2 border-foreground/40 bg-muted text-foreground font-bold text-[8px] sm:text-[9px]">4</span> <span className="hidden sm:inline">Bogey</span><span className="sm:hidden">Bog</span>
      </span>
      <span className="text-[10px] font-sans text-muted-foreground flex items-center gap-1">
        <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-sm bg-destructive/10 text-destructive font-bold text-[8px] sm:text-[9px]">5+</span> Doble+
      </span>
      <span className="text-[10px] font-sans text-muted-foreground/70 flex items-center gap-1 italic">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/40" /> No abonat
      </span>
    </div>
  );

  const pairLegend = (
    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
      <span className="text-[10px] font-sans text-muted-foreground flex items-center gap-1">
        <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary text-primary-foreground font-bold text-[8px] sm:text-[9px]">1</span> Hole in one
      </span>
      <span className="text-[10px] font-sans text-muted-foreground flex items-center gap-1">
        <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-primary text-primary font-bold text-[8px] sm:text-[9px]">2</span> Berdie
      </span>
      <span className="text-[10px] font-sans text-muted-foreground flex items-center gap-1">
        <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 text-foreground font-semibold text-[8px] sm:text-[9px]">3</span> Par
      </span>
      <span className="text-[10px] font-sans text-muted-foreground flex items-center gap-1">
        <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-sm border-2 border-foreground/40 bg-muted text-foreground font-bold text-[8px] sm:text-[9px]">4</span> Bogey
      </span>
      <span className="text-[10px] font-sans text-muted-foreground flex items-center gap-1">
        <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-sm bg-destructive/10 text-destructive font-bold text-[8px] sm:text-[9px]">5+</span> Doble o +
      </span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Pair category selector (pairs mode only) */}
      {!isIndividual && (
        <div className="flex items-center gap-3">
          <Flag className="w-4 h-4 text-primary" />
          <Select value={pairCategory} onValueChange={setPairCategory}>
            <SelectTrigger className="w-60 border-primary/30 bg-card font-sans font-medium"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAIR_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tournament list */}
      <div className="space-y-3">
        {tournaments.map((t) => {
          const category = tournamentCategory[t.id] || 'handicap_male';
          const cat = isIndividual ? INDIVIDUAL_CATEGORIES.find(c => c.value === category)! : null;

          let filtered: TournamentResult[] = [];
          let pairFiltered: PairTournamentResult[] = [];

          if (isIndividual && cat) {
            filtered = t.results
              .filter(r => {
                if (r[cat.scoreKey] === null) return false;
                if (cat.seniorOnly) return r.is_senior;
                return r.player_gender === cat.gender;
              })
              .sort((a, b) => (b[cat.scoreKey] ?? -1) - (a[cat.scoreKey] ?? -1));
          } else if (pCat) {
            pairFiltered = t.pairResults
              .filter(r => r[pCat.scoreKey] !== null)
              .sort((a, b) => {
                const scoreDiff = (b[pCat.scoreKey] ?? 0) - (a[pCat.scoreKey] ?? 0);
                if (scoreDiff !== 0) return scoreDiff;
                return pCat.value === 'scratch_pairs'
                  ? b.nhp_tiebreak - a.nhp_tiebreak
                  : a.nhp_tiebreak - b.nhp_tiebreak;
              });
          }

          // Use total results (any category) to decide if tournament is disputed
          const hasResults = isIndividual ? t.results.length > 0 : t.pairResults.length > 0;
          const resultCount = isIndividual ? filtered.length : pairFiltered.length;
          const isOpen = openId === t.id;
          const isUpcoming = !hasResults && t.date && new Date(t.date) > new Date();
          const isPast = !hasResults && !isUpcoming;

          return (
            <Collapsible key={t.id} open={isOpen} onOpenChange={(open) => hasResults ? setOpenId(open ? t.id : null) : null}>
              <CollapsibleTrigger className={`w-full flex items-center justify-between rounded-xl px-5 py-4 transition-all group border-2 ${
                isOpen ? 'bg-primary/5 border-primary shadow-md'
                : hasResults ? 'bg-card border-border hover:border-primary/40 hover:shadow-sm cursor-pointer'
                : isUpcoming ? 'bg-card border-dashed border-border/60 opacity-60 cursor-default'
                : 'bg-muted/30 border-border/40 opacity-50 cursor-default'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg font-display font-extrabold text-sm ${
                    isOpen ? 'bg-primary text-primary-foreground' : hasResults ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground'
                  }`}>P{t.round_number}</div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-sans font-semibold text-sm text-foreground">{t.name}</span>
                      {hasResults && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-sans font-semibold">
                          <CheckCircle className="w-3 h-3" /> Disputada
                        </span>
                      )}
                      {isUpcoming && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-muted-foreground text-[10px] font-sans font-semibold">
                          <Calendar className="w-3 h-3" /> Pendent
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {t.date && <span className="text-sm font-sans text-muted-foreground">{new Date(t.date).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                      {hasResults && (
                        <span className="text-xs text-muted-foreground/70 font-sans">
                          · {resultCount} {isIndividual ? 'jugadors' : 'parelles'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {hasResults && <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : 'text-muted-foreground'}`} />}
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="mt-1 rounded-b-xl border-2 border-t-0 border-primary/20 bg-card overflow-hidden">
                  {/* Legend + admin tools */}
                  <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 bg-accent/30 border-b border-border">
                    {isIndividual ? individualLegend : pairLegend}
                    {showAdminTools && hasResults && (
                      <div className="flex items-center gap-2">
                        {isIndividual ? (
                          <>
                            <TournamentPostGenerator tournamentName={t.name} tournamentDate={t.date} roundNumber={t.round_number} results={t.results} />
                            <TournamentImageGenerator tournamentName={t.name} tournamentDate={t.date} roundNumber={t.round_number} results={t.results} category={category} />
                          </>
                        ) : (
                          <>
                            <TournamentPostGenerator
                              tournamentName={t.name}
                              tournamentDate={t.date}
                              roundNumber={t.round_number}
                              results={t.pairResults.map(pr => ({
                                player_name: pr.pair_name,
                                player_gender: 'mixed',
                                player_id: pr.pair_id,
                                scratch_score: pr.scratch_score,
                                handicap_score: pr.handicap_score,
                                hole_scores: pr.hole_scores.map(h => ({ hole_number: h.hole_number, strokes: h.points })),
                              }))}
                            />
                            <TournamentImageGenerator
                              tournamentName={t.name}
                              tournamentDate={t.date}
                              roundNumber={t.round_number}
                              results={t.pairResults.map(pr => ({
                                player_name: pr.pair_name,
                                player_gender: 'mixed',
                                player_id: pr.pair_id,
                                scratch_score: pr.scratch_score,
                                handicap_score: pr.handicap_score,
                                hole_scores: pr.hole_scores.map(h => ({ hole_number: h.hole_number, strokes: h.points })),
                                photo_url: null,
                                pair_hole_scores: pr.hole_scores.map(h => ({ hole_number: h.hole_number, strokes: h.points, player_name: h.player_name })),
                              }))}
                              category={pairCategory}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {isIndividual && cat ? (
                    <>
                      <div className="block lg:hidden">
                        <MobileResultsList filtered={filtered} cat={cat} />
                      </div>
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full min-w-[780px] text-xs border-collapse">
                          <thead>
                            <tr className="bg-primary/5">
                              <th className="py-2.5 px-2 text-center font-display font-bold text-primary text-[11px] w-9 sticky left-0 bg-primary/5">#</th>
                              <th className="py-2.5 px-3 text-left font-display font-bold text-primary text-[11px] min-w-[130px] sticky left-9 bg-primary/5">Jugador</th>
                              {Array.from({ length: 18 }, (_, i) => i + 1).map(h => (
                                <th key={h} className="py-2.5 px-0 text-center font-bold text-[11px] w-7 text-foreground/70">{h}</th>
                              ))}
                              <th className="py-2.5 px-3 text-center font-display font-extrabold text-primary text-xs w-12">Tot</th>
                            </tr>
                            <tr className="h-0"><td colSpan={2} /><td colSpan={9} className="border-b-2 border-primary/20" /><td colSpan={9} className="border-b-2 border-primary/20" /><td /></tr>
                          </thead>
                          <tbody>
                            {filtered.map((r, i) => {
                              const holeLookup = new Map(r.hole_scores.map(score => [score.hole_number, score]));
                              const isTop3 = i < 3;
                              return (
                                <tr key={`r-${i}`} className={`border-b border-border/50 transition-colors hover:bg-accent/20 ${isTop3 ? 'bg-accent/10' : ''}`}>
                                  <td className="py-2 px-1 text-center sticky left-0 bg-card"><PositionBadge position={i + 1} /></td>
                                  <td className={`py-2 px-3 text-left font-sans truncate max-w-[160px] sticky left-9 bg-card ${isTop3 ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'} ${!r.is_subscriber ? 'italic' : ''}`}>
                                    <span className="inline-flex items-center gap-1.5">
                                      <ClickablePlayerName playerId={r.player_id} name={r.player_name} gender={r.player_gender} className={!r.is_subscriber ? 'text-foreground/60' : ''} />
                                      {!r.is_subscriber && <span title="No abonat — no compta per a l'Ordre del Mèrit" className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />}
                                    </span>
                                  </td>
                                  {Array.from({ length: 18 }, (_, idx) => idx + 1).map(holeNum => {
                                    const hs = holeLookup.get(holeNum);
                                    return <td key={holeNum} className="py-1.5 px-0 text-center">{hs ? <IndividualHoleScoreCell strokes={hs.strokes} /> : <span className="text-muted-foreground/30">·</span>}</td>;
                                  })}
                                  <td className={`py-2 px-3 text-center tabular-nums font-display ${isTop3 ? 'font-extrabold text-primary text-sm' : 'font-bold text-foreground text-sm'}`}>{r[cat.scoreKey]}</td>
                                </tr>
                              );
                            })}
                            {filtered.length === 0 && <tr><td colSpan={21} className="px-5 py-6 text-sm text-muted-foreground text-center font-sans">Sense resultats per aquesta categoria</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : pCat && (
                    <>
                      <div className="block lg:hidden">
                        <MobilePairResultsList filtered={pairFiltered} scoreKey={pCat.scoreKey} />
                      </div>
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full min-w-[780px] text-xs border-collapse">
                          <thead>
                            <tr className="bg-primary/5">
                              <th className="py-2.5 px-2 text-center font-display font-bold text-primary text-[11px] w-9 sticky left-0 bg-primary/5">#</th>
                              <th className="py-2.5 px-3 text-left font-display font-bold text-primary text-[11px] min-w-[160px] sticky left-9 bg-primary/5">Parella / Jugador</th>
                              {Array.from({ length: 18 }, (_, i) => i + 1).map(h => (
                                <th key={h} className="py-2.5 px-0 text-center font-bold text-[11px] w-7 text-foreground/70">{h}</th>
                              ))}
                              <th className="py-2.5 px-3 text-center font-display font-extrabold text-primary text-xs w-12">Tot</th>
                            </tr>
                            <tr className="h-0"><td colSpan={2} /><td colSpan={9} className="border-b-2 border-primary/20" /><td colSpan={9} className="border-b-2 border-primary/20" /><td /></tr>
                          </thead>
                          <tbody>
                            {pairFiltered.map((r, i) => {
                              const isTop3 = i < 3;
                              const playerNames = [...new Set(r.hole_scores.map(h => h.player_name).filter(Boolean))];
                              return (
                                <React.Fragment key={`p-${i}`}>
                                  {/* Pair header row */}
                                  <tr className={`border-b border-border/30 ${isTop3 ? 'bg-accent/10' : ''}`}>
                                    <td className="py-2 px-1 text-center sticky left-0 bg-card" rowSpan={playerNames.length + 1}><PositionBadge position={i + 1} /></td>
                                    <td className={`py-2 px-3 text-left font-sans truncate max-w-[200px] sticky left-9 bg-card ${isTop3 ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                                      <ClickablePairName pairId={r.pair_id} name={r.pair_name} />
                                    </td>
                                    <td colSpan={18}></td>
                                    <td className={`py-2 px-3 text-center tabular-nums font-display ${isTop3 ? 'font-extrabold text-primary text-sm' : 'font-bold text-foreground text-sm'}`}>{r[pCat.scoreKey]}</td>
                                  </tr>
                                  {/* Per-player rows */}
                                  {playerNames.map((playerName, pIdx) => {
                                    const playerHoles = r.hole_scores.filter(h => h.player_name === playerName);
                                    return (
                                      <tr key={`p-${i}-${pIdx}`} className={`border-b border-border/50 ${pIdx === playerNames.length - 1 ? 'border-b-2 border-border' : ''}`}>
                                        <td className="py-1 px-3 text-left font-sans text-[10px] text-muted-foreground truncate max-w-[160px] sticky left-9 bg-card pl-5">
                                          ↳ {playerName}
                                        </td>
                                        {Array.from({ length: 18 }, (_, idx) => idx + 1).map(holeNum => {
                                          const hs = playerHoles.find(h => h.hole_number === holeNum);
                                          return <td key={holeNum} className="py-1 px-0 text-center">{hs ? <PairHoleScoreCell points={hs.points} /> : <span className="text-muted-foreground/30">·</span>}</td>;
                                        })}
                                        <td className="py-1 px-3 text-center tabular-nums font-display font-bold text-foreground/70 text-[11px]">
                                          {playerHoles.reduce((a, h) => a + h.points, 0)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                            {pairFiltered.length === 0 && <tr><td colSpan={21} className="px-5 py-6 text-sm text-muted-foreground text-center font-sans">Sense resultats per aquesta categoria</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
