/**
 * Training_Transit_Sim's closed forms, ported to TypeScript for the transit
 * page's interactives (`analytic.py`, `model.py`, `hardware.py` and the
 * energy and hot-spot accounting of `engine.py`, at commit c6de1f4).
 *
 * Every input comes from src/data/derived/transit_constants.json, written
 * from the simulation's own package by scripts/transit_reference.py; nothing
 * is typed here. The float operations are in the Python's order, so the step
 * times equal the closed forms bit for bit (tests/unit/transit.test.ts, on
 * the fixtures the same script writes), and the engine's to rounding.
 *
 * Variants: A `adamw`, B `topk`, C `band` (measured); E `band-pluggable`
 * (measured steps, one seed per ENOB); C′ `band-allreduce` and E′
 * `band-switch` (hypothetical: not run, they reuse C's and E's steps).
 */
import C from "@/data/derived/transit_constants.json";

export type Variant =
  | "adamw"
  | "topk"
  | "band"
  | "band-pluggable"
  | "band-allreduce"
  | "band-switch";
export const VARIANTS: readonly Variant[] = [
  "adamw",
  "topk",
  "band",
  "band-pluggable",
  "band-allreduce",
  "band-switch",
];
export const TRANSIT: readonly Variant[] = ["band-pluggable", "band-switch"];
export const HYPOTHETICAL: readonly Variant[] = [
  "band-allreduce",
  "band-switch",
];

/** The results.md names of the variants ("A  AdamW, dense ring all-reduce", …). */
export const VARIANT_NAME = C.variants as Record<Variant, string>;
/** The short letters the site uses. */
export const LETTER: Record<Variant, string> = {
  adamw: "A",
  topk: "B",
  band: "C",
  "band-pluggable": "E",
  "band-allreduce": "C′",
  "band-switch": "E′",
};

export type Link = { bandwidth: number; latency: number; pj_per_bit: number };
export type ModuleKey = "low" | "high" | "free";
export type Module = {
  port_rate: number;
  optics_bits_per_s: number;
  planes: number;
  enob: number;
  gflops: number;
  transform_charged: boolean;
  fpga_ops_per_s: number;
  latency: number;
  static_w: number;
  laser_w: number;
  pj_per_bit: number;
  caps_port: boolean;
};
export const MODULES = C.modules as Record<
  ModuleKey,
  Module & { placement: string }
>;
export const LINKS = C.links as Record<string, Link & { name: string }>;
export const SETUP = C.setup;
export const TARGETS = C.targets as [number, string][];
export const ENOBS = C.enobs;
export const PLANES = C.planes;
export const CATEGORIES = C.categories as Category[];
/** results.md section 10: the model sizes (null: the experiment's) and the sync intervals H. */
export const EXTRAPOLATE = C.extrapolate as {
  sizes: [string, number | null][];
  sync_every: number[];
};
export type Category =
  | "compute"
  | "intra-DC link"
  | "inter-DC link"
  | "module port"
  | "module optics"
  | "module compute"
  | "FPGA";

export type Topology = {
  workers: number;
  dcs: number;
  intra: Link;
  inter: Link;
};

/** W workers in D data centres, InfiniBand NDR inside each, `inter` between. */
export function topology(
  dcs: number,
  interBw: number,
  inter = "eth-100g",
): Topology {
  const base = LINKS[inter]!;
  return {
    workers: SETUP.workers,
    dcs,
    intra: LINKS["ib-ndr"]!,
    inter: { ...base, bandwidth: interBw },
  };
}

export type Config = {
  variant: Variant;
  topo: Topology;
  module: Module;
  /** In-transit variants: the exact band's (C's) steps instead of E's. */
  exactSteps?: boolean;
  /** Parameters (default: the experiment's). Any other size is an extrapolation (results.md section 10). */
  params?: number;
  /** Sync every H steps, DiLoCo-style (default 1). H > 1 is an extrapolation (results.md section 10). */
  syncEvery?: number;
};

/** A module setting of results.md, optionally with ENOB, planes or budget changed. */
export function moduleOf(key: ModuleKey, over: Partial<Module> = {}): Module {
  return { ...MODULES[key], ...over };
}

// ── kernels (hardware.py) ────────────────────────────────────────────────
type Kernel = {
  fft: number; // operations per input byte, optical
  add: number; // operations per input byte, digital
  fpgaPerValue: number;
  optical: boolean;
};
const BAND = C.band_kernel;
const LOG2N = Math.log2(BAND.n);
export function bandKernel(planes: number): Kernel {
  return {
    fft: (2.5 * LOG2N) / 2,
    add: 0,
    fpgaPerValue: 2.0 + planes * BAND.keep,
    optical: true,
  };
}
export function sumKernel(streams: number): Kernel {
  return {
    fft: 0,
    add: (streams - 1) / (2 * streams),
    fpgaPerValue: 0,
    optical: false,
  };
}

export type Stage = "module port" | "module optics" | "module compute" | "FPGA";
export const STAGES: readonly Stage[] = [
  "module port",
  "module optics",
  "module compute",
  "FPGA",
];

/** Seconds each pipelined stage needs for `b` bytes (Module.stage_times). */
export function stageTimes(
  m: Module,
  b: number,
  k: Kernel,
): Record<Stage, number> {
  const values = b / BAND.bytes_per_value;
  let charged = 0;
  if (k.optical && m.transform_charged) charged += k.fft;
  if (k.add) charged += k.add;
  const fpga = values * k.fpgaPerValue + b * 0.0;
  return {
    "module port": b / m.port_rate,
    "module optics": k.optical ? (values * m.planes) / m.optics_bits_per_s : 0,
    "module compute": (b * charged) / m.gflops,
    FPGA: fpga / m.fpga_ops_per_s,
  };
}

/** (seconds, binding stage) for one stream (Module.stream_time). */
export function streamTime(m: Module, b: number, k: Kernel): [number, Stage] {
  const st = stageTimes(m, b, k);
  let stage: Stage = "module port";
  for (const s of STAGES) if (st[s] > st[stage]) stage = s;
  return [m.latency + st[stage], stage];
}

/** analytic.module_stream. */
export function moduleStream(m: Module, b: number, k: Kernel): number {
  return streamTime(m, b, k)[0];
}

// ── the step plan (model.py) ─────────────────────────────────────────────
const PAY = C.payload_per_step as Record<string, number>;
const LAB = C.labels;
const LADDER = C.ladder as Record<string, (number | null)[]>;

function bytesPerParam(label: string): number {
  return PAY[label]! / SETUP.params;
}

export function opticsLabel(enob: number, planes: number): string {
  const l = (LAB.optics as Record<string, string>)[`${enob},${planes}`];
  if (!l)
    throw new Error(`no measured E run at ENOB ${enob}, ${planes} planes`);
  return l;
}

/** The experiment label whose steps a configuration uses (model.steps_label). */
export function stepsLabel(cfg: Config): string {
  switch (cfg.variant) {
    case "adamw":
      return LAB.adamw;
    case "topk":
      return LAB.topk;
    case "band":
    case "band-allreduce":
      return LAB.band;
    default:
      return cfg.exactSteps
        ? LAB.band
        : opticsLabel(cfg.module.enob, cfg.module.planes);
  }
}

/** Steps to the ladder loss `target` (index into TARGETS), or null. */
export function stepsTo(cfg: Config, target = 0): number | null {
  const row = LADDER[stepsLabel(cfg)];
  if (!row) throw new Error(`no ladder row for ${stepsLabel(cfg)}`);
  return row[target] ?? null;
}

export type Plan = {
  cfg: Config;
  params: number;
  computeS: number;
  flops: number;
  payload: number;
  dense: number;
  nModules: number;
};

const GPU_EXTRA = C.gpu_flops_per_value as Record<string, number>;

export function plan(cfg: Config): Plan {
  const P = cfg.params ?? SETUP.params;
  const tokens = SETUP.tokens_per_worker;
  const dense = bytesPerParam(LAB.adamw) * P;
  const flops = 6.0 * P * tokens;
  const rate = C.accelerator.peak_flops * C.mfu;
  const extra = (GPU_EXTRA[cfg.variant] ?? 0.0) * P;
  const v = cfg.variant;
  let payload: number;
  if (v === "adamw") payload = dense;
  else if (v === "topk") payload = bytesPerParam(LAB.topk) * P;
  else if (v === "band" || v === "band-allreduce" || v === "band-switch")
    payload = bytesPerParam(LAB.band) * P;
  else payload = bytesPerParam(stepsLabel(cfg)) * P;
  const nModules = TRANSIT.includes(v) ? cfg.topo.workers : 0;
  return {
    cfg,
    params: P,
    computeS: (flops + extra) / rate,
    flops: flops + extra,
    payload,
    dense,
    nModules,
  };
}

// ── the closed forms (analytic.py) ───────────────────────────────────────
export function ringAllreduce(
  n: number,
  D: number,
  B: number,
  intra: Link,
  inter: Link,
): number {
  return (
    2 * (n - 1) * (intra.latency + B / n / intra.bandwidth) +
    2 * (D - 1) * (inter.latency + B / D / inter.bandwidth)
  );
}

export function ringAllgather(
  n: number,
  D: number,
  P: number,
  intra: Link,
  inter: Link,
  cap?: number,
): number {
  const c = cap ?? Infinity;
  let t = (n - 1) * (intra.latency + P / Math.min(intra.bandwidth, c));
  t += (D - 1) * (inter.latency + Math.max((n * P) / inter.bandwidth, P / c));
  if (D > 1)
    t +=
      (n - 1) * (intra.latency + ((D - 1) * P) / Math.min(intra.bandwidth, c));
  return t;
}

/** One round of the sync, and the category the engine charges it to. */
export type Term = { seconds: number; category: Category };

/**
 * The sync as the engine runs it: its rounds' times (the closed forms'
 * terms) and the hot spot each is charged to (engine.group_time: the
 * slowest op of a round sets it).
 */
export function syncTerms(p: Plan): Term[] {
  const { cfg } = p;
  const t = cfg.topo;
  const m = cfg.module;
  const n = t.workers / t.dcs;
  const D = t.dcs;
  const Li = t.intra.latency;
  const bi = t.intra.bandwidth;
  const Lw = t.inter.latency;
  const bw = t.inter.bandwidth;
  const v = cfg.variant;
  const out: Term[] = [];
  const add = (seconds: number, category: Category, times = 1) => {
    if (times > 0) out.push({ seconds: times * seconds, category });
  };
  const gather = (P: number, cap?: number) => {
    const c = cap ?? Infinity;
    // a transfer is held to the pluggable's port when that is slower than the link
    add(
      Li + P / Math.min(bi, c),
      P / c > P / bi ? "module port" : "intra-DC link",
      n - 1,
    );
    add(
      Lw + Math.max((n * P) / bw, P / c),
      P / c > (n * P) / bw ? "module port" : "inter-DC link",
      D - 1,
    );
    if (D > 1)
      add(
        Li + ((D - 1) * P) / Math.min(bi, c),
        ((D - 1) * P) / c > ((D - 1) * P) / bi
          ? "module port"
          : "intra-DC link",
        n - 1,
      );
  };
  if (v === "adamw" || v === "band-allreduce") {
    add(Li + p.payload / n / bi, "intra-DC link", 2 * (n - 1));
    add(Lw + p.payload / D / bw, "inter-DC link", 2 * (D - 1));
  } else if (v === "topk" || v === "band") {
    gather(p.payload);
  } else if (v === "band-pluggable") {
    const [s, stage] = streamTime(m, p.dense, bandKernel(m.planes));
    add(s, stage);
    gather(p.payload, m.caps_port ? m.port_rate : undefined);
  } else {
    const B = p.payload;
    add(Li + p.dense / bi, "intra-DC link");
    const [s, stage] = streamTime(m, p.dense, bandKernel(m.planes));
    add(s, stage);
    const [ss, sstage] = streamTime(m, B, sumKernel(n));
    const back = Li + B / bi;
    // the engine charges a round to its last op to finish (ties: the larger name)
    if (ss > back || (ss === back && sstage > "intra-DC link")) add(ss, sstage);
    else add(back, "intra-DC link");
    add(Lw + B / D / bw, "inter-DC link", 2 * (D - 1));
    add(Li + B / bi, "intra-DC link");
  }
  return out;
}

/** analytic.sync_time: the closed form, in the Python's operation order. */
export function syncTime(p: Plan): number {
  const { cfg } = p;
  const t = cfg.topo;
  const m = cfg.module;
  const n = t.workers / t.dcs;
  const D = t.dcs;
  const Li = t.intra.latency;
  const bi = t.intra.bandwidth;
  const v = cfg.variant;
  if (v === "adamw" || v === "band-allreduce")
    return ringAllreduce(n, D, p.payload, t.intra, t.inter);
  if (v === "topk" || v === "band")
    return ringAllgather(n, D, p.payload, t.intra, t.inter);
  if (v === "band-pluggable") {
    const cap = m.caps_port ? m.port_rate : undefined;
    return (
      moduleStream(m, p.dense, bandKernel(m.planes)) +
      ringAllgather(n, D, p.payload, t.intra, t.inter, cap)
    );
  }
  const B = p.payload;
  return (
    Li +
    p.dense / bi +
    moduleStream(m, p.dense, bandKernel(m.planes)) +
    Math.max(moduleStream(m, B, sumKernel(n)), Li + B / bi) +
    2 * (D - 1) * (t.inter.latency + B / D / t.inter.bandwidth) +
    (Li + B / bi)
  );
}

/** analytic.step_time: compute plus one sync every `syncEvery` steps. */
export function stepTime(p: Plan): number {
  return p.computeS + syncTime(p) / (p.cfg.syncEvery ?? 1);
}

/** analytic.wire_per_worker: bytes a worker sends per sync. */
export function wirePerWorker(p: Plan): number {
  const t = p.cfg.topo;
  const v = p.cfg.variant;
  const N = t.workers;
  if (v === "adamw" || v === "band-allreduce") {
    const n = t.workers / t.dcs;
    const D = t.dcs;
    return (
      ((2 * (n - 1)) / n) * p.payload + (((2 * (D - 1)) / D) * p.payload) / n
    );
  }
  if (v === "topk" || v === "band" || v === "band-pluggable")
    return (N - 1) * p.payload;
  return p.dense;
}

/** Share of the step each category holds (engine.Result.hot_spots). */
export function hotSpots(p: Plan): Record<Category, number> {
  // the engine runs H computes per sync: the sync's rounds count once in H steps
  const H = p.cfg.syncEvery ?? 1;
  const terms = [
    { seconds: p.computeS, category: "compute" as Category },
    ...syncTerms(p).map((x) => ({ ...x, seconds: x.seconds / H })),
  ];
  const total = stepTime(p);
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<
    Category,
    number
  >;
  for (const x of terms) out[x.category] += x.seconds / total;
  return out;
}

/** The category with the largest share (ties: the first in CATEGORIES). */
export function hotSpot(p: Plan): Category {
  const h = hotSpots(p);
  let best: Category = CATEGORIES[0]!;
  for (const c of CATEGORIES) if (h[c] > h[best]) best = c;
  return best;
}

/** Bytes per step on the intra-DC links, the WAN and through the modules. */
export function trafficPerStep(p: Plan): {
  intra: number;
  wan: number;
  module: number;
} {
  const t = p.cfg.topo;
  const W = t.workers;
  const n = t.workers / t.dcs;
  const D = t.dcs;
  const v = p.cfg.variant;
  const P = p.payload;
  if (v === "adamw" || v === "band-allreduce") {
    const piece = P / (n * D);
    return {
      intra: W * 2 * (n - 1) * piece * D,
      wan: W * 2 * (D - 1) * piece,
      module: 0,
    };
  }
  if (v === "topk" || v === "band" || v === "band-pluggable") {
    const intra = W * (n - 1) * P + (D > 1 ? W * (n - 1) * P * (D - 1) : 0);
    return {
      intra,
      wan: W * (D - 1) * P,
      module: v === "band-pluggable" ? W * p.dense : 0,
    };
  }
  return {
    intra: W * p.dense + 2 * W * P,
    wan: 2 * (D - 1) * P,
    module: W * p.dense + W * P,
  };
}

/**
 * Joules per step, all workers (engine.Result.energy): compute = each
 * device's static power for the whole step plus its energy per FLOP; link =
 * pJ/bit over every byte; module = static and laser power of every module
 * for the whole step plus pJ/bit over the bytes it processes.
 */
export function energyPerStep(p: Plan): {
  compute: number;
  link: number;
  module: number;
} {
  const t = p.cfg.topo;
  const m = p.cfg.module;
  const T = stepTime(p);
  const acc = C.accelerator;
  const tr = trafficPerStep(p);
  return {
    compute: t.workers * (acc.idle_w * T + acc.pj_per_flop * 1e-12 * p.flops),
    link:
      tr.intra * 8 * t.intra.pj_per_bit * 1e-12 +
      tr.wan * 8 * t.inter.pj_per_bit * 1e-12,
    module:
      p.nModules * (m.static_w + m.laser_w) * T +
      tr.module * 8 * m.pj_per_bit * 1e-12,
  };
}

/** Seconds to a ladder loss (Infinity when the measured runs never got there). */
export function timeTo(cfg: Config, target = 0): number {
  const s = stepsTo(cfg, target);
  return s === null ? Infinity : s * stepTime(plan(cfg));
}

// ── bisection (study.py) ─────────────────────────────────────────────────
export type BreakEven = {
  x: number | null;
  fLo: number;
  fHi: number;
  iterations: number;
};

/** study.bisect: the x in [lo, hi] where f changes sign, in log space. */
export function bisect(
  f: (x: number) => number,
  lo: number,
  hi: number,
  relTol = 1e-4,
  maxIter = 200,
): BreakEven {
  let a = lo;
  let b = hi;
  let fa = f(a);
  const fb0 = f(b);
  if (Number.isNaN(fa) || Number.isNaN(fb0))
    return { x: null, fLo: fa, fHi: fb0, iterations: 0 };
  if (fa === 0) return { x: a, fLo: fa, fHi: fb0, iterations: 0 };
  if (fb0 === 0) return { x: b, fLo: fa, fHi: fb0, iterations: 0 };
  if (fa > 0 === fb0 > 0) return { x: null, fLo: fa, fHi: fb0, iterations: 0 };
  let it = 0;
  while (it < maxIter && b - a > relTol * Math.max(Math.abs(a), Math.abs(b))) {
    const m = a > 0 ? Math.sqrt(a * b) : (a + b) / 2;
    const fm = f(m);
    it += 1;
    if (fm === 0) {
      a = b = m;
      break;
    }
    if (fm > 0 === fa > 0) {
      a = m;
      fa = fm;
    } else {
      b = m;
    }
  }
  return {
    x: a > 0 ? Math.sqrt(a * b) : (a + b) / 2,
    fLo: f(lo),
    fHi: f(hi),
    iterations: it,
  };
}

/** Time of X minus Y to a ladder loss as the WAN bandwidth varies (study.gap). */
export function gapOverBandwidth(
  x: Config,
  y: Config,
  dcs: number,
  target = 0,
): (bw: number) => number {
  return (bw) => {
    const tx = timeTo({ ...x, topo: topology(dcs, bw) }, target);
    const ty = timeTo({ ...y, topo: topology(dcs, bw) }, target);
    if (!Number.isFinite(tx) && !Number.isFinite(ty)) return NaN;
    return tx - ty;
  };
}
