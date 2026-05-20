import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2, Pencil, CheckCircle2 } from 'lucide-react';

const COURSE_NAME = 'Portal del Roc Pitch & Putt';
const TOTAL_HOLES = 18;

interface HoleRow {
  hole_number: number;
  par: string;
  stroke_index: string;
}

function createEmptyRows(): HoleRow[] {
  return Array.from({ length: TOTAL_HOLES }, (_, i) => ({
    hole_number: i + 1,
    par: '',
    stroke_index: '',
  }));
}

export default function CourseHolesManager() {
  const [rows, setRows] = useState<HoleRow[]>(createEmptyRows);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('course_holes')
        .select('hole_number, par, stroke_index')
        .eq('course_name', COURSE_NAME)
        .order('hole_number', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const map = new Map(data.map((h) => [h.hole_number, h]));
        setRows(
          Array.from({ length: TOTAL_HOLES }, (_, i) => {
            const holeNum = i + 1;
            const existing = map.get(holeNum);
            return {
              hole_number: holeNum,
              par: existing ? String(existing.par) : '',
              stroke_index: existing ? String(existing.stroke_index) : '',
            };
          })
        );
        if (data.length === TOTAL_HOLES) {
          setIsSaved(true);
          setIsEditing(false);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error carregant dades del camp');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateRow = (holeNumber: number, field: 'par' | 'stroke_index', value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.hole_number === holeNumber ? { ...r, [field]: value } : r))
    );
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`${field}_${holeNumber}`];
      return next;
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const seenStrokeIndices = new Map<number, number>();

    for (const row of rows) {
      const parNum = Number(row.par);
      const siNum = Number(row.stroke_index);

      if (row.par.trim() === '') {
        newErrors[`par_${row.hole_number}`] = 'Obligatori / Obligatorio';
      } else if (Number.isNaN(parNum) || parNum <= 0) {
        newErrors[`par_${row.hole_number}`] = 'Par > 0';
      }

      if (row.stroke_index.trim() === '') {
        newErrors[`stroke_index_${row.hole_number}`] = 'Obligatori / Obligatorio';
      } else if (Number.isNaN(siNum) || siNum < 1 || siNum > 18) {
        newErrors[`stroke_index_${row.hole_number}`] = '1 – 18';
      } else {
        if (seenStrokeIndices.has(siNum)) {
          const otherHole = seenStrokeIndices.get(siNum)!;
          newErrors[`stroke_index_${row.hole_number}`] = `Duplicat amb hoyo ${otherHole} / Duplicado con hoyo ${otherHole}`;
          newErrors[`stroke_index_${otherHole}`] = `Duplicat amb hoyo ${row.hole_number} / Duplicado con hoyo ${row.hole_number}`;
        }
        seenStrokeIndices.set(siNum, row.hole_number);
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Hi ha errors de validació. Revisa els camps marcats. / Hay errores de validación. Revisa los campos marcados.');
      return;
    }

    setSaving(true);
    try {
      const upserts = rows.map((row) => ({
        course_name: COURSE_NAME,
        hole_number: row.hole_number,
        par: Number(row.par),
        stroke_index: Number(row.stroke_index),
      }));

      const { error } = await supabase.from('course_holes').upsert(upserts, {
        onConflict: 'course_name,hole_number',
      });

      if (error) throw error;

      toast.success('Dades del camp guardades correctament / Datos del campo guardados correctamente');
    } catch (err: any) {
      toast.error(err.message || 'Error guardant dades del camp');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregant… / Cargando…</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{COURSE_NAME}</CardTitle>
        <CardDescription>
          Gestiona el par i l&apos;índex de handicap (stroke index) dels 18 forats.
          <br />
          Gestiona el par y el índice de hándicap (stroke index) de los 18 hoyos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Hoyo</TableHead>
                <TableHead>Par</TableHead>
                <TableHead>Stroke index / Hándicap del hoyo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const parError = errors[`par_${row.hole_number}`];
                const siError = errors[`stroke_index_${row.hole_number}`];
                return (
                  <TableRow key={row.hole_number}>
                    <TableCell className="font-medium">{row.hole_number}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={row.par}
                        onChange={(e) => updateRow(row.hole_number, 'par', e.target.value)}
                        className={`w-20 ${parError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        placeholder="Par"
                      />
                      {parError && (
                        <p className="text-[11px] text-destructive mt-1">{parError}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={18}
                        value={row.stroke_index}
                        onChange={(e) => updateRow(row.hole_number, 'stroke_index', e.target.value)}
                        className={`w-28 ${siError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        placeholder="SI"
                      />
                      {siError && (
                        <p className="text-[11px] text-destructive mt-1">{siError}</p>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Aquests dades són necessàries per calcular els punts Stableford a partir dels cops forat a forat.
            <br />
            Estos datos son necesarios para calcular los puntos Stableford a partir de los golpes hoyo a hoyo.
          </p>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
