import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ChevronDown, ChevronUp, Medal } from 'lucide-react';
import HistoricRoundResults from '@/components/HistoricRoundResults';
import HallOfFameHero from '@/components/HallOfFameHero';

const CATEGORY_LABELS: Record<string, string> = {
  scratch_male: 'Scratch Masculí',
  handicap_male: 'Handicap Masculí',
  scratch_female: 'Scratch Femení',
  handicap_female: 'Handicap Femení',
  general: 'Classificació General',
};

const CATEGORY_ORDER = ['scratch_male', 'handicap_male', 'scratch_female', 'handicap_female'];

interface Season {
  id: string;
  year: number;
  total_rounds: number;
  counting_rounds: number;
  modality: string;
}

interface RankingEntryWithQualified extends RankingEntry {
  qualified: boolean;
}

interface Winner {
  category: string;
  position: number;
  player_name: string;
  photo_url: string | null;
}

interface RankingEntry {
  category: string;
  position: number;
  player_name: string;
  total_points: number;
  rounds_played: number;
}

export default function Palmares() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedYear, setExpandedYear] = useState<string | null>(null);
  const [yearData, setYearData] = useState<Record<string, { winners: Winner[]; rankings: RankingEntryWithQualified[] }>>({});
  const [loadingYear, setLoadingYear] = useState<string | null>(null);
  const [topPlayers, setTopPlayers] = useState<Record<string, { male?: string; female?: string }>>({});

  useEffect(() => {
    (async () => {
      const [{ data: seasonsData }, { data: winnersData }] = await Promise.all([
        supabase.from('historic_seasons').select('*').eq('status', 'published').order('year', { ascending: false }),
        supabase.from('historic_winners').select('season_id, category, position, player_name').eq('position', 1).in('category', ['scratch_male', 'scratch_female']),
      ]);
      setSeasons((seasonsData || []) as Season[]);
      const tp: Record<string, { male?: string; female?: string }> = {};
      (winnersData || []).forEach((w: any) => {
        if (!tp[w.season_id]) tp[w.season_id] = {};
        if (w.category === 'scratch_male') tp[w.season_id].male = w.player_name;
        if (w.category === 'scratch_female') tp[w.season_id].female = w.player_name;
      });
      setTopPlayers(tp);
      setLoading(false);
    })();
  }, []);

  const loadYearData = async (seasonId: string) => {
    if (yearData[seasonId]) return;
    setLoadingYear(seasonId);
    const season = seasons.find(s => s.id === seasonId);
    const countingRounds = season?.counting_rounds || 8;
    const [{ data: winners }, { data: rankings }] = await Promise.all([
      supabase.from('historic_winners').select('*').eq('season_id', seasonId).order('position'),
      supabase.from('historic_rankings').select('*').eq('season_id', seasonId).order('position'),
    ]);
    const ranksWithQualified = (rankings || []).map(r => ({
      ...r,
      qualified: (r as any).rounds_played >= countingRounds,
    })) as RankingEntryWithQualified[];
    setYearData(prev => ({
      ...prev,
      [seasonId]: { winners: (winners || []) as Winner[], rankings: ranksWithQualified },
    }));
    setLoadingYear(null);
  };

  const toggleYear = (seasonId: string) => {
    if (expandedYear === seasonId) {
      setExpandedYear(null);
    } else {
      setExpandedYear(seasonId);
      loadYearData(seasonId);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="py-8 sm:py-12">
        <div className="container max-w-5xl">
          <div className="mb-8">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground flex items-center gap-3">
              <Trophy className="w-8 h-8 text-primary" /> Palmarés
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Historial de campions i classificacions des de 2019
            </p>
          </div>

          <HallOfFameHero />

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : seasons.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Encara no hi ha temporades publicades</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {seasons.map((season, idx) => (
                <motion.div
                  key={season.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleYear(season.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl sm:text-2xl font-extrabold text-primary">{season.year}</span>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-[10px]">{season.total_rounds} proves</Badge>
                          <Badge variant="outline" className="text-[10px]">{season.modality === 'stableford' ? 'Stableford' : 'Medalplay'}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {topPlayers[season.id]?.male && (
                          <div className="hidden sm:flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1 border border-primary/20">
                            <Trophy className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[11px] font-bold text-foreground">{topPlayers[season.id].male}</span>
                            <span className="text-[9px] text-muted-foreground/80 uppercase tracking-wider font-medium">Campió</span>
                          </div>
                        )}
                        {topPlayers[season.id]?.female && (
                          <div className="hidden sm:flex items-center gap-1.5 bg-accent/50 rounded-full px-3 py-1 border border-accent">
                            <Trophy className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[11px] font-bold text-foreground">{topPlayers[season.id].female}</span>
                            <span className="text-[9px] text-muted-foreground/80 uppercase tracking-wider font-medium">Campiona</span>
                          </div>
                        )}
                        {expandedYear === season.id ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedYear === season.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-border/50 p-4 sm:p-6 space-y-8">
                            {loadingYear === season.id ? (
                              <div className="space-y-3">
                                <Skeleton className="h-32" />
                                <Skeleton className="h-48" />
                              </div>
                            ) : yearData[season.id] ? (
                              <>
                                {/* Hall of Fame */}
                                <HallOfFame winners={yearData[season.id].winners} year={season.year} />

                                {/* Rankings */}
                                <div>
                                  <h3 className="font-bold text-foreground mb-4 flex items-center gap-2 text-lg">
                                    📊 Classificacions
                                  </h3>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {CATEGORY_ORDER.map(cat => {
                                      const catRankings = yearData[season.id].rankings.filter(r => r.category === cat);
                                      if (catRankings.length === 0) return null;
                                      const qualifiedCount = catRankings.filter(r => r.qualified).length;
                                      return (
                                        <Card key={cat}>
                                          <CardHeader className="py-2 px-4">
                                            <CardTitle className="text-sm font-semibold text-muted-foreground">{CATEGORY_LABELS[cat]}</CardTitle>
                                          </CardHeader>
                                          <CardContent className="px-4 pb-3">
                                            <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                                              {catRankings.map((r, idx) => (
                                                <div key={r.position}>
                                                  {/* Separator between qualified and non-qualified */}
                                                  {idx === qualifiedCount && qualifiedCount > 0 && (
                                                    <div className="flex items-center gap-2 py-2 my-1">
                                                      <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                                                      <span className="text-[9px] font-display text-muted-foreground/60 whitespace-nowrap">Menys de {season.counting_rounds} proves</span>
                                                      <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                                                    </div>
                                                  )}
                                                  <div
                                                    className={`flex items-center gap-2 text-xs py-1.5 px-2 rounded ${
                                                      r.position <= 3 ? 'bg-primary/10 font-bold' :
                                                      r.position <= 10 ? 'bg-muted/50' : ''
                                                    } ${!r.qualified ? 'opacity-60' : ''}`}
                                                  >
                                                    <span className={`w-6 font-bold ${
                                                      r.position === 1 ? 'text-[hsl(var(--gold))]' :
                                                      r.position === 2 ? 'text-[hsl(var(--silver))]' :
                                                      r.position === 3 ? 'text-[hsl(var(--bronze))]' : 'text-foreground'
                                                    }`}>
                                                      {r.position <= 3 ? ['🥇', '🥈', '🥉'][r.position - 1] : `#${r.position}`}
                                                    </span>
                                                    <span className="flex-1 text-foreground truncate">{r.player_name}</span>
                                                    <span className="text-muted-foreground whitespace-nowrap">{r.total_points} {season.modality === 'stableford' ? 'pts' : 'cops'}{r.rounds_played > 0 ? ` · ${r.rounds_played}p` : ''}</span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </CardContent>
                                        </Card>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Prova per Prova - only show if there's round-by-round data */}
                                {yearData[season.id]?.rankings.some(r => r.rounds_played > 0) ? (
                                  <div>
                                    <h3 className="font-bold text-foreground mb-4 flex items-center gap-2 text-lg">
                                      ⛳ Prova per Prova
                                    </h3>
                                    <HistoricRoundResults seasonId={season.id} />
                                  </div>
                                ) : (
                                  <div className="p-4 rounded-md bg-muted/50 border border-border text-sm text-muted-foreground text-center">
                                    ℹ️ Aquesta temporada no disposa de dades prova a prova. Només es mostra la classificació final.
                                  </div>
                                )}
                              </>
                            ) : null}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function HallOfFame({ winners, year }: { winners: Winner[]; year: number }) {
  if (winners.length === 0) return null;

  return (
    <div>
      <h3 className="font-bold text-foreground mb-4 flex items-center gap-2 text-lg">
        🏆 Hall of Fame {year}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATEGORY_ORDER.map(cat => {
          const catWinners = winners.filter(w => w.category === cat);
          if (catWinners.length === 0) return null;
          const champion = catWinners.find(w => w.position === 1);
          const others = catWinners.filter(w => w.position > 1);

          return (
            <Card key={cat} className="border-primary/20 overflow-hidden">
              <CardHeader className="py-2 px-4 bg-primary/5">
                <CardTitle className="text-xs font-semibold text-primary">{CATEGORY_LABELS[cat]}</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {/* Champion */}
                {champion && (
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center overflow-hidden shrink-0">
                      {champion.photo_url ? (
                        <img src={champion.photo_url} alt={champion.player_name} className="w-full h-full object-cover" />
                      ) : (
                        <Medal className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">🥇 Campió/na</p>
                      <p className="font-bold text-foreground">{champion.player_name}</p>
                    </div>
                  </div>
                )}
                {/* 2nd & 3rd */}
                {others.map(w => (
                  <div key={w.position} className="flex items-center gap-2 text-sm py-1">
                    <span className="text-xs">{w.position === 2 ? '🥈' : '🥉'}</span>
                    <span className="text-foreground">{w.player_name}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
