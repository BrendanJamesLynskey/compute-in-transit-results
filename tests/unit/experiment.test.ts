/**
 * The run-log views against the experiment's own results: the final losses,
 * bytes, run times and clip rates of results.json, and the ladder, energy
 * and optics tables of results.md, recomputed from the exported logs.
 */
import { describe, expect, it } from "vitest";

import { experimentMd, experimentResults, runsFile } from "@/lib/data/load";
import {
  ladderCell,
  ladderTargets,
  inLadder,
  stepsToLoss,
} from "@/lib/experiment/ladder";
import {
  curve,
  ENERGY_FAMILIES,
  energyAverage,
  energyOverTraining,
  fmean,
  groups,
} from "@/lib/experiment/series";
import { fixed } from "@/lib/format";
import { tableAfter } from "@/lib/md";

const R = experimentResults();
const runs = runsFile().runs;
const G = groups(
  runs,
  R.rows.map((r) => r.group),
);
const MD = experimentMd();

function close(a: number, b: number, rel = 1e-12): boolean {
  // relative, or absolute for the energies that are zero to rounding (a band
  // removed by error feedback every step keeps ~1e-17 of the delta)
  return (
    Math.abs(a - b) <= Math.max(rel * Math.max(Math.abs(a), Math.abs(b)), 1e-15)
  );
}

describe("the exported run logs", () => {
  it("are every completed run at the pinned commit", () => {
    expect(runsFile().commit).toBe("b1f62d394ac79250df9ce555d3a55d85cf1cd517");
    expect(runs).toHaveLength(33);
    expect(MD).toContain("from 33 completed runs");
  });

  it("group into results.json's configurations, seeds and labels", () => {
    expect(G).toHaveLength(R.rows.length);
    R.rows.forEach((r, i) => {
      expect(G[i]!.label).toBe(r.label);
      expect(G[i]!.runs).toHaveLength(r.seeds);
    });
  });

  it("give results.json's final losses, bytes and run times", () => {
    R.rows.forEach((r, i) => {
      const c = curve(G[i]!);
      expect(close(c.mean.at(-1)!, r.final_val), r.label).toBe(true);
      const last = G[i]!.runs.map((x) => x.evals.val_loss.at(-1)!);
      if (last.length > 1) {
        const m = fmean(last);
        const sd = Math.sqrt(
          last.reduce((s, x) => s + (x - m) ** 2, 0) / (last.length - 1),
        );
        expect(close(sd, r.final_val_sd, 1e-9), r.label).toBe(true);
      }
      for (const run of G[i]!.runs) {
        expect(run.evals.step.at(-1)).toBe(3000);
        expect(run.evals.wire_bytes.at(-1)).toBe(r.wire_per_step * 3000);
        expect(run.evals.payload_bytes.at(-1)).toBe(r.payload_per_step * 3000);
      }
      expect(
        close(fmean(G[i]!.runs.map((x) => x.seconds)), r.seconds, 1e-12),
      ).toBe(true);
      if (r.clip_rate !== undefined) {
        expect(
          close(
            fmean(G[i]!.runs.map((x) => x.evals.clip_rate.at(-1)!)),
            r.clip_rate,
          ),
        ).toBe(true);
        expect(
          close(
            fmean(G[i]!.runs.map((x) => x.evals.clip_rate_interval.at(-1)!)),
            r.clip_rate_last!,
          ),
        ).toBe(true);
      }
    });
  });

  it("curves: the band lies between the seeds, around the mean", () => {
    for (const g of G) {
      const c = curve(g);
      c.mean.forEach((m, i) => {
        expect(c.lo[i]!).toBeLessThanOrEqual(m + 1e-12);
        expect(c.hi[i]!).toBeGreaterThanOrEqual(m - 1e-12);
      });
    }
  });
});

describe("results.md, recomputed from the logs", () => {
  it("the steps-to-loss ladder, cell for cell", () => {
    const t = tableAfter(MD, "### Steps to reach a loss");
    const targets = ladderTargets(R.rows);
    expect(t.header.slice(1)).toEqual(
      targets.map((x) => `to ${fixed(x.loss, 3)} (${x.letter})`),
    );
    const got = R.rows
      .map((r, i) => ({ r, g: G[i]! }))
      .filter(({ r }) => inLadder(r.label))
      .map(({ r, g }) => [
        r.label,
        ...targets.map((x) =>
          ladderCell(stepsToLoss(g, x.loss), r.payload_per_step),
        ),
      ]);
    expect(got).toEqual(t.rows);
  });

  it("captured energy: results.json's averages and results.md's table", () => {
    const t = tableAfter(MD, "## 2. Captured energy");
    for (const f of ENERGY_FAMILIES) {
      const avg = energyAverage(runs, f.key, 200);
      const want = R.energy[f.key]!;
      expect(Object.keys(avg).sort()).toEqual(Object.keys(want).sort());
      for (const [k, v] of Object.entries(want))
        expect(close(avg[k]!, v, 1e-12), `${f.key} ${k}`).toBe(true);
      for (const src of ["momentum", "delta", "grad"])
        for (const grp of ["all", "attn", "mlp", "embed"]) {
          const row = t.rows.find(
            (r) => r[0] === f.run && r[1] === src && r[2] === grp,
          )!;
          const g = (s: string) => {
            const v = avg[`${src}/${grp}/${s}`];
            return v === undefined ? "n/a" : fixed(v, 3);
          };
          expect(row.slice(3), `${f.run} ${src} ${grp}`).toEqual(
            ["topk", "low", "zigzag", "high", "random", "calib"].map(g),
          );
        }
    }
  });

  it("energy over training: the family means per diagnostic step", () => {
    const e = energyOverTraining(runs, "band/2d/64");
    expect(e.step[0]).toBe(200);
    expect(e.step.at(-1)).toBe(3000);
    expect(e.energy["momentum/all/topk"]).toHaveLength(e.step.length);
  });

  it("the optics table: final loss and clip rates", () => {
    const t = tableAfter(MD, "## 3. Emulated optics");
    const got = R.rows
      .filter((r) => r.variant === "optics")
      .map((r) => [
        r.label,
        fixed(r.final_val, 3),
        `${fixed(100 * r.clip_rate!, 2)}%`,
        `${fixed(100 * r.clip_rate_last!, 2)}%`,
      ]);
    expect(got).toEqual(t.rows);
  });
});
