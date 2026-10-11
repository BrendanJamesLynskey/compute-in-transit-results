/**
 * The steps-to-loss ladder (results.md section 1, "Steps to reach a loss"),
 * recomputed from the run logs as the experiment's analyse.ladder does: the
 * targets are the multi-seed configurations' mean final losses (to 3
 * decimals); a cell is the first evaluation at or below the target, mean
 * over seeds, shown only when every seed reaches it.
 */
import type { ResultRow } from "@/lib/data/types";

import { fixed } from "../format";
import { fmean, type Group } from "./series";

export type Target = { loss: number; letter: string };

export function ladderTargets(rows: ResultRow[]): Target[] {
  const marks = new Map<string, [number, string]>();
  for (const r of rows)
    if (r.seeds > 1 && r.final_val !== null && !marks.has(r.variant + r.label))
      marks.set(r.variant + r.label, [r.final_val, r.label.slice(0, 1)]);
  const byLoss = new Map<number, string>();
  for (const [v, k] of marks.values())
    byLoss.set(Math.round(v * 1000) / 1000, k);
  return [...byLoss.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([loss, letter]) => ({ loss, letter }));
}

/** Mean steps to reach `loss`, or null when a seed never does. */
export function stepsToLoss(g: Group, loss: number): number | null {
  const hits = g.runs.map((r) => {
    const i = r.evals.val_loss.findIndex((v) => v <= loss);
    return i < 0 ? null : r.evals.step[i]!;
  });
  return hits.every((h) => h !== null) ? fmean(hits as number[]) : null;
}

/** A ladder cell as results.md writes it: "2,667 (5.28 GB)" or "–". */
export function ladderCell(
  steps: number | null,
  payloadPerStep: number,
): string {
  return steps === null
    ? "–"
    : `${fixed(steps, 0)} (${fixed((steps * payloadPerStep) / 1e9, 2)} GB)`;
}

/** Configurations the ladder leaves out: the diverged first optics design. */
export function inLadder(label: string): boolean {
  return !(
    label.startsWith("E") && label.includes("feedback of the exact band")
  );
}
