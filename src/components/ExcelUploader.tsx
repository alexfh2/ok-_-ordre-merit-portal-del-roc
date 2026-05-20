import { useState, useCallback, useEffect } from 'react';
import { Upload, FileSpreadsheet, Loader2, Users, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExcelUploaderProps {
  onUploadComplete: () => void;
}

const CURRENT_SEASON = 2026;

type SlotKind = 'inscrits' | 'resultats';

interface SlotConfig {
  kind: SlotKind;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const SLOTS: SlotConfig[] = [
  {
    kind: 'inscrits',
    title: 'Inscrits',
    description: 'Excel amb el llistat d\'inscrits (sexe i data de naixement)',
    icon: <Users className="w-5 h-5 text-primary" />,
  },
  {
    kind: 'resultats',
    title: 'Resultats forat a forat',
    description: 'Excel amb cops per forat i hàndicap de joc',
    icon: <ListChecks className="w-5 h-5 text-primary" />,
  },
];

export default function ExcelUploader({ onUploadComplete }: ExcelUploaderProps) {
  const [roundNumber, setRoundNumber] = useState<string>('');
  const [tournaments, setTournaments] = useState<Array<{ round_number: number; name: string }>>([]);
  const [files, setFiles] = useState<Record<SlotKind, File | null>>({ inscrits: null, resultats: null });
  const [uploading, setUploading] = useState<Record<SlotKind, boolean>>({ inscrits: false, resultats: false });
  const [dragging, setDragging] = useState<SlotKind | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('round_number, name')
        .eq('season', CURRENT_SEASON)
        .order('round_number', { ascending: true });
      if (data) setTournaments(data);
    })();
  }, []);

  const setFile = (kind: SlotKind, file: File | null) =>
    setFiles((prev) => ({ ...prev, [kind]: file }));

  const validateAndSet = (kind: SlotKind, file?: File | null) => {
    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Si us plau, puja un fitxer Excel (.xlsx o .xls)');
      return;
    }
    setFile(kind, file);
  };

  const handleUpload = async (kind: SlotKind) => {
    const file = files[kind];
    if (!file) return;
    if (!roundNumber) {
      toast.error('Si us plau, selecciona la prova primer');
      return;
    }
    setUploading((p) => ({ ...p, [kind]: true }));
    try {
      const safeName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '_');
      const fileName = `${kind}_round${roundNumber}_${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('excel-uploads')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      if (kind === 'resultats') {
        const { data: processData, error: processError } = await supabase.functions.invoke('process-excel', {
          body: { fileName, roundNumber: parseInt(roundNumber) },
        });
        if (processError) throw processError;
        const stats = processData?.stats;
        const tournamentMsg = processData?.tournament || '';
        toast.success(
          `${tournamentMsg} processat: ${stats?.total_results || 0} resultats de ${stats?.total_players || 0} jugadors.`
        );
        onUploadComplete();
      } else {
        const { data: insData, error: insError } = await supabase.functions.invoke('process-inscrits', {
          body: { fileName },
        });
        if (insError) throw insError;
        const s = insData?.stats;
        toast.success(
          `Inscrits processats: ${s?.total || 0} (${s?.inserted || 0} nous, ${s?.updated || 0} actualitzats, ${s?.seniors || 0} sèniors).`
        );
        onUploadComplete();
      }
      setFile(kind, null);
    } catch (err: any) {
      toast.error(err.message || 'Error en processar el fitxer');
    } finally {
      setUploading((p) => ({ ...p, [kind]: false }));
    }
  };

  const selectedName = tournaments.find((t) => String(t.round_number) === roundNumber)?.name;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="font-sans">Prova</Label>
        <Select value={roundNumber} onValueChange={setRoundNumber}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona la prova..." />
          </SelectTrigger>
          <SelectContent>
            {tournaments.map((t) => (
              <SelectItem key={t.round_number} value={String(t.round_number)}>
                Prova {t.round_number} · {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedName && (
          <p className="text-xs text-muted-foreground">
            Pujaràs els fitxers per a: <strong>{selectedName}</strong>
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {SLOTS.map((slot) => {
          const file = files[slot.kind];
          const isUploading = uploading[slot.kind];
          const inputId = `excel-input-${slot.kind}`;
          const isDragging = dragging === slot.kind;
          return (
            <div key={slot.kind} className="rounded-lg border border-border bg-background p-3 space-y-2">
              <div className="flex items-center gap-2">
                {slot.icon}
                <div className="min-w-0">
                  <p className="font-sans font-medium text-sm text-foreground">{slot.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{slot.description}</p>
                </div>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(slot.kind);
                }}
                onDragLeave={() => setDragging(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(null);
                  validateAndSet(slot.kind, e.dataTransfer.files[0]);
                }}
                onClick={() => document.getElementById(inputId)?.click()}
                className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary hover:bg-primary/5'
                }`}
              >
                <input
                  id={inputId}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => validateAndSet(slot.kind, e.target.files?.[0])}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-1">
                    <FileSpreadsheet className="w-7 h-7 text-primary" />
                    <p className="text-xs font-medium text-foreground truncate max-w-full">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Arrossega o fes clic</p>
                  </div>
                )}
              </div>

              {file && (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={isUploading || !roundNumber}
                  onClick={() => handleUpload(slot.kind)}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="animate-spin mr-2 w-4 h-4" />
                      Processant...
                    </>
                  ) : (
                    `Pujar ${slot.title.toLowerCase()}`
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
