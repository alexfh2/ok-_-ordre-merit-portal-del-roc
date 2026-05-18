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
            {/* 1. Objectiu */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Flag className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">1. Objectiu</h2>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p>
                  L'objectiu d'El Rànquing de VALLROMANES és establir la <strong className="text-foreground">llista oficial dels millors jugadors/es</strong> de Pitch & Putt de Vallromanes. L'objectiu no és el d'establir el jugador/a més regular, sinó el de determinar el <strong className="text-foreground">millor jugador/a de l'any</strong>.
                </p>
                <p>
                  Aquest rànquing estarà directament relacionat amb els equips del club, d'on, depenent de la participació, la classificació final i el criteri dels capitans de l'any, es podran treure els nous jugadors de l'any següent.
                </p>
              </div>
            </article>

            {/* 2. Rànquing */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">2. Rànquing</h2>
              </div>
              <div className="text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p className="mb-3">El Rànquing constarà de quatre classificacions:</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Scratch Masculina', color: 'bg-primary/10 text-primary' },
                    { label: 'Scratch Femenina', color: 'bg-primary/10 text-primary' },
                    { label: 'Hàndicap Masculina', color: 'bg-accent text-accent-foreground' },
                    { label: 'Hàndicap Femenina', color: 'bg-accent text-accent-foreground' },
                  ].map(cat => (
                    <div key={cat.label} className={`rounded-md px-3 py-2 text-center font-display font-semibold text-xs ${cat.color}`}>
                      {cat.label}
                    </div>
                  ))}
                </div>
              </div>
            </article>

            {/* 4. Proves que puntuen */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">3. Proves que puntuen</h2>
              </div>
              <div className="text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p>
                  Per a la confecció del Rànquing de Vallromanes 2026 es tindran en compte els <strong className="text-foreground">8 millors resultats</strong> dels concursos puntuables, que seran un total de <strong className="text-foreground">10 proves</strong>.
                </p>
              </div>
            </article>

            {/* 5. Empats */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">4. Empats</h2>
              </div>
              <div className="text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p>En cas d'empat s'aplicarà la fórmula de desempat de la <strong className="text-foreground">FCPP</strong> (Federació Catalana de Pitch & Putt).</p>
              </div>
            </article>

            {/* 6. Informació dels resultats */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Info className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">5. Informació dels resultats</h2>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p>
                  Una vegada celebrat el campionat, el camp organitzador penjarà a la vista dels jugadors el resultat Scratch i Hàndicap.
                </p>
                <p>
                  En el període d'<strong className="text-foreground">una setmana</strong>, el C.G. Vallromanes farà públics els resultats definitius de la prova a efectes del Rànquing.
                </p>
              </div>
            </article>

            {/* 7. Trofeus i premis */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">6. Trofeus i premis</h2>
              </div>
              <div className="space-y-4 text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <div>
                  <h3 className="font-display font-semibold text-foreground mb-2">Premis per prova</h3>
                  <p>
                    En finalitzar cada prova es donaran els premis del campionat als guanyadors en: Scratch Masculí, Scratch Femení, Hcp Inferior (de (+) fins a 9), Hcp Superior (de 9,1 fins a 21) i Hcp Senior.
                  </p>
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground mb-2">Premis finals del Rànquing</h3>
                  <p className="mb-3">
                    Una vegada celebrats tots els concursos puntuables, es donarà un trofeu al primer classificat en el Rànquing masculí i femení, Rànquing Hcp i diferents regals/premis per als següents classificats:
                  </p>
                  <div className="space-y-2">
                    {[
                      { pos: '1r/a', prize: "Any d'abonament gratis (greenfees es paguen)" },
                      { pos: '2n/a', prize: "Mig any d'abonament gratis (greenfees es paguen)" },
                      { pos: '3r/a', prize: "3 mesos d'abonament gratis (greenfees es paguen)" },
                    ].map(p => (
                      <div key={p.pos} className="flex items-center gap-3 bg-muted rounded-md px-4 py-2.5">
                        <span className="font-display font-bold text-primary text-sm">{p.pos}</span>
                        <span className="text-foreground text-sm">{p.prize}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs italic">
                    Per optar a qualsevol premi cal haver disputat un mínim de <strong className="text-foreground not-italic">8 proves</strong>.
                  </p>
                  <p className="mt-1 text-xs italic">
                    Els premis no són acumulables ni entre categories ni entre competicions del club. Sempre prevaldrà el premi de major valor.
                  </p>
                </div>
              </div>
            </article>

            {/* 8. Desempats finals */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Gavel className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">7. Desempats en la classificació final</h2>
              </div>
              <div className="text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p>
                  En cas d'empat en qualsevol posició premiada es desempatarà de la següent manera: <strong className="text-foreground">millor resultat en les cinc últimes proves</strong>.
                </p>
              </div>
            </article>

            {/* 9. Comitè */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">8. Comitè de competició</h2>
              </div>
              <div className="text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p>El comitè de competició de cada prova estarà format per: <strong className="text-foreground">Marc, Jesús, Artur i Alberto</strong>.</p>
              </div>
            </article>

            {/* 10. Sortides */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Flag className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">9. Sortides</h2>
              </div>
              <div className="text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p>
                  Els jugadors que s'apuntin des del dijous en el mateix camp, no tindran dret a voler sortir en el lloc que els hi tocava per hàndicap ni es podrà assegurar una plaça per jugar.
                </p>
              </div>
            </article>

            {/* 11. Resultats */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">10. Resultats i Interclubs</h2>
              </div>
              <div className="text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p>
                  Els resultats del 2026 es podran tenir en compte per a la confecció dels <strong className="text-foreground">equips Interclubs 2027</strong>.
                </p>
              </div>
            </article>

            {/* 12. Obligacions */}
            <article className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Info className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">11. Obligacions del camp organitzador</h2>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground font-sans leading-relaxed pl-11">
                <p>
                  El camp s'encarregarà d'elaborar les targetes dels participants, el control de les sortides, el control de l'entrega de targetes i el còmput de les targetes, la publicació de resultats i l'ordre de sortida dels jugadors.
                </p>
                <p className="text-xs italic">
                  El camp organitzador es reserva el dret a realitzar algun canvi en l'organització de les proves a causa d'inconvenients climàtics i/o organitzatius.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
