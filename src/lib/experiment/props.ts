/**
 * Slim views of the run logs and results for the pages' client widgets
 * (Server-side only: it reads the files). Values are not rounded, so a
 * widget formats exactly what results.md formats; every one traces to a run
 * log or to results.json, and the unit tests check those against results.md.
 */
import type { LossSeries } from "@/components/widgets/LossCurves";
import { experimentMd, experimentResults, runsFile } from "@/lib/data/load";
import type { ResultRow } from "@/lib/data/types";

import { ladderCell, ladderTargets, inLadder, stepsToLoss } from "./ladder";
import {
  curve,
  ENERGY_FAMILIES,
  energyAverage,
  energyOverTraining,
  groups,
  type Group,
} from "./series";

const r6 = (v: number): number => v;

export function allGroups(): Group[] {
  return groups(
    runsFile().runs,
    experimentResults().rows.map((r) => r.group),
  );
}

export function rowOf(id: string): ResultRow {
  const r = experimentResults().rows.find((x) => x.group === id);
  if (!r) throw new Error(`no results.json row ${id}`);
  return r;
}

export function lossSeries(
  keep: (g: Group) => boolean = () => true,
): LossSeries[] {
  return allGroups()
    .filter(keep)
    .map((g) => {
      const c = curve(g);
      return {
        id: c.id,
        short: c.short,
        kind: c.kind,
        seeds: c.seeds,
        step: c.step,
        wire: c.wire,
        mean: c.mean.map(r6),
        lo: c.lo.map(r6),
        hi: c.hi.map(r6),
      };
    });
}

/** Group ids by a predicate on the short label, for the widgets' defaults. */
export function idsWhere(keep: (g: Group) => boolean): string[] {
  return allGroups()
    .filter(keep)
    .map((g) => g.id);
}

export type LadderRow = {
  id: string;
  short: string;
  kind: Group["kind"];
  label: string;
  steps: (number | null)[];
  cells: string[];
};

/** The steps-to-loss ladder from the logs (checked cell for cell against results.md). */
export function ladderProps(): {
  targets: { loss: number; letter: string }[];
  rows: LadderRow[];
} {
  const rows = experimentResults().rows;
  const targets = ladderTargets(rows);
  const gs = allGroups();
  return {
    targets,
    rows: rows
      .map((r, i) => ({ r, g: gs[i]! }))
      .filter(({ r }) => inLadder(r.label))
      .map(({ r, g }) => {
        const steps = targets.map((t) => stepsToLoss(g, t.loss));
        return {
          id: g.id,
          short: g.short,
          kind: g.kind,
          label: r.label,
          steps,
          cells: steps.map((s) => ladderCell(s, r.payload_per_step)),
        };
      }),
  };
}

export type EnergyProps = {
  families: {
    key: string;
    title: string;
    step: number[];
    /** "momentum/all/topk" → value per diagnostic step (null before calibration). */
    energy: Record<string, (number | null)[]>;
    /** results.md section 2's average after the warm-up. */
    average: Record<string, number>;
  }[];
  after: number;
  /** The fraction of coefficients every compressed variant keeps. */
  keep: number;
};

export function energyProps(): EnergyProps {
  const runs = runsFile().runs;
  // results.md section 2: "averaged over diagnostics after step <warm-up>"
  const after = Number(
    /averaged over diagnostics after step (\d+)/.exec(experimentMd())![1],
  );
  return {
    after,
    keep: runs.find((r) => r.config.variant === "band")!.config.keep,
    families: ENERGY_FAMILIES.map((f) => {
      const e = energyOverTraining(runs, f.key);
      const avg = energyAverage(runs, f.key, after);
      return {
        key: f.key,
        title: f.title,
        step: e.step,
        energy: Object.fromEntries(
          Object.entries(e.energy).map(([k, v]) => [
            k,
            v.map((x) => (x === null ? null : r6(x))),
          ]),
        ),
        average: Object.fromEntries(
          Object.entries(avg).map(([k, v]) => [k, r6(v)]),
        ),
      };
    }),
  };
}

export type ClipSeries = {
  id: string;
  short: string;
  kind: Group["kind"];
  enob: number | null;
  planes: number | null;
  step: number[];
  loss: number[];
  /** Share of inputs clipped over the interval ending at each evaluation. */
  clip: (number | null)[];
};

/** The optics runs: loss and clip rate at every evaluation (one seed each). */
export function clipProps(): ClipSeries[] {
  return allGroups()
    .filter((g) => g.config.variant === "optics")
    .map((g) => {
      const r = g.runs[0]!;
      return {
        id: g.id,
        short: g.short,
        kind: g.kind,
        enob: g.config.enob,
        planes: g.config.planes,
        step: r.evals.step,
        loss: r.evals.val_loss.map(r6),
        clip: r.evals.clip_rate_interval.map((x) =>
          x === null ? null : r6(x),
        ),
      };
    });
}
