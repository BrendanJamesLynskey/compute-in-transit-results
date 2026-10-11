/**
 * The TypeScript port of Training_Transit_Sim against the simulation itself:
 *
 * - the closed forms bit for bit, on fixtures the simulation's own package
 *   wrote (scripts/transit_reference.py, at the vendored commit);
 * - the discrete-event engine (zero background load) to rounding: step
 *   time, hot-spot shares and energy;
 * - every cell of the vendored results.md the transit page can reproduce,
 *   formatted as results.py formats it, character for character.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fixed, pct1, plusFixed, pyG, reached } from "@/lib/format";
import { cell, row, section, tableAfter } from "@/lib/md";
import {
  bandKernel,
  bisect,
  CATEGORIES,
  energyPerStep,
  gapOverBandwidth,
  hotSpot,
  hotSpots,
  moduleOf,
  plan,
  stageTimes,
  stepTime,
  stepsTo,
  streamTime,
  syncTime,
  TARGETS,
  timeTo,
  topology,
  TRANSIT,
  VARIANT_NAME,
  VARIANTS,
  wirePerWorker,
  type Config,
  type ModuleKey,
  type Variant,
} from "@/lib/transit/model";
import {
  BASE,
  BW_RANGE,
  preset,
  TOPOLOGY_PRESETS,
} from "@/lib/transit/presets";

import parity from "../fixtures/transit_parity.json";

const MD = readFileSync(
  join(process.cwd(), "src/data/vendor/sim/results.md"),
  "utf8",
);
const DCS: Record<string, number> = { "1x8": 1, "2x4": 2, "8x1": 8 };

type Row = (typeof parity.rows)[number] & { enob?: number; planes?: number };

function cfgOf(r: Row): Config {
  return {
    variant: r.variant as Variant,
    topo: topology(DCS[r.topology]!, r.bw),
    module: moduleOf(r.module as ModuleKey, {
      ...(r.enob !== undefined ? { enob: r.enob } : {}),
      ...(r.planes !== undefined ? { planes: r.planes } : {}),
    }),
    exactSteps: r.exact,
  };
}

/** results.py's rows_for: each in-transit variant once per module setting. */
function rowsFor(
  modules: ModuleKey[] = ["low", "high", "free"],
  only = VARIANTS,
) {
  const out: { name: string; variant: Variant; module: ModuleKey }[] = [];
  for (const v of only) {
    if (TRANSIT.includes(v))
      for (const m of modules)
        out.push({ name: `${VARIANT_NAME[v]} [${m}]`, variant: v, module: m });
    else out.push({ name: VARIANT_NAME[v], variant: v, module: "high" });
  }
  return out;
}

function at(
  variant: Variant,
  module: ModuleKey,
  name: string,
  exactSteps = false,
): Config {
  const p = preset(name);
  return {
    variant,
    module: moduleOf(module),
    topo: topology(p.dcs, p.bw),
    exactSteps,
  };
}

describe("the closed forms, bit for bit", () => {
  const rows = parity.rows as Row[];
  it("covers every variant, module setting and topology", () => {
    expect(parity.commit).toMatch(/^c6de1f4/);
    expect(rows.length).toBeGreaterThan(700);
    expect(new Set(rows.map((r) => r.variant)).size).toBe(6);
  });
  it("step plan, sync, step and wire bytes equal analytic.py exactly", () => {
    for (const r of rows) {
      const p = plan(cfgOf(r));
      const tag = `${r.variant} ${r.module} ${r.topology} ${r.bw}`;
      expect(p.computeS, tag).toBe(r.compute_s);
      expect(p.payload, tag).toBe(r.payload);
      expect(p.dense, tag).toBe(r.dense);
      expect(syncTime(p), tag).toBe(r.sync);
      expect(stepTime(p), tag).toBe(r.step);
      expect(wirePerWorker(p), tag).toBe(r.wire);
    }
  });
  it("the engine's step time, hot spots and energy, to rounding", () => {
    let n = 0;
    for (const r of rows) {
      if (r.engine_step === undefined) continue;
      n += 1;
      const p = plan(cfgOf(r));
      const tag = `${r.variant} ${r.module} ${r.topology} ${r.bw}`;
      expect(Math.abs(stepTime(p) / r.engine_step - 1), tag).toBeLessThan(
        1e-12,
      );
      const h = hotSpots(p);
      for (const c of CATEGORIES)
        expect(
          Math.abs(h[c] - (r.hot_spots as Record<string, number>)[c]!),
          `${tag} ${c}`,
        ).toBeLessThan(1e-9);
      const e = energyPerStep(p);
      for (const k of ["compute", "link", "module"] as const) {
        const want = (r.energy as Record<string, number>)[k]!;
        expect(Math.abs(e[k] - want), `${tag} ${k}`).toBeLessThanOrEqual(
          1e-12 * Math.abs(want),
        );
      }
    }
    expect(n).toBeGreaterThan(600);
  });
  it("the module's stage times equal Module.stage_times exactly", () => {
    const dense = plan(at("band-pluggable", "high", BASE)).dense;
    for (const s of parity.stages) {
      const m = moduleOf("high", {
        gflops: s.gflops,
        planes: s.planes,
        transform_charged: s.charged,
      });
      const st = stageTimes(m, dense, bandKernel(s.planes));
      for (const [k, v] of Object.entries(s.stages))
        expect(st[k as keyof typeof st]).toBe(v);
      const [t, stage] = streamTime(m, dense, bandKernel(s.planes));
      expect(t).toBe(s.stream);
      expect(stage).toBe(s.binding);
    }
  });
});

describe("results.md, cell for cell", () => {
  it("section 1: the model's wire bytes in one DC", () => {
    const t = tableAfter(MD, "## 1. Inputs");
    for (const v of VARIANTS) {
      const p = plan(at(v, "high", "1 DC x 8"));
      expect(cell(t, VARIANT_NAME[v], "Model wire / step (bytes)")).toBe(
        fixed(wirePerWorker(p), 0),
      );
      expect(cell(t, VARIANT_NAME[v], "Payload / step (bytes)")).toBe(
        fixed(p.payload, 0),
      );
    }
  });

  it("section 2: step time, time to 3.158 and the hot spot on every topology", () => {
    const step = tableAfter(MD, "## 2. Time to", 0);
    const time = tableAfter(MD, "## 2. Time to", 1);
    const hot = tableAfter(MD, "## 2. Time to", 2);
    let n = 0;
    for (const r of rowsFor()) {
      for (const t of TOPOLOGY_PRESETS) {
        const c = at(r.variant, r.module, t.name);
        const p = plan(c);
        expect(cell(step, r.name, t.name), `${r.name} ${t.name}`).toBe(
          fixed(stepTime(p) * 1e3, 3),
        );
        expect(cell(time, r.name, t.name), `${r.name} ${t.name}`).toBe(
          reached(timeTo(c)),
        );
        expect(cell(hot, r.name, t.name), `${r.name} ${t.name}`).toBe(
          hotSpot(p),
        );
        n += 3;
      }
      expect(cell(time, r.name, "Steps")).toBe(
        fixed(stepsTo(at(r.variant, r.module, BASE))!, 0),
      );
    }
    expect(n).toBe(10 * 8 * 3);
  });

  it("section 2: the in-transit rows on the exact band's steps", () => {
    const t = tableAfter(MD, "Without the hypothesis");
    for (const r of rowsFor(["low", "high", "free"], TRANSIT)) {
      const e = at(r.variant, r.module, BASE);
      const x = at(r.variant, r.module, BASE, true);
      const cells = row(t, r.name);
      expect(cells.slice(1)).toEqual([
        fixed(stepsTo(e)!, 0),
        reached(timeTo(e)),
        fixed(stepsTo(x)!, 0),
        reached(timeTo(x)),
      ]);
    }
  });

  it("section 3: time to every ladder loss", () => {
    const t = tableAfter(MD, "## 3. Time to every ladder loss");
    for (const r of rowsFor(["high"]))
      expect(row(t, r.name).slice(1)).toEqual(
        TARGETS.map((_, i) =>
          reached(timeTo(at(r.variant, r.module, BASE), i)),
        ),
      );
  });

  it("section 5: energy per step and to the target", () => {
    const t = tableAfter(MD, "## 5. Energy");
    for (const r of rowsFor()) {
      const c = at(r.variant, r.module, BASE);
      const e = energyPerStep(plan(c));
      const tot = e.compute + e.link + e.module;
      const steps = stepsTo(c);
      expect(row(t, r.name).slice(1), r.name).toEqual([
        fixed(e.compute, 3),
        fixed(e.link, 4),
        fixed(e.module, 3),
        pct1(e.module / tot),
        reached(steps === null ? null : (steps * tot) / 1e3),
      ]);
    }
  });

  it("section 6: hot-spot shares and the module's stages", () => {
    const t = tableAfter(MD, "## 6. Hot-spot attribution");
    for (const r of rowsFor()) {
      const h = hotSpots(plan(at(r.variant, r.module, BASE)));
      expect(row(t, r.name).slice(1), r.name).toEqual(
        CATEGORIES.map((c) => pct1(h[c])),
      );
    }
    const dense = plan(at("band-pluggable", "high", BASE)).dense;
    const st = stageTimes(moduleOf("high"), dense, bandKernel(8));
    const low = stageTimes(moduleOf("low"), dense, bandKernel(8));
    const line = Object.entries(st)
      .map(([k, x]) => `${k} ${fixed(1e3 * x, 3)}`)
      .join(", ");
    expect(section(MD, "## 6. Hot-spot attribution")).toContain(
      `time): ${line} at [high]; the compute stage is ${fixed(1e3 * low["module compute"], 3)} ms at [low]`,
    );
  });

  it("section 7a: every break-even over the WAN bandwidth", () => {
    const t = tableAfter(MD, "### 7a.");
    const pairs: [Variant, Variant][] = [
      ["band-switch", "adamw"],
      ["band-switch", "topk"],
      ["band-switch", "band-allreduce"],
      ["band-pluggable", "adamw"],
      ["band-pluggable", "topk"],
      ["band-pluggable", "band"],
      ["band-allreduce", "adamw"],
      ["band-allreduce", "topk"],
      ["band", "adamw"],
      ["topk", "adamw"],
    ];
    const got: string[][] = [];
    for (const [x, y] of pairs)
      for (const m of TRANSIT.includes(x)
        ? (["free", "high"] as const)
        : (["high"] as const))
        for (const exact of TRANSIT.includes(x) ? [false, true] : [false]) {
          const cx = at(x, m, BASE, exact);
          const cy = at(y, m, BASE);
          const be = bisect(
            gapOverBandwidth(cx, cy, 2),
            BW_RANGE[0],
            BW_RANGE[1],
          );
          const gbs =
            be.x === null
              ? "none in range"
              : `${pyG(be.x / 1e9, 3)} GB/s (${pyG((be.x * 8) / 1e9, 3)} Gb/s)`;
          const below = (be.fLo < 0 ? VARIANT_NAME[x] : VARIANT_NAME[y])
            .slice(0, 2)
            .trim();
          got.push([
            VARIANT_NAME[x],
            VARIANT_NAME[y],
            TRANSIT.includes(x) ? m : "–",
            exact ? "C (exact)" : TRANSIT.includes(x) ? "E" : "measured",
            gbs,
            plusFixed(be.fLo, 2),
            plusFixed(be.fHi, 2),
            below,
          ]);
        }
    expect(got).toEqual(t.rows);
  });

  it("section 7b: the compute budget at which the optics, not the budget, binds", () => {
    const dense = plan(at("band-pluggable", "high", BASE)).dense;
    const be = bisect(
      (g) => {
        const s = stageTimes(
          moduleOf("high", { gflops: g }),
          dense,
          bandKernel(8),
        );
        return (
          s["module compute"] -
          Math.max(s["module port"], s["module optics"], s.FPGA)
        );
      },
      1e9,
      1e14,
    );
    expect(section(MD, "### 7b.")).toContain(
      `at **${fixed(be.x! / 1e9, 1)} GFLOP/s**`,
    );
  });

  it("section 8: bit planes against convergence", () => {
    const t = tableAfter(MD, "## 8. Bit planes");
    const got: string[][] = [];
    for (const pl of [4, 8, 12])
      for (const m of ["free", "high"] as const) {
        const mod = moduleOf(m, { planes: pl });
        const p = preset(BASE);
        const e: Config = {
          variant: "band-pluggable",
          module: mod,
          topo: topology(p.dcs, p.bw),
        };
        const s: Config = { ...e, variant: "band-switch" };
        const pe = plan(e);
        got.push([
          String(pl),
          m,
          fixed(stepsTo(e)!, 0),
          fixed(
            stageTimes(mod, pe.dense, bandKernel(pl))["module optics"] * 1e3,
            3,
          ),
          fixed(stepTime(pe) * 1e3, 3),
          reached(timeTo(e)),
          fixed(stepTime(plan(s)) * 1e3, 3),
          reached(timeTo(s)),
        ]);
      }
    expect(got).toEqual(t.rows);
  });
});
