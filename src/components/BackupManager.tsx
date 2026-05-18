import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Download, Upload, RefreshCw, Trash2, Database, Calendar, Clock, AlertCircle, CheckCircle2, Cloud } from 'lucide-react';
import { toast } from 'sonner';
import DriveBackupsCard from './DriveBackupsCard';
import { callBackupFn } from '@/lib/backupApi';

interface BackupLog {
  id: string;
  filename: string;
  storage_path: string;
  size_bytes: number | null;
  tipo: 'manual' | 'automatico' | 'pre-restauracion';
  estado: 'exitoso' | 'error';
  total_registros: number | null;
  error_mensaje: string | null;
  drive_file_id: string | null;
  drive_uploaded_at: string | null;
  created_at: string;
}

export default function BackupManager() {
  const [items, setItems] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<{ path?: string; payload?: any; label?: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BackupLog | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await callBackupFn<{ items: BackupLog[] }>('list-backups');
      setItems(r.items || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createBackup = async () => {
    setCreating(true);
    try {
      const r = await callBackupFn<{ drive_file_id: string | null }>('create-backup', { tipo: 'manual' });
      toast.success(r.drive_file_id ? 'Còpia creada i pujada a Drive' : 'Còpia creada a Lovable Cloud');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setCreating(false); }
  };

  const downloadBackup = async (path: string) => {
    try {
      const { url } = await callBackupFn<{ url: string }>('download-backup', { path });
      const a = document.createElement('a');
      a.href = url; a.download = path.split('/').pop() || 'backup.json';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteBackup = async (id: string) => {
    try {
      await callBackupFn('delete-backup', { id });
      toast.success('Backup eliminat');
      setConfirmDelete(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const restoreBackup = async () => {
    if (!confirmRestore) return;
    setRestoring(true);
    try {
      await callBackupFn('restore-backup', confirmRestore);
      toast.success('Dades restaurades (mode merge)');
      setConfirmRestore(null);
      setTimeout(() => window.location.reload(), 1000);
    } catch (e: any) {
      toast.error(e.message);
      setRestoring(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload.data) throw new Error('Format invàlid');
      setConfirmRestore({ payload, label: file.name });
    } catch (e: any) { toast.error(e.message); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  };

  const fmtSize = (b: number | null) => {
    if (!b) return '—';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  };
  const fmtDate = (s?: string) => s ? new Date(s).toLocaleString('ca-ES') : '—';

  const tipoLabel = (t: string) => t === 'automatico' ? 'Automàtic' : t === 'pre-restauracion' ? 'Pre-restauració' : 'Manual';
  const tipoIcon = (t: string) => t === 'automatico' ? <Clock className="w-3 h-3" /> : t === 'pre-restauracion' ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />;
  const tipoCls = (t: string) => t === 'automatico' ? 'bg-primary/10 text-primary' : t === 'pre-restauracion' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-secondary text-secondary-foreground';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-muted-foreground font-sans">
            <p className="text-foreground font-semibold mb-1">Com funciona</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Còpia <strong>automàtica diària</strong> a les 3:00 AM (es mantenen les 14 últimes).</li>
              <li>Còpies <strong>manuals</strong> il·limitades (es mantenen les 30 últimes).</li>
              <li>Cada backup es puja també a <strong>Google Drive</strong> si està connectat.</li>
              <li>Abans de qualsevol restauració es crea una <strong>còpia de seguretat preventiva</strong>.</li>
              <li>La restauració utilitza mode <strong>merge</strong>: actualitza per ID sense esborrar dades no incloses.</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={createBackup} disabled={creating}>
            <Database className="w-4 h-4" /> {creating ? 'Creant...' : 'Crear còpia ara'}
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refrescar
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload className="w-4 h-4" /> Restaurar des de fitxer
          </Button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={handleFileUpload} />
        </div>
      </div>

      <DriveBackupsCard onChanged={load} />

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 font-sans font-semibold">Tipus</th>
                <th className="px-3 py-2 font-sans font-semibold">Data</th>
                <th className="px-3 py-2 font-sans font-semibold">Registres</th>
                <th className="px-3 py-2 font-sans font-semibold">Mida</th>
                <th className="px-3 py-2 font-sans font-semibold">Drive</th>
                <th className="px-3 py-2 font-sans font-semibold text-right">Accions</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Carregant...</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Encara no hi ha còpies.</td></tr>
              )}
              {items.map(it => (
                <tr key={it.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${tipoCls(it.tipo)}`}>
                      {tipoIcon(it.tipo)} {tipoLabel(it.tipo)}
                    </span>
                    {it.estado === 'error' && (
                      <div className="text-xs text-destructive mt-1" title={it.error_mensaje || ''}>Error</div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-sans">{fmtDate(it.created_at)}</td>
                  <td className="px-3 py-2 font-sans text-muted-foreground">{it.total_registros ?? '—'}</td>
                  <td className="px-3 py-2 font-sans text-muted-foreground">{fmtSize(it.size_bytes)}</td>
                  <td className="px-3 py-2">
                    {it.drive_file_id ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400" title={`Pujat ${fmtDate(it.drive_uploaded_at || undefined)}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Drive
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Cloud className="w-3.5 h-3.5" /> Local
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => downloadBackup(it.storage_path)} title="Descarregar" disabled={it.estado !== 'exitoso'}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRestore({ path: it.storage_path, label: it.filename })} title="Restaurar" disabled={it.estado !== 'exitoso'}>
                        <Upload className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(it)} title="Eliminar">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!confirmRestore} onOpenChange={open => !open && !restoring && setConfirmRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Restaurar còpia de seguretat?</AlertDialogTitle>
            <AlertDialogDescription className="font-sans">
              Es restaurarà <strong>{confirmRestore?.label || 'la còpia seleccionada'}</strong> en mode <strong>merge</strong>:
              s'actualitzaran els registres per ID i s'inseriran els nous, sense esborrar dades actuals que no estiguin a la còpia.
              <br /><br />
              Abans s'farà automàticament una <strong>còpia preventiva</strong> de l'estat actual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); restoreBackup(); }}
              disabled={restoring}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {restoring ? 'Restaurant...' : 'Sí, restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={open => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Eliminar còpia?</AlertDialogTitle>
            <AlertDialogDescription className="font-sans">
              S'eliminarà permanentment del sistema (i de Drive si està pujada).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete && deleteBackup(confirmDelete.id); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
