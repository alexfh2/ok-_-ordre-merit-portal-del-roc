import { useState, useEffect } from 'react';
import CourseHolesManager from '@/components/CourseHolesManager';
import { Link } from 'react-router-dom';
import { RANKING_RULES } from '@/config/rankingRules';
import { LogOut, Trash2, CalendarSync } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import ExcelUploader from '@/components/ExcelUploader';


import SubscriberExcelUploader from '@/components/SubscriberExcelUploader';
import TournamentResults from '@/components/TournamentResults';
import PlayerManagement from '@/components/PlayerManagement';
import NewsArticleGenerator from '@/components/NewsArticleGenerator';
import PalmaresAdmin from '@/components/PalmaresAdmin';
import Navbar from '@/components/Navbar';
import CategoryTabs from '@/components/CategoryTabs';
import type { RankingEntry } from '@/components/RankingTable';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Wordmark from '@/components/Wordmark';

export default function Admin() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [rankings, setRankings] = useState<Record<string, RankingEntry[]>>({});
  
  const [activeCategory, setActiveCategory] = useState('scratch_male');
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showYearDialog, setShowYearDialog] = useState(false);
  const [yearDates, setYearDates] = useState<string[]>(Array.from({ length: RANKING_RULES.totalRounds }, () => ''));
  const [changingYear, setChangingYear] = useState(false);

  useEffect(() => {
    if (user) { fetchRankings(); }
  }, [user]);

  async function fetchRankings() {
    try {
      const { data, error } = await supabase
        .from('rankings')
        .select('position, total_points, category, player_id, players(name)')
        .order('position', { ascending: true })
        .lte('position', 50);

      if (error) throw error;

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

        for (let i = 0; i < RANKING_RULES.totalRounds; i++) {
          const roundData = playerRounds.get(row.player_id)?.get(i + 1);
          const score = roundData ? (isScratch ? roundData.scratch : roundData.handicap) : null;
          rounds.push(score);
          if (score !== null) scores.push({ value: score, index: i });
        }

        const discarded: number[] = [];
        if (scores.length > RANKING_RULES.countingRounds) {
          // Stableford: higher is better. Keep the top countingRounds, discard the rest.
          const sorted = [...scores].sort((a, b) => b.value - a.value);
          const discardedScores = sorted.slice(RANKING_RULES.countingRounds);
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
    }
  }

  async function fetchPairRankings() {
    try {
      const [pairRankingsRes, pairsRes, tournamentsRes] = await Promise.all([
        supabase.from('pair_rankings').select('position, total_points, category, pair_id').order('position', { ascending: true }).lte('position', 50),
        supabase.from('pairs').select('id, name'),
        supabase.from('tournaments').select('id, round_number'),
      ]);
      if (pairRankingsRes.error || pairsRes.error || tournamentsRes.error) return;
      const data = pairRankingsRes.data || [];
      const pairNameById = new Map((pairsRes.data || []).map(p => [p.id, p.name]));
      const roundByTournamentId = new Map((tournamentsRes.data || []).map(t => [t.id, t.round_number]));
      const pairIds = [...new Set(data.map(r => r.pair_id))];
      let results: Array<{ pair_id: string; scratch_score: number | null; handicap_score: number | null; tournament_id: string }> = [];
      if (pairIds.length > 0) {
        const { data: rd } = await supabase.from('pair_results').select('pair_id, scratch_score, handicap_score, tournament_id').in('pair_id', pairIds);
        results = rd || [];
      }
      const pairRounds = new Map<string, Map<number, { scratch: number | null; handicap: number | null }>>();
      for (const r of results) {
        const roundNum = roundByTournamentId.get(r.tournament_id);
        if (!roundNum) continue;
        if (!pairRounds.has(r.pair_id)) pairRounds.set(r.pair_id, new Map());
        pairRounds.get(r.pair_id)!.set(roundNum, { scratch: r.scratch_score, handicap: r.handicap_score });
      }
      const grouped: Record<string, RankingEntry[]> = {};
      for (const row of data) {
        const cat = row.category;
        if (!grouped[cat]) grouped[cat] = [];
        const isScratch = cat.startsWith('scratch');
        const rounds: (number | null)[] = [];
        const scores: { value: number; index: number }[] = [];
        for (let i = 0; i < RANKING_RULES.totalRounds; i++) {
          const rd = pairRounds.get(row.pair_id)?.get(i + 1);
          const score = rd ? (isScratch ? rd.scratch : rd.handicap) : null;
          rounds.push(score);
          if (score !== null) scores.push({ value: score, index: i });
        }
        const discarded: number[] = [];
        if (scores.length > RANKING_RULES.countingRounds) {
          const sorted = [...scores].sort((a, b) => b.value - a.value);
          const discardedScores = sorted.slice(RANKING_RULES.countingRounds);
          for (const d of discardedScores) discarded.push(d.index);
        }
        grouped[cat].push({ position: row.position, total_points: row.total_points, name: pairNameById.get(row.pair_id) || 'Desconegut', player_id: row.pair_id, rounds, discarded });
      }
      setPairRankings(grouped);
    } catch { /* ok */ }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const { error } = await signIn(email, password);
    if (error) toast.error(error.message);
    setLoginLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-sm p-8">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <Wordmark size="lg" />
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email" className="font-sans">Correu electrònic</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password" className="font-sans">Contrasenya</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loginLoading}>
              {loginLoading ? 'Entrant...' : 'Iniciar Sessió'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground font-sans">
              ← Tornar a l'inici
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        rightContent={
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut className="w-4 h-4" />
            Sortir
          </Button>
        }
      />

      <section className="py-8 sm:py-12">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 space-y-10">
          {/* Ordre del Mèrit Portal del Roc 2026 — flux unificat */}
          <div className="border border-dashed border-primary/40 rounded-lg p-5 bg-primary/5 space-y-4">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground mb-1">
                Ordre del Mèrit Portal del Roc · Temporada 2026
              </h2>
              <p className="text-sm text-muted-foreground">
                Puja un únic Excel Stableford per prova. Detecta abonats (nom subratllat en groc),
                sexe i data de naixement; omple <strong>Prova a Prova</strong> amb tots els jugadors
                i actualitza l'<strong>Ordre del Mèrit</strong> només amb els abonats.
              </p>
            </div>

            <div className="rounded-md border border-primary/40 bg-background p-3">
              <h3 className="font-semibold text-sm mb-3">Pujar resultats de la prova</h3>
              <ExcelUploader onUploadComplete={() => { fetchRankings(); }} />
            </div>

            <div className="rounded-md border border-primary/40 bg-background p-3">
              <h3 className="font-semibold text-sm mb-2">Gestionar camp</h3>
              <CourseHolesManager />
            </div>

            <div className="rounded-md border border-primary/40 bg-background p-3">
              <h3 className="font-semibold text-sm mb-1">Llista d'abonats del club</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Puja un Excel amb només els noms i cognoms dels abonats. El sistema els detectarà
                automàticament a les properes proves si l'Excel no porta les cel·les en groc, i
                avisarà si en algun Excel falten marques en groc respecte a aquesta llista.
              </p>
              <SubscriberExcelUploader />
            </div>
          </div>




          {/* Individual Rankings preview + image gen */}
          <div>
            <h2 className="font-display text-xl font-bold text-foreground mb-4">Rànquing Individual</h2>
            <CategoryTabs rankings={rankings} loading={false} showImageGenerator />
          </div>

          {/* News Article Generator */}
          <div>
            <h2 className="font-display text-xl font-bold text-foreground mb-4">Generador de Notícies</h2>
            <p className="text-sm text-muted-foreground mb-3">Genera una notícia esportiva completa amb classificacions individuals, patrocinadors i mencions especials.</p>
            <NewsArticleGenerator individualRankings={rankings} pairRankings={{}} />
          </div>

          {/* Tournament results per prova - Individual */}
          <div>
            <h2 className="font-display text-xl font-bold text-foreground mb-4">Resultats per Prova</h2>
            <TournamentResults showAdminTools mode="individual" />
          </div>


          {/* Player management */}
          <div>
            <h2 className="font-display text-xl font-bold text-foreground mb-4">Gestió de Jugadors</h2>
            <PlayerManagement />
          </div>

          {/* Palmarés Històric */}
          <PalmaresAdmin />

          {/* Reset */}
          <div className="border-t border-destructive/30 pt-6 space-y-6">
            <h2 className="font-display text-xl font-bold text-destructive mb-2">Zona Perillosa</h2>

            {/* Reset individual */}
            <div>
              <p className="text-sm text-muted-foreground mb-3">Esborra tots els resultats, rànquings i jugadors <strong>individuals</strong>. Les proves es mantenen.</p>
              {!confirmReset ? (
                <Button variant="destructive" size="sm" onClick={() => setConfirmReset(true)}>
                  <Trash2 className="w-4 h-4" />
                  Resetear Individual
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={resetting}
                    onClick={async () => {
                      setResetting(true);
                      try {
                        await supabase.from('hole_scores').delete().gte('hole_number', 0);
                        await supabase.from('rankings').delete().gte('position', 0);
                        await supabase.from('results').delete().gte('points', 0);
                        await supabase.from('players').delete().neq('name', '');
                        setRankings({});
                        toast.success('Resultats individuals esborrats.');
                      } catch (err: any) {
                        toast.error(err.message || 'Error esborrant dades');
                      } finally {
                        setResetting(false);
                        setConfirmReset(false);
                      }
                    }}
                  >
                    {resetting ? 'Esborrant...' : 'Confirmar Reset Individual'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)}>Cancel·lar</Button>
                </div>
              )}
            </div>

            {/* Reset parejas */}
            <div>
              <p className="text-sm text-muted-foreground mb-3">Esborra tots els resultats, rànquings i parelles. Les proves es mantenen.</p>
              {!confirmResetPairs ? (
                <Button variant="destructive" size="sm" onClick={() => setConfirmResetPairs(true)}>
                  <Trash2 className="w-4 h-4" />
                  Resetear Parelles
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={resettingPairs}
                    onClick={async () => {
                      setResettingPairs(true);
                      try {
                        await supabase.from('pair_hole_scores').delete().gte('hole_number', 0);
                        await supabase.from('pair_rankings').delete().gte('position', 0);
                        await supabase.from('pair_results').delete().gte('points', 0);
                        await supabase.from('pair_members').delete().neq('player_name', '');
                        await supabase.from('pairs').delete().neq('name', '');
                        setPairRankings({});
                        toast.success('Resultats de parelles esborrats.');
                      } catch (err: any) {
                        toast.error(err.message || 'Error esborrant dades de parelles');
                      } finally {
                        setResettingPairs(false);
                        setConfirmResetPairs(false);
                      }
                    }}
                  >
                    {resettingPairs ? 'Esborrant...' : 'Confirmar Reset Parelles'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmResetPairs(false)}>Cancel·lar</Button>
                </div>
              )}
            </div>

            {/* Change year */}
            <div>
              <p className="text-sm text-muted-foreground mb-3">Canvia d'any: esborra TOT (resultats + proves) i crea les 10 proves del nou any amb les dates que indiquis.</p>
              <Button variant="destructive" size="sm" onClick={() => setShowYearDialog(true)}>
                <CalendarSync className="w-4 h-4" />
                Canviar d'any
              </Button>
            </div>
          </div>

          {/* Year change dialog */}
          <Dialog open={showYearDialog} onOpenChange={setShowYearDialog}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">Canviar d'any</DialogTitle>
                <DialogDescription className="font-sans">
                  Introdueix les dates de les 10 proves del nou any. S'esborraran TOTES les dades actuals.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                {yearDates.map((date, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Label className="font-sans font-semibold text-sm w-16 shrink-0">Prova {i + 1}</Label>
                    <Input
                      type="date"
                      value={date}
                      onChange={e => {
                        const copy = [...yearDates];
                        copy[i] = e.target.value;
                        setYearDates(copy);
                      }}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowYearDialog(false)}>Cancel·lar</Button>
                <Button
                  variant="destructive"
                  disabled={changingYear || yearDates.every(d => !d)}
                  onClick={async () => {
                    setChangingYear(true);
                    try {
                      // Delete everything
                      await supabase.from('hole_scores').delete().gte('hole_number', 0);
                      await supabase.from('rankings').delete().gte('position', 0);
                      await supabase.from('results').delete().gte('points', 0);
                      await supabase.from('tournaments').delete().gte('round_number', 0);
                      await supabase.from('players').delete().neq('name', '');

                      // Create new tournaments
                      const newTournaments = yearDates.map((date, i) => ({
                        name: `Prova ${i + 1}`,
                        round_number: i + 1,
                        date: date || null,
                      }));
                      const { error } = await supabase.from('tournaments').insert(newTournaments);
                      if (error) throw error;

                      setRankings({});
                      setShowYearDialog(false);
                      setYearDates(Array.from({ length: RANKING_RULES.totalRounds }, () => ''));
                      toast.success('Nou any creat correctament!');
                      // Reload page to refresh all components
                      window.location.reload();
                    } catch (err: any) {
                      toast.error(err.message || 'Error canviant d\'any');
                    } finally {
                      setChangingYear(false);
                    }
                  }}
                >
                  {changingYear ? 'Canviant...' : 'Confirmar canvi d\'any'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </section>
    </div>
  );
}
