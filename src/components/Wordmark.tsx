import { CLUB } from '@/config/club';
import { cn } from '@/lib/utils';

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
  return (
    <div className={cn('flex flex-col leading-none select-none', className)}>
      <span className={cn('font-display font-semibold tracking-tight text-primary', sizes[size])}>
        Pitch &amp; Putt
      </span>
      <span className="font-sans uppercase tracking-[0.25em] text-[0.6rem] sm:text-[0.7rem] text-muted-foreground mt-1">
        {CLUB.city}
      </span>
    </div>
  );
}
