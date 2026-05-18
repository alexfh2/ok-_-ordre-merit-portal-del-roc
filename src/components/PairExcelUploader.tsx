import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PairExcelUploaderProps {
  onUploadComplete: () => void;
}

export default function PairExcelUploader({ onUploadComplete }: PairExcelUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [roundNumber, setRoundNumber] = useState<string>('');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile);
    } else {
      toast.error('Si us plau, puja un fitxer Excel (.xlsx o .xls)');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    if (!roundNumber) {
      toast.error('Si us plau, selecciona el número de prova');
      return;
    }
    setUploading(true);
    try {
      const fileName = `pairs_${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('excel-uploads')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: processData, error: processError } = await supabase.functions.invoke('process-pairs-excel', {
        body: { fileName, roundNumber: parseInt(roundNumber) },
      });

      if (processError) throw processError;

      const stats = processData?.stats;
      toast.success(
        `Prova ${roundNumber} parelles processat: ${stats?.total_results || 0} resultats de ${stats?.total_pairs || 0} parelles.`
      );
      setFile(null);
      setRoundNumber('');
      onUploadComplete();
    } catch (err: any) {
      toast.error(err.message || "Error en processar el fitxer de parelles");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="font-sans">Número de prova</Label>
        <Select value={roundNumber} onValueChange={setRoundNumber}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona la prova..." />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <SelectItem key={n} value={String(n)}>Prova {n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary hover:bg-primary/5'
        }`}
        onClick={() => document.getElementById('pair-excel-input')?.click()}
      >
        <input id="pair-excel-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileSpreadsheet className="w-10 h-10 text-primary" />
            <p className="font-sans font-medium text-foreground">{file.name}</p>
            <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-10 h-10 text-muted-foreground" />
            <p className="font-sans font-medium text-foreground">Arrossega l'Excel de parelles aquí</p>
            <p className="text-sm text-muted-foreground">o fes clic per seleccionar</p>
          </div>
        )}
      </div>
      {file && (
        <Button onClick={handleUpload} disabled={uploading || !roundNumber} className="w-full">
          {uploading ? (
            <><Loader2 className="animate-spin" />Processant...</>
          ) : (
            `Pujar i Processar Parelles – Prova ${roundNumber || '?'}`
          )}
        </Button>
      )}
    </div>
  );
}
