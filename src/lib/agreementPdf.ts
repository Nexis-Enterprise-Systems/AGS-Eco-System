// Builds the signed-agreement PDF in the browser from the exact wording
// that was signed. Used when someone signs (the PDF is stored with the
// record), when an admin downloads it, and for the person's own copy.
// jsPDF is loaded only when needed so it does not slow the rest of the app.

export interface AgreementPdfInput {
  title: string;
  body: string;
  signatureName: string;
  signedAt: Date;
  reference?: string;
}

const MARGIN = 20;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BODY_PT = 9.5;
const LINE = 4.8;

// Standard PDF fonts cover Latin text; anything else is replaced.
function clean(s: string): string {
  return s
    .replace(/\*\*/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\n\t -ÿ–—•…€]/g, "?");
}

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => clean(c.trim()));
}

export async function buildAgreementPdf(input: AgreementPdfInput): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const ink = (r = 27, g = 29, b = 31) => doc.setTextColor(r, g, b);
  const ensure = (h: number) => {
    if (y + h > PAGE_H - 18) {
      doc.addPage();
      y = MARGIN;
    }
  };
  const paragraph = (text: string, opts?: { size?: number; font?: "helvetica" | "times"; style?: "normal" | "bold" | "italic"; gap?: number }) => {
    doc.setFont(opts?.font ?? "helvetica", opts?.style ?? "normal");
    doc.setFontSize(opts?.size ?? BODY_PT);
    const lines = doc.splitTextToSize(clean(text), CONTENT_W) as string[];
    for (const l of lines) {
      ensure(LINE);
      doc.text(l, MARGIN, y);
      y += LINE;
    }
    y += opts?.gap ?? 2;
  };

  // ---- Body, from the same simple markdown the screen shows ----------
  ink();
  const lines = input.body.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || /^---+$/.test(line.trim())) {
      i++;
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!/^\|[\s|:-]+\|?$/.test(lines[i])) rows.push(cells(lines[i]));
        i++;
      }
      const cols = rows[0]?.length ?? 2;
      const widths = cols === 2 ? [CONTENT_W * 0.33, CONTENT_W * 0.67] : Array(cols).fill(CONTENT_W / cols);
      doc.setDrawColor(217, 215, 210);
      doc.setLineWidth(0.2);
      rows.forEach((r, ri) => {
        doc.setFont("helvetica", ri === 0 ? "bold" : "normal");
        doc.setFontSize(BODY_PT - 0.5);
        const wrapped = r.map((c, ci) => doc.splitTextToSize(c, widths[ci] - 4) as string[]);
        const h = Math.max(...wrapped.map((w) => w.length)) * (LINE - 0.4) + 3.2;
        ensure(h);
        let x = MARGIN;
        wrapped.forEach((w, ci) => {
          doc.rect(x, y, widths[ci], h);
          if (ri !== 0 && ci === 0 && cols === 2) ink(94, 98, 102);
          else ink();
          w.forEach((l, li) => doc.text(l, x + 2, y + 4 + li * (LINE - 0.4)));
          x += widths[ci];
        });
        ink();
        y += h;
      });
      y += 4;
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      ensure(level === 1 ? 16 : 12);
      y += level === 1 ? 2 : 4;
      doc.setFont("times", "bold");
      doc.setFontSize(level === 1 ? 20 : level === 2 ? 13 : 10.5);
      doc.text(clean(h[2]), MARGIN, y);
      y += level === 1 ? 8 : 6;
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("|") && !/^#{1,3}\s/.test(lines[i]) && !/^---+$/.test(lines[i].trim())) {
      para.push(lines[i]);
      i++;
    }
    paragraph(para.join("\n"));
  }

  // ---- Signature block ------------------------------------------------
  ensure(42);
  y += 6;
  doc.setDrawColor(110, 93, 63);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  ink(110, 93, 63);
  doc.text("SIGNED ELECTRONICALLY", MARGIN, y);
  y += 9;
  ink();
  doc.setFont("times", "italic");
  doc.setFontSize(20);
  doc.text(clean(input.signatureName), MARGIN, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const when = input.signedAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
  doc.text(`Signed by typing their full name on ${when} (UK time).`, MARGIN, y);
  y += 5;
  if (input.reference) {
    doc.text(`Reference: ${clean(input.reference)}`, MARGIN, y);
    y += 5;
  }

  // ---- Page footers ----------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    ink(94, 98, 102);
    doc.text(clean(input.title), MARGIN, PAGE_H - 10);
    doc.text(`Page ${p} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 10, { align: "right" });
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
