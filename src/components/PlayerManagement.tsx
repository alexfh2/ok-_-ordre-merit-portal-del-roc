import { useState, useEffect, useRef } from 'react';
import { Search, Pencil, Save, X, User, Camera, Loader2, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';

interface Player {
  id: string;
  name: string;
  gender: string;
  license_number: string | null;
  photo_url: string | null;
  is_subscriber: boolean;
}

interface HoleScoreEdit {
  id: string;
  hole_number: number;
  strokes: number;
  tournament_id: string;
  tournament_name: string;
  round_number: number;
}

interface ResultEdit {
  id: string;
  tournament_id: string;
  tournament_name: string;
  round_number: number;
  scratch_score: number | null;
  handicap_score: number | null;
}

function getPhotoUrl(photoPath: string | null): string | null {
  if (!photoPath) return null;
  // If it's already a full URL (legacy), return as-is
  if (photoPath.startsWith('http')) return photoPath;
  // Build public URL from storage path
  const { data } = supabase.storage.from('player-photos').getPublicUrl(photoPath);
  return data.publicUrl;
}

export default function PlayerManagement() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editPlayer, setEditPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState('male');
  const [editLicense, setEditLicense] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [editIsSubscriber, setEditIsSubscriber] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hole scores editing
  const [editHoles, setEditHoles] = useState<HoleScoreEdit[]>([]);
  const [editResults, setEditResults] = useState<ResultEdit[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchPlayers();
  }, []);

  async function fetchPlayers() {
    setLoading(true);
    const { data } = await supabase
      .from('players')
      .select('id, name, gender, license_number, photo_url, is_subscriber')
      .order('name', { ascending: true });
    setPlayers((data || []) as Player[]);
    setLoading(false);
  }

  async function toggleSubscriber(player: Player, value: boolean) {
    // Optimistic update
    setPlayers((prev) => prev.map((p) => (p.id === player.id ? { ...p, is_subscriber: value } : p)));
    const { error } = await supabase
      .from('players')
      .update({ is_subscriber: value, subscriber_updated_at: new Date().toISOString() })
      .eq('id', player.id);
    if (error) {
      toast.error('No s\'ha pogut actualitzar abonat');
      setPlayers((prev) => prev.map((p) => (p.id === player.id ? { ...p, is_subscriber: !value } : p)));
    } else {
      toast.success(value ? 'Marcat com abonat' : 'Desmarcat com abonat');
    }
  }

  async function openEdit(player: Player) {
    setEditPlayer(player);
    setEditName(player.name);
    setEditGender(player.gender);
    setEditLicense(player.license_number || '');
    setEditPhotoUrl(player.photo_url);
    setEditIsSubscriber(!!player.is_subscriber);
    setLoadingDetails(true);

    const [{ data: results }, { data: holes }] = await Promise.all([
      supabase
        .from('results')
        .select('id, tournament_id, scratch_score, handicap_score, tournaments(name, round_number)')
        .eq('player_id', player.id)
        .order('tournament_id'),
      supabase
        .from('hole_scores')
        .select('id, hole_number, strokes, tournament_id, tournaments(name, round_number)')
        .eq('player_id', player.id)
        .order('tournament_id')
        .order('hole_number'),
    ]);

    setEditResults((results || []).map(r => ({
      id: r.id,
      tournament_id: r.tournament_id,
      tournament_name: (r.tournaments as any)?.name || '',
      round_number: (r.tournaments as any)?.round_number || 0,
      scratch_score: r.scratch_score,
      handicap_score: r.handicap_score,
    })).sort((a, b) => a.round_number - b.round_number));

    setEditHoles((holes || []).map(h => ({
      id: h.id,
      hole_number: h.hole_number,
      strokes: h.strokes,
      tournament_id: h.tournament_id,
      tournament_name: (h.tournaments as any)?.name || '',
      round_number: (h.tournaments as any)?.round_number || 0,
    })));

    setLoadingDetails(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editPlayer) return;

    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${editPlayer.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('player-photos')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Store only the path, not the full URL
      setEditPhotoUrl(path);
      toast.success('Foto pujada correctament');
    } catch (err: any) {
      toast.error(err.message || 'Error pujant la foto');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    if (!editPlayer) return;
    setSaving(true);

    try {
      const { error: playerErr } = await supabase
        .from('players')
        .update({
          name: editName,
          gender: editGender,
          license_number: editLicense || null,
          photo_url: editPhotoUrl,
        })
        .eq('id', editPlayer.id);
      if (playerErr) throw playerErr;

      for (const r of editResults) {
        await supabase
          .from('results')
          .update({ scratch_score: r.scratch_score, handicap_score: r.handicap_score })
          .eq('id', r.id);
      }

      for (const h of editHoles) {
        await supabase
          .from('hole_scores')
          .update({ strokes: h.strokes })
          .eq('id', h.id);
      }

      toast.success('Jugador actualitzat correctament');
      setEditPlayer(null);
      fetchPlayers();
    } catch (err: any) {
      toast.error(err.message || 'Error actualitzant');
    } finally {
      setSaving(false);
    }
  }

  const filtered = search.trim()
    ? players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : players;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar jugador..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 font-sans"
          />
        </div>
        <span className="text-sm text-muted-foreground font-sans whitespace-nowrap">{players.length} jugadors</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="py-2 px-3 text-left font-display text-xs text-muted-foreground w-10"></th>
                <th className="py-2 px-3 text-left font-display text-xs text-muted-foreground">Nom</th>
                <th className="py-2 px-3 text-left font-display text-xs text-muted-foreground w-20">Gènere</th>
                <th className="py-2 px-3 text-left font-display text-xs text-muted-foreground w-24">Llicència</th>
                <th className="py-2 px-3 text-center font-display text-xs text-muted-foreground w-16">Editar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-accent/20 transition-colors">
                  <td className="py-1.5 px-3">
                    <Avatar className="h-7 w-7">
                      {getPhotoUrl(p.photo_url) && <AvatarImage src={getPhotoUrl(p.photo_url)!} alt={p.name} />}
                      <AvatarFallback className="text-[10px] font-display bg-primary/10 text-primary">
                        {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </td>
                  <td className="py-2 px-3 font-sans font-medium text-foreground text-sm">{p.name}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground font-sans">
                    {p.gender === 'female' ? 'Dona' : 'Home'}
                  </td>
                  <td className="py-2 px-3 text-xs text-muted-foreground font-sans tabular-nums">
                    {p.license_number || '—'}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground font-sans">
                    Cap jugador trobat
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editPlayer} onOpenChange={(open) => !open && setEditPlayer(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Editar Jugador
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Photo + basic info */}
            <div className="flex items-start gap-4">
              {/* Photo upload */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <Avatar className="h-20 w-20 border-2 border-border">
                    {getPhotoUrl(editPhotoUrl) && <AvatarImage src={getPhotoUrl(editPhotoUrl)!} alt={editName} />}
                    <AvatarFallback className="text-lg font-display bg-primary/10 text-primary">
                      {editName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingPhoto ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5 text-white" />
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <span className="text-[10px] text-muted-foreground font-sans">Canviar foto</span>
              </div>

              {/* Basic info */}
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="font-sans text-xs">Nom</Label>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="font-sans" />
                </div>
                <div>
                  <Label className="font-sans text-xs">Gènere</Label>
                  <Select value={editGender} onValueChange={setEditGender}>
                    <SelectTrigger className="font-sans"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Home</SelectItem>
                      <SelectItem value="female">Dona</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-sans text-xs">Llicència</Label>
                  <Input value={editLicense} onChange={e => setEditLicense(e.target.value)} className="font-sans tabular-nums" />
                </div>
              </div>
            </div>

            {loadingDetails ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Results */}
                {editResults.length > 0 && (
                  <div>
                    <h4 className="font-display font-bold text-sm text-foreground mb-2">Resultats</h4>
                    <div className="space-y-2">
                      {editResults.map((r, ri) => (
                        <div key={r.id} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2">
                          <span className="font-display font-bold text-xs text-primary w-8">P{r.round_number}</span>
                          <div className="flex items-center gap-2 flex-1">
                            <Label className="font-sans text-xs text-muted-foreground w-10">Brut</Label>
                            <Input
                              type="number"
                              value={r.scratch_score ?? ''}
                              onChange={e => {
                                const copy = [...editResults];
                                copy[ri] = { ...copy[ri], scratch_score: e.target.value ? parseInt(e.target.value) : null };
                                setEditResults(copy);
                              }}
                              className="w-16 h-8 text-center font-sans tabular-nums text-sm"
                            />
                            <Label className="font-sans text-xs text-muted-foreground w-10">Net</Label>
                            <Input
                              type="number"
                              value={r.handicap_score ?? ''}
                              onChange={e => {
                                const copy = [...editResults];
                                copy[ri] = { ...copy[ri], handicap_score: e.target.value ? parseInt(e.target.value) : null };
                                setEditResults(copy);
                              }}
                              className="w-16 h-8 text-center font-sans tabular-nums text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hole scores grouped by tournament */}
                {editHoles.length > 0 && (() => {
                  const grouped = new Map<string, HoleScoreEdit[]>();
                  for (const h of editHoles) {
                    const key = h.tournament_id;
                    if (!grouped.has(key)) grouped.set(key, []);
                    grouped.get(key)!.push(h);
                  }

                  return (
                    <div>
                      <h4 className="font-display font-bold text-sm text-foreground mb-2">Cops per Forat</h4>
                      <div className="space-y-3">
                        {Array.from(grouped.entries()).map(([tid, holes]) => {
                          const sorted = [...holes].sort((a, b) => a.hole_number - b.hole_number);
                          return (
                            <div key={tid} className="bg-muted/30 rounded-lg p-3">
                              <div className="font-display font-bold text-xs text-primary mb-2">P{sorted[0]?.round_number} — {sorted[0]?.tournament_name}</div>
                              <div className="grid grid-cols-9 gap-1">
                                {sorted.map((h) => {
                                  const hIdx = editHoles.findIndex(eh => eh.id === h.id);
                                  return (
                                    <div key={h.id} className="text-center">
                                      <div className="text-[10px] text-muted-foreground font-sans mb-0.5">{h.hole_number}</div>
                                      <Input
                                        type="number"
                                        value={h.strokes}
                                        onChange={e => {
                                          const copy = [...editHoles];
                                          copy[hIdx] = { ...copy[hIdx], strokes: parseInt(e.target.value) || 0 };
                                          setEditHoles(copy);
                                        }}
                                        className="w-full h-7 text-center font-sans tabular-nums text-xs p-0"
                                        min={1}
                                        max={15}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlayer(null)}>
              <X className="w-4 h-4" /> Cancel·lar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4" /> {saving ? 'Guardant...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
