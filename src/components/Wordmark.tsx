import { cn } from '@/lib/utils';
import anniversaryLogo from '@/assets/anniversary-logo.png';

interface WordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Wordmark({ className, size = 'md' }: WordmarkProps) {
  const sizes = {
    sm: 'text-base sm:text-lg',
    md: 'text-lg sm:text-2xl',
    lg: 'text-2xl sm:text-3xl',
  };
  const logoSizes = {
    sm: 'h-9 sm:h-10',
    md: 'h-11 sm:h-14',
    lg: 'h-14 sm:h-16',
  };
  return (
    <div className={cn('flex items-center gap-2 sm:gap-3 select-none', className)}>
      <img
        src={anniversaryLogo}
        alt="25è Aniversari Portal del Roc"
        className={cn('w-auto shrink-0', logoSizes[size])}
        loading="eager"
        decoding="async"
      />
      <div className="flex flex-col leading-none">
        <span className={cn('font-display font-semibold tracking-tight text-primary', sizes[size])}>
          Portal del Roc
        </span>
        <span className="font-sans uppercase tracking-[0.25em] text-[0.6rem] sm:text-[0.7rem] text-muted-foreground mt-1 text-center">
          PITCH & PUTT
        </span>
      </div>
    </div>
  );
}
