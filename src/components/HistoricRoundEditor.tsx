import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Save, Trash2, Search, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ResultRow {
  id: string;
  player_name: string;
  gender: string;
  scratch_score: number | null;
  handicap_score: number | null;
  license_number: string | null;
  round_name: string | null;
  round_date: string | null;
  hole_scores: { id: string; hole_number: number; strokes: number }[];
  dirty: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  seasonId: string;
  roundNumber: number;
  onSaved: () => void;
}

export default function HistoricRoundEditor({ open, onClose, seasonId, roundNumber, onSaved }: Props) {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const [{ data: resData }, { data: holeData }] = await Promise.all([
        supabase.from('historic_results').select('*')
          .eq('season_id', seasonId).eq('round_number', roundNumber)
          .order('scratch_score', { ascending: true }),
        supabase.from('historic_hole_scores').select('*')
          .eq('season_id', seasonId).eq('round_number', roundNumber)
          .order('hole_number')
          .range(0, 4999),
      ]);

      const holeMap = new Map<string, { id: string; hole_number: number; strokes: number }[]>();
      (holeData || []).forEach((h: any) => {
        const key = h.player_name;
        if (!holeMap.has(key)) holeMap.set(key, []);
        holeMap.get(key)!.push({ id: h.id, hole_number: h.hole_number, strokes: h.strokes });
      });

      setResults((resData || []).map((r: any) => ({
        id: r.id,
        player_name: r.player_name,
        gender: r.gender,
        scratch_score: r.scratch_score,
        handicap_score: r.handicap_score,
        license_number: r.license_number,
        round_name: r.round_name,
        round_date: r.round_date,
        hole_scores: (holeMap.get(r.player_name) || []).sort((a, b) => a.hole_number - b.hole_number),
        dirty: false,
      })));
      setLoading(false);
    })();
  }, [open, seasonId, roundNumber]);

  const updateField = (idx: number, field: 'scratch_score' | 'handicap_score', value: string) => {
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value === '' ? null : parseInt(value), dirty: true } : r));
  };

  const updateHole = (resultIdx: number, holeNumber: number, value: string) => {
    setResults(prev => prev.map((r, i) => {
      if (i !== resultIdx) return r;
      const strokes = value === '' ? 0 : parseInt(value);
      const existing = r.hole_scores.find(h => h.hole_number === holeNumber);
      let newHoles;
      if (existing) {
        newHoles = r.hole_scores.map(h => h.hole_number === holeNumber ? { ...h, strokes } : h);
      } else {
        newHoles = [...r.hole_scores, { id: '', hole_number: holeNumber, strokes }];
      }
      return { ...r, hole_scores: newHoles, dirty: true };
    }));
  };

  const deleteResult = async (idx: number) => {
    const r = results[idx];
    if (!confirm(`Eliminar resultat de ${r.player_name}?`)) return;
    await Promise.all([
      supabase.from('historic_results').delete().eq('id', r.id),
      supabase.from('historic_hole_scores').delete()
        .eq('season_id', seasonId).eq('round_number', roundNumber).eq('player_name', r.player_name),
    ]);
    setResults(prev => prev.filter((_, i) => i !== idx));
    toast.success(`Resultat de ${r.player_name} eliminat`);
  };

  const handleSave = async () => {
    const dirtyRows = results.filter(r => r.dirty);
    if (dirtyRows.length === 0) { toast.info('Cap canvi per guardar'); return; }
    setSaving(true);
    try {
      for (const r of dirtyRows) {
        await supabase.from('historic_results').update({
          scratch_score: r.scratch_score,
          handicap_score: r.handicap_score,
        }).eq('id', r.id);

        // Update hole scores
        for (const h of r.hole_scores) {
          if (h.id) {
            await supabase.from('historic_hole_scores').update({ strokes: h.strokes }).eq('id', h.id);
          } else {
            await supabase.from('historic_hole_scores').insert({
              season_id: seasonId,
              round_number: roundNumber,
              player_name: r.player_name,
              license_number: r.license_number,
              hole_number: h.hole_number,
              strokes: h.strokes,
            });
          }
        }
      }
      setResults(prev => prev.map(r => ({ ...r, dirty: false })));
      toast.success(`${dirtyRows.length} resultats actualitzats. Recalculant classificacions...`);

      // Recalculate rankings
      const { error: recalcError } = await supabase.functions.invoke('process-historic-excel', {
        body: { recalculateOnly: true, seasonId },
      });
      if (recalcError) {
        toast.error('Error recalculant classificacions: ' + recalcError.message);
      } else {
        toast.success('Classificacions actualitzades!');
      }
      onSaved();
    } catch (err: any) {
      toast.error('Error guardant: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = results.filter(r => {
    if (filter !== 'all' && r.gender !== filter) return false;
    if (searchQuery.trim()) {
      return r.player_name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    }
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Prova {roundNumber}
            {results[0]?.round_name && <Badge variant="outline">{results[0].round_name}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 mb-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tots ({results.length})</SelectItem>
              <SelectItem value="male">Masculí ({results.filter(r => r.gender === 'male').length})</SelectItem>
              <SelectItem value="female">Femení ({results.filter(r => r.gender === 'female').length})</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar jugador..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          {results.some(r => r.dirty) && (
            <Badge variant="destructive" className="text-xs">Canvis sense guardar</Badge>
          )}
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr>
                  <th className="py-2 px-2 text-left font-bold text-foreground min-w-[140px]">Jugador</th>
                  <th className="py-2 px-1 text-center font-bold text-foreground w-14">SCR</th>
                  <th className="py-2 px-1 text-center font-bold text-foreground w-14">HCP</th>
                  {Array.from({ length: 18 }, (_, i) => (
                    <th key={i} className="py-2 px-0 text-center font-bold text-muted-foreground w-9">{i + 1}</th>
                  ))}
                  <th className="py-2 px-1 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const realIdx = results.indexOf(r);
                  const holeLookup = new Map(r.hole_scores.map(h => [h.hole_number, h]));
                  return (
                    <tr key={r.id} className={`border-b border-border/30 ${r.dirty ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                      <td className="py-1.5 px-2 font-medium text-foreground truncate max-w-[160px]">
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${r.gender === 'female' ? 'bg-pink-400' : 'bg-blue-400'}`} />
                          {r.player_name}
                        </div>
                      </td>
                      <td className="py-1 px-0.5 text-center">
                        <Input
                          type="number"
                          value={r.scratch_score ?? ''}
                          onChange={e => updateField(realIdx, 'scratch_score', e.target.value)}
                          className="h-7 w-14 text-center text-xs px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="py-1 px-0.5 text-center">
                        <Input
                          type="number"
                          value={r.handicap_score ?? ''}
                          onChange={e => updateField(realIdx, 'handicap_score', e.target.value)}
                          className="h-7 w-14 text-center text-xs px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      {Array.from({ length: 18 }, (_, hIdx) => {
                        const hole = holeLookup.get(hIdx + 1);
                        return (
                          <td key={hIdx} className="py-1 px-0 text-center">
                            <Input
                              type="number"
                              value={hole?.strokes ?? ''}
                              onChange={e => updateHole(realIdx, hIdx + 1, e.target.value)}
                              className="h-7 w-9 text-center text-xs px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>
                        );
                      })}
                      <td className="py-1 px-0.5 text-center">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteResult(realIdx)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Tancar</Button>
          <Button onClick={handleSave} disabled={saving || !results.some(r => r.dirty)} className="gap-1">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardant...</> : <><Save className="w-4 h-4" /> Guardar canvis</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
