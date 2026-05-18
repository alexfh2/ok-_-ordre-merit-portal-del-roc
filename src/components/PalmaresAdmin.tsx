import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Upload, FileSpreadsheet, Loader2, Trash2, Eye, Globe, GlobeLock, ChevronDown, ChevronUp, Trophy, Camera, Pencil, RefreshCw, Settings, PlusCircle, ClipboardList } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import HistoricRoundEditor from './HistoricRoundEditor';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORY_LABELS: Record<string, string> = {
  scratch_male: 'Scratch Masculí',
  handicap_male: 'Handicap Masculí',
  scratch_female: 'Scratch Femení',
  handicap_female: 'Handicap Femení',
  general: 'Classificació General',
};

interface Season {
  id: string;
  year: number;
  total_rounds: number;
  counting_rounds: number;
  modality: string;
  status: string;
}

interface RoundStatus {
  round: number;
  hasData: boolean;
  resultCount: number;
  roundName: string | null;
}

export default function PalmaresAdmin() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedSeason, setExpandedSeason] = useState<string | null>(null);
  const [roundStatuses, setRoundStatuses] = useState<Record<string, RoundStatus[]>>({});
  const [previewSeason, setPreviewSeason] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);

  // Create form
  const [newYear, setNewYear] = useState('');
  const [newTotalRounds, setNewTotalRounds] = useState('10');
  const [newCountingRounds, setNewCountingRounds] = useState('8');
  const [newModality, setNewModality] = useState('medalplay');

  // Upload state
  const [uploadingRound, setUploadingRound] = useState<{ seasonId: string; round: number } | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [editingRound, setEditingRound] = useState<{ seasonId: string; round: number } | null>(null);

  // Winner photo upload
  const [winnerPhotoUpload, setWinnerPhotoUpload] = useState<{ seasonId: string; category: string; position: number; playerName: string } | null>(null);

  // Modality edit
  const [editModalitySeason, setEditModalitySeason] = useState<Season | null>(null);
  const [editModality, setEditModality] = useState('');
  const [editTotalRounds, setEditTotalRounds] = useState('');
  const [editCountingRounds, setEditCountingRounds] = useState('');

  // Quick ranking entry
  const [quickEntryOpen, setQuickEntryOpen] = useState<string | null>(null); // seasonId
  const [quickEntryCategory] = useState('general');
  const [quickEntryText, setQuickEntryText] = useState('');
  const [quickEntrySaving, setQuickEntrySaving] = useState(false);

  // Confirmation dialogs
  const [confirmAction, setConfirmAction] = useState<{ title: string; description: string; action: () => Promise<void> } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const fetchSeasons = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('historic_seasons')
      .select('*')
      .order('year', { ascending: false });
    if (error) { toast.error('Error carregant temporades'); console.error(error); }
    else setSeasons((data || []) as Season[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSeasons(); }, [fetchSeasons]);

  const fetchRoundStatuses = async (seasonId: string, totalRounds: number) => {
    const { data } = await supabase
      .from('historic_results')
      .select('round_number, round_name')
      .eq('season_id', seasonId);

    const statuses: RoundStatus[] = [];
    for (let r = 1; r <= totalRounds; r++) {
      const roundResults = (data || []).filter(d => d.round_number === r);
      statuses.push({
        round: r,
        hasData: roundResults.length > 0,
        resultCount: roundResults.length,
        roundName: roundResults[0]?.round_name || null,
      });
    }
    setRoundStatuses(prev => ({ ...prev, [seasonId]: statuses }));
  };

  const handleCreate = async () => {
    if (!newYear) { toast.error('Selecciona un any'); return; }
    const { error } = await supabase.from('historic_seasons').insert({
      year: parseInt(newYear),
      total_rounds: parseInt(newTotalRounds),
      counting_rounds: parseInt(newCountingRounds),
      modality: newModality,
    });
    if (error) {
      if (error.code === '23505') toast.error('Aquesta temporada ja existeix');
      else toast.error('Error: ' + error.message);
      return;
    }
    toast.success(`Temporada ${newYear} creada`);
    setCreateOpen(false);
    setNewYear('');
    fetchSeasons();
  };

  const handleDelete = async (id: string, year: number) => {
    if (!confirm(`Eliminar temporada ${year} i totes les dades?`)) return;
    const { error } = await supabase.from('historic_seasons').delete().eq('id', id);
    if (error) toast.error('Error eliminant');
    else { toast.success('Temporada eliminada'); fetchSeasons(); }
  };

  const handleTogglePublish = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    const { error } = await supabase.from('historic_seasons').update({ status: newStatus }).eq('id', id);
    if (error) toast.error('Error');
    else { toast.success(newStatus === 'published' ? 'Publicada!' : 'Despublicada'); fetchSeasons(); }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadingRound) return;
    setProcessing(true);
    try {
      const fileName = `historic_${Date.now()}_${uploadFile.name}`;
      const { error: uploadError } = await supabase.storage.from('excel-uploads').upload(fileName, uploadFile);
      if (uploadError) throw uploadError;

      const { data, error } = await supabase.functions.invoke('process-historic-excel', {
        body: { fileName, seasonId: uploadingRound.seasonId, roundNumber: uploadingRound.round },
      });
      if (error) throw error;

      toast.success(`Prova ${uploadingRound.round} processada: ${data.stats?.total_results || 0} resultats`);
      setUploadFile(null);
      setUploadingRound(null);
      const season = seasons.find(s => s.id === uploadingRound.seasonId);
      if (season) fetchRoundStatuses(season.id, season.total_rounds);
    } catch (err: any) {
      toast.error(err.message || 'Error processant');
    } finally {
      setProcessing(false);
    }
  };

  const handlePreview = async (seasonId: string) => {
    const [{ data: rankings }, { data: winners }, { data: results }] = await Promise.all([
      supabase.from('historic_rankings').select('*').eq('season_id', seasonId).order('position'),
      supabase.from('historic_winners').select('*').eq('season_id', seasonId).order('position'),
      supabase.from('historic_results').select('round_number, round_name').eq('season_id', seasonId),
    ]);
    const rounds = [...new Set((results || []).map(r => r.round_number))].sort((a, b) => a - b);
    const roundNames = new Map<number, string>();
    (results || []).forEach(r => { if (r.round_name) roundNames.set(r.round_number, r.round_name); });

    setPreviewData({ rankings, winners, rounds, roundNames: Object.fromEntries(roundNames) });
    setPreviewSeason(seasonId);
  };

  const handleWinnerPhoto = async (file: File) => {
    if (!winnerPhotoUpload) return;
    try {
      const ext = file.name.split('.').pop();
      const path = `${winnerPhotoUpload.seasonId}/${winnerPhotoUpload.category}_${winnerPhotoUpload.position}.${ext}`;
      await supabase.storage.from('winner-photos').upload(path, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('winner-photos').getPublicUrl(path);

      await supabase.from('historic_winners').update({ photo_url: publicUrl })
        .eq('season_id', winnerPhotoUpload.seasonId)
        .eq('category', winnerPhotoUpload.category)
        .eq('position', winnerPhotoUpload.position);

      toast.success('Foto actualitzada');
      setWinnerPhotoUpload(null);
    } catch (err: any) {
      toast.error('Error pujant foto');
    }
  };

  const toggleExpand = (seasonId: string, totalRounds: number) => {
    if (expandedSeason === seasonId) {
      setExpandedSeason(null);
    } else {
      setExpandedSeason(seasonId);
      if (!roundStatuses[seasonId]) fetchRoundStatuses(seasonId, totalRounds);
    }
  };

  const handleAddRound = (season: Season) => {
    setConfirmAction({
      title: `Afegir prova a ${season.year}`,
      description: `S'afegirà la prova ${season.total_rounds + 1} a la temporada ${season.year}. Estàs segur?`,
      action: async () => {
        const newTotal = season.total_rounds + 1;
        const { error } = await supabase.from('historic_seasons').update({ total_rounds: newTotal }).eq('id', season.id);
        if (error) { toast.error('Error: ' + error.message); return; }
        toast.success(`Prova ${newTotal} afegida a ${season.year}`);
        fetchSeasons();
        if (expandedSeason === season.id) fetchRoundStatuses(season.id, newTotal);
      },
    });
  };

  const handleEditModality = (season: Season) => {
    setEditModalitySeason(season);
    setEditModality(season.modality);
    setEditTotalRounds(String(season.total_rounds));
    setEditCountingRounds(String(season.counting_rounds));
  };

  const handleSaveModality = () => {
    if (!editModalitySeason) return;
    const season = editModalitySeason;
    setConfirmAction({
      title: `Modificar configuració de ${season.year}`,
      description: `Es canviarà la modalitat/configuració de la temporada ${season.year}. Estàs segur?`,
      action: async () => {
        const { error } = await supabase.from('historic_seasons').update({
          modality: editModality,
          total_rounds: parseInt(editTotalRounds),
          counting_rounds: parseInt(editCountingRounds),
        }).eq('id', season.id);
        if (error) { toast.error('Error: ' + error.message); return; }
        toast.success(`Configuració de ${season.year} actualitzada. Regenerant classificacions...`);
        setEditModalitySeason(null);
        fetchSeasons();
        // Regenerate rankings
        const { error: recalcError } = await supabase.functions.invoke('process-historic-excel', {
          body: { recalculateOnly: true, seasonId: season.id },
        });
        if (recalcError) toast.error('Error regenerant: ' + recalcError.message);
        else toast.success('Classificacions regenerades!');
        if (expandedSeason === season.id) fetchRoundStatuses(season.id, parseInt(editTotalRounds));
      },
    });
  };

  const handleRegenerateRankings = (season: Season) => {
    setConfirmAction({
      title: `Regenerar classificacions de ${season.year}`,
      description: `Es recalcularan totes les classificacions de la temporada ${season.year}. Estàs segur?`,
      action: async () => {
        setRegenerating(season.id);
        const { error } = await supabase.functions.invoke('process-historic-excel', {
          body: { recalculateOnly: true, seasonId: season.id },
        });
        setRegenerating(null);
        if (error) toast.error('Error regenerant: ' + error.message);
        else toast.success(`Classificacions de ${season.year} regenerades!`);
      },
    });
  };

  const handleQuickEntry = async () => {
    if (!quickEntryOpen || !quickEntryText.trim()) return;
    setQuickEntrySaving(true);
    try {
      const lines = quickEntryText.trim().split('\n').filter(l => l.trim());
      const entries: { name: string; points: number }[] = [];
      for (const line of lines) {
        // Accept formats: "Name, 150" or "Name - 150" or "Name 150" or "1. Name 150"
        const cleaned = line.replace(/^\d+[\.\)\-]\s*/, '').trim();
        const match = cleaned.match(/^(.+?)\s*[,\-–]\s*(\d+)\s*$/) || cleaned.match(/^(.+?)\s+(\d+)\s*$/);
        if (match) {
          entries.push({ name: match[1].trim(), points: parseInt(match[2]) });
        }
      }
      if (entries.length === 0) {
        toast.error('No s\'han pogut interpretar les dades. Format: "Nom, punts" o "Nom - punts"');
        setQuickEntrySaving(false);
        return;
      }

      // Sort by points (stableford = higher is better, medalplay = lower is better)
      const season = seasons.find(s => s.id === quickEntryOpen);
      const isStableford = season?.modality === 'stableford';
      entries.sort((a, b) => isStableford ? b.points - a.points : a.points - b.points);

      // Delete existing rankings for this category+season
      await supabase.from('historic_rankings').delete()
        .eq('season_id', quickEntryOpen)
        .eq('category', quickEntryCategory);

      // Insert rankings
      const rankingsToInsert = entries.map((e, i) => ({
        season_id: quickEntryOpen,
        category: quickEntryCategory,
        player_name: e.name,
        total_points: e.points,
        position: i + 1,
        rounds_played: 0, // 0 indicates no round-by-round data
      }));
      const { error: insertError } = await supabase.from('historic_rankings').insert(rankingsToInsert);
      if (insertError) throw insertError;

      // Upsert top 3 as winners
      await supabase.from('historic_winners').delete()
        .eq('season_id', quickEntryOpen)
        .eq('category', quickEntryCategory);

      const winnersToInsert = entries.slice(0, 3).map((e, i) => ({
        season_id: quickEntryOpen,
        category: quickEntryCategory,
        player_name: e.name,
        position: i + 1,
      }));
      if (winnersToInsert.length > 0) {
        await supabase.from('historic_winners').insert(winnersToInsert);
      }

      toast.success(`${entries.length} jugadors afegits a la classificació general`);
      setQuickEntryText('');
      setQuickEntryOpen(null);
    } catch (err: any) {
      toast.error(err.message || 'Error desant dades');
    } finally {
      setQuickEntrySaving(false);
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      await confirmAction.action();
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  };

  // Get existing years for filtering
  const existingYears = new Set(seasons.map(s => s.year));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" /> Palmarés Històric
          </h2>
          <p className="text-sm text-muted-foreground">{seasons.length} temporades</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1">
          <Plus className="w-4 h-4" /> Nova temporada
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Carregant...</p>
      ) : seasons.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No hi ha temporades creades</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {seasons.map(season => (
            <Card key={season.id} className="overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(season.id, season.total_rounds)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-foreground">{season.year}</span>
                  <Badge variant={season.status === 'published' ? 'default' : 'secondary'}>
                    {season.status === 'published' ? '🌐 Publicada' : '📝 Esborrany'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {season.total_rounds} proves · {season.counting_rounds} puntuen · {season.modality}
                  </span>
                </div>
                <TooltipProvider delayDuration={200}>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); handleAddRound(season); }}>
                        <PlusCircle className="w-4 h-4 text-primary" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Afegir prova</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); handleEditModality(season); }}>
                        <Settings className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Modificar modalitat/configuració</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); handleRegenerateRankings(season); }}>
                        {regenerating === season.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Regenerar classificacions</TooltipContent>
                  </Tooltip>
                  <span className="w-px h-5 bg-border" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); handlePreview(season.id); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Previsualitzar</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); handleTogglePublish(season.id, season.status); }}>
                        {season.status === 'published' ? <GlobeLock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{season.status === 'published' ? 'Despublicar' : 'Publicar'}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={e => { e.stopPropagation(); handleDelete(season.id, season.year); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Eliminar temporada</TooltipContent>
                  </Tooltip>
                  {expandedSeason === season.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
                </TooltipProvider>
              </div>

              <AnimatePresence>
                {expandedSeason === season.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 border-t border-border/50 pt-3">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {(roundStatuses[season.id] || []).map(rs => (
                          <div
                            key={rs.round}
                            className={`flex items-center justify-between p-2 rounded-md border text-sm ${
                              rs.hasData ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'
                            }`}
                          >
                            <div>
                              <span className="font-medium text-foreground">P{rs.round}</span>
                              {rs.hasData && (
                                <span className="ml-1 text-xs text-primary">✓ {rs.resultCount}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5">
                              {rs.hasData && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => setEditingRound({ seasonId: season.id, round: rs.round })}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => { setUploadingRound({ seasonId: season.id, round: rs.round }); setUploadFile(null); }}
                              >
                                <Upload className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => { setQuickEntryOpen(season.id); setQuickEntryText(''); }}
                        >
                          <ClipboardList className="w-4 h-4" />
                          Entrada ràpida de classificació
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">Per temporades sense dades prova a prova</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Temporada Històrica</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Any</Label>
              <Select value={newYear} onValueChange={setNewYear}>
                <SelectTrigger><SelectValue placeholder="Selecciona l'any..." /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 2025 - 1993 + 1 }, (_, i) => 2025 - i)
                    .filter(y => !existingYears.has(y))
                    .map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº proves totals</Label>
                <Input type="number" value={newTotalRounds} onChange={e => setNewTotalRounds(e.target.value)} min="1" max="20" />
              </div>
              <div>
                <Label>Proves que puntuen</Label>
                <Input type="number" value={newCountingRounds} onChange={e => setNewCountingRounds(e.target.value)} min="1" max="20" />
              </div>
            </div>
            <div>
              <Label>Modalitat</Label>
              <Select value={newModality} onValueChange={setNewModality}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medalplay">Medalplay (cops)</SelectItem>
                  <SelectItem value="stableford">Stableford (punts)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel·lar</Button>
            <Button onClick={handleCreate}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      <Dialog open={!!uploadingRound} onOpenChange={() => setUploadingRound(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Pujar Excel — Prova {uploadingRound?.round}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              onClick={() => document.getElementById('historic-excel-input')?.click()}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files?.[0]) setUploadFile(e.dataTransfer.files[0]); }}
            >
              <input
                id="historic-excel-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); }}
              />
              {uploadFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="w-8 h-8 text-primary" />
                  <p className="font-medium text-foreground text-sm">{uploadFile.name}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Fes clic per seleccionar</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadingRound(null)}>Cancel·lar</Button>
            <Button onClick={handleUpload} disabled={!uploadFile || processing}>
              {processing ? <><Loader2 className="animate-spin w-4 h-4 mr-1" /> Processant...</> : 'Pujar i Processar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewSeason} onOpenChange={() => setPreviewSeason(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Preview — {seasons.find(s => s.id === previewSeason)?.year}
            </DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-6 mt-2">
              {/* Winners */}
              <div>
                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">🏆 Hall of Fame</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.keys(CATEGORY_LABELS).map(cat => {
                    const catWinners = (previewData.winners || []).filter((w: any) => w.category === cat);
                    if (catWinners.length === 0) return null;
                    return (
                      <Card key={cat} className="border-primary/20">
                        <CardHeader className="py-2 px-3">
                          <CardTitle className="text-xs text-muted-foreground">{CATEGORY_LABELS[cat]}</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 space-y-1">
                          {catWinners.map((w: any) => (
                            <div key={w.position} className="flex items-center gap-2 text-sm">
                              <span className={w.position === 1 ? 'text-base' : 'text-xs'}>
                                {w.position === 1 ? '🥇' : w.position === 2 ? '🥈' : '🥉'}
                              </span>
                              <span className={`${w.position === 1 ? 'font-bold' : ''} text-foreground`}>{w.player_name}</span>
                              {w.position === 1 && previewSeason && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 ml-auto"
                                  onClick={() => setWinnerPhotoUpload({
                                    seasonId: previewSeason,
                                    category: cat,
                                    position: w.position,
                                    playerName: w.player_name,
                                  })}
                                >
                                  <Camera className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Rankings preview */}
              <div>
                <h3 className="font-bold text-foreground mb-3">📊 Classificacions</h3>
                {Object.keys(CATEGORY_LABELS).map(cat => {
                  const catRankings = (previewData.rankings || []).filter((r: any) => r.category === cat).slice(0, 10);
                  if (catRankings.length === 0) return null;
                  return (
                    <div key={cat} className="mb-4">
                      <h4 className="text-sm font-semibold text-muted-foreground mb-1">{CATEGORY_LABELS[cat]}</h4>
                      <div className="space-y-0.5">
                        {catRankings.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-muted/30">
                            <span className="w-6 font-bold text-foreground">#{r.position}</span>
                            <span className="flex-1 text-foreground">{r.player_name}</span>
                            <span className="text-muted-foreground">{r.total_points} {seasons.find(s => s.id === previewSeason)?.modality === 'stableford' ? 'pts' : 'cops'}{r.rounds_played > 0 ? ` · ${r.rounds_played} proves` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Rounds */}
              <div>
                <h3 className="font-bold text-foreground mb-2">📅 Proves processades</h3>
                {previewData.rounds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {previewData.rounds.map((r: number) => (
                      <Badge key={r} variant="secondary">
                        P{r} {previewData.roundNames[r] ? `— ${previewData.roundNames[r]}` : ''}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-md bg-muted/50 border border-border text-sm text-muted-foreground">
                    ℹ️ Aquesta temporada no disposa de dades prova a prova. Només es mostra la classificació final.
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Winner photo upload dialog */}
      <Dialog open={!!winnerPhotoUpload} onOpenChange={() => setWinnerPhotoUpload(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Foto del guanyador — {winnerPhotoUpload?.playerName}</DialogTitle>
          </DialogHeader>
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => document.getElementById('winner-photo-input')?.click()}
          >
            <input
              id="winner-photo-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleWinnerPhoto(e.target.files[0]); }}
            />
            <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Fes clic per seleccionar la foto</p>
          </div>
        </DialogContent>
      </Dialog>
      {/* Edit round dialog */}
      {editingRound && (
        <HistoricRoundEditor
          open={!!editingRound}
          onClose={() => setEditingRound(null)}
          seasonId={editingRound.seasonId}
          roundNumber={editingRound.round}
          onSaved={() => {
            const season = seasons.find(s => s.id === editingRound.seasonId);
            if (season) fetchRoundStatuses(season.id, season.total_rounds);
          }}
        />
      )}

      {/* Edit modality dialog */}
      <Dialog open={!!editModalitySeason} onOpenChange={() => setEditModalitySeason(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modificar configuració — {editModalitySeason?.year}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Modalitat</Label>
              <Select value={editModality} onValueChange={setEditModality}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medalplay">Medalplay (cops)</SelectItem>
                  <SelectItem value="stableford">Stableford (punts)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº proves totals</Label>
                <Input type="number" value={editTotalRounds} onChange={e => setEditTotalRounds(e.target.value)} min="1" max="20" />
              </div>
              <div>
                <Label>Proves que puntuen</Label>
                <Input type="number" value={editCountingRounds} onChange={e => setEditCountingRounds(e.target.value)} min="1" max="20" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalitySeason(null)}>Cancel·lar</Button>
            <Button onClick={handleSaveModality}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick entry dialog */}
      <Dialog open={!!quickEntryOpen} onOpenChange={() => setQuickEntryOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Entrada ràpida de classificació — {seasons.find(s => s.id === quickEntryOpen)?.year}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-3 rounded-md bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">
                ⚠️ Aquesta temporada quedarà marcada com a <strong>sense dades prova a prova</strong>. 
                Escriu un jugador per línia amb el resultat total. Formats acceptats:
              </p>
              <pre className="text-xs text-muted-foreground mt-1 font-mono">
{`Nom Jugador, 150
Nom Jugador - 140
1. Nom Jugador 130`}
              </pre>
            </div>
            <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              📋 Classificació única (sense distinció de gènere ni modalitat)
            </div>
            <div>
              <Label>Classificació</Label>
              <Textarea
                placeholder={`Pere García, 150\nJoan López - 145\nMaria Puig, 140`}
                value={quickEntryText}
                onChange={e => setQuickEntryText(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickEntryOpen(null)}>Cancel·lar</Button>
            <Button onClick={handleQuickEntry} disabled={quickEntrySaving || !quickEntryText.trim()}>
              {quickEntrySaving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Desant...</> : 'Desar classificació'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmLoading}>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction onClick={executeConfirmAction} disabled={confirmLoading}>
              {confirmLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Processant...</> : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
