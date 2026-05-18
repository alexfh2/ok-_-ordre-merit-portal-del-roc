import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Lock } from 'lucide-react';
import Wordmark from '@/components/Wordmark';
import PlayerSearch from '@/components/PlayerSearch';
import DarkModeToggle from '@/components/DarkModeToggle';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { to: '/rankings', label: 'Class. Acumulades', icon: '🏆' },
  { to: '/proves', label: 'Prova a Prova', icon: '⛳' },
  { to: '/jugadors', label: 'Jugadors', icon: '👤' },
  { to: '/palmares', label: 'Palmarés', icon: '🏅' },
  { to: '/reglament', label: 'Bases', icon: '📋' },
  { to: '/admin', label: '', icon: <Lock className="w-4 h-4" /> },
];

interface NavbarProps {
  showSearch?: boolean;
  rightContent?: React.ReactNode;
}

export default function Navbar({ showSearch = false, rightContent }: NavbarProps) {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-20 border-b border-border/60 bg-card/80 backdrop-blur-lg"
    >
      <div className="container flex items-center justify-between h-14 sm:h-20">
        {/* Logo */}
        <Link to="/" className="shrink-0 group">
          <Wordmark size="md" />
        </Link>

        {/* Desktop nav links */}
        <div className="hidden sm:flex items-center gap-2">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'relative px-3 py-2 text-sm font-sans font-medium rounded-md transition-colors duration-200',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                <span className="flex items-center gap-1.5">
                  {typeof link.icon !== 'string' && link.icon}
                  {link.label}
                </span>
              </Link>
            );
          })}

          {showSearch && (
            <div className="ml-2">
              <PlayerSearch />
            </div>
          )}

          <DarkModeToggle />

          {rightContent && <div className="ml-2">{rightContent}</div>}
        </div>

        {/* Mobile: search + dark mode + hamburger */}
        <div className="flex sm:hidden items-center gap-1">
          {showSearch && <PlayerSearch />}
          <DarkModeToggle />
          {rightContent}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="sm:hidden overflow-hidden border-t border-border/40"
          >
            <div className="container py-2 space-y-1">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-sans font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    )}
                  >
                    <span className="text-base">{link.icon}</span>
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
