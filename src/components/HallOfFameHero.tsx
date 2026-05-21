import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trophy, Camera, Crown, Check, X, ZoomIn, ZoomOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface Champion {
  id: string;
  season_id: string;
  category: string;
  player_name: string;
  photo_url: string | null;
  position: number;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 80 }, 1, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

async function getCroppedBlob(
  image: HTMLImageElement,
  crop: Crop,
  scale: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const outputSize = 512;
  canvas.width = outputSize;
  canvas.height = outputSize;

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;
  const cropWidth = crop.width * scaleX;
  const cropHeight = crop.height * scaleY;

  ctx.drawImage(
    image,
    cropX / scale,
    cropY / scale,
    cropWidth / scale,
    cropHeight / scale,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      0.92,
    );
  });
}

export default function HallOfFameHero() {
  const { user } = useAuth();
  const [champions, setChampions] = useState<{ male?: Champion; female?: Champion; year?: number }>({});
  const [uploading, setUploading] = useState<string | null>(null);

  // Crop state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [scale, setScale] = useState(1);
  const [activeChampion, setActiveChampion] = useState<Champion | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    loadChampions();
  }, []);

  const loadChampions = async () => {
    const { data: seasons } = await supabase
      .from('historic_seasons')
      .select('id, year')
      .eq('status', 'published')
      .order('year', { ascending: false })
      .limit(1);

    if (!seasons || seasons.length === 0) return;

    const latestSeason = seasons[0];
    const { data: winners } = await supabase
      .from('historic_winners')
      .select('*')
      .eq('season_id', latestSeason.id)
      .eq('position', 1)
      .in('category', ['scratch_male', 'scratch_female']);

    const result: { male?: Champion; female?: Champion; year?: number } = { year: latestSeason.year };
    (winners || []).forEach((w: any) => {
      if (w.category === 'scratch_male') result.male = w;
      if (w.category === 'scratch_female') result.female = w;
    });
    setChampions(result);
  };

  const openCropDialog = (champion: Champion) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setCropImageSrc(reader.result as string);
        setActiveChampion(champion);
        setScale(1);
        setCrop(undefined);
        setCropDialogOpen(true);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height));
  }, []);

  const handleCropConfirm = async () => {
    if (!imgRef.current || !crop || !activeChampion) return;
    setCropDialogOpen(false);
    setUploading(activeChampion.category);

    try {
      const blob = await getCroppedBlob(imgRef.current, crop, scale);
      const path = `${activeChampion.season_id}/${activeChampion.category}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('winner-photos')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('winner-photos')
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('historic_winners')
        .update({ photo_url: urlData.publicUrl })
        .eq('id', activeChampion.id);

      if (updateError) throw updateError;

      setChampions(prev => ({
        ...prev,
        [activeChampion.category === 'scratch_male' ? 'male' : 'female']: {
          ...activeChampion,
          photo_url: urlData.publicUrl,
        },
      }));
      toast.success('Foto actualitzada!');
    } catch (err: any) {
      toast.error('Error pujant la foto: ' + err.message);
    } finally {
      setUploading(null);
    }
  };

  if (!champions.year) return null;

  const formatName = (name: string) => {
    const parts = name.split(', ');
    if (parts.length === 2) {
      return `${parts[1]} ${parts[0]}`;
    }
    return name;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/30 p-6 sm:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

          <div className="relative text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-3">
              <Crown className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-widest">Hall of Fame</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">
              Millors Jugadors {champions.year}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Champions de la temporada</p>
          </div>

          <div className="relative flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
            {champions.male && (
              <ChampionCard
                champion={champions.male}
                label="Millor Jugador de l'Any"
                isAdmin={!!user}
                uploading={uploading === 'scratch_male'}
                onUpload={() => openCropDialog(champions.male!)}
                formatName={formatName}
                accentClass="from-[hsl(var(--gold))] to-[hsl(43,80%,45%)]"
              />
            )}

            <div className="hidden sm:block w-px h-40 bg-gradient-to-b from-transparent via-border to-transparent" />
            <div className="sm:hidden h-px w-40 bg-gradient-to-r from-transparent via-border to-transparent" />

            {champions.female && (
              <ChampionCard
                champion={champions.female}
                label="Millor Jugadora de l'Any"
                isAdmin={!!user}
                uploading={uploading === 'scratch_female'}
                onUpload={() => openCropDialog(champions.female!)}
                formatName={formatName}
                accentClass="from-[hsl(var(--gold))] to-[hsl(43,80%,45%)]"
              />
            )}
          </div>
        </div>
      </motion.div>

      {/* Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Retallar i encuadrar foto
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {cropImageSrc && (
              <div className="flex justify-center bg-muted/30 rounded-lg p-2 max-h-[60vh] overflow-auto">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  aspect={1}
                  circularCrop
                  keepSelection
                >
                  <img
                    ref={imgRef}
                    src={cropImageSrc}
                    alt="Crop"
                    onLoad={onImageLoad}
                    style={{ transform: `scale(${scale})`, transformOrigin: 'top left', maxWidth: '100%' }}
                  />
                </ReactCrop>
              </div>
            )}

            {/* Zoom control */}
            <div className="flex items-center gap-3 px-2">
              <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
              <Slider
                value={[scale]}
                onValueChange={([v]) => setScale(v)}
                min={0.5}
                max={3}
                step={0.05}
                className="flex-1"
              />
              <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCropDialogOpen(false)}>
                <X className="w-4 h-4 mr-1" /> Cancel·lar
              </Button>
              <Button size="sm" onClick={handleCropConfirm} disabled={!crop}>
                <Check className="w-4 h-4 mr-1" /> Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChampionCard({
  champion,
  label,
  isAdmin,
  uploading,
  onUpload,
  formatName,
  accentClass,
}: {
  champion: Champion;
  label: string;
  isAdmin: boolean;
  uploading: boolean;
  onUpload: () => void;
  formatName: (name: string) => string;
  accentClass: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="flex flex-col items-center text-center group"
    >
      <div
        className={`relative w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden mb-4 
          ring-4 ring-offset-2 ring-offset-background ring-primary/30
          shadow-xl shadow-primary/10 ${isAdmin ? 'cursor-pointer' : ''}`}
        onClick={isAdmin ? onUpload : undefined}
      >
        {champion.photo_url ? (
          <img
            src={champion.photo_url}
            alt={champion.player_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/40 flex items-center justify-center">
            <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-primary/40" />
          </div>
        )}

        {isAdmin && !uploading && (
          <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-8 h-8 text-background" />
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-background border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <div className={`absolute -top-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br ${accentClass} flex items-center justify-center shadow-lg`}>
          <Crown className="w-4 h-4 text-white" />
        </div>
      </div>

      <h3 className="text-base sm:text-lg font-extrabold text-foreground leading-tight">
        {formatName(champion.player_name)}
      </h3>

      <div className="mt-1.5 inline-flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 min-h-[48px] justify-center">
        <Trophy className="w-3 h-3 text-primary shrink-0" />
        <span className="text-[10px] sm:text-xs font-bold text-primary whitespace-pre-line text-center">{label}</span>
      </div>

    </motion.div>
  );
}
