import { useState } from 'react';
import Navbar from '@/components/Navbar';
import TournamentResults from '@/components/TournamentResults';
import ModeToggle, { type Mode } from '@/components/ModeToggle';

export default function Proves() {
  const [mode, setMode] = useState<Mode>('individual');

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
                {mode === 'individual' ? 'Classificació individual de cada prova del circuit' : 'Classificació per parelles de cada prova del circuit'}
              </p>
            </div>
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
          <TournamentResults mode={mode} />
        </div>
      </section>
    </div>
  );
}
