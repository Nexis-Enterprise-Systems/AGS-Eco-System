import { Fragment, type ReactNode } from "react";

// Shows agreement text (simple markdown: headings, bold, tables,
// paragraphs) in the AGS style instead of as raw characters. The stored
// wording is unchanged; this only affects how it is displayed.
function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function AgreementText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
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
      const [head, ...body] = rows;
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto rounded-sm border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted">
                {head.map((h, c) => (
                  <th key={c} className="px-3 py-2 font-medium">
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="border-b border-line last:border-0 align-top">
                  {r.map((c, ci) => (
                    <td key={ci} className={`px-3 py-2 ${ci === 0 ? "w-1/3 text-ink-muted" : ""}`}>
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      blocks.push(
        <div
          key={key++}
          className={
            level === 1
              ? "mb-2 mt-2 font-display text-2xl"
              : level === 2
                ? "mb-1 mt-6 font-display text-xl"
                : "mb-1 mt-4 text-sm font-semibold"
          }
        >
          {inline(h[2])}
        </div>
      );
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("|") && !/^#{1,3}\s/.test(lines[i]) && !/^---+$/.test(lines[i].trim())) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-2 whitespace-pre-line text-sm leading-relaxed">
        {inline(para.join("\n"))}
      </p>
    );
  }
  return <div className={className}>{blocks}</div>;
}
