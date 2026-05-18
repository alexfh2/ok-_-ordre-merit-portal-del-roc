import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Copy, Check, Loader2 } from 'lucide-react';
import PublishToWebDialog from './PublishToWebDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import PostPhotosSection from './PostPhotosSection';
import { generateAIPost } from '@/lib/generateAIPost';
import { toast } from 'sonner';

type PostFormat = 'whatsapp' | 'instagram' | 'noticia';

interface TournamentResult {
  player_name: string;
  player_gender: string;
  player_id: string;
  scratch_score: number | null;
  handicap_score: number | null;
  hole_scores: { hole_number: number; strokes: number }[];
}

interface TournamentPostGeneratorProps {
  tournamentName: string;
  tournamentDate: string | null;
  roundNumber: number;
  results: TournamentResult[];
}

export default function TournamentPostGenerator({ tournamentName, tournamentDate, roundNumber, results }: TournamentPostGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<PostFormat>('whatsapp');
  const [step, setStep] = useState<'config' | 'result'>('config');
  const [publishOpen, setPublishOpen] = useState(false);

  const [mainPhoto, setMainPhoto] = useState<string | null>(null);
  const [mainPhotoFile, setMainPhotoFile] = useState<File | null>(null);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  function handleOpen() {
    setStep('config');
    setPostText('');
    setMainPhoto(null);
    setMainPhotoFile(null);
    setGalleryUrls([]);
    setGalleryFiles([]);
    setOpen(true);
  }

  async function generatePost() {
    setLoading(true);
    setStep('result');
    try {
      const isPairs = results.some(r => r.player_gender === 'mixed');
      const dateStr = tournamentDate
        ? new Date(tournamentDate).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

      const text = await generateAIPost({
        type: 'tournament',
        format,
        data: {
          tournamentName,
          tournamentDate: dateStr,
          roundNumber,
          results: results.map(r => ({
            player_name: r.player_name,
            player_gender: r.player_gender,
            scratch_score: r.scratch_score,
            handicap_score: r.handicap_score,
            hole_scores: r.hole_scores,
          })),
          isPairs,
        },
      });
      setPostText(text);
    } catch (err) {
      toast.error('Error generant el post amb IA');
      setPostText('Error generant el post. Prova-ho de nou.');
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard() {
    // Convert **bold** to *bold* for WhatsApp compatibility
    const cleanText = postText.replace(/\*\*([^*]+)\*\*/g, '*$1*');
    navigator.clipboard.writeText(cleanText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const formatLabels: Record<PostFormat, string> = {
    whatsapp: '📱 WhatsApp',
    instagram: '📸 Instagram',
    noticia: '📰 Notícia per diari',
  };

  return (
    <>
      <Button onClick={handleOpen} disabled={results.length === 0} variant="outline" size="sm">
        <MessageSquare className="w-4 h-4" />
        Post
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Post · {tournamentName}</DialogTitle>
          </DialogHeader>

          {step === 'config' ? (
            <div className="space-y-5">
              <PostPhotosSection
                mainPhoto={mainPhoto}
                galleryPhotos={galleryUrls}
                onMainPhotoChange={(url, file) => { setMainPhoto(url); setMainPhotoFile(file); }}
                onGalleryAdd={(urls, files) => { setGalleryUrls(p => [...p, ...urls]); setGalleryFiles(p => [...p, ...files]); }}
                onGalleryRemove={(i) => { setGalleryUrls(p => p.filter((_, idx) => idx !== i)); setGalleryFiles(p => p.filter((_, idx) => idx !== i)); }}
              />

              <div>
                <Label className="font-sans font-semibold">Format del post</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as PostFormat)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">📱 WhatsApp (complet)</SelectItem>
                    <SelectItem value="instagram">📸 Instagram (més curt)</SelectItem>
                    <SelectItem value="noticia">📰 Notícia per diari (formal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={generatePost} className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Generar amb IA
              </Button>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-sans">Generant text amb IA...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="bg-muted px-2 py-0.5 rounded">{formatLabels[format]}</span>
              </div>
              <div className="whitespace-pre-wrap text-sm font-sans bg-muted rounded-lg p-4 border border-border text-foreground leading-relaxed">
                {postText.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                  part.startsWith('**') && part.endsWith('**')
                    ? <strong key={i}>{part.slice(2, -2)}</strong>
                    : part
                )}
              </div>

              {(mainPhoto || galleryUrls.length > 0) && (
                <PostPhotosSection
                  mainPhoto={mainPhoto}
                  galleryPhotos={galleryUrls}
                  onMainPhotoChange={() => {}}
                  onGalleryAdd={() => {}}
                  onGalleryRemove={() => {}}
                  readOnly
                  title="Fotos seleccionadas"
                  description="Aquestes imatges quedaran vinculades al post."
                />
              )}

              <div className="flex gap-2">
                <Button onClick={() => setStep('config')} variant="outline" size="sm">
                  ← Tornar
                </Button>
                <Button onClick={copyToClipboard} className="flex-1" size="sm">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiat!' : 'Copiar al portapapers'}
                </Button>
                <Button
                  onClick={() => setPublishOpen(true)}
                  disabled={!postText}
                  variant="outline"
                  size="sm"
                >
                  Publicar a la Web
                </Button>
                <PublishToWebDialog
                  open={publishOpen}
                  onOpenChange={setPublishOpen}
                  title={`Resultats ${roundNumber}a Prova Rànquing 2026`}
                  content={postText}
                  initialMainPhoto={mainPhoto}
                  initialMainPhotoFile={mainPhotoFile}
                  initialGalleryUrls={galleryUrls}
                  initialGalleryFiles={galleryFiles}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
