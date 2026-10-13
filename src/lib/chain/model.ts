/**
 * The whole proposed chain, TX input data to RX output data, for one chunk
 * of 256 values on each of 8 workers: a TypeScript port of what the
 * experiment's code does to it (DeMo_Fixed_Band_Experiment at b1f62d3,
 * experiment/compressors.py and train.py's demo_step, variant E: 1-D chunks
 * of 256, the low band, k = 16, feedback of the values sent), stage by
 * stage, so an animation can show every intermediate value.
 *
 * Checked against the experiment's own functions by tests/unit/chain.test.ts
 * (fixture: scripts/chain_reference.py). No imports, so the same file is
 * also compiled for the decks (scripts/build-chain-js.mjs).
 */

export type ChainInputs = {
  workers: number;
  m: number;
  k: number;
  decay: number;
  lr: number;
  kappa: number;
  /** One chunk of the gradient per worker (illustrative). */
  grad: number[][];
  /** The residual error feedback holds per worker (illustrative). */
  residual: number[][];
};

/** E: the band computed by each worker's pluggable module, then all-gathered. E′: computed and summed at the switch. */
export type ChainMode = "E" | "Eprime";

export type ChainParams = {
  /** Input bits P (bit planes); null = exact input. */
  planes: number | null;
  /** ENOB of each plane's readout; null = exact readout. */
  enob: number | null;
  mode: ChainMode;
  /** Seed of the readout noise. */
  seed: number;
};

// ── the transform ─────────────────────────────────────────────────────
/** Orthonormal DCT-II matrix D (n x n): coefficients = D x (compressors.dct_matrix). */
export function dctMatrix(n: number): number[][] {
  const d: number[][] = [];
  for (let k = 0; k < n; k++) {
    const row: number[] = [];
    for (let i = 0; i < n; i++)
      row.push(
        Math.cos((Math.PI * (2 * i + 1) * k) / (2 * n)) * Math.sqrt(2 / n),
      );
    if (k === 0) for (let i = 0; i < n; i++) row[i] = row[i]! / Math.SQRT2;
    d.push(row);
  }
  return d;
}

/** c = D x (Chunker.encode for one 1-D chunk). */
export function encode(x: number[], D: number[][]): number[] {
  return D.map((row) => row.reduce((s, v, i) => s + v * x[i]!, 0));
}

/** x = Dᵀ c (Chunker.decode). */
export function decode(c: number[], D: number[][]): number[] {
  const n = c.length;
  const x = new Array<number>(n).fill(0);
  for (let k = 0; k < n; k++) {
    const ck = c[k]!;
    if (ck === 0) continue;
    const row = D[k]!;
    for (let i = 0; i < n; i++) x[i] = x[i]! + ck * row[i]!;
  }
  return x;
}

/** The low band of a 1-D chunk: positions 0 .. k-1 (band_order "low"). */
export function bandPositions(k: number): number[] {
  return Array.from({ length: k }, (_, i) => i);
}

// ── the optics, as the experiment emulates it ─────────────────────────
/** Round half to even, as torch.round does. */
export function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** RMS over every value of every row (the full scale's mean square: a MAC). */
export function rms(rows: number[][]): number {
  let s = 0;
  let n = 0;
  for (const r of rows)
    for (const v of r) {
      s += v * v;
      n += 1;
    }
  return Math.sqrt(s / n);
}

/** P-bit two's-complement integers against the full scale, saturating. */
export function quantise(
  x: number[],
  scale: number,
  planes: number,
): { q: number[]; clipped: number } {
  const qmax = 2 ** (planes - 1) - 1;
  let clipped = 0;
  const q = x.map((v) => {
    const r = roundHalfEven((v / scale) * qmax);
    if (Math.abs(r) > qmax) clipped += 1;
    return Math.max(-qmax, Math.min(qmax, r)) + 0; // + 0: no negative zero
  });
  return { q, clipped };
}

/** Bit planes: plane b holds bit b of every value's two's-complement pattern (0 or 1). */
export function bitPlanes(q: number[], planes: number): number[][] {
  const mask = 2 ** planes - 1;
  return Array.from({ length: planes }, (_, b) =>
    q.map((v) => {
      const u = ((v % (mask + 1)) + (mask + 1)) % (mask + 1);
      return Math.floor(u / 2 ** b) % 2;
    }),
  );
}

/** The band outputs of one input vector: rows `pos` of D times x. */
export function bandOf(x: number[], D: number[][], pos: number[]): number[] {
  return pos.map((r) => D[r]!.reduce((s, v, j) => s + v * x[j]!, 0));
}

/** A plane's readout full scale: with a 0/1 input, output i reaches at most Σⱼ|Dᵢⱼ|. */
export function fsOut(D: number[][]): number {
  return Math.max(...D.map((row) => row.reduce((s, v) => s + Math.abs(v), 0)));
}

/** Readout noise RMS at an ENOB: FS · 2^-ENOB · 2/√12 (OpticsEmulator.plane_noise_rms). */
export function noiseRms(fs: number, enob: number | null): number {
  return enob === null ? 0 : (fs * 2 ** -enob * 2) / Math.sqrt(12);
}

/** Recombine plane outputs: Σ 2^b · out_b, the MSB weighted −2^(P−1), times scale / qmax. */
export function recombine(
  outs: number[][],
  planes: number,
  scale: number,
): number[] {
  const qmax = 2 ** (planes - 1) - 1;
  const k = outs[0]!.length;
  const y = new Array<number>(k).fill(0);
  outs.forEach((o, b) => {
    const w = b === planes - 1 ? -(2 ** b) : 2 ** b;
    for (let i = 0; i < k; i++) y[i] = y[i]! + w * o[i]!;
  });
  return y.map((v) => (v * scale) / qmax);
}

/** Seeded uniform PRNG (mulberry32) and a Gaussian (Box–Muller), for the readout noise. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gauss(r: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}

export type OpticsOut = {
  /** Quantised inputs (P-bit integers), or null with exact input. */
  q: number[] | null;
  clipped: number;
  /** P x m binary planes. */
  bits: number[][];
  /** P x k exact plane outputs in the band, and as read (with noise). */
  ideal: number[][];
  read: number[][];
  /** The k band values the module sends. */
  values: number[];
};

/** One worker's chunk through the emulated optics (OpticsEmulator.__call__). */
export function optics(
  x: number[],
  D: number[][],
  pos: number[],
  planes: number | null,
  sigma: number,
  scale: number,
  rnd: () => number,
): OpticsOut {
  if (planes === null) {
    const y = bandOf(x, D, pos);
    const read = sigma ? y.map((v) => v + gauss(rnd) * sigma) : y.slice();
    return {
      q: null,
      clipped: 0,
      bits: [],
      ideal: [y],
      read: [read],
      values: read,
    };
  }
  const { q, clipped } = quantise(x, scale, planes);
  const bits = bitPlanes(q, planes);
  const ideal = bits.map((p) => bandOf(p, D, pos));
  const read = ideal.map((o) =>
    sigma ? o.map((v) => v + gauss(rnd) * sigma) : o.slice(),
  );
  return {
    q,
    clipped,
    bits,
    ideal,
    read,
    values: recombine(read, planes, scale),
  };
}

// ── the network and the receiver ──────────────────────────────────────
/** Every worker's band values placed at the fixed positions, the mean at each, zeros elsewhere (scatter_mean). */
export function scatterMean(
  vals: number[][],
  pos: number[],
  m: number,
): number[] {
  const out = new Array<number>(m).fill(0);
  pos.forEach((p, j) => {
    let s = 0;
    for (const v of vals) s += v[j]!;
    out[p] = s / vals.length;
  });
  return out;
}

/** The switch's sum of the band values (E′), before the receiver divides by the workers. */
export function switchSum(vals: number[][]): number[] {
  return vals[0]!.map((_, j) => vals.reduce((s, v) => s + v[j]!, 0));
}

export const sign = (x: number[]): number[] => x.map((v) => Math.sign(v));

export type ChainRun = {
  params: ChainParams;
  D: number[][];
  pos: number[];
  delta: number[][];
  coef: number[][];
  /** The exact band of each worker's delta. */
  band: number[][];
  scale: number;
  fs: number;
  sigma: number;
  optics: OpticsOut[];
  /** What each worker sends (the optics' band values). */
  sent: number[][];
  /** E′: the switch's sum of the band values. */
  sum: number[];
  /** What every receiver places at the band positions: the mean over the workers, zeros elsewhere. */
  agg: number[];
  update: number[];
  sign: number[];
  /** Each worker's residual after error feedback of the values it sent. */
  residualAfter: number[][];
};

/** The chain for every worker's chunk, as demo_step does it for variant E. */
export function chainRun(inp: ChainInputs, params: ChainParams): ChainRun {
  const { m, k, decay, lr, kappa } = inp;
  const D = dctMatrix(m);
  const pos = bandPositions(k);
  const delta = inp.residual.map((r, w) =>
    r.map((v, i) => v * decay + lr * inp.grad[w]![i]!),
  );
  const coef = delta.map((d) => encode(d, D));
  const band = coef.map((c) => pos.map((p) => c[p]!));
  const r0 = rms(delta);
  const scale = r0 > 0 ? kappa * r0 : 1;
  const fs = fsOut(D);
  const sigma = noiseRms(fs, params.enob);
  const rnd = mulberry32(params.seed);
  const opt = delta.map((d) =>
    optics(d, D, pos, params.planes, sigma, scale, rnd),
  );
  const sent = opt.map((o) => o.values);
  const sum = switchSum(sent);
  const agg =
    params.mode === "Eprime"
      ? (() => {
          const out = new Array<number>(m).fill(0);
          pos.forEach((p, j) => (out[p] = sum[j]! / sent.length));
          return out;
        })()
      : scatterMean(sent, pos, m);
  const update = decode(agg, D);
  const residualAfter = delta.map((d, w) => {
    const c = new Array<number>(m).fill(0);
    pos.forEach((p, j) => (c[p] = sent[w]![j]!));
    const back = decode(c, D);
    return d.map((v, i) => v - back[i]!);
  });
  return {
    params,
    D,
    pos,
    delta,
    coef,
    band,
    scale,
    fs,
    sigma,
    optics: opt,
    sent,
    sum,
    agg,
    update,
    sign: sign(update),
    residualAfter,
  };
}

// ── the stages of the animation ───────────────────────────────────────
/** Where each claim comes from: the paper (the module's parts), the experiment's model, the simulation, or an assumption. */
export type Source = "paper" | "experiment" | "simulation" | "assumption";

/** Bytes per worker per step, read from the experiment's results.json and the simulation's results.md (never typed). */
export type ChainBytes = {
  /** The dense delta, 2 bytes per parameter (A's payload). */
  dense: number;
  bandPayload: number;
  bandWire: number;
  topkPayload: number;
  topkWire: number;
  /** E′: what each worker sends up to the switch (the simulation's model wire). */
  switchUp: number;
  workers: number;
};

export type Block =
  | "grad"
  | "delta"
  | "chunk"
  | "port"
  | "quant"
  | "mzm"
  | "oft"
  | "pd"
  | "adc"
  | "fpga"
  | "fibre"
  | "net"
  | "place"
  | "idct"
  | "sign"
  | "feedback";

/** The diagram's blocks in chain order, with their group and source tags. */
export const BLOCKS: {
  id: Block;
  group: "tx" | "module" | "net" | "rx";
  label: string;
  sub: string;
  tags: Source[];
}[] = [
  {
    id: "grad",
    group: "tx",
    label: "gradient g",
    sub: "TX GPU",
    tags: ["experiment"],
  },
  {
    id: "delta",
    group: "tx",
    label: "δ ← decay·δ + lr·g",
    sub: "momentum / delta",
    tags: ["experiment"],
  },
  {
    id: "chunk",
    group: "tx",
    label: "1-D chunks of 256",
    sub: "this is one",
    tags: ["experiment"],
  },
  {
    id: "port",
    group: "module",
    label: "host FPGA card → QSFP56",
    sub: "dense values in",
    tags: ["paper"],
  },
  {
    id: "quant",
    group: "module",
    label: "P-bit integers",
    sub: "full scale κ·RMS",
    tags: ["experiment"],
  },
  {
    id: "mzm",
    group: "module",
    label: "4 × modulator",
    sub: "binary NRZ: bit planes",
    tags: ["paper", "experiment"],
  },
  {
    id: "oft",
    group: "module",
    label: "optical Fourier transform",
    sub: "passive, diffractive",
    tags: ["paper", "assumption"],
  },
  {
    id: "pd",
    group: "module",
    label: "read k = 16 of 256",
    sub: "balanced photodiodes",
    tags: ["paper", "assumption"],
  },
  {
    id: "adc",
    group: "module",
    label: "TIAs / ADCs",
    sub: "readout at an ENOB",
    tags: ["paper", "experiment"],
  },
  {
    id: "fpga",
    group: "module",
    label: "FPGA: Σ 2^b · plane",
    sub: "16 values",
    tags: ["experiment"],
  },
  {
    id: "fibre",
    group: "net",
    label: "values only, no indices",
    sub: "serialised NRZ",
    tags: ["experiment"],
  },
  {
    id: "net",
    group: "net",
    label: "all-gather",
    sub: "or E′: switch sums",
    tags: ["experiment", "simulation"],
  },
  {
    id: "place",
    group: "rx",
    label: "band positions, mean",
    sub: "RX transceiver → GPU",
    tags: ["experiment"],
  },
  {
    id: "idct",
    group: "rx",
    label: "inverse DCT",
    sub: "256 values",
    tags: ["experiment"],
  },
  {
    id: "sign",
    group: "rx",
    label: "sign → weights",
    sub: "w ← w − lr·sign",
    tags: ["experiment"],
  },
  {
    id: "feedback",
    group: "tx",
    label: "error feedback",
    sub: "δ ← δ − what was sent",
    tags: ["experiment"],
  },
];

/** What the data panel shows at a stage. */
export type View =
  | {
      kind: "strip";
      series: { name: string; values: number[]; tone: "a" | "b" | "muted" }[];
      band?: number;
    }
  | { kind: "bits"; bits: number[][]; band?: number }
  | { kind: "outputs"; rows: number[][]; band: number }
  | { kind: "planes"; ideal: number[][]; read: number[][] | null }
  | {
      kind: "values";
      series: { name: string; values: number[]; tone: "a" | "b" | "muted" }[];
    }
  | { kind: "workers"; rows: number[][]; sum?: number[] };

export type Stage = {
  block: Block;
  tags: Source[];
  caption: string;
  view: View;
  /** Bytes per worker per step on this hop, band (or E′) against top-k, when the hop carries the chunk. */
  bytes:
    | { label: string; value: number; topk?: number; topkLabel?: string }[]
    | null;
};

const f3 = (v: number) =>
  Math.abs(v) < 1e-3 && v !== 0 ? v.toExponential(2) : v.toFixed(4);

/** The animation's state sequence: one stage per step, computed from the run (worker 0's chunk where one is shown). */
export function chainStages(
  run: ChainRun,
  inp: ChainInputs,
  bytes: ChainBytes,
): Stage[] {
  const p = run.params;
  const E2 = p.mode === "Eprime";
  const o0 = run.optics[0]!;
  const P = p.planes;
  const W = inp.workers;
  const k = run.pos.length;
  const err = Math.max(
    ...run.sent[0]!.map((v, j) => Math.abs(v - run.band[0]![j]!)),
  );
  // every output of each plane (worker 0), to show the band among them
  const full =
    P === null ? [run.coef[0]!] : o0.bits.map((b) => encode(b, run.D));
  const stages: Stage[] = [
    {
      block: "grad",
      tags: ["experiment"],
      caption: `TX GPU: worker 0's gradient for one chunk of ${inp.m} values (illustrative inputs; the run has ${W} workers).`,
      view: {
        kind: "strip",
        series: [{ name: "g", values: inp.grad[0]!, tone: "a" }],
      },
      bytes: null,
    },
    {
      block: "delta",
      tags: ["experiment"],
      caption: `The delta: δ ← ${inp.decay}·δ + ${inp.lr}·g. The residual error feedback keeps (out of band, as late in training) dominates it.`,
      view: {
        kind: "strip",
        series: [
          { name: "residual", values: inp.residual[0]!, tone: "muted" },
          { name: "δ", values: run.delta[0]!, tone: "a" },
        ],
      },
      bytes: null,
    },
    {
      block: "chunk",
      tags: ["experiment"],
      caption: `Cut into 1-D chunks of ${inp.m}: the module's transforms are 1 × N and power-of-2 (the experiment's E runs use 1-D 256). Its DCT would put this much in the band of ${k}: shown shaded.`,
      view: {
        kind: "strip",
        series: [{ name: "DCT of δ", values: run.coef[0]!, tone: "a" }],
        band: k,
      },
      bytes: null,
    },
    {
      block: "port",
      tags: E2 ? ["paper", "simulation"] : ["paper"],
      caption: E2
        ? `E′: the dense delta goes up to the switch, where a module on each worker-facing port computes the band (the simulation's switch variant): every value crosses the worker's link.`
        : `The host FPGA card sends the dense delta through the QSFP56 port into the pluggable: every value enters the module, not just the band.`,
      view: {
        kind: "strip",
        series: [{ name: "δ", values: run.delta[0]!, tone: "a" }],
      },
      bytes: [
        {
          label: E2
            ? "dense delta up to the switch"
            : "dense delta into the module",
          value: E2 ? bytes.switchUp : bytes.dense,
        },
      ],
    },
    {
      block: "quant",
      tags: ["experiment"],
      caption:
        P === null
          ? "Exact input (no bit planes): the control run's setting."
          : `Each value becomes a ${P}-bit two's-complement integer against the full scale κ·RMS = ${f3(run.scale)} (a mean square: MAC only). ${o0.clipped} of ${inp.m} clip in this chunk.`,
      view: o0.q
        ? { kind: "strip", series: [{ name: "q", values: o0.q, tone: "a" }] }
        : {
            kind: "strip",
            series: [{ name: "δ", values: run.delta[0]!, tone: "a" }],
          },
      bytes: null,
    },
    {
      block: "mzm",
      tags: ["paper", "experiment"],
      caption:
        P === null
          ? "The modulators write the values onto light (exact input: not what the module does; it takes binary NRZ only)."
          : `The modulators take binary (NRZ) levels only, so the integers go in as ${P} bit planes, one pass each: plane b is bit b of every value (the top plane carries the sign).`,
      view:
        P === null
          ? {
              kind: "strip",
              series: [{ name: "δ", values: run.delta[0]!, tone: "a" }],
            }
          : { kind: "bits", bits: o0.bits },
      bytes: null,
    },
    {
      block: "oft",
      tags: ["paper", "assumption"],
      caption: `The passive diffractive device transforms each plane by propagation, with no operation count. The experiment emulates it as the same orthonormal DCT (an assumption: the paper's device computes an optical Fourier transform).`,
      view: { kind: "outputs", rows: full, band: k },
      bytes: null,
    },
    {
      block: "pd",
      tags: ["paper", "assumption"],
      caption: `Only the band's ${k} of ${inp.m} outputs are read (an assumption: a fixed band is a fixed set of output ports), by balanced photodiodes, so the outputs' signs survive (coherent detection).`,
      view: { kind: "planes", ideal: o0.ideal, read: null },
      bytes: null,
    },
    {
      block: "adc",
      tags: ["paper", "experiment"],
      caption:
        p.enob === null
          ? "TIAs and ADCs read each plane's band exactly (no readout noise)."
          : `TIAs and ADCs read each plane at ENOB ${p.enob}: noise RMS = FS·2^-ENOB·2/√12 = ${f3(run.sigma)} with FS = ${run.fs.toFixed(2)}, the largest a 0/1 plane can make.`,
      view: { kind: "planes", ideal: o0.ideal, read: o0.read },
      bytes: null,
    },
    {
      block: "fpga",
      tags: ["experiment"],
      caption:
        P === null
          ? `The band values, as read. Largest error against the exact band: ${f3(err)}.`
          : `The FPGA recombines the planes, Σ 2^b · plane b (the top plane negative), times the full scale: ${k} band values. Largest error against the exact band: ${f3(err)}.`,
      view: {
        kind: "values",
        series: [
          { name: "exact band", values: run.band[0]!, tone: "muted" },
          { name: "sent", values: run.sent[0]!, tone: "a" },
        ],
      },
      bytes: null,
    },
    {
      block: "fibre",
      tags: ["experiment"],
      caption: `Values only: the positions are fixed, so no indices are sent. Top-k must send each value's position too.`,
      view: {
        kind: "values",
        series: [{ name: "sent", values: run.sent[0]!, tone: "a" }],
      },
      bytes: [
        {
          label: "band payload",
          value: bytes.bandPayload,
          topk: bytes.topkPayload,
          topkLabel: "top-k payload (values + indices)",
        },
      ],
    },
    {
      block: "net",
      tags: E2 ? ["simulation"] : ["experiment"],
      caption: E2
        ? `E′ (hypothetical, simulated): the switch sums the ${W} workers' bands, returns each worker its own band (the loopback feedback needs), and the DCs all-reduce the sum.`
        : `All-gather: every worker receives all ${W} workers' band values, its own included (which is what lets it feed back what it sent). Wire bytes grow with the workers.`,
      view: { kind: "workers", rows: run.sent, sum: E2 ? run.sum : undefined },
      bytes: E2
        ? [{ label: "dense up to the switch", value: bytes.switchUp }]
        : [
            {
              label: "band wire (all-gather)",
              value: bytes.bandWire,
              topk: bytes.topkWire,
              topkLabel: "top-k wire (all-gather)",
            },
          ],
    },
    {
      block: "place",
      tags: ["experiment"],
      caption: E2
        ? `RX: the sum divided by ${W}, placed at the band positions 0–${k - 1}; zeros everywhere else.`
        : `RX: each position's mean over the ${W} workers (scatter-mean), placed at the band positions 0–${k - 1}; zeros everywhere else.`,
      view: {
        kind: "strip",
        series: [{ name: "mean", values: run.agg, tone: "a" }],
        band: k,
      },
      bytes: null,
    },
    {
      block: "idct",
      tags: ["experiment"],
      caption: `The inverse DCT turns the ${k} coefficients back into ${inp.m} values: a smooth update, because only low frequencies were kept.`,
      view: {
        kind: "strip",
        series: [{ name: "update", values: run.update, tone: "a" }],
      },
      bytes: null,
    },
    {
      block: "sign",
      tags: ["experiment"],
      caption: `DeMo applies the sign: every weight in the chunk moves by ±lr (${run.sign.filter((s) => s > 0).length} up, ${run.sign.filter((s) => s < 0).length} down).`,
      view: {
        kind: "strip",
        series: [{ name: "sign", values: run.sign, tone: "b" }],
      },
      bytes: null,
    },
    {
      block: "feedback",
      tags: ["experiment"],
      caption: `Error feedback: worker 0 subtracts the inverse DCT of the values it actually sent, returned to it by the ${E2 ? "switch's loopback" : "all-gather"}, so the optics' errors stay in the residual and go out on later steps.`,
      view: {
        kind: "strip",
        series: [
          { name: "δ before", values: run.delta[0]!, tone: "muted" },
          { name: "δ after", values: run.residualAfter[0]!, tone: "a" },
        ],
      },
      bytes: null,
    },
  ];
  return stages;
}
