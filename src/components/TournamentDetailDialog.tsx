import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, User } from 'lucide-react';
import { usePlayerDetail } from '@/components/PlayerDetailContext';

interface TournamentResult {
  player_id: string;
  player_name: string;
  gender: string;
  scratch_score: number | null;
  handicap_score: number | null;
  points: number;
}

interface Props {
  roundNumber: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TournamentDetailDialog({ roundNumber, open, onOpenChange }: Props) {
  const { openPlayer } = usePlayerDetail();
  const [results, setResults] = useState<TournamentResult[]>([]);
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentDate, setTournamentDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roundNumber || !open) return;
    setLoading(true);

    async function fetch() {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('id, name, date')
        .eq('round_number', roundNumber!)
        .maybeSingle();

      if (!tournament) { setLoading(false); return; }

      setTournamentName(tournament.name);
      setTournamentDate(tournament.date || '');

      const { data } = await supabase
        .from('results')
        .select('player_id, scratch_score, handicap_score, points, players(name, gender)')
        .eq('tournament_id', tournament.id)
        .order('scratch_score', { ascending: false });

      if (data) {
        setResults(data.map((r: any) => ({
          player_id: r.player_id,
          player_name: r.players?.name || 'Desconegut',
          gender: r.players?.gender || 'male',
          scratch_score: r.scratch_score,
          handicap_score: r.handicap_score,
          points: r.points,
        })));
      }
      setLoading(false);
    }
    fetch();
  }, [roundNumber, open]);

  const maleResults = results.filter(r => r.gender === 'male');
  const femaleResults = results.filter(r => r.gender === 'female');

  const formatDate = (d: string) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const ResultTable = ({ data, sortBy }: { data: TournamentResult[]; sortBy: 'scratch' | 'handicap' }) => {
    const sorted = [...data].sort((a, b) => {
      const va = sortBy === 'scratch' ? a.scratch_score : a.handicap_score;
      const vb = sortBy === 'scratch' ? b.scratch_score : b.handicap_score;
      return (va ?? 999) - (vb ?? 999);
    });

    return (
      <div className="space-y-1">
        <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem] gap-1 px-2 py-1.5 text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
          <span>#</span>
          <span>Jugador</span>
          <span className="text-right">Scr</span>
          <span className="text-right">Hcp</span>
        </div>
        {sorted.map((r, i) => (
          <div
            key={r.player_name + i}
            className={`grid grid-cols-[2rem_1fr_3.5rem_3.5rem] gap-1 px-2 py-1.5 rounded text-sm ${
              i < 3 ? 'bg-primary/5' : ''
            }`}
          >
            <span className={`font-display font-bold text-xs ${i < 3 ? 'text-primary' : 'text-muted-foreground'}`}>
              {i + 1}
            </span>
            <button
              onClick={() => openPlayer(r.player_id, r.player_name, r.gender)}
              className="font-sans text-xs text-foreground truncate hover:text-primary hover:underline transition-colors text-left"
            >
              {r.player_name}
            </button>
            <span className={`text-right font-bold tabular-nums text-xs ${sortBy === 'scratch' ? 'text-primary' : 'text-foreground'}`}>
              {r.scratch_score ?? '-'}
            </span>
            <span className={`text-right font-bold tabular-nums text-xs ${sortBy === 'handicap' ? 'text-primary' : 'text-foreground'}`}>
              {r.handicap_score ?? '-'}
            </span>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">Sense resultats</p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            {tournamentName || `Prova ${roundNumber}`}
          </DialogTitle>
          {tournamentDate && (
            <p className="text-sm text-muted-foreground font-sans">{formatDate(tournamentDate)}</p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <Tabs defaultValue="scratch_male">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
              <TabsTrigger value="scratch_male" className="text-xs">Scr. Masc.</TabsTrigger>
              <TabsTrigger value="scratch_female" className="text-xs">Scr. Fem.</TabsTrigger>
              <TabsTrigger value="handicap_male" className="text-xs">Hcp. Masc.</TabsTrigger>
              <TabsTrigger value="handicap_female" className="text-xs">Hcp. Fem.</TabsTrigger>
            </TabsList>
            <TabsContent value="scratch_male">
              <ResultTable data={maleResults} sortBy="scratch" />
            </TabsContent>
            <TabsContent value="scratch_female">
              <ResultTable data={femaleResults} sortBy="scratch" />
            </TabsContent>
            <TabsContent value="handicap_male">
              <ResultTable data={maleResults} sortBy="handicap" />
            </TabsContent>
            <TabsContent value="handicap_female">
              <ResultTable data={femaleResults} sortBy="handicap" />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
