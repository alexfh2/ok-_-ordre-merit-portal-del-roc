import { useState, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  parseSubscribersSheet,
  normalizeName,
  type ParsedSubscriber,
} from "@/lib/portalDelRoc";

interface ExistingPlayer {
  id: string;
  name: string;
  license_number: string | null;
}

interface PreviewRow {
  parsed: ParsedSubscriber;
  status: "new" | "update" | "duplicate" | "no_license" | "error";
  match?: ExistingPlayer;
  note?: string;
}

export default function SubscriberExcelUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [done, setDone] = useState<{ created: number; updated: number } | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) {
      setFile(f);
      setPreview(null);
      setDone(null);
    } else toast.error("Si us plau, puja un fitxer Excel (.xlsx o .xls)");
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(null);
      setDone(null);
    }
  };

  const generatePreview = async () => {
    if (!file) return;
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
      // Prefer a sheet named "Abonats"/"Abonados"; else first sheet.
      const preferred = wb.SheetNames.find((n) => /abonat|abonado|subscriber/i.test(n));
      const sheetName = preferred || wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed = parseSubscribersSheet(rows);
      if (parsed.length === 0) {
        toast.error("No s'han trobat files vàlides al fitxer.");
        setParsing(false);
        return;
      }

      // Fetch existing players to compute diff
      const { data: existing, error } = await supabase
        .from("players")
        .select("id, name, license_number");
      if (error) throw error;

      const byName = new Map<string, ExistingPlayer>();
      for (const p of existing || []) {
        byName.set(normalizeName(p.name), p);
      }

      const seenName = new Set<string>();
      const rowsOut: PreviewRow[] = parsed.map((p) => {
        const nameKey = normalizeName(p.name);
        let dupNote: string | undefined;
        if (seenName.has(nameKey)) dupNote = "Nom repetit al fitxer";
        seenName.add(nameKey);

        if (!p.name) return { parsed: p, status: "error", note: "Falta nom" };

        const match = byName.get(nameKey);
        const status: PreviewRow["status"] = match ? "update" : "new";

        return { parsed: p, status, match, note: dupNote };
      });

      setPreview(rowsOut);
    } catch (e: any) {
      toast.error(e.message || "Error processant el fitxer");
    } finally {
      setParsing(false);
    }
  };

  const summary = useMemo(() => {
    if (!preview) return null;
    return {
      total: preview.length,
      new: preview.filter((r) => r.status === "new").length,
      update: preview.filter((r) => r.status === "update").length,
      errors: preview.filter((r) => r.status === "error").length,
      duplicates: preview.filter((r) => r.note).length,
    };
  }, [preview]);

  const confirmImport = async () => {
    if (!preview) return;
    setCommitting(true);
    let created = 0;
    let updated = 0;
    const now = new Date().toISOString();
    try {
      for (const row of preview) {
        if (row.status === "error") continue;
        const p = row.parsed;
        if (row.match) {
          const { error } = await supabase
            .from("players")
            .update({ name: p.name, is_subscriber: true, subscriber_updated_at: now })
            .eq("id", row.match.id);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await supabase
            .from("players")
            .insert({ name: p.name, gender: "M", is_subscriber: true, subscriber_updated_at: now });
          if (error) throw error;
          created++;
        }
      }
      setDone({ created, updated });
      toast.success(`Importació completada: ${created} nous · ${updated} actualitzats`);
      setPreview(null);
      setFile(null);
    } catch (e: any) {
      toast.error(e.message || "Error guardant abonats");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {done && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          Importació completada · {done.created} nous · {done.updated} actualitzats
        </div>
      )}

      {!preview && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("subscribers-excel-input")?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary hover:bg-primary/5"
            }`}
          >
            <input
              id="subscribers-excel-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-8 h-8 text-primary" />
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm font-medium">Arrossega l'Excel d'abonats</p>
                <p className="text-xs text-muted-foreground">o fes clic per seleccionar (.xlsx / .xls)</p>
              </div>
            )}
          </div>
          {file && (
            <Button onClick={generatePreview} disabled={parsing} className="w-full">
              {parsing ? (<><Loader2 className="animate-spin" /> Llegint Excel...</>) : "Llegir i previsualitzar"}
            </Button>
          )}
        </>
      )}

      {preview && summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <Stat label="Total files" value={summary.total} />
            <Stat label="Nous" value={summary.new} tone="primary" />
            <Stat label="Actualitzats" value={summary.update} />
            <Stat label="Sense llicència" value={summary.noLicense} tone={summary.noLicense ? "warn" : undefined} />
            <Stat label="Duplicats" value={summary.duplicates} tone={summary.duplicates ? "warn" : undefined} />
            <Stat label="Errors" value={summary.errors} tone={summary.errors ? "danger" : undefined} />
          </div>

          <div className="max-h-72 overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-2">Estat</th>
                  <th className="text-left p-2">Nom</th>
                  <th className="text-left p-2">Llicència</th>
                  <th className="text-left p-2">Sexe</th>
                  <th className="text-left p-2">HCP</th>
                  <th className="text-left p-2">Nota</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-2">{r.parsed.name}</td>
                    <td className="p-2 font-mono">{r.parsed.license_number || "—"}</td>
                    <td className="p-2">{r.parsed.gender || "—"}</td>
                    <td className="p-2">{r.parsed.handicap_actual ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">{r.note || (r.match ? `→ ${r.match.name}` : "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {summary.errors > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              Les files amb errors no s'importaran.
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setPreview(null); }} disabled={committing}>
              Tornar
            </Button>
            <Button onClick={confirmImport} disabled={committing} className="flex-1">
              {committing ? (<><Loader2 className="animate-spin" /> Guardant...</>) : `Confirmar importació (${summary.total - summary.errors} files)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "primary" | "warn" | "danger" }) {
  const cls =
    tone === "primary" ? "text-primary"
    : tone === "warn" ? "text-amber-600 dark:text-amber-400"
    : tone === "danger" ? "text-destructive"
    : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <div className={`text-lg font-bold ${cls}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: PreviewRow["status"] }) {
  const map: Record<PreviewRow["status"], { label: string; cls: string }> = {
    new: { label: "Nou", cls: "bg-primary/15 text-primary" },
    update: { label: "Actualitzar", cls: "bg-muted text-foreground" },
    no_license: { label: "Sense llic.", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
    duplicate: { label: "Duplicat", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
    error: { label: "Error", cls: "bg-destructive/15 text-destructive" },
  };
  const m = map[status];
  return <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${m.cls}`}>{m.label}</span>;
}
