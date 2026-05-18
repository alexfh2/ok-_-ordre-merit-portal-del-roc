import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ImagePlus, X, Star } from 'lucide-react';

interface PostPhotoUploaderProps {
  mainPhoto: string | null;
  galleryPhotos: string[];
  onMainPhotoChange: (url: string | null, file: File | null) => void;
  onGalleryAdd: (urls: string[], files: File[]) => void;
  onGalleryRemove: (index: number) => void;
  readOnly?: boolean;
}

export default function PostPhotoUploader({
  mainPhoto,
  galleryPhotos,
  onMainPhotoChange,
  onGalleryAdd,
  onGalleryRemove,
  readOnly = false,
}: PostPhotoUploaderProps) {
  const mainInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  function handleMainSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onMainPhotoChange(url, file);
    e.target.value = '';
  }

  function handleGallerySelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const urls = files.map(f => URL.createObjectURL(f));
    onGalleryAdd(urls, files);
    e.target.value = '';
  }

  if (readOnly) {
    const hasPhotos = mainPhoto || galleryPhotos.length > 0;
    if (!hasPhotos) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-sans">Fotos adjuntes:</p>
        <div className="flex flex-wrap gap-2">
          {mainPhoto && (
            <div className="relative">
              <img src={mainPhoto} alt="Foto principal" className="w-28 h-28 object-cover rounded-lg border-2 border-primary" />
              <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Star className="w-3 h-3" /> Principal
              </span>
            </div>
          )}
          {galleryPhotos.map((url, i) => (
            <img key={i} src={url} alt={`Galeria ${i + 1}`} className="w-24 h-24 object-cover rounded-md border border-border" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main photo */}
      <div>
        <Label className="font-sans font-semibold">📸 Foto principal</Label>
        <input ref={mainInputRef} type="file" accept="image/*" onChange={handleMainSelect} className="hidden" />
        {mainPhoto ? (
          <div className="relative inline-block mt-1">
            <img src={mainPhoto} alt="Foto principal" className="w-32 h-32 object-cover rounded-lg border-2 border-primary" />
            <button
              onClick={() => onMainPhotoChange(null, null)}
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
            >
              ×
            </button>
            <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Star className="w-3 h-3" /> Principal
            </span>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="mt-1" onClick={() => mainInputRef.current?.click()}>
            <ImagePlus className="w-4 h-4" />
            Afegir foto principal
          </Button>
        )}
      </div>

      {/* Gallery */}
      <div>
        <Label className="font-sans font-semibold">🖼️ Galeria de fotos</Label>
        <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleGallerySelect} className="hidden" />
        <div className="mt-1 space-y-2">
          <Button variant="outline" size="sm" onClick={() => galleryInputRef.current?.click()}>
            <ImagePlus className="w-4 h-4" />
            Afegir fotos a la galeria
          </Button>
          {galleryPhotos.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {galleryPhotos.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt={`Galeria ${i + 1}`} className="w-20 h-20 object-cover rounded-md border border-border" />
                  <button
                    onClick={() => onGalleryRemove(i)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
