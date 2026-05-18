import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HardDrive, Plug, Unplug, FolderPlus, FolderCheck } from 'lucide-react';
import { toast } from 'sonner';
import { callBackupFn } from '@/lib/backupApi';

interface DriveStatus {
  connected: boolean;
  email: string | null;
  connected_at: string | null;
  folder_id: string | null;
  folder_name: string | null;
}
interface DriveFolder { id: string; name: string }

export default function DriveBackupsCard({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState('Backups Pitch&Putt Vallromanes');
  const [folderUrl, setFolderUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const extractFolderIdFromUrl = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    // Plain ID (alphanumeric + - + _, typically 25-44 chars)
    if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;
    // URL formats: /folders/{id} or ?id={id}
    const folderMatch = trimmed.match(/\/folders\/([A-Za-z0-9_-]+)/);
    if (folderMatch) return folderMatch[1];
    const idMatch = trimmed.match(/[?&]id=([A-Za-z0-9_-]+)/);
    if (idMatch) return idMatch[1];
    return null;
  };

  const saveFolderByUrl = async () => {
    const id = extractFolderIdFromUrl(folderUrl);
    if (!id) {
      toast.error('URL o ID de carpeta no vàlid');
      return;
    }
    setSaving(true);
    try {
      await callBackupFn('drive-set-folder', { folder_id: id });
      toast.success('Carpeta guardada');
      setFolderDialogOpen(false);
      setFolderUrl('');
      await load();
      onChanged?.();
      void triggerTestBackup();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const getDriveRedirectUri = () => `${window.location.origin}/admin`;

  const load = async () => {
    setLoading(true);
    try {
      const r = await callBackupFn<DriveStatus>('drive-status');
      setStatus(r);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const connected = url.searchParams.get('drive_connected');
    const error = url.searchParams.get('drive_error');
    if (!connected && !error) return;

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('drive_connected');
    cleanUrl.searchParams.delete('drive_error');
    cleanUrl.searchParams.delete('code');
    cleanUrl.searchParams.delete('scope');
    cleanUrl.searchParams.delete('authuser');
    cleanUrl.searchParams.delete('prompt');
    cleanUrl.searchParams.delete('state');
    window.history.replaceState({}, '', cleanUrl.toString());

    if (error) {
      const message = error === 'access_denied' ? 'Connexió cancel·lada a Google Drive' : 'Error connectant Google Drive';
      toast.error(message);
      return;
    }

    toast.success('Google Drive connectat correctament');
    void load().then(() => onChanged?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setConnecting(true);
    try {
      const { url } = await callBackupFn<{ url: string }>('drive-oauth-start', { redirect_uri: getDriveRedirectUri() });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message);
      setConnecting(false);
    }
  };

  const openFolderPicker = async () => {
    setFolderDialogOpen(true);
    try {
      const r = await callBackupFn<{ folders: DriveFolder[] }>('drive-list-folders');
      setFolders(r.folders);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const triggerTestBackup = async () => {
    const t = toast.loading('Pujant còpia de prova a Drive...');
    try {
      const r = await callBackupFn<{ drive_file_id: string | null }>('create-backup', { tipo: 'manual' });
      if (r.drive_file_id) {
        toast.success('Còpia de prova pujada a Drive correctament', { id: t });
      } else {
        toast.error('Còpia creada però no s\'ha pujat a Drive. Revisa la carpeta.', { id: t });
      }
      onChanged?.();
    } catch (e: any) {
      toast.error(`Error pujant còpia: ${e.message}`, { id: t });
    }
  };

  const saveFolder = async () => {
    setSaving(true);
    try {
      await callBackupFn('drive-set-folder', { folder_id: selectedFolderId, folder_name: folders.find(f => f.id === selectedFolderId)?.name });
      toast.success('Carpeta guardada');
      setFolderDialogOpen(false);
      await load();
      onChanged?.();
      void triggerTestBackup();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    setSaving(true);
    try {
      await callBackupFn('drive-set-folder', { create_name: newFolderName.trim() });
      toast.success('Carpeta creada i seleccionada');
      setFolderDialogOpen(false);
      await load();
      onChanged?.();
      void triggerTestBackup();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnectConfirmText, setDisconnectConfirmText] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await callBackupFn('drive-disconnect');
      toast.success('Google Drive desconnectat');
      setDisconnectOpen(false);
      setDisconnectConfirmText('');
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <HardDrive className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-foreground font-semibold">Google Drive</p>
          <p className="text-sm text-muted-foreground font-sans">
            Pujada automàtica de cada backup a una carpeta del teu Drive personal.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregant...</p>
      ) : status?.connected ? (
        <div className="space-y-2 text-sm font-sans">
          <p><span className="text-muted-foreground">Compte:</span> <strong>{status.email}</strong></p>
          <p>
            <span className="text-muted-foreground">Carpeta:</span>{' '}
            {status.folder_name ? <strong>{status.folder_name}</strong> : <span className="text-destructive">No seleccionada</span>}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={openFolderPicker}>
              <FolderCheck className="w-4 h-4" /> {status.folder_name ? 'Canviar carpeta' : 'Seleccionar carpeta'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDisconnectOpen(true)}>
              <Unplug className="w-4 h-4" /> Desconnectar
            </Button>
          </div>
          {!status.folder_name && (
            <p className="text-xs text-destructive pt-1">⚠️ Selecciona una carpeta perquè es pugin els backups.</p>
          )}
        </div>
      ) : (
        <Button size="sm" onClick={connect} disabled={connecting}>
          <Plug className="w-4 h-4" /> {connecting ? 'Redirigint...' : 'Connectar Google Drive'}
        </Button>
      )}

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Carpeta de Drive per als backups</DialogTitle>
            <DialogDescription className="font-sans">
              Tria una carpeta existent o crea'n una de nova al teu Drive.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Triar carpeta existent</Label>
              <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent>
                  {folders.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={saveFolder} disabled={!selectedFolderId || saving}>
                Guardar selecció
              </Button>
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <Label>O enganxar URL/ID d'una carpeta existent</Label>
              <div className="flex gap-2">
                <Input
                  value={folderUrl}
                  onChange={e => setFolderUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                />
                <Button size="sm" onClick={saveFolderByUrl} disabled={!folderUrl.trim() || saving}>
                  <FolderCheck className="w-4 h-4" /> Usar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Comparteix la carpeta amb {status?.email || 'el compte connectat'} (rol Editor) si no és teva.
              </p>
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <Label>O crear-ne una nova</Label>
              <div className="flex gap-2">
                <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
                <Button size="sm" onClick={createFolder} disabled={!newFolderName.trim() || saving}>
                  <FolderPlus className="w-4 h-4" /> Crear
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>Tancar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={disconnectOpen}
        onOpenChange={(open) => {
          if (disconnecting) return;
          setDisconnectOpen(open);
          if (!open) setDisconnectConfirmText('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Desconnectar Google Drive?</AlertDialogTitle>
            <AlertDialogDescription className="font-sans space-y-2">
              <span className="block">
                Aquesta acció revocarà l'accés a la teva carpeta de Drive. Les còpies ja pujades es mantindran al teu Drive,
                però <strong>els backups futurs deixaran de pujar-se</strong> (es continuaran guardant a Lovable Cloud).
              </span>
              <span className="block">
                Per confirmar, escriu <strong>DESCONNECTAR</strong> a sota:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={disconnectConfirmText}
            onChange={(e) => setDisconnectConfirmText(e.target.value)}
            placeholder="DESCONNECTAR"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); disconnect(); }}
              disabled={disconnecting || disconnectConfirmText.trim() !== 'DESCONNECTAR'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? 'Desconnectant...' : 'Sí, desconnectar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
