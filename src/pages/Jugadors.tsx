import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Search, ArrowUpDown, TrendingUp, TrendingDown, Minus, Trophy, Target, Flame, BarChart3, Users, GitCompare } from 'lucide-react';
import { usePlayerDetail } from '@/components/PlayerDetailContext';

// ─── Helpers ────────────────────────────────────────────────────────

function formatHandicap(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'No federat';
  const abs = Math.abs(value);
  const formatted = abs.toFixed(1);
  if (value > 0) return `Hdcp +${formatted}`;
  if (value === 0) return 'Hdcp 0.0';
  return `Hdcp ${formatted}`;
}

function handicapSortValue(h: number | null | undefined): number {
  if (h === null || h === undefined) return 9999; // No federat → always last
  return -h; // Best (highest positive) first
}

interface PlayerData {
  id: string;
  name: string;
  gender: string;
  license_number: string | null;
  photo_url: string | null;
  handicap_actual: number | null;
  handicap_updated_at: string | null;
  rankings: { category: string; position: number; total_points: number }[];
  results: { tournament_id: string; scratch_score: number | null; points: number; round_number: number }[];
  avgStrokes: number | null;
  bestResult: number | null;
  tournamentCount: number;
  trend: 'improving' | 'declining' | 'stable';
  consistency: number; // lower = more consistent
  winProbability: number;
}

// ─── Component ──────────────────────────────────────────────────────

export default function Jugadors() {
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingAll, setUpdatingAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [handicapFilter, setHandicapFilter] = useState('all');
  const [rankingFilter, setRankingFilter] = useState('all');
  const [trendFilter, setTrendFilter] = useState('all');
  const [sortBy, setSortBy] = useState('ranking_scratch');
  const [comparatorOpen, setComparatorOpen] = useState(false);
  const [playerA, setPlayerA] = useState<string | null>(null);
  const [playerB, setPlayerB] = useState<string | null>(null);
  const { openPlayer } = usePlayerDetail();

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const [playersRes, rankingsRes, resultsRes, tournamentsRes] = await Promise.all([
        // NOTE: explicit columns — birth_date / subscriber_updated_at are restricted to authenticated.
        supabase.from('players').select('id, name, gender, license_number, photo_url, handicap_actual, handicap_updated_at, is_subscriber, created_at'),
        supabase.from('rankings').select('player_id, category, position, total_points'),
        supabase.from('results').select('player_id, tournament_id, scratch_score, points'),
        supabase.from('tournaments').select('id, round_number').order('round_number', { ascending: true }),
      ]);

      const tournamentMap = new Map<string, number>();
      (tournamentsRes.data || []).forEach(t => tournamentMap.set(t.id, t.round_number));

      const playersData = (playersRes.data || []).map(p => {
        const playerRankings = (rankingsRes.data || []).filter(r => r.player_id === p.id);
        const playerResults = (resultsRes.data || [])
          .filter(r => r.player_id === p.id)
          .map(r => ({ ...r, round_number: tournamentMap.get(r.tournament_id) || 0 }))
          .sort((a, b) => a.round_number - b.round_number);

        const scratchScores = playerResults
          .filter(r => r.scratch_score !== null)
          .map(r => r.scratch_score!);

        const avgStrokes = scratchScores.length > 0
          ? scratchScores.reduce((a, b) => a + b, 0) / scratchScores.length
          : null;

        const bestResult = scratchScores.length > 0 ? Math.min(...scratchScores) : null;

        // Trend: compare last 3 vs previous 3
        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        if (scratchScores.length >= 4) {
          const recent = scratchScores.slice(-3);
          const previous = scratchScores.slice(-6, -3);
          if (previous.length > 0) {
            const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
            const prevAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
            const diff = prevAvg - recentAvg; // lower strokes = better
            if (diff > 1) trend = 'improving';
            else if (diff < -1) trend = 'declining';
          }
        }

        // Consistency (std deviation of scores)
        let consistency = 999;
        if (scratchScores.length >= 2) {
          const mean = scratchScores.reduce((a, b) => a + b, 0) / scratchScores.length;
          const variance = scratchScores.reduce((a, b) => a + (b - mean) ** 2, 0) / scratchScores.length;
          consistency = Math.sqrt(variance);
        }

        // Win probability (simplified model)
        let winProbability = 0;
        const handicap = p.handicap_actual;
        if (scratchScores.length > 0) {
          const handicapScore = handicap !== null ? Math.max(0, 20 - Math.abs(handicap)) * 2 : 0; // 40% weight
          const recentScores = scratchScores.slice(-3);
          const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
          const recentScore = Math.max(0, (60 - recentAvg) * 1.5); // 30% weight, lower strokes = better
          const regularityScore = Math.max(0, (10 - consistency) * 2); // 20% weight
          const trendScore = trend === 'improving' ? 10 : trend === 'declining' ? 0 : 5; // 10% weight
          
          winProbability = Math.min(99, Math.max(1, Math.round(
            handicapScore * 0.4 + recentScore * 0.3 + regularityScore * 0.2 + trendScore * 0.1
          )));
        }

        return {
          id: p.id,
          name: p.name,
          gender: p.gender,
          license_number: p.license_number,
          photo_url: p.photo_url,
          handicap_actual: p.handicap_actual,
          handicap_updated_at: p.handicap_updated_at,
          rankings: playerRankings,
          results: playerResults,
          avgStrokes,
          bestResult,
          tournamentCount: playerResults.length,
          trend,
          consistency,
          winProbability,
        } as PlayerData;
      });

      setPlayers(playersData);
    } catch (err) {
      console.error(err);
      toast.error('Error carregant jugadors');
    } finally {
      setLoading(false);
    }
  }, []);

  const hasAutoUpdated = useRef(false);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

  // Auto-update handicaps only once on first page load
  useEffect(() => {
    if (!loading && players.length > 0 && !hasAutoUpdated.current) {
      hasAutoUpdated.current = true;
      handleUpdateAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleUpdateAll = async () => {
    setUpdatingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-handicaps-bulk', {
        body: { force: true },
      });
      if (error) throw error;
      toast.success(`Handicaps actualitzats: ${data.updated} | Cached: ${data.cached} | No trobats: ${data.not_found}`);
      await fetchPlayers();
    } catch (err: any) {
      toast.error('Error actualitzant handicaps: ' + (err.message || 'Unknown'));
    } finally {
      setUpdatingAll(false);
    }
  };

  const handleUpdateSingle = async (playerId: string, license: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-handicap', {
        body: { player_id: playerId, license_number: license, force: true },
      });
      if (error) throw error;
      if (data.handicap !== null) {
        toast.success(`Handicap actualitzat: ${formatHandicap(data.handicap)}`);
        await fetchPlayers();
      } else {
        toast.error('No s\'ha trobat el handicap');
      }
    } catch (err: any) {
      toast.error('Error: ' + (err.message || 'Unknown'));
    }
  };

  // ─── Filtered & sorted players ─────────────────────────────────────

  const filtered = useMemo(() => {
    let list = [...players];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(term) || (p.license_number || '').toLowerCase().includes(term));
    }

    // Handicap filter
    if (handicapFilter === 'best') {
      list = list.filter(p => p.handicap_actual !== null && p.handicap_actual > 0);
    } else if (handicapFilter === '0-5') {
      list = list.filter(p => p.handicap_actual !== null && Math.abs(p.handicap_actual) >= 0 && Math.abs(p.handicap_actual) <= 5);
    } else if (handicapFilter === '5-10') {
      list = list.filter(p => p.handicap_actual !== null && Math.abs(p.handicap_actual) > 5 && Math.abs(p.handicap_actual) <= 10);
    } else if (handicapFilter === '10+') {
      list = list.filter(p => p.handicap_actual !== null && Math.abs(p.handicap_actual) > 10);
    }

    // Ranking filter
    if (rankingFilter === 'top10') {
      const top10Ids = new Set(players.filter(p => p.rankings.some(r => r.position <= 10)).map(p => p.id));
      list = list.filter(p => top10Ids.has(p.id));
    } else if (rankingFilter === 'top20') {
      const top20Ids = new Set(players.filter(p => p.rankings.some(r => r.position <= 20)).map(p => p.id));
      list = list.filter(p => top20Ids.has(p.id));
    }

    // Trend filter
    if (trendFilter === 'improving') list = list.filter(p => p.trend === 'improving');
    else if (trendFilter === 'declining') list = list.filter(p => p.trend === 'declining');
    else if (trendFilter === 'stable') list = list.filter(p => p.trend === 'stable');

    // Sort
    if (sortBy === 'handicap') {
      list.sort((a, b) => handicapSortValue(a.handicap_actual) - handicapSortValue(b.handicap_actual));
    } else if (sortBy === 'ranking_scratch') {
      list.sort((a, b) => {
        const aPos = a.rankings.find(r => r.category.includes('scratch'))?.position ?? 999;
        const bPos = b.rankings.find(r => r.category.includes('scratch'))?.position ?? 999;
        return aPos - bPos;
      });
    } else if (sortBy === 'ranking_handicap') {
      list.sort((a, b) => {
        const aPos = a.rankings.find(r => r.category.includes('handicap'))?.position ?? 999;
        const bPos = b.rankings.find(r => r.category.includes('handicap'))?.position ?? 999;
        return aPos - bPos;
      });
    } else if (sortBy === 'trend') {
      const trendOrder = { improving: 0, stable: 1, declining: 2 };
      list.sort((a, b) => trendOrder[a.trend] - trendOrder[b.trend]);
    } else if (sortBy === 'probability') {
      list.sort((a, b) => b.winProbability - a.winProbability);
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [players, searchTerm, handicapFilter, rankingFilter, trendFilter, sortBy]);

  // ─── Insights ──────────────────────────────────────────────────────

  const insights = useMemo(() => {
    const withHandicap = players.filter(p => p.handicap_actual !== null);
    const bestHandicap = withHandicap.length > 0
      ? withHandicap.reduce((best, p) => handicapSortValue(p.handicap_actual) < handicapSortValue(best.handicap_actual) ? p : best)
      : null;

    const improving = players.filter(p => p.trend === 'improving');
    const bestImprover = improving.length > 0
      ? improving.reduce((best, p) => (p.winProbability > best.winProbability ? p : best))
      : null;

    const withConsistency = players.filter(p => p.consistency < 999 && p.tournamentCount >= 3);
    const mostConsistent = withConsistency.length > 0
      ? withConsistency.reduce((best, p) => p.consistency < best.consistency ? p : best)
      : null;

    const bestWinProb = players.filter(p => p.winProbability > 0).length > 0
      ? players.reduce((best, p) => p.winProbability > best.winProbability ? p : best)
      : null;

    return { bestHandicap, bestImprover, mostConsistent, bestWinProb };
  }, [players]);

  // ─── Comparator ────────────────────────────────────────────────────

  const playerAData = players.find(p => p.id === playerA);
  const playerBData = players.find(p => p.id === playerB);

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar showSearch />

      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-7 h-7 text-primary" /> Jugadors
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {players.length} jugadors registrats
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setComparatorOpen(true)}
              className="gap-1"
            >
              <GitCompare className="w-4 h-4" /> Comparar
            </Button>
            <Button
              size="sm"
              onClick={handleUpdateAll}
              disabled={updatingAll}
              className="gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${updatingAll ? 'animate-spin' : ''}`} />
              {updatingAll ? 'Actualitzant handicaps...' : 'Actualitzar handicaps'}
            </Button>
          </div>
        </div>

        {/* Insights */}
        {!loading && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {insights.bestHandicap && (
                <InsightCard icon="🥇" label="Millor handicap" name={insights.bestHandicap.name} value={formatHandicap(insights.bestHandicap.handicap_actual)} />
              )}
              {insights.bestImprover && (
                <InsightCard icon="📈" label="Major millora" name={insights.bestImprover.name} value={`${insights.bestImprover.winProbability}%`} />
              )}
              {insights.mostConsistent && (
                <InsightCard icon="🎯" label="Més regular" name={insights.mostConsistent.name} value={`σ ${insights.mostConsistent.consistency.toFixed(1)}`} />
              )}
              {insights.bestWinProb && (
                <InsightCard icon="🔥" label="Favorit pròxima prova" name={insights.bestWinProb.name} value={`${insights.bestWinProb.winProbability}%`} tooltip="Predicció per la pròxima prova basada en: handicap (40%), resultats recents (30%), regularitat (20%) i tendència (10%)" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-md bg-muted/50 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground text-xs mr-1">Llegenda:</span>
              <span><b>Hdcp +X</b> = Handicap (+ millor)</span>
              <span><b>#N</b> = Rànquing</span>
              <span className="inline-flex items-center gap-0.5"><BarChart3 className="w-3 h-3" /> Ø Mitjana</span>
              <span className="inline-flex items-center gap-0.5"><Trophy className="w-3 h-3" /> Millor resultat</span>
              <span className="inline-flex items-center gap-0.5"><Target className="w-3 h-3" /> Proves</span>
              <span className="inline-flex items-center gap-0.5"><TrendingUp className="w-3 h-3 text-primary" /> Millora</span>
              <span className="inline-flex items-center gap-0.5"><TrendingDown className="w-3 h-3 text-destructive" /> Empitjora</span>
              <span className="inline-flex items-center gap-0.5"><Minus className="w-3 h-3" /> Estable</span>
              <span><b>Prob.</b> = Predicció IA</span>
              <span><b>No federat</b> = Sense llicència</span>
            </div>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cercar jugador..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={handicapFilter} onValueChange={setHandicapFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Handicap" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tots</SelectItem>
                  <SelectItem value="best">Millors (+)</SelectItem>
                  <SelectItem value="0-5">0–5</SelectItem>
                  <SelectItem value="5-10">5–10</SelectItem>
                  <SelectItem value="10+">10+</SelectItem>
                </SelectContent>
              </Select>

              <Select value={rankingFilter} onValueChange={setRankingFilter}>
                <SelectTrigger className="w-[120px]"><SelectValue placeholder="Rànquing" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tots</SelectItem>
                  <SelectItem value="top10">Top 10</SelectItem>
                  <SelectItem value="top20">Top 20</SelectItem>
                </SelectContent>
              </Select>

              <Select value={trendFilter} onValueChange={setTrendFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Evolució" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Totes</SelectItem>
                  <SelectItem value="improving">📈 Millora</SelectItem>
                  <SelectItem value="declining">📉 Empitjora</SelectItem>
                  <SelectItem value="stable">➖ Estable</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px]">
                  <ArrowUpDown className="w-3 h-3 mr-1" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="handicap">Handicap</SelectItem>
                  <SelectItem value="ranking_scratch">Rànquing Scratch</SelectItem>
                  <SelectItem value="ranking_handicap">Rànquing Handicap</SelectItem>
                  <SelectItem value="trend">Evolució</SelectItem>
                  <SelectItem value="probability">Probabilitat</SelectItem>
                  <SelectItem value="name">Nom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Player grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{filtered.length} jugadors</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {filtered.map((player, idx) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    index={idx}
                    onUpdate={handleUpdateSingle}
                    onViewDetail={(id) => {
                      const p = players.find(pl => pl.id === id);
                      if (p) openPlayer(p.id, p.name, p.gender);
                    }}
                    onCompare={(id) => {
                      if (!playerA) {
                        setPlayerA(id);
                        setComparatorOpen(true);
                      } else if (!playerB) {
                        setPlayerB(id);
                        setComparatorOpen(true);
                      } else {
                        setPlayerA(id);
                        setPlayerB(null);
                        setComparatorOpen(true);
                      }
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* Comparator dialog */}
        <Dialog open={comparatorOpen} onOpenChange={setComparatorOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-primary" /> Comparador de Jugadors
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Jugador A</label>
                <Select value={playerA || ''} onValueChange={setPlayerA}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {players.sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Jugador B</label>
                <Select value={playerB || ''} onValueChange={setPlayerB}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {players.sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {playerAData && playerBData && (
              <ComparisonTable a={playerAData} b={playerBData} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function InsightCard({ icon, label, name, value, tooltip }: { icon: string; label: string; name: string; value: string; tooltip?: string }) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <span className="text-base">{icon}</span> {label}
        </div>
        <p className="font-semibold text-sm text-foreground mt-1 truncate">{name}</p>
        <p className="text-xs text-primary font-bold">{value}</p>
        {tooltip && (
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">{tooltip}</p>
        )}
      </CardContent>
    </Card>
  );
}

function TrendIndicator({ trend }: { trend: 'improving' | 'declining' | 'stable' }) {
  if (trend === 'improving') return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary"><TrendingUp className="w-3 h-3" /> Millora</span>;
  if (trend === 'declining') return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-destructive"><TrendingDown className="w-3 h-3" /> Empitjora</span>;
  return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground"><Minus className="w-3 h-3" /> Estable</span>;
}

function PlayerCard({
  player,
  index,
  onUpdate,
  onViewDetail,
  onCompare,
}: {
  player: PlayerData;
  index: number;
  onUpdate: (id: string, license: string) => void;
  onViewDetail: (id: string) => void;
  onCompare: (id: string) => void;
}) {
  const scratchRanking = player.rankings.find(r => r.category.includes('scratch'));
  const handicapRanking = player.rankings.find(r => r.category.includes('handicap'));

  const initials = player.name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
    >
      <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => onViewDetail(player.id)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 border-2 border-primary/20">
              {player.photo_url ? (
                <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-primary">{initials}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground truncate">{player.name}</h3>
                <TrendIndicator trend={player.trend} />
              </div>

              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs font-bold">
                  {formatHandicap(player.handicap_actual)}
                </Badge>
                {scratchRanking && (
                  <Badge variant="outline" className="text-xs">
                    #{scratchRanking.position} Scr
                  </Badge>
                )}
                {handicapRanking && (
                  <Badge variant="outline" className="text-xs">
                    #{handicapRanking.position} Hcp
                  </Badge>
                )}
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {player.avgStrokes !== null && (
                  <span className="flex items-center gap-0.5">
                    <BarChart3 className="w-3 h-3" /> Ø{player.avgStrokes.toFixed(1)}
                  </span>
                )}
                {player.bestResult !== null && (
                  <span className="flex items-center gap-0.5">
                    <Trophy className="w-3 h-3" /> {player.bestResult}
                  </span>
                )}
                <span className="flex items-center gap-0.5">
                  <Target className="w-3 h-3" /> {player.tournamentCount} proves
                </span>
              </div>

              {/* Win probability */}
              {player.winProbability > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Prob. guanyar</span>
                    <span className="font-bold text-primary">{player.winProbability}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full mt-0.5 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${player.winProbability}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions (visible on hover) */}
          <div className="flex gap-1 mt-3 pt-2 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
            {player.license_number && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={(e) => { e.stopPropagation(); onUpdate(player.id, player.license_number!); }}
              >
                <RefreshCw className="w-3 h-3" /> Actualitzar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={(e) => { e.stopPropagation(); onCompare(player.id); }}
            >
              <GitCompare className="w-3 h-3" /> Comparar
            </Button>
          </div>

          {/* Updated date */}
          {player.handicap_updated_at && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Act. {new Date(player.handicap_updated_at).toLocaleDateString('ca')}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ComparisonTable({ a, b }: { a: PlayerData; b: PlayerData }) {
  const rows = [
    { label: 'Handicap', va: formatHandicap(a.handicap_actual), vb: formatHandicap(b.handicap_actual), better: handicapSortValue(a.handicap_actual) < handicapSortValue(b.handicap_actual) ? 'a' : handicapSortValue(a.handicap_actual) > handicapSortValue(b.handicap_actual) ? 'b' : 'tie' },
    { label: 'Millor rànquing', va: a.rankings.length > 0 ? `#${Math.min(...a.rankings.map(r => r.position))}` : '—', vb: b.rankings.length > 0 ? `#${Math.min(...b.rankings.map(r => r.position))}` : '—', better: (Math.min(...a.rankings.map(r => r.position), 999)) < (Math.min(...b.rankings.map(r => r.position), 999)) ? 'a' : 'b' },
    { label: 'Mitjana golpes', va: a.avgStrokes !== null ? a.avgStrokes.toFixed(1) : '—', vb: b.avgStrokes !== null ? b.avgStrokes.toFixed(1) : '—', better: (a.avgStrokes || 999) < (b.avgStrokes || 999) ? 'a' : 'b' },
    { label: 'Millor resultat', va: a.bestResult !== null ? `${a.bestResult}` : '—', vb: b.bestResult !== null ? `${b.bestResult}` : '—', better: (a.bestResult || 999) < (b.bestResult || 999) ? 'a' : 'b' },
    { label: 'Regularitat (σ)', va: a.consistency < 999 ? a.consistency.toFixed(1) : '—', vb: b.consistency < 999 ? b.consistency.toFixed(1) : '—', better: a.consistency < b.consistency ? 'a' : 'b' },
    { label: 'Tendència', va: a.trend === 'improving' ? '📈' : a.trend === 'declining' ? '📉' : '➖', vb: b.trend === 'improving' ? '📈' : b.trend === 'declining' ? '📉' : '➖', better: a.trend === 'improving' && b.trend !== 'improving' ? 'a' : b.trend === 'improving' && a.trend !== 'improving' ? 'b' : 'tie' },
    { label: 'Prob. guanyar', va: `${a.winProbability}%`, vb: `${b.winProbability}%`, better: a.winProbability > b.winProbability ? 'a' : 'b' },
  ];

  const aWins = rows.filter(r => r.better === 'a').length;
  const bWins = rows.filter(r => r.better === 'b').length;
  const stronger = aWins > bWins ? a : aWins < bWins ? b : null;

  return (
    <div className="mt-4 space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 text-muted-foreground font-medium"></th>
              <th className="text-center py-2 font-semibold text-foreground">{a.name.split(',')[0]}</th>
              <th className="text-center py-2 font-semibold text-foreground">{b.name.split(',')[0]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label} className="border-b border-border/50">
                <td className="py-2 text-muted-foreground text-xs">{row.label}</td>
                <td className={`py-2 text-center font-medium ${row.better === 'a' ? 'text-primary font-bold' : ''}`}>{row.va}</td>
                <td className={`py-2 text-center font-medium ${row.better === 'b' ? 'text-primary font-bold' : ''}`}>{row.vb}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-3 text-center">
          {stronger ? (
            <p className="font-bold text-foreground">
              👉 Jugador més fort actualment: <span className="text-primary">{stronger.name}</span>
            </p>
          ) : (
            <p className="font-bold text-foreground">👉 Ambdós jugadors estan igualats!</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="py-3 px-4">
          <p className="text-xs font-semibold text-foreground mb-2">Llegenda de la comparativa</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <li><span className="font-medium">Handicap</span> — Nivell federat (+ = millor)</li>
            <li><span className="font-medium">Millor rànquing</span> — Posició més alta al circuit</li>
            <li><span className="font-medium">Mitjana cops</span> — Mitjana de cops per prova</li>
            <li><span className="font-medium">Millor resultat</span> — Menor nombre de cops en una prova</li>
            <li><span className="font-medium">Regularitat (σ)</span> — Desviació estàndard (menor = més regular)</li>
            <li><span className="font-medium">Tendència</span> — 📈 Millora / 📉 Empitjora / ➖ Estable</li>
            <li><span className="font-medium">Prob. guanyar</span> — Predicció basada en handicap, resultats, regularitat i tendència</li>
            <li><span className="text-primary font-bold">Verd</span> — Indica el valor superior en cada paràmetre</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
