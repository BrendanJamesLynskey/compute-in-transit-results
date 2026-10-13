/**
 * The chain animation's model (src/lib/chain/model.ts) against the
 * experiment's own functions (DeMo_Fixed_Band_Experiment at b1f62d3:
 * compressors.py and train.py's demo_step, variant E), on the fixture
 * scripts/chain_reference.py wrote: every stage to rounding, the integers
 * exactly, the readout noise statistically. Then the animation's state
 * sequence (the stages, their byte counts read from the vendored results)
 * and the SVG it draws.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { chainBytes } from "@/lib/chain/bytes";
import {
  BLOCKS,
  bitPlanes,
  chainRun,
  chainStages,
  dctMatrix,
  decode,
  encode,
  fsOut,
  noiseRms,
  quantise,
  recombine,
  roundHalfEven,
  type ChainInputs,
  type ChainParams,
} from "@/lib/chain/model";
import { bytesSvg, diagramSvg, legendSvg, viewSvg } from "@/lib/chain/render";
import { G, row } from "@/lib/quote";

type PlaneFix = {
  scale_in: number;
  clipped: number;
  q0: number[];
  tx: number[][];
  agg: number[];
  update: number[];
  sign: number[];
  residual_after: number[][];
};
const FIX = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/chain_parity.json"), "utf8"),
) as {
  commit: string;
  positions: number[];
  k: number;
  delta: number[][];
  coef: number[][];
  band: number[][];
  rms: number;
  fs_out: number;
  noise_rms: Record<string, number>;
  planes: Record<string, PlaneFix>;
  index_bytes_256: number;
  value_bytes: number;
};
const INP = JSON.parse(
  readFileSync(
    join(process.cwd(), "src/data/derived/chain_inputs.json"),
    "utf8",
  ),
) as ChainInputs;

/** Equal to rounding: BLAS sums in its own order. */
function close(a: number[], b: number[], what: string, tol = 1e-12): void {
  expect(a.length, what).toBe(b.length);
  const scale = Math.max(1e-300, ...b.map(Math.abs));
  const err = Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
  expect(err / scale, what).toBeLessThan(tol);
}

const exactRead: ChainParams = { planes: 8, enob: null, mode: "E", seed: 1 };

describe("the model against the experiment's functions (b1f62d3)", () => {
  it("pins the commit", () => {
    expect(FIX.commit.startsWith("b1f62d3")).toBe(true);
  });
  it("the DCT is orthonormal and matches the experiment's coefficients", () => {
    const D = dctMatrix(INP.m);
    const x = INP.grad[0]!;
    close(decode(encode(x, D), D), x, "D^T D x = x");
    const run = chainRun(INP, exactRead);
    run.delta.forEach((d, w) => close(d, FIX.delta[w]!, `delta ${w}`));
    run.coef.forEach((c, w) => close(c, FIX.coef[w]!, `coef ${w}`));
    run.band.forEach((b, w) => close(b, FIX.band[w]!, `band ${w}`));
    expect(run.pos).toEqual(FIX.positions);
    expect(run.pos.length).toBe(FIX.k);
  });
  it("the full scale, the readout full scale and the noise RMS", () => {
    const run = chainRun(INP, exactRead);
    expect(run.scale / INP.kappa).toBeCloseTo(FIX.rms, 15);
    expect(run.fs).toBeCloseTo(FIX.fs_out, 12);
    for (const [e, s] of Object.entries(FIX.noise_rms))
      expect(noiseRms(run.fs, Number(e))).toBeCloseTo(s, 14);
    expect(noiseRms(run.fs, null)).toBe(0);
  });
  for (const P of [4, 8, 12]) {
    it(`${P} bit planes, exact readout: every stage`, () => {
      const f = FIX.planes[String(P)]!;
      const run = chainRun(INP, { ...exactRead, planes: P });
      expect(run.scale).toBeCloseTo(f.scale_in, 15);
      expect(run.optics[0]!.q).toEqual(f.q0);
      expect(run.optics.reduce((s, o) => s + o.clipped, 0)).toBe(f.clipped);
      run.sent.forEach((t, w) => close(t, f.tx[w]!, `tx ${w}`));
      close(run.agg, f.agg, "scatter-mean");
      close(run.update, f.update, "inverse DCT");
      expect(run.sign).toEqual(f.sign);
      run.residualAfter.forEach((r, w) =>
        close(r, f.residual_after[w]!, `residual ${w}`),
      );
    });
  }
  it("E′ (switch sum, then ÷ workers) delivers what the all-gather's mean does", () => {
    const a = chainRun(INP, exactRead);
    const b = chainRun(INP, { ...exactRead, mode: "Eprime" });
    close(b.agg, a.agg, "same mean", 1e-14);
    expect(b.sign).toEqual(a.sign);
    close(
      b.sum,
      a.sent[0]!.map((_, j) => a.sent.reduce((s, v) => s + v[j]!, 0)),
      "sum",
    );
  });
});

describe("the parts", () => {
  it("rounds half to even, as torch.round", () => {
    expect([2.5, 3.5, -2.5, 0.5, 1.4, -1.6].map(roundHalfEven)).toEqual([
      2, 4, -2, 0, 1, -2,
    ]);
  });
  it("bit planes recombine to the integers (two's complement, MSB negative)", () => {
    const q = [-127, -1, 0, 1, 77, 127, -64];
    const bits = bitPlanes(q, 8);
    expect(bits.every((p) => p.every((b) => b === 0 || b === 1))).toBe(true);
    const back = recombine(bits, 8, 127);
    back.forEach((v, i) => expect(v).toBeCloseTo(q[i]!, 12));
  });
  it("quantises with saturation", () => {
    const { q, clipped } = quantise([0.1, -2, 3, 0.5], 1, 4);
    expect(q).toEqual([1, -7, 7, 4]);
    expect(clipped).toBe(2);
  });
  it("the readout full scale of a 0/1 plane is the largest row sum of |D|", () => {
    const D = dctMatrix(4);
    expect(fsOut(D)).toBeCloseTo(
      Math.max(...D.map((r) => r.reduce((s, v) => s + Math.abs(v), 0))),
      15,
    );
  });
  it("readout noise: the right size, reproducible from its seed", () => {
    const p: ChainParams = { planes: 8, enob: 8, mode: "E", seed: 7 };
    const a = chainRun(INP, p);
    const b = chainRun(INP, p);
    expect(a.sent).toEqual(b.sent);
    const e = a.optics.flatMap((o) =>
      o.read.flatMap((r, i) => r.map((v, j) => v - o.ideal[i]![j]!)),
    );
    const r = Math.sqrt(e.reduce((s, v) => s + v * v, 0) / e.length);
    expect(r / FIX.noise_rms["8.0"]!).toBeGreaterThan(0.9);
    expect(r / FIX.noise_rms["8.0"]!).toBeLessThan(1.1);
    const c = chainRun(INP, { ...p, seed: 8 });
    expect(c.sent).not.toEqual(a.sent);
  });
  it("exact input: the band itself, plus noise when the readout has an ENOB", () => {
    const x = chainRun(INP, { planes: null, enob: null, mode: "E", seed: 1 });
    x.sent.forEach((s, w) => close(s, FIX.band[w]!, `exact ${w}`));
    expect(x.optics[0]!.q).toBeNull();
    const n = chainRun(INP, { planes: null, enob: 6, mode: "E", seed: 1 });
    expect(n.sent[0]).not.toEqual(x.sent[0]);
  });
  it("fewer planes, larger error against the exact band", () => {
    const err = (P: number) => {
      const r = chainRun(INP, { ...exactRead, planes: P });
      return Math.max(
        ...r.sent.flatMap((s, w) =>
          s.map((v, j) => Math.abs(v - r.band[w]![j]!)),
        ),
      );
    };
    expect(err(4)).toBeGreaterThan(err(8));
    expect(err(8)).toBeGreaterThan(err(12));
  });
});

describe("the animation's state sequence", () => {
  const bytes = chainBytes();
  it("reads the byte counts from the vendored results", () => {
    expect(bytes.dense).toBe(row(G.A).payload_per_step);
    expect(bytes.bandPayload).toBe(row(G.C1d256).payload_per_step);
    expect(bytes.bandWire).toBe(row(G.E10).wire_per_step);
    expect(bytes.topkPayload).toBe(row(G.B).payload_per_step);
    expect(bytes.topkWire).toBe(row(G.B).wire_per_step);
    // the simulation sends the dense delta up to the switch: 2 bytes per parameter, A's payload
    expect(bytes.switchUp).toBe(bytes.dense);
    expect(bytes.workers).toBe(INP.workers);
    // values only (2 bytes) against values and positions (1 byte in a 256-chunk, 2 in a 4,096-chunk)
    expect(FIX.value_bytes).toBe(2);
    expect(FIX.index_bytes_256).toBe(1);
  });
  for (const mode of ["E", "Eprime"] as const)
    for (const [planes, enob] of [
      [8, 8],
      [4, 6],
      [12, 12],
      [null, null],
      [8, null],
    ] as const)
      it(`${mode}, planes ${planes}, ENOB ${enob}: one stage per block, in chain order`, () => {
        const run = chainRun(INP, { planes, enob, mode, seed: 3 });
        const st = chainStages(run, INP, bytes);
        expect(st.map((s) => s.block)).toEqual(BLOCKS.map((b) => b.id));
        expect(new Set(st.map((s) => s.caption)).size).toBe(st.length);
        st.forEach((s) => {
          expect(s.tags.length).toBeGreaterThan(0);
          for (const w of [1000, 360]) {
            const svg = viewSvg(s.view, w);
            expect(svg).toMatch(/^<svg/);
            expect(svg).not.toMatch(/NaN|Infinity|undefined/);
          }
          if (s.bytes) {
            const svg = bytesSvg(s.bytes, bytes, 700);
            expect(svg).not.toMatch(/NaN|undefined/);
            expect(bytesSvg(s.bytes, bytes, 340)).toMatch(/MB/);
          }
        });
        const net = st.find((s) => s.block === "net")!;
        if (mode === "Eprime") {
          expect(net.tags).toEqual(["simulation"]);
          expect(net.bytes![0]!.value).toBe(bytes.switchUp);
          expect(net.view.kind === "workers" && net.view.sum).toBeTruthy();
        } else {
          expect(net.bytes![0]!.value).toBe(bytes.bandWire);
          expect(net.bytes![0]!.topk).toBe(bytes.topkWire);
        }
        const fibre = st.find((s) => s.block === "fibre")!;
        expect(fibre.bytes![0]!.value).toBe(bytes.bandPayload);
        expect(fibre.bytes![0]!.topk).toBe(bytes.topkPayload);
      });
  it("the frames: worker 0's numbers at three key stages", () => {
    const run = chainRun(INP, exactRead);
    const st = chainStages(run, INP, bytes);
    const v = (i: number) => st[i]!.view;
    const f8 = FIX.planes["8"]!;
    const a = v(9);
    expect(a.kind === "values" && a.series[1]!.values).toEqual(run.sent[0]);
    close(run.sent[0]!, f8.tx[0]!, "frame 10: the values sent");
    const b = v(12);
    expect(b.kind === "strip" && b.series[0]!.values).toEqual(run.agg);
    close(run.agg, f8.agg, "frame 13: the mean at the band positions");
    const c = v(14);
    expect(c.kind === "strip" && c.series[0]!.values).toEqual(f8.sign);
  });
});

describe("the drawings", () => {
  it("the diagram has every block, marks the active one, and changes with E′", () => {
    for (const w of [900, 360]) {
      const e = diagramSvg(w, "E", "oft", ["grad", "delta"]);
      expect(e.match(/data-block=/g)!.length).toBe(BLOCKS.length);
      expect(e).toContain('data-block="oft" data-active="true"');
      expect(e).toContain("all-gather");
      const p = diagramSvg(w, "Eprime", "feedback", []);
      expect(p).toContain("switch sum");
      expect(p).toContain("(E′)");
      expect(p).not.toMatch(/NaN|undefined/);
    }
  });
  it("every label is at least 11 px (the site's phone standard), at every stage", () => {
    const sizes = (svg: string) =>
      [...svg.matchAll(/font-size="([0-9.]+)"/g)].map((m) => Number(m[1]));
    const bytes = chainBytes();
    for (const mode of ["E", "Eprime"] as const) {
      const run = chainRun(INP, { planes: 12, enob: 6, mode, seed: 1 });
      for (const s of chainStages(run, INP, bytes))
        for (const w of [1000, 360]) {
          const all = [
            ...sizes(viewSvg(s.view, w)),
            ...sizes(diagramSvg(w, mode, s.block, [])),
            ...sizes(legendSvg(w)),
            ...(s.bytes ? sizes(bytesSvg(s.bytes, bytes, w)) : []),
          ];
          expect(Math.min(...all)).toBeGreaterThanOrEqual(11);
        }
    }
  });
  it("the legend names every source", () => {
    for (const w of [800, 340]) {
      const l = legendSvg(w);
      for (const s of ["paper", "experiment", "simulation", "assumption"])
        expect(l).toContain(s);
    }
  });
});
