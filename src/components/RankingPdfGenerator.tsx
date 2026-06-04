import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RankingEntry } from './RankingTable';
import type { Mode } from './ModeToggle';
import { drawPdfFooter, drawPdfHeader, getLogoDataUrl } from '@/lib/pdfBranding';
import { RANKING_RULES } from '@/config/rankingRules';

interface Props {
  allRankings: Record<string, RankingEntry[]>;
  mode?: Mode;
}

const INDIVIDUAL = [
  { key: 'handicap_male',   label: 'Hàndicap Masculí' },
  { key: 'handicap_female', label: 'Hàndicap Femení' },
  { key: 'scratch_male',    label: 'Scratch Masculí' },
  { key: 'scratch_female',  label: 'Scratch Femení' },
  { key: 'handicap_senior', label: 'Hàndicap Sènior' },
];

const PAIRS = [
  { key: 'scratch_pairs',  label: 'Scratch Parelles' },
  { key: 'handicap_pairs', label: 'Hàndicap Parelles' },
];

export default function RankingPdfGenerator({ allRankings, mode = 'individual' }: Props) {
  const categories = mode === 'pairs' ? PAIRS : INDIVIDUAL;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map(c => [c.key, true]))
  );

  function toggle(k: string) { setSelected(p => ({ ...p, [k]: !p[k] })); }

  async function generate() {
    const active = categories.filter(c => selected[c.key] && (allRankings[c.key]?.length ?? 0) > 0);
    if (active.length === 0) {
      toast.error('Selecciona almenys una classificació amb resultats');
      return;
    }
    setLoading(true);
    try {
      const logo = await getLogoDataUrl();

      for (const cat of active) {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const entries = allRankings[cat.key] || [];

        const headerH = drawPdfHeader(doc, logo, {
          title: 'Ordre del Mèrit Portal del Roc',
          subtitle: 'Classificació Acumulada 2026',
          smallLine: cat.label,
        });

        const totalRounds = RANKING_RULES.totalRounds;
        const roundIndices = Array.from({ length: totalRounds }, (_, i) => i);

        const head = [
          ['#', mode === 'pairs' ? 'Parella' : 'Jugador/a', ...roundIndices.map(i => `P${i + 1}`), 'Punts'],
        ];

        const body = entries.map(e => {
          const discardedSet = new Set(e.discarded || []);
          const roundCells = roundIndices.map(i => {
            const v = e.rounds[i];
            if (v === null || v === undefined) return { content: '–', styles: { textColor: [180, 180, 180] as [number, number, number] } };
            if (discardedSet.has(i)) return { content: `(${v})`, styles: { textColor: [150, 150, 150] as [number, number, number], fontStyle: 'italic' as const } };
            return { content: String(v), styles: {} };
          });
          return [
            { content: String(e.position), styles: { fontStyle: 'bold' as const } },
            e.name,
            ...roundCells,
            { content: String(e.total_points), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
          ];
        });

        const roundColStyles: Record<number, any> = {};
        for (let i = 0; i < totalRounds; i++) {
          roundColStyles[2 + i] = { cellWidth: 6.2, halign: 'center', fontSize: 7 };
        }

        autoTable(doc, {
          startY: headerH + 6,
          head,
          body,
          theme: 'striped',
          styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.3, overflow: 'hidden' },
          headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 48, fontSize: 8 },
            ...roundColStyles,
            [2 + totalRounds]: { cellWidth: 14, halign: 'right', fontStyle: 'bold', fontSize: 9 },
          },
          margin: { left: 10, right: 10, top: headerH + 6, bottom: 18 },
          didDrawPage: () => {
            drawPdfHeader(doc, logo, {
              title: 'Ordre del Mèrit Portal del Roc',
              subtitle: 'Classificació Acumulada 2026',
              smallLine: cat.label,
            });
          },
        });

        const finalY = (doc as any).lastAutoTable?.finalY ?? headerH + 10;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(110, 110, 110);
        doc.text(
          `P1–P${totalRounds} = proves de la temporada · (xx) = resultat descartat · Millors ${RANKING_RULES.countingRounds} de ${totalRounds} proves`,
          10,
          Math.min(finalY + 5, 287)
        );

        drawPdfFooter(doc);
        const safeLabel = cat.label.replace(/[^\w\-]+/g, '_');
        doc.save(`OrdreMerit_${safeLabel}.pdf`);
      }

      setOpen(false);
    } catch (err: any) {
      toast.error('Error generant el PDF: ' + (err?.message || 'desconegut'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" size="sm">
        <FileText className="w-4 h-4" />
        PDF
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">PDF de l'Ordre del Mèrit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-sans">
              Selecciona les classificacions acumulades a incloure (A4 vertical, una per pàgina).
            </p>
            <div className="space-y-2">
              {categories.map(c => {
                const count = allRankings[c.key]?.length ?? 0;
                return (
                  <Label key={c.key} className={`flex items-center gap-3 px-3 py-2 border border-border rounded-md cursor-pointer hover:bg-accent/30 transition-colors ${count === 0 ? 'opacity-50' : ''}`}>
                    <Checkbox checked={!!selected[c.key]} onCheckedChange={() => toggle(c.key)} disabled={count === 0} />
                    <span className="font-sans text-sm flex-1">{c.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                  </Label>
                );
              })}
            </div>
            <Button onClick={generate} className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Descarregar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
