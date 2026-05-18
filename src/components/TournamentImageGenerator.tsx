import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { CLUB } from '@/config/club';

interface PairPlayerHoleScore {
  hole_number: number;
  strokes: number;
  player_name: string;
}

interface TournamentResult {
  player_name: string;
  player_gender: string;
  player_id: string;
  scratch_score: number | null;
  handicap_score: number | null;
  photo_url?: string | null;
  hole_scores?: { hole_number: number; strokes: number }[];
  pair_hole_scores?: PairPlayerHoleScore[];
}

interface TournamentImageGeneratorProps {
  tournamentName: string;
  tournamentDate: string | null;
  roundNumber: number;
  results: TournamentResult[];
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

export default function TournamentImageGenerator({ tournamentName, tournamentDate, roundNumber, results, category }: TournamentImageGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>('vertical');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({});

  const isScratch = category.startsWith('scratch');
  const isPairs = category.includes('pairs');
  const gender = category.includes('female') ? 'female' : 'male';
  const scoreKey = isScratch ? 'scratch_score' : 'handicap_score';

  const filtered = isPairs
    ? results
        .filter(r => r[scoreKey as keyof TournamentResult] !== null)
        .sort((a, b) => ((b[scoreKey as keyof TournamentResult] as number) ?? 0) - ((a[scoreKey as keyof TournamentResult] as number) ?? 0))
    : results
        .filter(r => r.player_gender === gender && r[scoreKey as keyof TournamentResult] !== null)
        .sort((a, b) => ((a[scoreKey as keyof TournamentResult] as number) ?? 999) - ((b[scoreKey as keyof TournamentResult] as number) ?? 999));

  const dateStr = tournamentDate
    ? new Date(tournamentDate).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  useEffect(() => {
    const urls: Record<string, string | null> = {};
    for (const r of filtered) {
      urls[r.player_id] = getPhotoUrl(r.photo_url);
    }
    setPhotoUrls(urls);
  }, [filtered.map(r => r.player_id).join(',')]);

  const generate = async () => {
    setGenerating(true);
    try {
      const isHorizontal = orientation === 'horizontal';
      const scale = 2;
      const maxRows = Math.min(filtered.length, 25);

      const IMG_W = isHorizontal ? 1920 : 1080;
      const HEADER_H = 100;
      const TH_H = isHorizontal ? 44 : 36;
      const FOOTER_H = 36;
      const ROW_H_TOP3 = isPairs && isHorizontal ? 72 : 52;
      const ROW_H_TOP10 = isPairs && isHorizontal ? 60 : 42;
      const ROW_H_REST = isPairs && isHorizontal ? 52 : 36;

      const getRowH = (i: number) => i < 3 ? ROW_H_TOP3 : i < 10 ? ROW_H_TOP10 : ROW_H_REST;
      const totalRowH = filtered.slice(0, maxRows).reduce((sum, _, i) => sum + getRowH(i), 0);
      const IMG_H = HEADER_H + TH_H + totalRowH + FOOTER_H + 10;

      const PAD = 40;
      const POS_W = 44;
      const AVATAR_W = 46;
      const SCORE_W = 80;

      // Hole columns only in horizontal mode
      const HOLE_COUNT = 18;
      const HOLE_COL_W = isHorizontal ? 46 : 0;
      const HOLES_TOTAL_W = isHorizontal ? HOLE_COUNT * HOLE_COL_W : 0;
      const nameW = IMG_W - PAD * 2 - POS_W - AVATAR_W - SCORE_W - HOLES_TOTAL_W;

      const scoreLabel = isScratch ? 'COPS' : 'HCP';

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

      const logo = await loadImage('/images/logo-full.png');
      const textStartX = logo ? PAD + (logo.width * (52 / logo.height)) + 16 : PAD;
      if (logo) {
        const logoH = 52;
        const logoW = logo.width * (logoH / logo.height);
        ctx.drawImage(logo, PAD, (HEADER_H - logoH) / 2, logoW, logoH);
      }

      ctx.fillStyle = WHITE;
      ctx.font = 'bold 24px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(tournamentName.toUpperCase(), textStartX, HEADER_H / 2 - 12);
      ctx.font = '500 14px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(`${CATEGORY_LABELS[category] || category}${dateStr ? ` · ${dateStr}` : ''}`, textStartX, HEADER_H / 2 + 14);

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '500 12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(CLUB.rankingDomain, IMG_W - PAD, HEADER_H / 2);
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

      // Hole header numbers (horizontal only)
      if (isHorizontal) {
        const holesStartX = PAD + POS_W + AVATAR_W + nameW;
        for (let h = 0; h < HOLE_COUNT; h++) {
          ctx.textAlign = 'center';
          ctx.font = 'bold 13px sans-serif';
          ctx.fillStyle = PRIMARY_DARK;
          ctx.fillText(String(h + 1), holesStartX + h * HOLE_COL_W + HOLE_COL_W / 2, thY);
        }
      }

      ctx.textAlign = 'center';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = PRIMARY_DARK;
      ctx.fillText(scoreLabel, IMG_W - PAD - SCORE_W / 2, thY);
      ctx.textAlign = 'left';

      y += TH_H;

      // Load photos for top 3
      const photoImages: Record<string, HTMLImageElement | null> = {};
      for (let i = 0; i < Math.min(3, maxRows); i++) {
        const url = photoUrls[filtered[i].player_id];
        if (url) {
          photoImages[filtered[i].player_id] = await loadImage(url);
        }
      }

      // Rows
      for (let i = 0; i < maxRows; i++) {
        const r = filtered[i];
        const isTop3 = i < 3;
        const isTop10 = i < 10;
        const rowH = getRowH(i);
        const medalColor = i === 0 ? GOLD : i === 1 ? SILVER : i === 2 ? BRONZE : 'transparent';

        const bgColor = isTop3
          ? `rgba(89, 130, 52, ${0.14 - i * 0.03})`
          : isTop10
            ? 'rgba(89, 130, 52, 0.04)'
            : i % 2 === 0 ? WHITE : BG_STRIPE;

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, y, IMG_W, rowH);

        if (isTop3) {
          ctx.fillStyle = medalColor;
          ctx.fillRect(0, y, 5, rowH);
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

        // Position
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 ${isTop3 ? 20 : isTop10 ? 15 : 13}px sans-serif`;
        ctx.fillStyle = isTop3 ? medalColor : isTop10 ? PRIMARY_DARK : TEXT_LIGHT;
        ctx.fillText(String(i + 1), PAD + POS_W / 2, rowMid);

        // Avatar for top 3
        if (isTop3) {
          const avatarSize = 38;
          const avatarX = PAD + POS_W + (AVATAR_W - avatarSize) / 2;
          const avatarY = rowMid - avatarSize / 2;
          const avatarCX = avatarX + avatarSize / 2;
          const avatarCY = avatarY + avatarSize / 2;
          const avatarR = avatarSize / 2;

          const photoImg = photoImages[r.player_id];
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
            ctx.beginPath();
            ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
            ctx.fillStyle = PRIMARY_LIGHT;
            ctx.fill();
            ctx.font = 'bold 12px sans-serif';
            ctx.fillStyle = PRIMARY_DARK;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(getInitials(r.player_name), avatarCX, avatarCY);
          }
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

        let displayName = r.player_name;
        if (ctx.measureText(displayName).width > maxNameW) {
          while (displayName.length > 0 && ctx.measureText(displayName + '…').width > maxNameW) {
            displayName = displayName.slice(0, -1);
          }
          displayName += '…';
        }
        ctx.fillText(displayName, nameX, rowMid);

        // Hole-by-hole scores (horizontal only)
        if (isHorizontal) {
          const holesStartX = PAD + POS_W + AVATAR_W + nameW;

          if (isPairs && r.pair_hole_scores && r.pair_hole_scores.length > 0) {
            // For pairs: show two sub-rows, one per player
            const playerNames = [...new Set(r.pair_hole_scores.map(h => h.player_name).filter(Boolean))];
            const subRowH = rowH / Math.max(playerNames.length, 1);

            playerNames.forEach((pName, pIdx) => {
              const playerHoles = r.pair_hole_scores!.filter(h => h.player_name === pName);
              const holeMap = new Map(playerHoles.map(h => [h.hole_number, h.strokes]));
              const subRowMid = y + pIdx * subRowH + subRowH / 2;

              // Player name label (small, left of holes area)
              // We skip it for space - the pair name already shows

              for (let h = 0; h < HOLE_COUNT; h++) {
                const strokes = holeMap.get(h + 1);
                if (strokes !== undefined) {
                  ctx.textAlign = 'center';
                  ctx.font = `600 ${isTop3 ? 13 : 12}px sans-serif`;
                  if (strokes === 1) ctx.fillStyle = GOLD;
                  else if (strokes === 2) ctx.fillStyle = PRIMARY;
                  else if (strokes === 3) ctx.fillStyle = TEXT_DARK;
                  else ctx.fillStyle = '#c0392b';
                  ctx.fillText(String(strokes), holesStartX + h * HOLE_COL_W + HOLE_COL_W / 2, subRowMid);
                }
              }

              // Divider between sub-rows
              if (pIdx === 0 && playerNames.length > 1) {
                ctx.fillStyle = '#dddddd';
                ctx.fillRect(holesStartX, y + subRowH - 0.5, HOLE_COUNT * HOLE_COL_W, 1);
              }
            });
          } else if (r.hole_scores && r.hole_scores.length > 0) {
            const holeMap = new Map(r.hole_scores.map(h => [h.hole_number, h.strokes]));
            for (let h = 0; h < HOLE_COUNT; h++) {
              const strokes = holeMap.get(h + 1);
              if (strokes !== undefined) {
                ctx.textAlign = 'center';
                ctx.font = `${isTop3 ? 700 : 600} ${isTop3 ? 16 : isTop10 ? 14 : 13}px sans-serif`;
                if (strokes === 1) ctx.fillStyle = GOLD;
                else if (strokes === 2) ctx.fillStyle = PRIMARY;
                else if (strokes === 3) ctx.fillStyle = TEXT_DARK;
                else ctx.fillStyle = '#c0392b';
                ctx.fillText(String(strokes), holesStartX + h * HOLE_COL_W + HOLE_COL_W / 2, rowMid);
              }
            }
          }

          // Vertical separator before score
          ctx.fillStyle = '#dddddd';
          ctx.fillRect(holesStartX + HOLE_COUNT * HOLE_COL_W - 1, y, 1, rowH);
        }

        // Score
        ctx.textAlign = 'center';
        ctx.font = `900 ${isTop3 ? 20 : isTop10 ? 17 : 14}px sans-serif`;
        ctx.fillStyle = isTop3 ? PRIMARY_DARK : isTop10 ? PRIMARY : TEXT_DARK;
        ctx.fillText(String(r[scoreKey as keyof TournamentResult] ?? ''), IMG_W - PAD - SCORE_W / 2, rowMid);

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
      ctx.fillText(`${CLUB.name} · ${new Date().getFullYear()}   |   ${CLUB.rankingDomain}`, IMG_W / 2, y + (FOOTER_H + 10) / 2);

      const link = document.createElement('a');
      link.download = `prova${roundNumber}-${category}-${orientation}-${Date.now()}.png`;
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
        <Button variant="outline" size="sm" disabled={filtered.length === 0}>
          <ImageIcon className="w-4 h-4" />
          Imatge
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
                <RadioGroupItem value="vertical" id="tvert" />
                <Label htmlFor="tvert">Vertical (1080×auto)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="horizontal" id="thoriz" />
                <Label htmlFor="thoriz">Horitzontal (1920×auto)</Label>
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
