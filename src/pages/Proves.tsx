import Navbar from '@/components/Navbar';
import TournamentResults from '@/components/TournamentResults';

export default function Proves() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="py-8 sm:py-12">
        <div className="container max-w-5xl">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground mb-1">
                Resultats Prova a Prova
              </h1>
              <p className="text-sm text-muted-foreground font-sans">
                Classificació individual de cada prova del circuit
              </p>
            </div>
          </div>
          <TournamentResults mode="individual" />
        </div>
      </section>
    </div>
  );
}
