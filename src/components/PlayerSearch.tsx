import { useState, useMemo, useCallback } from 'react';
import { Search, X, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePlayerDetail } from './PlayerDetailContext';
import { useIsMobile } from '@/hooks/use-mobile';

export default function PlayerSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [allPlayers, setAllPlayers] = useState<{ id: string; name: string; gender: string }[]>([]);
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const { openPlayer } = usePlayerDetail();
  const isMobile = useIsMobile();

  const loadPlayers = useCallback(async () => {
    if (playersLoaded) return;
    const { data } = await supabase
      .from('players')
      .select('id, name, gender')
      .order('name', { ascending: true });
    setAllPlayers(data || []);
    setPlayersLoaded(true);
  }, [playersLoaded]);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return allPlayers.filter(p => p.name.toLowerCase().includes(q)).slice(0, 10);
  }, [query, allPlayers]);

  function handleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      loadPlayers();
      setQuery('');
    }
  }

  function handleSelectPlayer(p: { id: string; name: string; gender: string }) {
    setOpen(false);
    openPlayer(p.id, p.name, p.gender);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {isMobile ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
            <Search className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/5">
            <Search className="w-4 h-4 text-primary" />
            <span className="font-sans font-medium">Buscar Jugador</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Buscar Jugador
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Escriu el nom del jugador..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-8 font-sans"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {filtered.length > 0 && (
          <div className="border border-border rounded-lg divide-y divide-border overflow-hidden max-h-[300px] overflow-y-auto">
            {filtered.map(p => (
              <button
                key={p.id}
                className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex items-center gap-3"
                onClick={() => handleSelectPlayer(p)}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <span className="font-sans font-medium text-sm text-foreground">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {query.trim() && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4 font-sans">
            Cap jugador trobat amb "{query}"
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
