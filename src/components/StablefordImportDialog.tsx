import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

export interface PreviewPlayer {
  license: string;
  name: string;
  gender: 'male' | 'female' | null;
  birth_date: string | null;
  hpj: number | null;
  holes: (number | null)[];
  bruto: number | null;
  neto: number | null;
  stbScratchTotal: number | null;
  stbHandicapTotal: number | null;
  is_subscriber: boolean;
  warnings: string[];
}

export interface PreviewData {
  tournament_name: string;
  detected_round: number | null;
  detected_date: string | null;
  results_sheet: string | null;
  hole_count: number;
  has_stableford_holes: boolean;
  has_any_yellow?: boolean;
  subscriber_warnings?: string[];
  players: PreviewPlayer[];
  summary: {
    total: number;
    with_results: number;
    females: number;
    males: number;
    subscribers: number;
    non_subscribers: number;
    warnings: number;
  };
}

export interface ImportAudit {
  parsed_players: number;
  players_with_results: number;
  duplicate_licenses: Array<{ license: string; kept: string; skipped: string[] }>;
  duplicate_player_matches: Array<{ player_id: string; kept: string; skipped: string[] }>;
  skipped_without_player: Array<{ license: string; name: string }>;
  skipped_without_scores: Array<{ license: string; name: string }>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preview: PreviewData | null;
  audit?: ImportAudit | null;
  onConfirm: () => Promise<void> | void;
  importing: boolean;
}

export default function StablefordImportDialog({ open, onOpenChange, preview, audit, onConfirm, importing }: Props) {
  if (!preview) return null;
  const { summary } = preview;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Validació d'importació · {preview.tournament_name || 'Prova'}</DialogTitle>
          <DialogDescription>
            Revisa els jugadors detectats abans d'importar. Format: Individual Stableford.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
          <Stat label="Detectats" value={summary.total} />
          <Stat label="Amb resultat" value={summary.with_results} />
          <Stat label="Abonats (O.M.)" value={summary.subscribers} tone="ok" />
          <Stat label="No abonats" value={summary.non_subscribers} />
          <Stat label="Dones / Homes" value={`${summary.females} / ${summary.males}` as any} />
          <Stat label="Amb avisos" value={summary.warnings} tone={summary.warnings ? 'warn' : 'ok'} />
        </div>

        <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
          <span>Full: <strong>{preview.results_sheet ?? '—'}</strong></span>
          <span>Forats: <strong>{preview.hole_count}</strong></span>
          <span>Stableford al Excel: <strong>{preview.has_stableford_holes ? 'sí' : 'no (es calcularà)'}</strong></span>
          {preview.detected_date && <span>Data: <strong>{preview.detected_date}</strong></span>}
          <span>Marques grogues: <strong>{preview.has_any_yellow ? 'sí' : 'no (fallback per llista)'}</strong></span>
        </div>

        {preview.subscriber_warnings && preview.subscriber_warnings.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-1">
            <div className="font-semibold text-amber-700 dark:text-amber-300">Avisos d'abonats</div>
            <ul className="list-disc pl-5 text-amber-700 dark:text-amber-300">
              {preview.subscriber_warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        {audit && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-2">
            <div className="font-semibold text-foreground">Auditoria d'importació</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat label="Llegits" value={audit.parsed_players} />
              <Stat label="Amb resultat" value={audit.players_with_results} />
              <Stat label="Importats" value={audit.players_with_results - audit.duplicate_player_matches.length} tone="ok" />
              <Stat label="Duplicats" value={audit.duplicate_licenses.length + audit.duplicate_player_matches.length} tone={audit.duplicate_licenses.length || audit.duplicate_player_matches.length ? 'warn' : 'ok'} />
            </div>
            {audit.duplicate_licenses.length > 0 && (
              <div className="text-amber-700 dark:text-amber-300">
                <strong>Llicències duplicades:</strong>{' '}
                {audit.duplicate_licenses.map((d) => `${d.license}: es queda ${d.kept}; saltat ${d.skipped.join(', ')}`).join(' · ')}
              </div>
            )}
            {audit.skipped_without_scores.length > 0 && (
              <div className="text-muted-foreground">
                <strong>Sense resultat importable:</strong>{' '}
                {audit.skipped_without_scores.map((p) => p.name).join(', ')}
              </div>
            )}
          </div>
        )}


        <ScrollArea className="h-[420px] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Llicència</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Sexe</TableHead>
                <TableHead>Naix.</TableHead>
                <TableHead className="text-right">HPJ</TableHead>
                <TableHead className="text-right">Brut</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Avisos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.players.map((p, i) => (
                <TableRow key={`${p.license}-${i}`}>
                  <TableCell className="font-mono text-xs">{p.license}</TableCell>
                  <TableCell className={!p.is_subscriber ? 'italic text-muted-foreground' : ''}>
                    {p.name}
                    {p.is_subscriber
                      ? <Badge variant="secondary" className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Abonat</Badge>
                      : <Badge variant="outline" className="ml-2 text-[10px]">No abonat</Badge>}
                  </TableCell>
                  <TableCell>{p.gender === 'female' ? 'F' : p.gender === 'male' ? 'M' : '—'}</TableCell>
                  <TableCell className="text-xs">{p.birth_date ?? '—'}</TableCell>
                  <TableCell className="text-right">{p.hpj ?? '—'}</TableCell>
                  <TableCell className="text-right">{p.bruto ?? (p.stbScratchTotal ?? '—')}</TableCell>
                  <TableCell className="text-right">{p.neto ?? (p.stbHandicapTotal ?? '—')}</TableCell>
                  <TableCell>
                    {p.warnings.length === 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <div className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="text-[11px]">{p.warnings.join(' · ')}</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing}>Cancel·lar</Button>
          <Button onClick={onConfirm} disabled={importing || summary.with_results === 0 || Boolean(audit)}>
            {audit ? 'Importació completada' : importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Important…</> : `Importar ${summary.with_results} resultats`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-emerald-600' : ''}`}>{value}</div>
    </div>
  );
}
