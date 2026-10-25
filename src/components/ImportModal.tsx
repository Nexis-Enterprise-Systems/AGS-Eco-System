import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Modal } from "./Modal";
import { autoFormat } from "../lib/format";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  // Extra column-header spellings that should auto-map to this field,
  // on top of the field's own key/label. Lets a raw export from a
  // specific external tool (e.g. Xero, QuickBooks, Zoho Books) land
  // pre-mapped with no manual work, while still falling back to the
  // manual dropdown below for anything unrecognised.
  synonyms?: string[];
}

// Generic bulk-import flow: upload a .csv or .xlsx, map its columns to
// the target table's fields, preview, then insert. Used by Clients,
// Projects and Sub-Contractors so each only supplies its own field
// list and a row-transform function (e.g. parsing a date string).
export function ImportModal<T extends Record<string, unknown>>({
  title,
  fields,
  onClose,
  onImport,
  transformRow,
}: {
  title: string;
  fields: ImportField[];
  onClose: () => void;
  onImport: (rows: T[]) => Promise<{ error: string | null; count: number }>;
  transformRow: (mapped: Record<string, string>) => T;
}) {
  const [step, setStep] = useState<"upload" | "map" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ count: number; error: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  function handleFile(file: File) {
    setError(null);
    const isExcel = /\.xlsx?$/i.test(file.name);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
        if (json.length === 0) {
          setError("That sheet looks empty.");
          return;
        }
        setHeaders(Object.keys(json[0]));
        setDataRows(json);
        setMapping(autoMap(Object.keys(json[0]), fields));
        setStep("map");
      };
      reader.readAsBinaryString(file);
    } else {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length === 0) {
            setError("That file looks empty.");
            return;
          }
          const cols = results.meta.fields ?? [];
          setHeaders(cols);
          setDataRows(results.data);
          setMapping(autoMap(cols, fields));
          setStep("map");
        },
        error: (err) => setError(err.message),
      });
    }
  }

  async function handleImport() {
    setBusy(true);
    setError(null);
    const missing = fields.filter((f) => f.required && !mapping[f.key]);
    if (missing.length > 0) {
      setError(`Please map: ${missing.map((f) => f.label).join(", ")}`);
      setBusy(false);
      return;
    }

    const rows: T[] = dataRows.map((raw) => {
      const mapped: Record<string, string> = {};
      for (const f of fields) {
        const sourceCol = mapping[f.key];
        mapped[f.key] = sourceCol ? autoFormat(f.key, String(raw[sourceCol] ?? "").trim()) : "";
      }
      return transformRow(mapped);
    });

    const res = await onImport(rows);
    setResult(res);
    setBusy(false);
    setStep("done");
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      {step === "upload" && (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">Upload a CSV or Excel (.xlsx) file to bulk-import records.</p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="input"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}

      {step === "map" && (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            Found {dataRows.length} row{dataRows.length === 1 ? "" : "s"}. Match each field to a column from your
            file.
          </p>
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <label className="w-40 shrink-0 text-sm font-medium">
                  {f.label}
                  {f.required && <span className="text-red-600 dark:text-red-400"> *</span>}
                </label>
                <select
                  className="input"
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                >
                  <option value="">— Skip —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="max-h-48 overflow-auto rounded-lg border border-line text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted">
                  {headers.map((h) => (
                    <th key={h} className="px-2 py-1 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {headers.map((h) => (
                      <td key={h} className="px-2 py-1">
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setStep("upload")}>
              Back
            </button>
            <button className="btn-primary" disabled={busy} onClick={handleImport}>
              {busy ? "Importing…" : `Import ${dataRows.length} row${dataRows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-4">
          {result?.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">Import failed: {result.error}</p>
          ) : (
            <p className="text-sm text-green-700 dark:text-green-300">Imported {result?.count ?? 0} records successfully.</p>
          )}
          <div className="flex justify-end">
            <button className="btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Matches each target field to the best column in the uploaded file.
// Tries the field's own key and label first, then its synonym list
// (real-world header spellings from tools like Xero/QuickBooks/Zoho —
// see each page's IMPORT_FIELDS for the actual lists). Whatever isn't
// auto-matched still shows up in the mapping dropdown for a manual pick,
// so an unrecognised header never blocks the import.
function autoMap(headers: string[], fields: ImportField[]): Record<string, string> {
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const mapping: Record<string, string> = {};
  const used = new Set<string>();

  for (const f of fields) {
    const candidates = [f.key, f.label, ...(f.synonyms ?? [])].map(normalizeHeader);
    const found = normalizedHeaders.find((h) => !used.has(h.raw) && candidates.includes(h.norm));
    if (found) {
      mapping[f.key] = found.raw;
      used.add(found.raw);
    }
  }
  return mapping;
}
