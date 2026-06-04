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
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      active.forEach((cat, idx) => {
        if (idx > 0) doc.addPage();
        const entries = allRankings[cat.key] || [];

        const headerH = drawPdfHeader(doc, logo, {
          title: 'Ordre del Mèrit Portal del Roc',
          subtitle: 'Classificació Acumulada 2026',
          smallLine: cat.label,
        });

        const body = entries.map(e => {
          const played = e.rounds.filter(r => r !== null).length;
          return [
            String(e.position),
            e.name,
            String(played),
            String(e.total_points),
          ];
        });

        autoTable(doc, {
          startY: headerH + 6,
          head: [['#', mode === 'pairs' ? 'Parella' : 'Jugador/a', 'Proves', 'Punts O.M.']],
          body,
          theme: 'striped',
          styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.2 },
          headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: {
            0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 22, halign: 'center' },
            3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
          },
          margin: { left: 14, right: 14, top: headerH + 6, bottom: 16 },
          didDrawPage: () => {
            drawPdfHeader(doc, logo, {
              title: 'Ordre del Mèrit Portal del Roc',
              subtitle: 'Classificació Acumulada 2026',
              smallLine: cat.label,
            });
          },
        });
      });

      drawPdfFooter(doc);
      doc.save(`OrdreMerit_PortalDelRoc_${mode === 'pairs' ? 'Parelles' : 'Individual'}.pdf`);
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
