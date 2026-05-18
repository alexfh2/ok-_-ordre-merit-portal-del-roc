import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Copy, Check, Loader2 } from 'lucide-react';
import PublishToWebDialog from './PublishToWebDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { RankingEntry } from './RankingTable';
import { supabase } from '@/integrations/supabase/client';
import type { Mode } from './ModeToggle';
import PostPhotosSection from './PostPhotosSection';
import { generateAIPost } from '@/lib/generateAIPost';
import { toast } from 'sonner';

type PostFormat = 'whatsapp' | 'instagram' | 'noticia';

interface SocialPostGeneratorProps {
  entries: RankingEntry[];
  category: string;
  allRankings?: Record<string, RankingEntry[]>;
  mode?: Mode;
}

export default function SocialPostGenerator({ entries, category, allRankings, mode = 'individual' }: SocialPostGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
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
      const isPairs = mode === 'pairs';

      // Gather HIO data for individual
      let holeInOnes: any[] = [];
      let bestRound: { name: string; score: number; round: number } | null = null;

      if (!isPairs) {
        const isFemale = category.includes('female');
        const scratchCat = isFemale ? 'scratch_female' : 'scratch_male';
        const hcpCat = isFemale ? 'handicap_female' : 'handicap_male';
        const scratchEntries = allRankings?.[scratchCat] || (category === scratchCat ? entries : []);
        const hcpEntries = allRankings?.[hcpCat] || (category === hcpCat ? entries : []);
        const allPlayerIds = [...new Set([...scratchEntries, ...hcpEntries].map(e => e.player_id))];

        const { data: hioData } = await supabase
          .from('hole_scores')
          .select('player_id, hole_number, tournament_id, strokes, players(name), tournaments(name, round_number)')
          .eq('strokes', 1);
        holeInOnes = (hioData || [])
          .filter(h => allPlayerIds.includes(h.player_id))
          .map(h => ({
            playerName: (h.players as any)?.name || 'Desconegut',
            hole: h.hole_number,
            tournament: (h.tournaments as any)?.name || '',
          }));

        const isScratch = category.startsWith('scratch');
        const allTop10 = (isScratch ? scratchEntries : hcpEntries).slice(0, 10);
        const roundScores: { name: string; score: number; round: number }[] = [];
        for (const entry of allTop10) {
          if (entry.rounds) {
            entry.rounds.forEach((score, idx) => {
              if (score !== null) roundScores.push({ name: entry.name, score, round: idx + 1 });
            });
          }
        }
        bestRound = roundScores.length > 0 ? roundScores.sort((a, b) => a.score - b.score)[0] : null;
      }

      const playedRounds = entries[0]?.rounds?.filter(r => r !== null).length || 0;

      // Build rankings data object
      const rankingsData: Record<string, any[]> = {};
      if (allRankings) {
        for (const [key, val] of Object.entries(allRankings)) {
          rankingsData[key] = (val as RankingEntry[]).slice(0, 10).map(e => ({
            name: e.name,
            total_points: e.total_points,
          }));
        }
      } else {
        rankingsData[category] = entries.slice(0, 10).map(e => ({
          name: e.name,
          total_points: e.total_points,
        }));
      }

      const text = await generateAIPost({
        type: 'ranking',
        format,
        data: {
          mode,
          category,
          rankings: rankingsData,
          playedRounds,
          holeInOnes,
          bestRound,
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
      <Button onClick={handleOpen} disabled={entries.length === 0} variant="outline" size="sm">
        <MessageSquare className="w-4 h-4" />
        Generar Post
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Generar Post · {mode === 'pairs' ? 'Parelles' : 'Individual'}</DialogTitle>
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
                  title={`Rànquing ${mode === 'pairs' ? 'Parelles' : 'Individual'} 2026`}
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
