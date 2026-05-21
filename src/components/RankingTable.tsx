import { useState } from 'react';
import { RANKING_RULES } from '@/config/rankingRules';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { ClickablePlayerName } from './PlayerDetailContext';
import { ClickablePairName } from './PairDetailContext';

export interface RankingEntry {
  position: number;
  name: string;
  total_points: number;
  player_id: string;
  rounds?: (number | null)[];
  discarded?: number[];
}

interface RankingTableProps {
  entries: RankingEntry[];
  loading?: boolean;
  category?: string;
  tournamentDates?: (string | null)[];
  tournamentNames?: (string | null)[];
  isPairs?: boolean;
}

function PositionBadge({ position }: { position: number }) {
  if (position === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gold font-display font-bold text-foreground text-xs">1</span>;
  if (position === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-silver font-display font-bold text-primary-foreground text-xs">2</span>;
  if (position === 3) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-bronze font-display font-bold text-primary-foreground text-xs">3</span>;
  return <span className="inline-flex items-center justify-center w-7 h-7 font-display font-bold text-muted-foreground text-xs tabular-nums">{position}</span>;
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' });
}

function AverageDisplay({ entry }: { entry: RankingEntry }) {
  const played = entry.rounds?.filter(r => r !== null).length || 0;
  if (played === 0) return <span>—</span>;
  const counting = Math.min(played, 8);
  const avg = entry.total_points / counting;
  const diff = avg - 54;
  const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
  return (
    <>
      {avg.toFixed(1)}{' '}
      <span className={diff > 0 ? 'text-destructive' : diff < 0 ? 'text-green-600' : ''}>
        [{diffStr}]
      </span>
    </>
  );
}

function PairsAverageDisplay({ entry }: { entry: RankingEntry }) {
  const played = entry.rounds?.filter(r => r !== null).length || 0;
  if (played === 0) return <span>—</span>;
  const counting = Math.min(played, 8);
  const avg = entry.total_points / counting;
  return (
    <>
      {avg.toFixed(1)}
    </>
  );
}

function NameCell({ entry, gender, isPairs, className }: { entry: RankingEntry; gender: string; isPairs?: boolean; className?: string }) {
  if (isPairs) {
    return <ClickablePairName pairId={entry.player_id} name={entry.name} className={className} />;
  }
  return <ClickablePlayerName playerId={entry.player_id} name={entry.name} gender={gender} className={className} />;
}

/* ── Mobile card view with expandable rounds ── */
function MobileRankingList({ entries, category, tournamentDates, isPairs }: { entries: RankingEntry[]; category?: string; tournamentDates?: (string | null)[]; isPairs?: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const gender = category?.endsWith('female') ? 'female' : 'male';
  const hasRounds = entries.some(e => e.rounds && e.rounds.some(r => r !== null));

  return (
    <div className="space-y-1">
      {entries.map((entry, index) => {
        const isTop10 = entry.position <= 10;
        const isOpen = expanded === entry.player_id;
        return (
          <motion.div
            key={entry.player_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02, duration: 0.25 }}
          >
            <button
              onClick={() => hasRounds ? setExpanded(isOpen ? null : entry.player_id) : undefined}
              className={`w-full flex items-center gap-2 py-3 px-3 border-b border-border text-left transition-colors ${
                isTop10 ? 'bg-card' : 'bg-background'
              } ${hasRounds ? 'cursor-pointer active:bg-muted/50' : 'cursor-default'}`}
            >
              <PositionBadge position={entry.position} />
              <div className="flex-1 min-w-0">
                <NameCell
                  entry={entry}
                  gender={gender}
                  isPairs={isPairs}
                  className={`font-sans text-sm ${isTop10 ? 'font-semibold' : 'font-medium'} text-foreground truncate block`}
                />
              </div>
              <span className={`tabular-nums font-bold shrink-0 ${isTop10 ? 'text-primary text-base' : 'text-foreground text-sm'}`}>
                {entry.total_points}
              </span>
              {hasRounds && (
                <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              )}
            </button>
            <AnimatePresence>
              {isOpen && hasRounds && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden bg-muted/30 border-b border-border"
                >
                  <div className="px-3 py-3">
                    <div className="grid grid-cols-5 gap-2 mb-3">
                      {Array.from({ length: RANKING_RULES.totalRounds }, (_, i) => {
                        const score = entry.rounds?.[i] ?? null;
                        const isDiscarded = entry.discarded?.includes(i) ?? false;
                        const dateStr = tournamentDates?.[i];
                        return (
                          <div key={i} className="text-center">
                            <div className="text-[10px] font-display font-bold text-muted-foreground">P{i + 1}</div>
                            {dateStr && (
                              <div className="text-[9px] font-sans text-muted-foreground/70 leading-tight">
                                {formatShortDate(dateStr)}
                              </div>
                            )}
                            <div className={`mt-1 text-sm tabular-nums font-medium ${
                              score === null
                                ? 'text-muted-foreground/30'
                                : isDiscarded
                                ? 'text-destructive line-through'
                                : 'text-foreground'
                            }`}>
                              {score !== null ? score : '—'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Desktop full table ── */
function DesktopRankingTable({ entries, category, tournamentDates, tournamentNames, isPairs }: { entries: RankingEntry[]; category?: string; tournamentDates?: (string | null)[]; tournamentNames?: (string | null)[]; isPairs?: boolean }) {
  const hasRounds = entries.some(e => e.rounds && e.rounds.some(r => r !== null));
  const gender = category?.endsWith('female') ? 'female' : 'male';
  const entityLabel = isPairs ? 'Parella' : 'Jugador/a';

  const roundIndices = Array.from({ length: RANKING_RULES.totalRounds }, (_, i) => i);

  if (!hasRounds) {
    return (
      <div className="space-y-0">
        {entries.map((entry, index) => {
          const isTop10 = entry.position <= 10;
          return (
            <motion.div
              key={entry.player_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={`flex items-center justify-between py-4 px-4 border-b border-border ${
                isTop10 ? 'border-l-4 border-l-primary bg-card' : 'bg-background'
              }`}
            >
              <div className="flex items-center gap-4">
                <PositionBadge position={entry.position} />
                <NameCell
                  entry={entry}
                  gender={gender}
                  isPairs={isPairs}
                  className={`font-sans ${isTop10 ? 'font-semibold' : 'font-medium'} text-foreground`}
                />
              </div>
              <span className={`tabular-nums font-bold ${isTop10 ? 'text-primary text-lg' : 'text-foreground'}`}>
                {entry.total_points}
              </span>
            </motion.div>
          );
        })}
      </div>
    );
  }

  const tooltipFor = (i: number) => {
    const name = tournamentNames?.[i];
    const date = tournamentDates?.[i];
    const dateLabel = date ? new Date(date).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    const parts = [name, dateLabel].filter(Boolean);
    return parts.length ? `Prova ${i + 1} · ${parts.join(' · ')}` : `Prova ${i + 1}`;
  };

  const renderRoundHeader = (i: number) => {
    const hasData = entries.some(e => e.rounds?.[i] !== null && e.rounds?.[i] !== undefined);
    return (
      <th
        key={i}
        title={tooltipFor(i)}
        className={`py-2 px-0 text-center font-display align-middle cursor-help ${
          hasData ? 'bg-primary/5' : ''
        }`}
      >
        <div className={`text-[11px] font-bold ${hasData ? 'text-primary' : 'text-muted-foreground'}`}>
          P{i + 1}
        </div>
      </th>
    );
  };

  const renderRoundCell = (entry: RankingEntry, i: number) => {
    const score = entry.rounds?.[i] ?? null;
    const isDiscarded = entry.discarded?.includes(i) ?? false;
    return (
      <td
        key={i}
        title={tooltipFor(i)}
        className={`py-3 px-0 text-center tabular-nums text-xs ${
          score === null
            ? 'text-muted-foreground/30'
            : isDiscarded
            ? 'text-destructive line-through'
            : 'text-foreground'
        }`}
      >
        {score !== null ? score : '—'}
      </td>
    );
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="text-sm border-separate border-spacing-0" style={{ minWidth: '900px' }}>
        <thead>
          <tr className="bg-muted/50">
            <th className="py-2 px-1 text-left font-display text-xs text-muted-foreground sticky left-0 z-20 bg-muted/95 backdrop-blur border-b border-border" style={{ width: '36px' }}>#</th>
            <th className="py-2 px-2 text-left font-display text-xs text-muted-foreground sticky left-9 z-20 bg-muted/95 backdrop-blur border-b border-border" style={{ width: '220px', minWidth: '220px' }}>{entityLabel}</th>
            <th className="py-2 px-2 text-right font-display text-xs font-bold text-primary-foreground bg-primary whitespace-nowrap border-b border-border" style={{ width: '64px' }}>Total</th>
            {roundIndices.map(renderRoundHeader)}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const isTop10 = entry.position <= 10;
            const rowBg = isTop10 ? 'bg-card' : 'bg-background';
            return (
              <motion.tr
                key={entry.player_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02, duration: 0.25 }}
                className={rowBg}
              >
                <td className={`py-3 px-1 sticky left-0 z-10 ${rowBg} border-b border-border`}>
                  <PositionBadge position={entry.position} />
                </td>
                <td className={`py-3 px-2 font-sans ${isTop10 ? 'font-semibold' : 'font-medium'} text-foreground text-sm leading-tight sticky left-9 z-10 ${rowBg} border-b border-border whitespace-nowrap`}>
                  <NameCell entry={entry} gender={gender} isPairs={isPairs} />
                </td>
                <td className={`py-3 px-2 text-right tabular-nums font-bold whitespace-nowrap border-b border-border ${
                  isTop10 ? 'bg-primary/10 text-primary text-base' : 'bg-muted/40 text-foreground'
                }`}>
                  {entry.total_points}
                </td>
                {roundIndices.map(i => renderRoundCell(entry, i))}
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function RankingTable({ entries, loading, category, tournamentDates, tournamentNames, isPairs }: RankingTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: RANKING_RULES.totalRounds }).map((_, i) => (
          <div key={i} className="h-14 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="font-display text-lg">No hi ha resultats processats per a aquesta categoria encara.</p>
      </div>
    );
  }

  return (
    <>
      <div className="block lg:hidden">
        <MobileRankingList entries={entries} category={category} tournamentDates={tournamentDates} isPairs={isPairs} />
      </div>
      <div className="hidden lg:block">
        <DesktopRankingTable entries={entries} category={category} tournamentDates={tournamentDates} tournamentNames={tournamentNames} isPairs={isPairs} />
      </div>
    </>
  );
}
