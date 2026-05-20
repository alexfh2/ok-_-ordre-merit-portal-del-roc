import { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import StablefordImportDialog, { type PreviewData } from './StablefordImportDialog';

interface ExcelUploaderProps {
  onUploadComplete: () => void;
}

const CURRENT_SEASON = 2026;

export default function ExcelUploader({ onUploadComplete }: ExcelUploaderProps) {
  const [roundNumber, setRoundNumber] = useState<string>('');
  const [tournaments, setTournaments] = useState<Array<{ round_number: number; name: string }>>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importing, setImporting] = useState(false);

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

  const validateAndSet = (f?: File | null) => {
    if (!f) return;
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      toast.error('Si us plau, puja un fitxer Excel (.xlsx o .xls)');
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!roundNumber) {
      toast.error('Si us plau, selecciona la prova primer');
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '_');
      const fileName = `stableford_round${roundNumber}_${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('excel-uploads')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: previewData, error: previewError } = await supabase.functions.invoke(
        'process-stableford-excel',
        { body: { fileName, roundNumber: parseInt(roundNumber), mode: 'preview' } },
      );
      if (previewError) throw previewError;
      if (!previewData?.success) throw new Error('Preview ha fallat');
      setPreview(previewData as PreviewData);
      setPreviewFileName(fileName);
      setPreviewOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Error en processar el fitxer');
    } finally {
      setUploading(false);
    }
  };

  const confirmImport = async () => {
    if (!previewFileName || !roundNumber) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-stableford-excel', {
        body: { fileName: previewFileName, roundNumber: parseInt(roundNumber), mode: 'import' },
      });
      if (error) throw error;
      const s = data?.stats;
      toast.success(
        `${data?.tournament || 'Prova'} importada: ${s?.total_results || 0} resultats, ${s?.hole_scores || 0} forats, ${s?.subscribers || 0} abonats.`,
      );
      setPreviewOpen(false);
      setPreview(null);
      setPreviewFileName(null);
      setFile(null);
      onUploadComplete();
    } catch (err: any) {
      toast.error(err.message || 'Error en importar');
    } finally {
      setImporting(false);
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
            Pujaràs l'Excel per a: <strong>{selectedName}</strong>
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-background p-3 space-y-2">
        <div className="min-w-0">
          <p className="font-sans font-medium text-sm text-foreground">Excel Stableford (resultats forat a forat)</p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Un únic fitxer. Detecta automàticament abonats (nom subratllat en groc), sexe i data de naixement.
            Calcula Stableford, omple Prova a Prova (tots els jugadors) i actualitza l'Ordre del Mèrit (només abonats).
          </p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            validateAndSet(e.dataTransfer.files[0]);
          }}
          onClick={() => document.getElementById('excel-input-stableford')?.click()}
          className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary hover:bg-primary/5'
          }`}
        >
          <input
            id="excel-input-stableford"
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => validateAndSet(e.target.files?.[0])}
          />
          {file ? (
            <div className="flex flex-col items-center gap-1">
              <FileSpreadsheet className="w-8 h-8 text-primary" />
              <p className="text-xs font-medium text-foreground truncate max-w-full">{file.name}</p>
              <p className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload className="w-7 h-7 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Arrossega o fes clic per pujar l'Excel</p>
            </div>
          )}
        </div>

        {file && (
          <Button
            size="sm"
            className="w-full"
            disabled={uploading || !roundNumber}
            onClick={handleUpload}
          >
            {uploading ? (
              <><Loader2 className="animate-spin mr-2 w-4 h-4" /> Processant…</>
            ) : (
              'Previsualitzar i importar'
            )}
          </Button>
        )}
      </div>

      <StablefordImportDialog
        open={previewOpen}
        onOpenChange={(v) => { setPreviewOpen(v); if (!v) setImporting(false); }}
        preview={preview}
        onConfirm={confirmImport}
        importing={importing}
      />
    </div>
  );
}
