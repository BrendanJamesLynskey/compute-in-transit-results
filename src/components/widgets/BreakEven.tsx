"use client";

/**
 * Break-even curves: how much sooner (below zero) or later X reaches 3.158
 * than Y, as the WAN bandwidth varies (2 DC × 4), with E's measured steps
 * (the hypothesis) and with the exact band's. A crossing is where the
 * bisection of results.md section 7a lands; the port finds the same ones
 * (tests/unit/transit.test.ts).
 */
import { useMemo, useState } from "react";

import { Segmented } from "@/components/ui/Controls";
import { XAxis, YAxis } from "@/components/viz/Axes";
import { useWidth } from "@/components/viz/useWidth";
import { fixed, plusFixed, pyG, trim } from "@/lib/format";
import {
  bisect,
  gapOverBandwidth,
  LETTER,
  moduleOf,
  stepsTo,
  topology,
  type Config,
  type ModuleKey,
  type Variant,
} from "@/lib/transit/model";
import { BW_RANGE } from "@/lib/transit/presets";
import { OKABE_ITO } from "@/lib/viz/palette";
import { linear, linearTicks, log, logTicks, path } from "@/lib/viz/scale";

const PAIRS: [Variant, Variant][] = [
  ["band-switch", "adamw"],
  ["band-switch", "topk"],
  ["band-switch", "band-allreduce"],
  ["band-pluggable", "adamw"],
  ["band-pluggable", "band"],
  ["band-allreduce", "adamw"],
];
const BWS = Array.from({ length: 121 }, (_, i) => 1e8 * 10 ** (i / 30));

export default function BreakEven({ testId }: { testId: string }): JSX.Element {
  const [pair, setPair] = useState("0");
  const [mod, setMod] = useState<ModuleKey>("free");
  const [ref, width] = useWidth();
  const [x, y] = PAIRS[Number(pair)]!;
  const cfg = (v: Variant, exact: boolean): Config => ({
    variant: v,
    topo: topology(2, 1e9),
    module: moduleOf(mod),
    exactSteps: exact,
  });
  const lines = useMemo(
    () =>
      [false, true].map((exact) => {
        const f = gapOverBandwidth(cfg(x, exact), cfg(y, exact), 2);
        return {
          exact,
          d: BWS.map(f),
          be: bisect(f, BW_RANGE[0], BW_RANGE[1]),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [x, y, mod],
  );
  const all = lines.flatMap((l) => l.d).filter(Number.isFinite);
  const lim = Math.max(1, ...all.map(Math.abs)) * 1.1;
  const H = 280;
  const m = { l: 52, r: 12, t: 10, b: 44 };
  const xS = log(BW_RANGE[0], BW_RANGE[1], m.l, width - m.r);
  const yS = linear(-lim, lim, H - m.b, m.t);
  const colour = [OKABE_ITO.vermillion, OKABE_ITO.blue];
  const lx = LETTER[x];
  const ly = LETTER[y];

  return (
    <figure
      data-testid={testId}
      className="my-8 min-w-0 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <figcaption>
        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
          Interactive · computed by the model
        </p>
        <p className="mt-1 font-semibold text-neutral-900 dark:text-neutral-100">
          Break-even: {lx} minus {ly}, seconds to 3.158
        </p>
        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
          Below zero, {lx} gets there first. 2 data centres × 4 workers.
        </p>
      </figcaption>
      <div ref={ref} className="mt-4 min-w-0">
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`Time of ${lx} minus ${ly} against WAN bandwidth`}
          className="block text-neutral-900 dark:text-neutral-100"
        >
          <YAxis
            scale={yS}
            ticks={linearTicks(-lim, lim, 6)}
            x={m.l}
            right={width - m.r}
            label={`${lx} − ${ly} (s)`}
            format={(v) => pyG(v, 3)}
          />
          <XAxis
            scale={xS}
            ticks={logTicks(BW_RANGE[0], BW_RANGE[1])}
            y={H - m.b}
            top={m.t}
            label="inter-DC bandwidth, GB/s (log)"
            format={(v) => trim(v / 1e9, 3)}
          />
          <line
            x1={m.l}
            x2={width - m.r}
            y1={yS(0)}
            y2={yS(0)}
            stroke="currentColor"
            strokeWidth={1.25}
          />
          {lines.map((l, i) => (
            <g key={String(l.exact)} data-exact={String(l.exact)}>
              <path
                d={path(
                  BWS.map((b) => xS(b)),
                  l.d.map((v) => (Number.isFinite(v) ? yS(v) : NaN)),
                )}
                fill="none"
                stroke={colour[i]}
                strokeWidth={2.25}
                strokeDasharray={l.exact ? "7 4" : undefined}
              />
              {l.be.x !== null && (
                <circle
                  cx={xS(l.be.x)}
                  cy={yS(0)}
                  r={5}
                  fill={colour[i]}
                  stroke="white"
                />
              )}
            </g>
          ))}
        </svg>
      </div>
      <ul
        className="mt-2 space-y-1 text-sm text-neutral-800 dark:text-neutral-200"
        data-testid="breakeven-readout"
      >
        {lines.map((l) => (
          <li key={String(l.exact)}>
            <span className="font-medium">
              {l.exact ? "Exact band's steps" : "E's steps (hypothesis)"}:
            </span>{" "}
            {l.be.x !== null
              ? `${l.be.fLo < 0 ? lx : ly} is faster below ${pyG(l.be.x / 1e9, 3)} GB/s (${pyG((l.be.x * 8) / 1e9, 3)} Gb/s).`
              : Number.isNaN(l.be.fLo)
                ? "neither reaches 3.158."
                : `no break-even in 0.1 to 1,000 GB/s; ${l.be.fLo < 0 ? lx : ly} is faster throughout (${plusFixed(l.be.fLo, 2)} s at 0.1 GB/s, ${plusFixed(l.be.fHi, 2)} s at 1,000 GB/s).`}
          </li>
        ))}
      </ul>
      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
            Pair
          </span>
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            className="focus-ring h-11 rounded border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-950"
          >
            {PAIRS.map(([a, b], i) => (
              <option key={i} value={String(i)}>
                {LETTER[a]} against {LETTER[b]}
              </option>
            ))}
          </select>
        </label>
        <Segmented
          label="Module"
          value={mod}
          options={[
            { value: "high", label: "99 GFLOP/s, charged" },
            { value: "free", label: "transform free" },
          ]}
          onChange={setMod}
        />
      </div>
      <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
        Solid: E&apos;s measured steps (
        {fixed(stepsTo(cfg("band-pluggable", false))!, 0)} to 3.158 at ENOB 8,
        one seed). Dashed: the exact band&apos;s steps (
        {fixed(stepsTo(cfg("band", false))!, 0)}, C, three seeds). Only the
        in-transit variants change between the two.
      </p>
    </figure>
  );
}
