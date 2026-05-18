import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import RankingTable, { type RankingEntry } from './RankingTable';
import SocialImageGenerator from './SocialImageGenerator';
import SocialPostGenerator from './SocialPostGenerator';
import { useEffect, useMemo, useState } from 'react';
import type { Mode } from './ModeToggle';

interface CategoryTabsProps {
  rankings: Record<string, RankingEntry[]>;
  loading?: boolean;
  showImageGenerator?: boolean;
  tournamentDates?: (string | null)[];
  mode?: Mode;
}

const INDIVIDUAL_CATEGORIES = [
  { value: 'scratch_male', label: 'Scratch Masc.' },
  { value: 'handicap_male', label: 'Hcp Masc.' },
  { value: 'scratch_female', label: 'Scratch Fem.' },
  { value: 'handicap_female', label: 'Hcp Fem.' },
];

const PAIRS_CATEGORIES = [
  { value: 'scratch_pairs', label: 'Scratch Parelles' },
  { value: 'handicap_pairs', label: 'Handicap Parelles' },
];

export default function CategoryTabs({ rankings, loading, showImageGenerator, tournamentDates, mode = 'individual' }: CategoryTabsProps) {
  const categories = useMemo(() => (mode === 'pairs' ? PAIRS_CATEGORIES : INDIVIDUAL_CATEGORIES), [mode]);
  const defaultTab = categories[0]?.value;
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const validTab = categories.some((c) => c.value === activeTab) ? activeTab : defaultTab;

  return (
    <Tabs key={mode} value={validTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className={`w-full grid gap-2 sticky top-0 z-10 bg-muted p-1.5 rounded-lg ${
        mode === 'pairs' ? 'grid-cols-2' : 'grid-cols-4'
      }`}>
        {categories.map(cat => (
          <TabsTrigger
            key={cat.value}
            value={cat.value}
            className="font-display font-semibold text-xs sm:text-sm rounded-md py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
          >
            {cat.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {categories.map(cat => (
        <TabsContent key={cat.value} value={cat.value} className="mt-4">
          <motion.div
            key={`${mode}-${cat.value}`}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {showImageGenerator && (
              <div className="flex justify-end gap-2 py-2">
                <SocialPostGenerator entries={rankings[cat.value] || []} category={cat.value} allRankings={rankings} mode={mode} />
                <SocialImageGenerator entries={rankings[cat.value] || []} category={cat.value} />
              </div>
            )}
            <RankingTable
              entries={rankings[cat.value] || []}
              loading={loading}
              category={cat.value}
              tournamentDates={tournamentDates}
              isPairs={mode === 'pairs'}
            />
          </motion.div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
