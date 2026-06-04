import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawPdfFooter, drawPdfHeader, getLogoDataUrl } from '@/lib/pdfBranding';

interface TournamentResult {
  player_name: string;
  player_gender: string;
  player_id: string;
  scratch_score: number | null;
  handicap_score: number | null;
  is_subscriber?: boolean;
  is_senior?: boolean;
}

type Mode = 'individual' | 'pairs';

interface Props {
  tournamentName: string;
  tournamentDate: string | null;
  roundNumber: number;
  results: TournamentResult[];
  mode?: Mode;
}

interface CategoryDef {
  key: string;
  label: string;
  scoreKey: 'scratch_score' | 'handicap_score';
  filter: (r: TournamentResult) => boolean;
  ascending?: boolean; // for stableford individual scores: higher is better (descending)
}

const INDIVIDUAL_CATEGORIES: CategoryDef[] = [
  { key: 'handicap_male',   label: 'Hàndicap Masculí',  scoreKey: 'handicap_score', filter: r => r.player_gender === 'male' },
  { key: 'handicap_female', label: 'Hàndicap Femení',   scoreKey: 'handicap_score', filter: r => r.player_gender === 'female' },
  { key: 'scratch_male',    label: 'Scratch Masculí',   scoreKey: 'scratch_score',  filter: r => r.player_gender === 'male' },
  { key: 'scratch_female',  label: 'Scratch Femení',    scoreKey: 'scratch_score',  filter: r => r.player_gender === 'female' },
  { key: 'handicap_senior', label: 'Hàndicap Sènior',   scoreKey: 'handicap_score', filter: r => r.is_senior === true },
];

const PAIRS_CATEGORIES: CategoryDef[] = [
  { key: 'scratch_pairs',  label: 'Scratch Parelles',  scoreKey: 'scratch_score',  filter: () => true },
  { key: 'handicap_pairs', label: 'Hàndicap Parelles', scoreKey: 'handicap_score', filter: () => true },
];

export default function TournamentPdfGenerator({ tournamentName, tournamentDate, roundNumber, results, mode = 'individual' }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const categories = mode === 'pairs' ? PAIRS_CATEGORIES : INDIVIDUAL_CATEGORIES;
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map(c => [c.key, true]))
  );

  function toggle(key: string) {
    setSelected(p => ({ ...p, [key]: !p[key] }));
  }

  async function generate() {
    const active = categories.filter(c => selected[c.key]);
    if (active.length === 0) {
      toast.error('Selecciona almenys una classificació');
      return;
    }
    setLoading(true);
    try {
      const logo = await getLogoDataUrl();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const dateStr = tournamentDate
        ? new Date(tournamentDate).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

      active.forEach((cat, idx) => {
        if (idx > 0) doc.addPage();

        const rows = results
          .filter(cat.filter)
          .filter(r => r[cat.scoreKey] !== null && r[cat.scoreKey] !== undefined)
          .sort((a, b) => {
            const av = a[cat.scoreKey] ?? 0;
            const bv = b[cat.scoreKey] ?? 0;
            // Higher is better (Stableford points / pair points)
            return bv - av;
          });

        const headerH = drawPdfHeader(doc, logo, {
          title: 'Ordre del Mèrit Portal del Roc',
          subtitle: `${tournamentName}${dateStr ? ' · ' + dateStr : ''}`,
          smallLine: `Classificació · ${cat.label}`,
        });

        if (rows.length === 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(11);
          doc.setTextColor(120, 120, 120);
          doc.text('Sense resultats per a aquesta classificació.', 14, headerH + 14);
          return;
        }

        const body = rows.map((r, i) => [
          String(i + 1),
          r.player_name + (mode === 'individual' && r.is_subscriber === false ? ' *' : ''),
          String(r[cat.scoreKey] ?? ''),
        ]);

        autoTable(doc, {
          startY: headerH + 6,
          head: [['#', mode === 'pairs' ? 'Parella' : 'Jugador/a', 'Punts']],
          body,
          theme: 'striped',
          styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.2 },
          headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: {
            0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
          },
          margin: { left: 14, right: 14, top: headerH + 6, bottom: 16 },
          didDrawPage: () => {
            // Repeat compact header on subsequent pages of the same table
            drawPdfHeader(doc, logo, {
              title: 'Ordre del Mèrit Portal del Roc',
              subtitle: `${tournamentName}${dateStr ? ' · ' + dateStr : ''}`,
              smallLine: `Classificació · ${cat.label}`,
            });
          },
        });

        if (mode === 'individual') {
          const finalY = (doc as any).lastAutoTable?.finalY ?? headerH + 10;
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(110, 110, 110);
          doc.text('* Jugador/a no abonat/da — no compta per a l\'Ordre del Mèrit.', 14, Math.min(finalY + 6, 285));
        }
      });

      drawPdfFooter(doc);
      const safeName = tournamentName.replace(/[^\w\-]+/g, '_');
      doc.save(`P${roundNumber}_${safeName}_classificacions.pdf`);
      setOpen(false);
    } catch (err: any) {
      toast.error('Error generant el PDF: ' + (err?.message || 'desconegut'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={results.length === 0} variant="outline" size="sm">
        <FileText className="w-4 h-4" />
        PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">PDF de classificacions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-sans">
              Selecciona les classificacions que vols incloure al PDF (A4 vertical, una per pàgina).
            </p>
            <div className="space-y-2">
              {categories.map(c => (
                <Label key={c.key} className="flex items-center gap-3 px-3 py-2 border border-border rounded-md cursor-pointer hover:bg-accent/30 transition-colors">
                  <Checkbox checked={!!selected[c.key]} onCheckedChange={() => toggle(c.key)} />
                  <span className="font-sans text-sm">{c.label}</span>
                </Label>
              ))}
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
