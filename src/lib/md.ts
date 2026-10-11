/**
 * Read the vendored results.md files: pipe tables after a heading or a
 * marker line, as arrays of trimmed cells. The pages quote results.md cells
 * through these (never retyped), and the tests compare the model's numbers
 * with them.
 */

export type Table = { header: string[]; rows: string[][] };

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** Every pipe table in `text`, in order. */
export function tables(text: string): Table[] {
  const out: Table[] = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    if (lines[i]!.startsWith("|") && lines[i + 1]?.startsWith("|---")) {
      const header = cells(lines[i]!);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.startsWith("|"))
        rows.push(cells(lines[i++]!));
      out.push({ header, rows });
    } else i += 1;
  }
  return out;
}

/** The text from `marker` up to the next heading of the same or a higher level. */
export function section(md: string, marker: string): string {
  const at = md.indexOf(marker);
  if (at < 0) throw new Error(`results.md: no "${marker}"`);
  const rest = md.slice(at + marker.length);
  const level = (marker.match(/^#+/)?.[0] ?? "##").length;
  const re = new RegExp(`\\n#{1,${level}} `);
  const end = rest.search(re);
  return end < 0 ? rest : rest.slice(0, end);
}

/** The `n`th table (0-based) after `marker`. */
export function tableAfter(md: string, marker: string, n = 0): Table {
  const t = tables(section(md, marker))[n];
  if (!t) throw new Error(`results.md: no table ${n} after "${marker}"`);
  return t;
}

/** A row of a table by its first cell. */
export function row(t: Table, first: string): string[] {
  const r = t.rows.find((x) => x[0] === first);
  if (!r) throw new Error(`results.md: no row "${first}"`);
  return r;
}

/** A cell by row (first cell) and column header. */
export function cell(t: Table, first: string, column: string): string {
  const j = t.header.indexOf(column);
  if (j < 0) throw new Error(`results.md: no column "${column}"`);
  return row(t, first)[j]!;
}
