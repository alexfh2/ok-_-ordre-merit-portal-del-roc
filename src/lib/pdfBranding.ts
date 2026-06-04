import anniversaryLogo from '@/assets/anniversary-logo.png';
import type jsPDF from 'jspdf';

let cachedLogo: string | null = null;

export async function getLogoDataUrl(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const res = await fetch(anniversaryLogo);
    const blob = await res.blob();
    cachedLogo = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return cachedLogo;
  } catch {
    return null;
  }
}

export interface PdfHeaderOptions {
  title: string;       // e.g. "Ordre del Mèrit Portal del Roc"
  subtitle: string;    // e.g. "5a Prova — 12 de juny de 2026"
  smallLine?: string;  // e.g. "Classificació Hàndicap Masculí"
}

export function drawPdfHeader(doc: jsPDF, logo: string | null, opts: PdfHeaderOptions): number {
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const headerH = 26;

  // Header background bar
  doc.setFillColor(15, 23, 42); // slate-900-ish
  doc.rect(0, 0, pageW, headerH, 'F');

  // Logo
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', marginX, 4, 18, 18);
    } catch {
      // ignore
    }
  }

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(opts.title, marginX + 22, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(200, 210, 225);
  doc.text(opts.subtitle, marginX + 22, 18);

  if (opts.smallLine) {
    doc.setFontSize(9);
    doc.setTextColor(180, 195, 215);
    doc.text(opts.smallLine, marginX + 22, 23);
  }

  // Reset
  doc.setTextColor(0, 0, 0);
  return headerH;
}

export function drawPdfFooter(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const stamp = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`Generat el ${stamp} · Portal del Roc Pitch & Putt`, 14, pageH - 8);
    doc.text(`Pàg. ${i} / ${total}`, pageW - 14, pageH - 8, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
}
