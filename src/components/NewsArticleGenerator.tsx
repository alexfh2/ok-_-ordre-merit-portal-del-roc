import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Newspaper, Copy, Check, Plus, X, Loader2 } from 'lucide-react';
import PublishToWebDialog from './PublishToWebDialog';
import PostPhotoUploader from './PostPhotoUploader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RankingEntry } from './RankingTable';
import { generateAIPost } from '@/lib/generateAIPost';
import { toast } from 'sonner';

type WritingStyle = 'esportiu' | 'formal' | 'festiu' | 'cronica';

interface NewsArticleGeneratorProps {
  individualRankings?: Record<string, RankingEntry[]>;
  pairRankings?: Record<string, RankingEntry[]>;
}

export default function NewsArticleGenerator({ individualRankings, pairRankings }: NewsArticleGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<WritingStyle>('esportiu');
  const [sponsors, setSponsors] = useState<string[]>(['']);
  const [mentions, setMentions] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [mainPhoto, setMainPhoto] = useState<string | null>(null);
  const [mainPhotoFile, setMainPhotoFile] = useState<File | null>(null);
  const [articleText, setArticleText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'config' | 'result'>('config');
  const [publishOpen, setPublishOpen] = useState(false);

  function addSponsor() {
    setSponsors(prev => [...prev, '']);
  }

  function removeSponsor(idx: number) {
    setSponsors(prev => prev.filter((_, i) => i !== idx));
  }

  function updateSponsor(idx: number, value: string) {
    setSponsors(prev => prev.map((s, i) => i === idx ? value : s));
  }


  async function generateArticle() {
    setLoading(true);
    setStep('result');

    try {
      const sponsorList = sponsors.filter(s => s.trim());

      // Build rankings data
      const rankingsData: Record<string, any[]> = {};
      const allRankings = { ...individualRankings, ...pairRankings };
      for (const [key, entries] of Object.entries(allRankings)) {
        if (!entries || entries.length === 0) continue;
        rankingsData[key] = entries.slice(0, 5).map(e => ({
          name: e.name,
          total_points: e.total_points,
          rounds: e.rounds,
        }));
      }

      const text = await generateAIPost({
        type: 'news',
        style,
        data: {
          rankings: rankingsData,
          sponsors: sponsorList,
          mentions: mentions.trim() || undefined,
          photoCount: photos.length,
        },
      });
      setArticleText(text);
    } catch (err) {
      toast.error('Error generant la notícia amb IA');
      setArticleText('Error generant la notícia. Prova-ho de nou.');
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard() {
    const cleanText = articleText.replace(/\*\*([^*]+)\*\*/g, '*$1*');
    navigator.clipboard.writeText(cleanText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpen() {
    setStep('config');
    setArticleText('');
    setOpen(true);
  }

  return (
    <>
      <Button onClick={handleOpen} variant="outline" size="sm">
        <Newspaper className="w-4 h-4" />
        Generar Notícia
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Generador de Notícia Esportiva</DialogTitle>
          </DialogHeader>

          {step === 'config' ? (
            <div className="space-y-5">
              {/* Style selection */}
              <div>
                <Label className="font-sans font-semibold">Estil de redactat</Label>
                <Select value={style} onValueChange={(v) => setStyle(v as WritingStyle)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="esportiu">🏌️ Esportiu i dinàmic</SelectItem>
                    <SelectItem value="formal">📰 Formal (estil diari)</SelectItem>
                    <SelectItem value="festiu">🎉 Festiu i entusiasta</SelectItem>
                    <SelectItem value="cronica">📝 Crònica per a la web (narrativa)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sponsors */}
              <div>
                <Label className="font-sans font-semibold">Patrocinadors / Col·laboradors</Label>
                <div className="space-y-2 mt-1">
                  {sponsors.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={s}
                        onChange={(e) => updateSponsor(i, e.target.value)}
                        placeholder={`Patrocinador ${i + 1}`}
                      />
                      {sponsors.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeSponsor(i)}>
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addSponsor}>
                    <Plus className="w-4 h-4" />
                    Afegir patrocinador
                  </Button>
                </div>
              </div>

              {/* Special mentions */}
              <div>
                <Label className="font-sans font-semibold">Mencions especials</Label>
                <Textarea
                  value={mentions}
                  onChange={(e) => setMentions(e.target.value)}
                  placeholder="p.ex. Felicitar el jugador X pel seu primer Hole-in-One, reconèixer el millor resultat de la jornada..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <PostPhotoUploader
                mainPhoto={mainPhoto}
                galleryPhotos={photoPreviewUrls}
                onMainPhotoChange={(url, file) => { setMainPhoto(url); setMainPhotoFile(file); }}
                onGalleryAdd={(urls, files) => { setPhotoPreviewUrls(p => [...p, ...urls]); setPhotos(p => [...p, ...files]); }}
                onGalleryRemove={(i) => { URL.revokeObjectURL(photoPreviewUrls[i]); setPhotoPreviewUrls(p => p.filter((_, idx) => idx !== i)); setPhotos(p => p.filter((_, idx) => idx !== i)); }}
              />

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel·lar</Button>
                <Button onClick={generateArticle} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Generar amb IA
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground font-sans">Generant notícia amb IA...</p>
                </div>
              ) : (
                <>
                  <pre className="whitespace-pre-wrap text-sm font-sans bg-muted rounded-lg p-4 border border-border text-foreground leading-relaxed">
                    {articleText}
                  </pre>
                  <PostPhotoUploader
                    mainPhoto={mainPhoto}
                    galleryPhotos={photoPreviewUrls}
                    onMainPhotoChange={() => {}}
                    onGalleryAdd={() => {}}
                    onGalleryRemove={() => {}}
                    readOnly
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => setStep('config')} variant="outline" size="sm">
                      ← Tornar a configurar
                    </Button>
                    <Button onClick={copyToClipboard} className="flex-1" size="sm">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copiat!' : 'Copiar text al portapapers'}
                    </Button>
                    <Button
                      onClick={() => setPublishOpen(true)}
                      disabled={!articleText}
                      variant="outline"
                      size="sm"
                    >
                      Publicar a la Web
                    </Button>
                    <PublishToWebDialog
                      open={publishOpen}
                      onOpenChange={setPublishOpen}
                      title="Notícia Rànquing P&P Vallromanes"
                      content={articleText}
                      initialMainPhoto={mainPhoto}
                      initialMainPhotoFile={mainPhotoFile}
                      initialGalleryUrls={photoPreviewUrls}
                      initialGalleryFiles={photos}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
