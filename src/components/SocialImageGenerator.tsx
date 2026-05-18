import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { RankingEntry } from './RankingTable';
import { supabase } from '@/integrations/supabase/client';
import { RANKING_RULES } from '@/config/rankingRules';
import { CLUB } from '@/config/club';

interface SocialImageGeneratorProps {
  entries: RankingEntry[];
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  scratch_male: 'Scratch Masculí',
  scratch_female: 'Scratch Femení',
  handicap_male: 'Handicap Masculí',
  handicap_female: 'Handicap Femení',
  scratch_pairs: 'Scratch Parelles',
  handicap_pairs: 'Handicap Parelles',
};

const PRIMARY = '#598234';
const PRIMARY_DARK = '#3d5a24';
const PRIMARY_LIGHT = '#e8f0e0';
const GOLD = '#D4A017';
const SILVER = '#8E8E93';
const BRONZE = '#B87333';
const WHITE = '#ffffff';
const TEXT_DARK = '#1a1a1a';
const TEXT_MED = '#4a4a4a';
const TEXT_LIGHT = '#888888';
const BG_STRIPE = '#f7f9f5';

function getPhotoUrl(photoPath: string | null | undefined): string | null {
  if (!photoPath) return null;
  if (photoPath.startsWith('http')) return photoPath;
  const { data } = supabase.storage.from('player-photos').getPublicUrl(photoPath);
  return data.publicUrl;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();
}

type Orientation = 'vertical' | 'horizontal';

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export default function SocialImageGenerator({ entries, category }: SocialImageGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>('vertical');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({});

  const isPairs = category.includes('pairs');
  const top25 = entries.slice(0, 25);

  useEffect(() => {
    if (isPairs) return;
    const fetchPhotos = async () => {
      const ids = top25.map(e => e.player_id);
      const { data } = await supabase.from('players').select('id, photo_url').in('id', ids);
      const urls: Record<string, string | null> = {};
      if (data) {
        for (const p of data) {
          urls[p.id] = getPhotoUrl(p.photo_url);
        }
      }
      setPhotoUrls(urls);
    };
    if (top25.length > 0) fetchPhotos();
  }, [top25.length, isPairs]);

  const generate = async () => {
    setGenerating(true);
    try {
      const isHorizontal = orientation === 'horizontal';
      const scale = 2;
      const numRounds = top25[0]?.rounds?.length || 0;
      const showRounds = numRounds > 0;

      const IMG_W = isHorizontal ? 1920 : 1080;
      const HEADER_H = 100;
      const TH_H = 36;
      const FOOTER_H = 36;
      const ROW_H_TOP3 = 52;
      const ROW_H_TOP10 = 42;
      const ROW_H_REST = 36;

      const getRowH = (i: number) => i < 3 ? ROW_H_TOP3 : i < 10 ? ROW_H_TOP10 : ROW_H_REST;
      const totalRowH = top25.reduce((sum, _, i) => sum + getRowH(i), 0);
      const IMG_H = HEADER_H + TH_H + totalRowH + FOOTER_H + 10;

      const ROUND_COL_W = showRounds ? Math.min(52, Math.floor((isHorizontal ? 650 : 380) / Math.max(numRounds, 1))) : 0;
      const PAD = 40;
      const POS_W = 44;
      const AVATAR_W = 46;
      const TOTAL_W = 75;
      const roundsTotalW = ROUND_COL_W * numRounds;
      const nameW = IMG_W - PAD * 2 - POS_W - AVATAR_W - roundsTotalW - TOTAL_W;

      const canvas = document.createElement('canvas');
      canvas.width = IMG_W * scale;
      canvas.height = IMG_H * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);

      // Background
      ctx.fillStyle = WHITE;
      ctx.fillRect(0, 0, IMG_W, IMG_H);

      // Header gradient
      const grad = ctx.createLinearGradient(0, 0, IMG_W, HEADER_H);
      grad.addColorStop(0, PRIMARY_DARK);
      grad.addColorStop(1, PRIMARY);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, IMG_W, HEADER_H);

      // Load logo
      const logo = await loadImage('/images/logo-full.png');
      if (logo) {
        const logoH = 52;
        const logoW = logo.width * (logoH / logo.height);
        ctx.drawImage(logo, PAD, (HEADER_H - logoH) / 2, logoW, logoH);

        // Title text
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 26px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('RÀNQUING EL VENDRELL 2026', PAD + logoW + 16, HEADER_H / 2 - 12);
        ctx.font = '500 14px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(`${CATEGORY_LABELS[category] || category} · Millors 8 de 10 proves`, PAD + logoW + 16, HEADER_H / 2 + 14);
      } else {
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 26px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('RÀNQUING EL VENDRELL 2026', PAD, HEADER_H / 2 - 12);
        ctx.font = '500 14px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(`${CATEGORY_LABELS[category] || category} · Millors 8 de 10 proves`, PAD, HEADER_H / 2 + 14);
      }

      // Website URL
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '500 12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('ranquing.pitchandputtvallromanes.com', IMG_W - PAD, HEADER_H / 2);
      ctx.textAlign = 'left';

      // Table header
      let y = HEADER_H;
      ctx.fillStyle = PRIMARY_LIGHT;
      ctx.fillRect(0, y, IMG_W, TH_H);
      ctx.fillStyle = PRIMARY;
      ctx.fillRect(0, y + TH_H - 3, IMG_W, 3);

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = PRIMARY_DARK;
      ctx.textBaseline = 'middle';
      const thY = y + TH_H / 2;
      ctx.textAlign = 'center';
      ctx.fillText('#', PAD + POS_W / 2, thY);
      ctx.textAlign = 'left';
      ctx.fillText(isPairs ? 'PARELLA' : 'JUGADOR/A', PAD + POS_W + AVATAR_W + 10, thY);

      if (showRounds) {
        const roundsStartX = PAD + POS_W + AVATAR_W + nameW;
        ctx.textAlign = 'center';
        ctx.font = 'bold 9px sans-serif';
        for (let ri = 0; ri < numRounds; ri++) {
          ctx.fillText(`P${ri + 1}`, roundsStartX + ri * ROUND_COL_W + ROUND_COL_W / 2, thY);
        }
      }

      ctx.textAlign = 'center';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('PUNTS', IMG_W - PAD - TOTAL_W / 2, thY);
      ctx.textAlign = 'left';

      y += TH_H;

      // Load photos for top 3
      const photoImages: Record<string, HTMLImageElement | null> = {};
      for (let i = 0; i < Math.min(3, top25.length); i++) {
        const url = photoUrls[top25[i].player_id];
        if (url) {
          photoImages[top25[i].player_id] = await loadImage(url);
        }
      }

      // Rows
      for (let i = 0; i < top25.length; i++) {
        const entry = top25[i];
        const isTop3 = i < 3;
        const isTop10 = i < 10;
        const rowH = getRowH(i);
        const medalColor = i === 0 ? GOLD : i === 1 ? SILVER : i === 2 ? BRONZE : 'transparent';

        // Row background
        const bgColor = isTop3
          ? `rgba(89, 130, 52, ${0.14 - i * 0.03})`
          : isTop10
            ? 'rgba(89, 130, 52, 0.04)'
            : i % 2 === 0 ? WHITE : BG_STRIPE;

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, y, IMG_W, rowH);

        // Left medal border for top 3
        if (isTop3) {
          ctx.fillStyle = medalColor;
          ctx.fillRect(0, y, 5, rowH);
        }

        // Bottom border
        if (isTop3) {
          ctx.fillStyle = 'rgba(89,130,52,0.2)';
          ctx.fillRect(0, y + rowH - 1, IMG_W, 1);
        } else if (isTop10 && i === 9) {
          ctx.fillStyle = PRIMARY;
          ctx.fillRect(0, y + rowH - 2, IMG_W, 2);
        } else {
          ctx.fillStyle = '#eeeeee';
          ctx.fillRect(0, y + rowH - 1, IMG_W, 1);
        }

        const rowMid = y + rowH / 2;

        // Position number
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 ${isTop3 ? 20 : isTop10 ? 15 : 13}px sans-serif`;
        ctx.fillStyle = isTop3 ? medalColor : isTop10 ? PRIMARY_DARK : TEXT_LIGHT;
        ctx.fillText(String(entry.position), PAD + POS_W / 2, rowMid);

        // Avatar for top 3
        if (isTop3) {
          const avatarSize = 38;
          const avatarX = PAD + POS_W + (AVATAR_W - avatarSize) / 2;
          const avatarY = rowMid - avatarSize / 2;
          const avatarCX = avatarX + avatarSize / 2;
          const avatarCY = avatarY + avatarSize / 2;
          const avatarR = avatarSize / 2;

          const photoImg = photoImages[entry.player_id];
          if (photoImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
            ctx.clip();
            const imgSize = Math.min(photoImg.width, photoImg.height);
            const sx = (photoImg.width - imgSize) / 2;
            const sy = (photoImg.height - imgSize) / 2;
            ctx.drawImage(photoImg, sx, sy, imgSize, imgSize, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();
          } else {
            // Initials circle
            ctx.beginPath();
            ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
            ctx.fillStyle = PRIMARY_LIGHT;
            ctx.fill();
            ctx.font = 'bold 12px sans-serif';
            ctx.fillStyle = PRIMARY_DARK;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(getInitials(entry.name), avatarCX, avatarCY);
          }

          // Medal border ring
          ctx.beginPath();
          ctx.arc(avatarCX, avatarCY, avatarR + 1, 0, Math.PI * 2);
          ctx.strokeStyle = medalColor;
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Name
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const nameX = PAD + POS_W + AVATAR_W + 10;
        const maxNameW = nameW - 20;
        ctx.font = `${isTop3 ? 800 : isTop10 ? 600 : 500} ${isTop3 ? 16 : isTop10 ? 14 : 13}px sans-serif`;
        ctx.fillStyle = TEXT_DARK;

        // Truncate name if needed
        let displayName = entry.name;
        let measured = ctx.measureText(displayName).width;
        if (measured > maxNameW) {
          while (displayName.length > 0 && ctx.measureText(displayName + '…').width > maxNameW) {
            displayName = displayName.slice(0, -1);
          }
          displayName += '…';
        }
        ctx.fillText(displayName, nameX, rowMid);

        // Round scores
        if (showRounds && entry.rounds) {
          const roundsStartX = PAD + POS_W + AVATAR_W + nameW;
          ctx.textAlign = 'center';
          ctx.font = '600 11px sans-serif';
          for (let ri = 0; ri < numRounds; ri++) {
            const score = entry.rounds[ri];
            const isDiscarded = entry.discarded?.includes(ri);
            ctx.fillStyle = isDiscarded ? '#cccccc' : score != null ? TEXT_MED : '#dddddd';
            const text = score != null ? String(score) : '-';
            const rx = roundsStartX + ri * ROUND_COL_W + ROUND_COL_W / 2;

            if (isDiscarded && score != null) {
              ctx.fillText(text, rx, rowMid);
              // Strikethrough
              const tw = ctx.measureText(text).width;
              ctx.fillRect(rx - tw / 2 - 1, rowMid, tw + 2, 1);
            } else {
              ctx.fillText(text, rx, rowMid);
            }
          }
        }

        // Total points
        ctx.textAlign = 'center';
        ctx.font = `900 ${isTop3 ? 20 : isTop10 ? 17 : 14}px sans-serif`;
        ctx.fillStyle = isTop3 ? PRIMARY_DARK : isTop10 ? PRIMARY : TEXT_DARK;
        ctx.fillText(String(entry.total_points), IMG_W - PAD - TOTAL_W / 2, rowMid);

        y += rowH;
      }

      // Footer
      ctx.fillStyle = PRIMARY_LIGHT;
      ctx.fillRect(0, y, IMG_W, FOOTER_H + 10);
      ctx.fillStyle = PRIMARY;
      ctx.fillRect(0, y, IMG_W, 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 11px sans-serif';
      ctx.fillStyle = PRIMARY_DARK;
      ctx.fillText(`Pitch & Putt Vallromanes · ${new Date().getFullYear()}   |   ranquing.pitchandputtvallromanes.com`, IMG_W / 2, y + (FOOTER_H + 10) / 2);

      // Download
      const link = document.createElement('a');
      link.download = `ranking-${category}-${orientation}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setOpen(false);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={entries.length === 0}>
          <ImageIcon className="w-4 h-4" />
          Generar Imatge
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generar imatge classificació</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Orientació</Label>
            <RadioGroup value={orientation} onValueChange={(v) => setOrientation(v as Orientation)} className="flex gap-4 mt-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="vertical" id="vert" />
                <Label htmlFor="vert">Vertical (1080×auto)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="horizontal" id="horiz" />
                <Label htmlFor="horiz">Horitzontal (1920×auto)</Label>
              </div>
            </RadioGroup>
          </div>
          <Button onClick={generate} disabled={generating} className="w-full">
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Descarregar Imatge
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
