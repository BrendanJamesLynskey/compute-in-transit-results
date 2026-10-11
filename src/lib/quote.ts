/**
 * Quoting the vendored results in the pages' prose (Server-side only): each
 * function reads a number from results.json or a cell from results.md and
 * formats it as the source does, so no result is retyped. A lookup that no
 * longer resolves throws, failing the build.
 */
import {
  experimentMd,
  experimentResults,
  simMd,
  simResults,
} from "@/lib/data/load";
import type { ResultRow } from "@/lib/data/types";
import { fixed } from "@/lib/format";
import { cell, tableAfter } from "@/lib/md";

/** The configurations the pages quote, by their results.json group. */
export const G = {
  A: "tinystories-adamw-lr0.003",
  B: "tinystories-topk-k16-2d64-lr0.001",
  C1d256: "tinystories-band-low-k16-1d256-lr0.001",
  C1d64: "tinystories-band-low-k16-1d64-lr0.001",
  C2d: "tinystories-band-low-k16-2d64-lr0.001",
  D: "tinystories-calib-calib-k16-2d64-lr0.001",
  Fhigh: "tinystories-band-high-k16-2d64-lr0.001",
  Frandom: "tinystories-band-random-k16-2d64-lr0.001",
  Fzigzag: "tinystories-band-zigzag-k16-2d64-lr0.001",
  Ectrl: "tinystories-optics-low-k16-1d256-enobNone-pNone-lr0.001",
  E6: "tinystories-optics-low-k16-1d256-enob6.0-p8-agc100-fbsent-lr0.001",
  E8: "tinystories-optics-low-k16-1d256-enob8.0-p8-agc100-fbsent-lr0.001",
  E10: "tinystories-optics-low-k16-1d256-enob10.0-p8-agc100-fbsent-lr0.001",
  E12: "tinystories-optics-low-k16-1d256-enob12.0-p8-agc100-fbsent-lr0.001",
  E8p4: "tinystories-optics-low-k16-1d256-enob8.0-p4-agc100-fbsent-lr0.001",
  E8p12: "tinystories-optics-low-k16-1d256-enob8.0-p12-agc100-fbsent-lr0.001",
  E8fixed: "tinystories-optics-low-k16-1d256-enob8.0-p8-fbsent-lr0.001",
  E0_8: "tinystories-optics-low-k16-1d256-enob8.0-p8-lr0.001",
} as const;

export function row(id: string): ResultRow {
  const r = experimentResults().rows.find((x) => x.group === id);
  if (!r) throw new Error(`results.json: no row ${id}`);
  return r;
}

/** Final validation loss as results.md prints it (3 decimals). */
export const loss = (id: string): string => fixed(row(id).final_val, 3);
/** "1.785 ± 0.007" (multi-seed rows). */
export const lossSd = (id: string): string =>
  `${fixed(row(id).final_val, 3)} ± ${fixed(row(id).final_val_sd, 3)}`;
/** Bytes per worker per step, with separators. */
export const wire = (id: string): string => fixed(row(id).wire_per_step, 0);
export const payload = (id: string): string =>
  fixed(row(id).payload_per_step, 0);
/** Megabytes, 1 decimal ("27.7 MB"), for prose. */
export const mb = (bytes: number): string => `${fixed(bytes / 1e6, 1)} MB`;

/** Captured energy share (results.json, results.md section 2's 3 decimals). */
export function energy(family: string, key: string): string {
  const v = experimentResults().energy[family]?.[key];
  if (v === undefined)
    throw new Error(`results.json: no energy ${family} ${key}`);
  return fixed(v, 3);
}

/** A cell of the experiment's results.md. */
export function expCell(
  marker: string,
  rowName: string,
  column: string,
  n = 0,
): string {
  return cell(tableAfter(experimentMd(), marker, n), rowName, column);
}

/** A cell of the simulation's results.md. */
export function simCell(
  marker: string,
  rowName: string,
  column: string,
  n = 0,
): string {
  return cell(tableAfter(simMd(), marker, n), rowName, column);
}

/** A row of the simulation's 7a break-even table: X, Y, module, steps → its cells. */
export function breakEven(
  x: string,
  y: string,
  module: string,
  steps: string,
): string[] {
  const t = tableAfter(simMd(), "### 7a.");
  const r = t.rows.find(
    (c) => c[0] === x && c[1] === y && c[2] === module && c[3] === steps,
  );
  if (!r)
    throw new Error(`results.md 7a: no row ${x} / ${y} / ${module} / ${steps}`);
  return r;
}

/** The simulation's results.json, for the transit page's recorded points. */
export { simResults };
