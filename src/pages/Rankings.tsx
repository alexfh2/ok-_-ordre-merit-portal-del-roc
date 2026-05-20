import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import CategoryTabs from '@/components/CategoryTabs';
import ModeToggle, { type Mode } from '@/components/ModeToggle';
import type { RankingEntry } from '@/components/RankingTable';
import { supabase } from '@/integrations/supabase/client';
import { RANKING_RULES } from '@/config/rankingRules';

export default function Rankings() {
  const [mode, setMode] = useState<Mode>('individual');
  const [rankings, setRankings] = useState<Record<string, RankingEntry[]>>({});
  const [pairRankings, setPairRankings] = useState<Record<string, RankingEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [pairLoading, setPairLoading] = useState(false);
  const [tournamentDates, setTournamentDates] = useState<(string | null)[]>([]);
  const [tournamentNames, setTournamentNames] = useState<(string | null)[]>([]);

  useEffect(() => {
    fetchRankings();
    fetchPairRankings();
  }, []);

  async function fetchRankings() {
    setLoading(true);
    try {
      const [rankingsRes, tournamentsRes] = await Promise.all([
        supabase
          .from('rankings')
          .select('position, total_points, category, player_id, players(name)')
          .order('position', { ascending: true })
          .lte('position', 50),
        supabase
          .from('tournaments')
          .select('round_number, date, name')
          .order('round_number', { ascending: true }),
      ]);

      const data = rankingsRes.data;
      if (rankingsRes.error) throw rankingsRes.error;

      const dates: (string | null)[] = Array.from({ length: RANKING_RULES.totalRounds }, () => null);
      const names: (string | null)[] = Array.from({ length: RANKING_RULES.totalRounds }, () => null);
      for (const t of tournamentsRes.data || []) {
        if (t.round_number >= 1 && t.round_number <= RANKING_RULES.totalRounds) {
          dates[t.round_number - 1] = t.date;
          names[t.round_number - 1] = (t as any).name ?? null;
        }
      }
      setTournamentDates(dates);
      setTournamentNames(names);

      const playerIds = [...new Set((data || []).map(r => r.player_id))];
      const { data: results } = playerIds.length > 0
        ? await supabase
            .from('results')
            .select('player_id, scratch_score, handicap_score, tournament_id, tournaments(round_number)')
            .in('player_id', playerIds)
        : { data: [] };

      const playerRounds = new Map<string, Map<number, { scratch: number | null; handicap: number | null }>>();
      for (const r of results || []) {
        const roundNum = (r.tournaments as any)?.round_number;
        if (!roundNum) continue;
        if (!playerRounds.has(r.player_id)) playerRounds.set(r.player_id, new Map());
        playerRounds.get(r.player_id)!.set(roundNum, {
          scratch: r.scratch_score,
          handicap: r.handicap_score,
        });
      }

      const grouped: Record<string, RankingEntry[]> = {};
      for (const row of data || []) {
        const cat = row.category;
        if (!grouped[cat]) grouped[cat] = [];
        const isScratch = cat.startsWith('scratch');
        const rounds: (number | null)[] = [];
        const scores: { value: number; index: number }[] = [];

        for (let i = 0; i < 10; i++) {
          const roundData = playerRounds.get(row.player_id)?.get(i + 1);
          const score = roundData ? (isScratch ? roundData.scratch : roundData.handicap) : null;
          rounds.push(score);
          if (score !== null) scores.push({ value: score, index: i });
        }

        const discarded: number[] = [];
        if (scores.length > 8) {
          const sorted = [...scores].sort((a, b) => a.value - b.value);
          const discardedScores = sorted.slice(8);
          for (const d of discardedScores) discarded.push(d.index);
        }

        grouped[cat].push({
          position: row.position,
          total_points: row.total_points,
          name: (row.players as any)?.name || 'Desconegut',
          player_id: row.player_id,
          rounds,
          discarded,
        });
      }
      setRankings(grouped);
    } catch {
      // ok
    } finally {
      setLoading(false);
    }
  }

  async function fetchPairRankings() {
    setPairLoading(true);
    try {
      const [pairRankingsRes, pairsRes, tournamentsRes] = await Promise.all([
        supabase
          .from('pair_rankings')
          .select('position, total_points, category, pair_id')
          .order('position', { ascending: true })
          .lte('position', 50),
        supabase
          .from('pairs')
          .select('id, name'),
        supabase
          .from('tournaments')
          .select('id, round_number'),
      ]);

      if (pairRankingsRes.error) throw pairRankingsRes.error;
      if (pairsRes.error) throw pairsRes.error;
      if (tournamentsRes.error) throw tournamentsRes.error;

      const data = pairRankingsRes.data || [];
      const pairNameById = new Map((pairsRes.data || []).map((p) => [p.id, p.name]));
      const roundByTournamentId = new Map((tournamentsRes.data || []).map((t) => [t.id, t.round_number]));

      const pairIds = [...new Set(data.map(r => r.pair_id))];
      let results: Array<{ pair_id: string; scratch_score: number | null; handicap_score: number | null; tournament_id: string }> = [];
      if (pairIds.length > 0) {
        const { data: resultsData, error: resultsError } = await supabase
          .from('pair_results')
          .select('pair_id, scratch_score, handicap_score, tournament_id')
          .in('pair_id', pairIds);
        if (resultsError) throw resultsError;
        results = resultsData || [];
      }

      const pairRounds = new Map<string, Map<number, { scratch: number | null; handicap: number | null }>>();
      for (const r of results || []) {
        const roundNum = roundByTournamentId.get(r.tournament_id);
        if (!roundNum) continue;
        if (!pairRounds.has(r.pair_id)) pairRounds.set(r.pair_id, new Map());
        pairRounds.get(r.pair_id)!.set(roundNum, {
          scratch: r.scratch_score,
          handicap: r.handicap_score,
        });
      }

      const grouped: Record<string, RankingEntry[]> = {};
      for (const row of data || []) {
        const cat = row.category;
        if (!grouped[cat]) grouped[cat] = [];
        const isScratch = cat.startsWith('scratch');
        const rounds: (number | null)[] = [];
        const scores: { value: number; index: number }[] = [];

        for (let i = 0; i < 10; i++) {
          const roundData = pairRounds.get(row.pair_id)?.get(i + 1);
          const score = roundData ? (isScratch ? roundData.scratch : roundData.handicap) : null;
          rounds.push(score);
          if (score !== null) scores.push({ value: score, index: i });
        }

        const discarded: number[] = [];
        if (scores.length > 8) {
          const sorted = [...scores].sort((a, b) => a.value - b.value);
          const discardedScores = sorted.slice(8);
          for (const d of discardedScores) discarded.push(d.index);
        }

        grouped[cat].push({
          position: row.position,
          total_points: row.total_points,
          name: pairNameById.get(row.pair_id) || 'Desconegut',
          player_id: row.pair_id,
          rounds,
          discarded,
        });
      }
      setPairRankings(grouped);
    } catch {
      // ok
    } finally {
      setPairLoading(false);
    }
  }

  const currentRankings = mode === 'pairs' ? pairRankings : rankings;
  const currentLoading = mode === 'pairs' ? pairLoading : loading;

  return (
    <div className="min-h-screen bg-background">
      <Navbar showSearch />

      <section className="py-8 sm:py-12">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground mb-1">
                {RANKING_RULES.competition} {RANKING_RULES.season}
              </h1>
              <p className="text-sm text-muted-foreground font-sans">
                Millors {RANKING_RULES.countingRounds} de {RANKING_RULES.totalRounds} proves O.M. · Top 50
              </p>
            </div>
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
          <CategoryTabs rankings={currentRankings} loading={currentLoading} tournamentDates={tournamentDates} tournamentNames={tournamentNames} mode={mode} />
        </div>
      </section>
    </div>
  );
}
