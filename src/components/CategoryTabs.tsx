import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  tournamentNames?: (string | null)[];
  mode?: Mode;
}

const INDIVIDUAL_CATEGORIES = [
  { value: 'scratch_male', label: 'Scratch Masc.' },
  { value: 'handicap_male', label: 'Hcp Masc.' },
  { value: 'scratch_female', label: 'Scratch Fem.' },
  { value: 'handicap_female', label: 'Hcp Fem.' },
  { value: 'handicap_senior', label: 'Hcp Sènior' },
];

const PAIRS_CATEGORIES = [
  { value: 'scratch_pairs', label: 'Scratch Parelles' },
  { value: 'handicap_pairs', label: 'Handicap Parelles' },
];

export default function CategoryTabs({ rankings, loading, showImageGenerator, tournamentDates, tournamentNames, mode = 'individual' }: CategoryTabsProps) {
  const categories = useMemo(() => (mode === 'pairs' ? PAIRS_CATEGORIES : INDIVIDUAL_CATEGORIES), [mode]);
  const defaultTab = categories[0]?.value;
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const validTab = categories.some((c) => c.value === activeTab) ? activeTab : defaultTab;

  return (
    <Tabs key={mode} value={validTab} onValueChange={setActiveTab} className="w-full">
      <div className="sticky top-0 z-10 bg-background pb-3">
        <Select value={validTab} onValueChange={setActiveTab}>
          <SelectTrigger className="w-full sm:w-72 font-display font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat.value} value={cat.value} className="font-display font-medium">
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
              tournamentNames={tournamentNames}
              isPairs={mode === 'pairs'}
            />
          </motion.div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
