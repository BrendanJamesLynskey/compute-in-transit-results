/**
 * Views of the experiment's run logs for the pages: configurations grouped
 * over seeds, their loss curves (mean, and the band between the lowest and
 * highest seed), the captured-energy diagnostics per family, and the
 * optics' clip rates. Pure functions of the run logs (src/data/derived/
 * runs.json, exported unrounded by scripts/vendor.py); the unit tests check
 * them against the experiment's own results.json and results.md.
 */
import type { Run, RunConfig } from "@/lib/data/types";

export type Kind = "A" | "B" | "C" | "D" | "E0" | "E" | "Ec" | "F";

export type Group = {
  id: string;
  /** The experiment's label (results.md, column 1). */
  label: string;
  /** A short label for legends. */
  short: string;
  kind: Kind;
  config: RunConfig;
  runs: Run[];
};

function chunkText(c: RunConfig): string {
  return c.chunk_mode === "2d" ? `2-D ${c.chunk}×${c.chunk}` : `1-D ${c.chunk}`;
}

export function kindOf(c: RunConfig): Kind {
  switch (c.variant) {
    case "adamw":
      return "A";
    case "topk":
      return "B";
    case "calib":
      return "D";
    case "band":
      return c.band === "low" ? "C" : "F";
    default:
      if (c.enob === null) return "Ec";
      return c.feedback === "sent" ? "E" : "E0";
  }
}

export function shortLabel(c: RunConfig): string {
  switch (kindOf(c)) {
    case "A":
      return "A · AdamW";
    case "B":
      return "B · top-k";
    case "C":
      return `C · low band, ${chunkText(c)}`;
    case "D":
      return "D · calibrated band";
    case "F":
      return `F · ${c.band} band`;
    case "Ec":
      return "E · perfect optics (control)";
    case "E0":
      return `E · ENOB ${c.enob}, ${c.planes} planes, first design`;
    default:
      return `E · ENOB ${c.enob}, ${c.planes} planes${c.fs_every ? "" : ", full scale fixed"}`;
  }
}

/** The runs grouped into configurations (seeds together), in results.md order. */
export function groups(runs: Run[], order: string[]): Group[] {
  const by = new Map<string, Run[]>();
  for (const r of runs) by.set(r.group, [...(by.get(r.group) ?? []), r]);
  return order.map((id) => {
    const rs = by.get(id);
    if (!rs) throw new Error(`no runs for ${id}`);
    const c = rs[0]!.config;
    return {
      id,
      label: rs[0]!.label,
      short: shortLabel(c),
      kind: kindOf(c),
      config: c,
      runs: rs.sort((a, b) => a.config.seed - b.config.seed),
    };
  });
}

/** Python's statistics.fmean (an exactly rounded sum, then one division). */
export function fmean(xs: number[]): number {
  // Neumaier's compensated sum: exact enough for the handful of values here
  let s = 0;
  let c = 0;
  for (const x of xs) {
    const t = s + x;
    c += Math.abs(s) >= Math.abs(x) ? s - t + x : x - t + s;
    s = t;
  }
  return (s + c) / xs.length;
}

export type Curve = {
  id: string;
  short: string;
  kind: Kind;
  seeds: number;
  step: number[];
  /** Cumulative wire bytes per worker at each evaluation. */
  wire: number[];
  mean: number[];
  lo: number[];
  hi: number[];
  /** Each seed's validation loss. */
  perSeed: number[][];
};

export function curve(g: Group): Curve {
  const step = g.runs[0]!.evals.step;
  for (const r of g.runs)
    if (r.evals.step.join() !== step.join())
      throw new Error(`${r.name}: different evaluation steps`);
  const perSeed = g.runs.map((r) => r.evals.val_loss);
  const at = (i: number) => perSeed.map((s) => s[i]!);
  return {
    id: g.id,
    short: g.short,
    kind: g.kind,
    seeds: g.runs.length,
    step,
    wire: g.runs[0]!.evals.wire_bytes,
    mean: step.map((_, i) => fmean(at(i))),
    lo: step.map((_, i) => Math.min(...at(i))),
    hi: step.map((_, i) => Math.max(...at(i))),
    perSeed,
  };
}

/** The energy families of results.md section 2 (analyse.energy's filter). */
export const ENERGY_FAMILIES = [
  { key: "band/2d/64", run: "C, 2d 64", title: "C · low band, 2-D 64×64" },
  { key: "band/1d/256", run: "C, 1d 256", title: "C · low band, 1-D 256" },
  { key: "band/1d/64", run: "C, 1d 64", title: "C · low band, 1-D 64" },
  {
    key: "calib/2d/64",
    run: "D, 2d 64",
    title: "D · calibrated band, 2-D 64×64",
  },
  { key: "topk/2d/64", run: "B, 2d 64", title: "B · top-k, 2-D 64×64" },
] as const;
export type EnergyFamily = (typeof ENERGY_FAMILIES)[number]["key"];

export function familyOf(c: RunConfig): EnergyFamily | null {
  if (!["topk", "band", "calib"].includes(c.variant)) return null;
  if (!["low", "calib"].includes(c.band)) return null;
  return `${c.variant}/${c.chunk_mode}/${c.chunk}` as EnergyFamily;
}

/**
 * Captured energy per diagnostic step, mean over the family's seeds, for
 * each tensor/group/selector key ("momentum/all/topk", …).
 */
export function energyOverTraining(
  runs: Run[],
  family: EnergyFamily,
): { step: number[]; energy: Record<string, (number | null)[]> } {
  const rs = runs.filter((r) => familyOf(r.config) === family);
  const step = rs[0]!.diags.step;
  const energy: Record<string, (number | null)[]> = {};
  for (const k of Object.keys(rs[0]!.diags.energy))
    energy[k] = step.map((_, i) => {
      const xs = rs.map((r) => r.diags.energy[k]![i]);
      return xs.every((x) => typeof x === "number")
        ? fmean(xs as number[])
        : null;
    });
  return { step, energy };
}

/**
 * results.md section 2's average: every diagnostic after `after` (the
 * warm-up), over every seed of the family (analyse.energy).
 */
export function energyAverage(
  runs: Run[],
  family: EnergyFamily,
  after: number,
): Record<string, number> {
  const rs = runs.filter((r) => familyOf(r.config) === family);
  const acc: Record<string, number[]> = {};
  for (const r of rs)
    r.diags.step.forEach((s, i) => {
      if (s <= after) return;
      for (const [k, v] of Object.entries(r.diags.energy)) {
        const x = v[i];
        if (typeof x === "number") (acc[k] ??= []).push(x);
      }
    });
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, fmean(v)]));
}
