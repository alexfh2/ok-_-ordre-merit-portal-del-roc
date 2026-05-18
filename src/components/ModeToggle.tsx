import { Users, User } from 'lucide-react';

export type Mode = 'individual' | 'pairs';

interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted p-1 gap-0.5">
      <button
        onClick={() => onChange('individual')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-sans font-medium transition-all duration-200 ${
          mode === 'individual'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <User className="w-3.5 h-3.5" />
        Individual
      </button>
      <button
        onClick={() => onChange('pairs')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-sans font-medium transition-all duration-200 ${
          mode === 'pairs'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Users className="w-3.5 h-3.5" />
        Parelles
      </button>
    </div>
  );
}
