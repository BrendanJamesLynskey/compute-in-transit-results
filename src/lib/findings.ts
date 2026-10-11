/**
 * The landing page's "What it found": every number in it, read from the
 * vendored results (the experiment's results.json and the simulation's
 * results.json and results.md) and formatted as their results.md prints it.
 * Server-side only. tests/unit/findings.test.ts asserts each one against the
 * vendored files, so none is typed by hand.
 */
import { experimentResults, runsFile, simResults } from "@/lib/data/load";
import { fixed } from "@/lib/format";
import { breakEven, energy, G, loss, row } from "@/lib/quote";
import { SETUP, TARGETS, VARIANT_NAME } from "@/lib/transit/model";

/** The groups of the first optics design (feedback of the exact band). */
export function firstOpticsGroups(): string[] {
  return experimentResults()
    .rows.map((r) => r.group)
    .filter((g) => g.includes("-optics-") && !g.includes("enobNone"))
    .filter((g) => !g.includes("fbsent"));
}

/** The repaired runs (feedback of the band sent; full scale fixed or re-set). */
export function repairedOpticsGroups(): string[] {
  return experimentResults()
    .rows.map((r) => r.group)
    .filter((g) => g.includes("-fbsent-"));
}

const range = (ids: string[], f: (id: string) => number) => {
  const v = ids.map(f);
  return [Math.min(...v), Math.max(...v)] as const;
};

export function findings() {
  const lowBand = [G.C1d256, G.C1d64, G.C2d];
  const [lowMin, lowMax] = range(lowBand, (id) => row(id).final_val);
  const first = firstOpticsGroups();
  const [firstMin, firstMax] = range(first, (id) => row(id).final_val);
  const [clipMin, clipMax] = range(first, (id) => row(id).clip_rate ?? 0);
  const repaired = repairedOpticsGroups();
  const [repMin, repMax] = range(repaired, (id) => row(id).final_val);
  const sim = simResults();
  const enobBe = sim.breakeven_enob as { measured_enob: number | null }[];
  const enobs = [
    ...new Set(enobBe.map((b) => b.measured_enob).filter((x) => x !== null)),
  ];
  if (enobs.length !== 1) throw new Error("expected one break-even ENOB");
  const never = sim.enob_never as number[];
  const pluggableVsA = [
    breakEven(VARIANT_NAME["band-pluggable"], VARIANT_NAME.adamw, "free", "E"),
    breakEven(
      VARIANT_NAME["band-pluggable"],
      VARIANT_NAME.adamw,
      "free",
      "C (exact)",
    ),
    breakEven(VARIANT_NAME["band-pluggable"], VARIANT_NAME.adamw, "high", "E"),
    breakEven(
      VARIANT_NAME["band-pluggable"],
      VARIANT_NAME.adamw,
      "high",
      "C (exact)",
    ),
  ];
  const gb = (cellText: string) => cellText.split(" ")[0]!;
  return {
    /** 1. The fixed low band (three chunk shapes) against top-k and AdamW. */
    lowMin: fixed(lowMin, 3),
    lowMax: fixed(lowMax, 3),
    topk: loss(G.B),
    adamw: loss(G.A),
    /** 2. Captured energy of real momentum, 2-D 64x64 chunks (and 1-D 256). */
    eLow2d: energy("band/2d/64", "momentum/all/low"),
    eTopk2d: energy("band/2d/64", "momentum/all/topk"),
    eRandom2d: energy("band/2d/64", "momentum/all/random"),
    eLow1d: energy("band/1d/256", "momentum/all/low"),
    eTopk1d: energy("band/1d/256", "momentum/all/topk"),
    /** 3. The optics: first design diverged; feedback of the band sent fixed it. */
    firstRuns: first.length,
    firstMin: fixed(firstMin, 3),
    firstMax: fixed(firstMax, 3),
    clipMin: `${fixed(100 * clipMin, 2)}%`,
    clipMax: `${fixed(100 * clipMax, 2)}%`,
    repMin: fixed(repMin, 3),
    repMax: fixed(repMax, 3),
    exactBand: loss(G.Ectrl),
    /** 4. ENOB. */
    enobNever: never.join(", "),
    enobBreakEven: String(enobs[0]),
    target: fixed(TARGETS[0]![0], 3),
    /** 5. Where the module could pay (results.md 7a). */
    pluggableNever: pluggableVsA.every((r) => r[4] === "none in range"),
    switchVsA: gb(
      breakEven(
        VARIANT_NAME["band-switch"],
        VARIANT_NAME.adamw,
        "free",
        "E",
      )[4]!,
    ),
    switchVsAExact: gb(
      breakEven(
        VARIANT_NAME["band-switch"],
        VARIANT_NAME.adamw,
        "free",
        "C (exact)",
      )[4]!,
    ),
    allreduceVsA: gb(
      breakEven(
        VARIANT_NAME["band-allreduce"],
        VARIANT_NAME.adamw,
        "–",
        "measured",
      )[4]!,
    ),
    switchVsAllreduceExact: breakEven(
      VARIANT_NAME["band-switch"],
      VARIANT_NAME["band-allreduce"],
      "free",
      "C (exact)",
    )[4]!,
    /** 6. Wire bytes: an all-gather grows with the workers. */
    wireBand: fixed(row(G.C1d256).wire_per_step, 0),
    wireAdamw: fixed(row(G.A).wire_per_step, 0),
    wireRatio: fixed(row(G.A).wire_per_step / row(G.C1d256).wire_per_step, 1),
    payloadRatio: fixed(
      row(G.A).payload_per_step / row(G.C1d256).payload_per_step,
      1,
    ),
    workers: SETUP.workers,
    /** The process: how many runs the GPU sweep completed. */
    runs: runsFile().runs.length,
  };
}

export type Findings = ReturnType<typeof findings>;
