import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Globe, Loader2, Eye, ArrowLeft } from 'lucide-react';
import PostPhotosSection from './PostPhotosSection';
import { usePublishToWeb } from '@/hooks/usePublishToWeb';

interface PublishToWebDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: string;
  excerpt?: string;
  initialMainPhoto?: string | null;
  initialMainPhotoFile?: File | null;
  initialGalleryUrls?: string[];
  initialGalleryFiles?: File[];
}

export default function PublishToWebDialog({
  open,
  onOpenChange,
  title,
  content,
  excerpt,
  initialMainPhoto = null,
  initialMainPhotoFile = null,
  initialGalleryUrls = [],
  initialGalleryFiles = [],
}: PublishToWebDialogProps) {
  const { publishing, publishToWeb } = usePublishToWeb();
  const [mainPhoto, setMainPhoto] = useState<string | null>(null);
  const [mainPhotoFile, setMainPhotoFile] = useState<File | null>(null);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [step, setStep] = useState<'edit' | 'preview'>('edit');

  // Sync initial values when dialog opens
  useEffect(() => {
    if (open) {
      setMainPhoto(initialMainPhoto);
      setMainPhotoFile(initialMainPhotoFile);
      setGalleryUrls(initialGalleryUrls || []);
      setGalleryFiles(initialGalleryFiles || []);
      setStep('edit');
    }
  }, [open]);

  function handleClose() {
    if (!publishing) {
      onOpenChange(false);
    }
  }

  async function handlePublish() {
    await publishToWeb(title, content, excerpt, mainPhotoFile, galleryFiles);
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {step === 'edit' ? '📰 Publicar a la Web' : '👁️ Preview de la publicació'}
          </DialogTitle>
        </DialogHeader>

        {step === 'edit' ? (
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-3 border border-border">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{content.slice(0, 200)}...</p>
            </div>

            <PostPhotosSection
              mainPhoto={mainPhoto}
              galleryPhotos={galleryUrls}
              onMainPhotoChange={(url, file) => { setMainPhoto(url); setMainPhotoFile(file); }}
              onGalleryAdd={(urls, files) => { setGalleryUrls(p => [...p, ...urls]); setGalleryFiles(p => [...p, ...files]); }}
              onGalleryRemove={(i) => { setGalleryUrls(p => p.filter((_, idx) => idx !== i)); setGalleryFiles(p => p.filter((_, idx) => idx !== i)); }}
              title="Imatges de la publicació"
              description="Afegeix la foto principal i galeria que apareixeran a la web del club."
            />

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose} disabled={publishing}>
                Cancel·lar
              </Button>
              <Button onClick={() => setStep('preview')} variant="secondary">
                <Eye className="w-4 h-4" />
                Veure Preview
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview card simulating a web article */}
            <div className="rounded-xl border-2 border-primary/20 bg-card overflow-hidden">
              {mainPhoto && (
                <div className="w-full overflow-hidden">
                  <img src={mainPhoto} alt="Foto principal" className="w-full h-auto rounded-t-xl object-contain" />
                </div>
              )}
              <div className="p-5 space-y-3">
                <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
                <div className="whitespace-pre-wrap text-sm font-sans text-foreground/80 leading-relaxed">
                  {content.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                    part.startsWith('**') && part.endsWith('**')
                      ? <strong key={i}>{part.slice(2, -2)}</strong>
                      : part
                  )}
                </div>
                {galleryUrls.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-sans font-semibold text-muted-foreground">📸 Galeria</p>
                    <div className="grid grid-cols-3 gap-2">
                      {galleryUrls.map((url, i) => (
                        <img key={i} src={url} alt={`Galeria ${i + 1}`} className="w-full aspect-square object-cover rounded-lg border border-border" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep('edit')} disabled={publishing}>
                <ArrowLeft className="w-4 h-4" />
                Tornar a editar
              </Button>
              <Button onClick={handlePublish} disabled={publishing}>
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                Confirmar i Publicar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
