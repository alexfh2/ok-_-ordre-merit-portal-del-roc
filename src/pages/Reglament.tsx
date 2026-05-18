import { useRef, useState } from 'react';
import { Trophy, Users, Award, Calendar, Flag, Info, Gavel, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function Reglament() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const downloadPdf = async () => {
    if (!contentRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const totalPdfHeight = imgHeight * ratio;
      let position = 0;

      while (position < totalPdfHeight) {
        if (position > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -position, pdfWidth, totalPdfHeight);
        position += pdfHeight;
      }

      pdf.save('bases-competicio-ordre-del-merit-portal-del-roc-2026.pdf');
    } finally {
      setGenerating(false);
    }
  };
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="py-8 sm:py-12">
        <div className="container max-w-3xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground mb-1">
                  Bases de Competició
                </h1>
                <p className="text-sm text-muted-foreground font-sans">
                  Reglament de l&apos;Ordre del Mèrit Portal del Roc 2026
                </p>
              </div>
              <Button onClick={downloadPdf} disabled={generating} variant="outline" size="sm">
                {generating ? <Loader2 className="animate-spin" /> : <Download />}
                Descarregar PDF
              </Button>
            </div>

          <div ref={contentRef} className="space-y-6">
            {/* Intro */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Info className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">Ordre del Mèrit Portal del Roc 2026 — HP i Scratch</h2>
              </div>
              <div className="text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p>
                  L&apos;Ordre del Mèrit (O.M.) és un <strong className="text-foreground">rànquing social</strong>, és a dir, només per a <strong className="text-foreground">abonats de Portal del Roc</strong>.
                </p>
              </div>
            </article>

            {/* 1. Proves */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">1. Proves</h2>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p>
                  Tots els tornejos que consten al calendari de competicions de Portal del Roc 2026 amb les lletres <strong className="text-foreground">(O.M.)</strong> es comptabilitzaran per al rànquing.
                </p>
                <p>
                  D&apos;un total de <strong className="text-foreground">16 proves</strong> es comptabilitzaran els <strong className="text-foreground">10 millors resultats</strong> per establir els guanyadors de l&apos;Ordre del Mèrit Portal del Roc 2026.
                </p>
                <p className="bg-muted rounded-md px-4 py-2.5 text-foreground">
                  <strong>Nombre mínim de tornejos jugats per optar als premis: 10</strong>
                </p>
              </div>
            </article>

            {/* 2. Modalitat */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Flag className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">2. Modalitat de joc</h2>
              </div>
              <div className="text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p>Modalitat de joc: <strong className="text-foreground">Individual Stableford</strong>.</p>
              </div>
            </article>

            {/* 3. Punts extra */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">3. Punts extra</h2>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p>
                  Els jugadors que hagin participat en un mínim de <strong className="text-foreground">10 proves</strong>, a partir de l&apos;onzena prova podran sumar punts extra al total de la puntuació acumulable.
                </p>
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left font-display font-semibold text-foreground px-4 py-2">Nº de proves jugades</th>
                        <th className="text-right font-display font-semibold text-foreground px-4 py-2">Punts extra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [11, 2], [12, 4], [13, 6], [14, 8], [15, 10], [16, 12],
                      ].map(([n, p]) => (
                        <tr key={n} className="border-t border-border">
                          <td className="px-4 py-2 text-foreground">{n}</td>
                          <td className="px-4 py-2 text-right font-bold tabular-nums text-primary">+{p}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>

            {/* 4. Desempats */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Gavel className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">4. Desempats</h2>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground font-sans leading-relaxed pl-11 list-disc list-inside">
                <li>En cas d&apos;empat en la classificació <strong className="text-foreground">Hàndicap</strong>, tindrà premi el jugador amb <strong className="text-foreground">hàndicap més baix</strong>.</li>
                <li>En cas d&apos;empat en la classificació <strong className="text-foreground">Scratch</strong>, tindrà premi el jugador amb <strong className="text-foreground">hàndicap més alt</strong>.</li>
              </ul>
            </article>

            {/* 5. Categories i premis */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">5. Categories i premis</h2>
              </div>
              <div className="space-y-4 text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <div>
                  <h3 className="font-display font-semibold text-foreground mb-2">Categories</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      '1r Classificat Scratch Masculí',
                      '1a Classificada Scratch Femení',
                      '1r Classificat Hàndicap Masculí',
                      '1a Classificada Hàndicap Femení',
                      '1r Classificat Hàndicap Sènior Indistint',
                    ].map((cat) => (
                      <div key={cat} className="rounded-md bg-primary/10 text-primary font-display font-semibold text-xs px-3 py-2 text-center">
                        {cat}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground mb-2">Premis</h3>
                  <p>
                    Els premis <strong className="text-foreground">NO són acumulables</strong>.
                  </p>
                  <p className="mt-2">
                    Els <strong className="text-foreground">5 guanyadors</strong> de l&apos;Ordre del Mèrit, a més del trofeu corresponent, tindran cadascun un <strong className="text-foreground">PERNIL IBÈRIC</strong>.
                  </p>
                </div>
              </div>
            </article>

            {/* 6. Entrega de premis */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">6. Entrega de premis</h2>
              </div>
              <div className="text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p>L&apos;entrega de premis es farà una vegada finalitzades totes les proves.</p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
