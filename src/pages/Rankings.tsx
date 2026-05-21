import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import CategoryTabs from '@/components/CategoryTabs';
import type { RankingEntry } from '@/components/RankingTable';
import { supabase } from '@/integrations/supabase/client';
import { RANKING_RULES } from '@/config/rankingRules';

export default function Rankings() {
  const [rankings, setRankings] = useState<Record<string, RankingEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [tournamentDates, setTournamentDates] = useState<(string | null)[]>([]);
  const [tournamentNames, setTournamentNames] = useState<(string | null)[]>([]);

  useEffect(() => {
    fetchRankings();
  }, []);

  async function fetchRankings() {
    setLoading(true);
    try {
      const [rankingsRes, tournamentsRes] = await Promise.all([
        supabase
          .from('rankings')
          .select('position, total_points, category, player_id')
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
      const [resultsRes, playersRes] = await Promise.all([
        playerIds.length > 0
          ? supabase
              .from('results')
              .select('player_id, scratch_score, handicap_score, tournament_id, tournaments(round_number)')
              .in('player_id', playerIds)
          : Promise.resolve({ data: [] as any[] }),
        playerIds.length > 0
          ? supabase.from('players_public').select('id, name').in('id', playerIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const results = resultsRes.data;
      const playerNames = new Map<string, string>();
      for (const p of playersRes.data || []) playerNames.set(p.id, p.name);

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
          name: playerNames.get(row.player_id) || 'Desconegut',
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
          </div>
          <CategoryTabs rankings={rankings} loading={loading} tournamentDates={tournamentDates} tournamentNames={tournamentNames} mode="individual" />
        </div>
      </section>
    </div>
  );
}
