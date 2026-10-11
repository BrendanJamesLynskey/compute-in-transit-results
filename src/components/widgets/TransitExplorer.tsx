"use client";

/**
 * The WAN-bandwidth explorer: time to the target loss (3.158) for the six
 * variants as the inter-DC bandwidth goes from 0.1 to 1,000 GB/s, computed
 * live by the TypeScript port of the simulation's closed forms
 * (src/lib/transit/model.ts). Dots are the simulation's recorded points
 * (results.json), which the curves pass through. The animation sweeps the
 * bandwidth; the bars below show where each variant's step goes there, or
 * its energy per step.
 */
import { useMemo, useState, type ReactNode } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Segmented } from "@/components/ui/Controls";
import { XAxis, YAxis } from "@/components/viz/Axes";
import { useWidth } from "@/components/viz/useWidth";
import { fixed, pyG, trim } from "@/lib/format";
import {
  bisect,
  CATEGORIES,
  energyPerStep,
  gapOverBandwidth,
  hotSpots,
  HYPOTHETICAL,
  LETTER,
  moduleOf,
  plan,
  stepTime,
  stepsTo,
  timeTo,
  topology,
  VARIANTS,
  type Config,
  type ModuleKey,
  type Variant,
} from "@/lib/transit/model";
import { BW_RANGE } from "@/lib/transit/presets";
import { CATEGORY_COLOUR, VARIANT_COLOUR } from "@/lib/viz/palette";
import { log, logTicks, path } from "@/lib/viz/scale";

export type RecordedPoint = {
  variant: Variant;
  module: ModuleKey | null;
  dcs: number;
  bw: number;
  seconds: number;
  topology: string;
};

const GRID = Array.from({ length: 41 }, (_, i) => 1e8 * 10 ** (i / 10));
const DENSE = Array.from({ length: 161 }, (_, i) => 1e8 * 10 ** (i / 40));

function gbs(bw: number): string {
  return `${pyG(bw / 1e9, 3)} GB/s (${pyG((bw * 8) / 1e9, 3)} Gb/s)`;
}

export default function TransitExplorer({
  recorded,
  equation,
  testId,
}: {
  recorded: RecordedPoint[];
  equation?: ReactNode;
  testId: string;
}): JSX.Element {
  const [mod, setMod] = useState<ModuleKey>("free");
  const [steps, setSteps] = useState<"e" | "exact">("e");
  const [enob, setEnob] = useState("8");
  const [dcs, setDcs] = useState<"2" | "8">("2");
  const [bars, setBars] = useState<"time" | "energy">("time");
  const D = Number(dcs);
  const key = `${mod}|${steps}|${enob}|${dcs}`;
  const stepper = useStepper(GRID.length, { stepMs: 450, resetKey: key });
  const [ref, width] = useWidth();

  const cfg = (v: Variant, bw: number): Config => ({
    variant: v,
    topo: topology(D, bw),
    module: moduleOf(mod, { enob: Number(enob) }),
    exactSteps: steps === "exact",
  });

  const curves = useMemo(
    () =>
      VARIANTS.map((v) => ({
        v,
        t: DENSE.map((bw) =>
          timeTo({
            variant: v,
            topo: topology(D, bw),
            module: moduleOf(mod, { enob: Number(enob) }),
            exactSteps: steps === "exact",
          }),
        ),
      })),
    [D, mod, enob, steps],
  );

  const crossings = useMemo(() => {
    const c = (v: Variant): Config => ({
      variant: v,
      topo: topology(D, 1e9),
      module: moduleOf(mod, { enob: Number(enob) }),
      exactSteps: steps === "exact",
    });
    return (
      [
        ["band-switch", "adamw"],
        ["band-switch", "topk"],
        ["band-allreduce", "adamw"],
        ["band-pluggable", "band"],
      ] as [Variant, Variant][]
    ).map(([a, b]) => ({
      a,
      b,
      ...bisect(gapOverBandwidth(c(a), c(b), D), BW_RANGE[0], BW_RANGE[1]),
    }));
  }, [D, mod, enob, steps]);

  const finite = curves.flatMap((c) => c.t).filter(Number.isFinite);
  const yMin = Math.min(...finite) * 0.8;
  const yMax = Math.max(...finite) * 1.25;
  const H = 300;
  const m = { l: 52, r: 12, t: 10, b: 44 };
  const xS = log(BW_RANGE[0], BW_RANGE[1], m.l, width - m.r);
  const yS = log(yMin, yMax, H - m.b, m.t);

  const bw = GRID[stepper.step]!;
  const rows = VARIANTS.map((v) => {
    const c = cfg(v, bw);
    const p = plan(c);
    return {
      v,
      time: timeTo(c),
      step: stepTime(p),
      hot: hotSpots(p),
      energy: energyPerStep(p),
      steps: stepsTo(c),
    };
  });
  const ranked = rows
    .filter((r) => Number.isFinite(r.time))
    .sort((a, b) => a.time - b.time);
  const never = rows
    .filter((r) => !Number.isFinite(r.time))
    .map((r) => LETTER[r.v]);
  const caption =
    `At ${gbs(bw)} of WAN: fastest to 3.158 is ${LETTER[ranked[0]!.v]} (${fixed(ranked[0]!.time, 2)} s)` +
    `, then ${ranked
      .slice(1)
      .map((r) => `${LETTER[r.v]} ${fixed(r.time, 2)} s`)
      .join(", ")}` +
    (never.length
      ? `; ${never.join(" and ")} never reach it at ENOB ${enob}`
      : "") +
    ".";

  const shown = recorded.filter(
    (r) =>
      r.dcs === D &&
      (r.module === null ||
        (r.module === mod && steps === "e" && enob === "8")),
  );

  const barH = 22;
  const labelW = 34;
  const bw2 = Math.max(120, width - labelW - 86);
  const maxE = Math.max(
    ...rows.map((r) => r.energy.compute + r.energy.link + r.energy.module),
  );

  const visual = (
    <div ref={ref} className="min-w-0">
      <svg
        width={width}
        height={H}
        role="img"
        aria-label="Time to reach a validation loss of 3.158 against inter-DC bandwidth, per variant"
        className="block text-neutral-900 dark:text-neutral-100"
      >
        <YAxis
          scale={yS}
          ticks={logTicks(yMin, yMax)}
          x={m.l}
          right={width - m.r}
          label="seconds to 3.158 (log)"
          format={(v) => trim(v, 3)}
        />
        <XAxis
          scale={xS}
          ticks={logTicks(BW_RANGE[0], BW_RANGE[1])}
          y={H - m.b}
          top={m.t}
          label="inter-DC bandwidth, GB/s (log)"
          format={(v) => trim(v / 1e9, 3)}
        />
        {curves.map(({ v, t }) => (
          <path
            key={v}
            data-variant={v}
            d={path(
              DENSE.map((b) => xS(b)),
              t.map((s) => (Number.isFinite(s) ? yS(s) : NaN)),
            )}
            fill="none"
            stroke={VARIANT_COLOUR[v]}
            strokeWidth={2.25}
            strokeDasharray={HYPOTHETICAL.includes(v) ? "7 4" : undefined}
          />
        ))}
        {shown.map((r) => (
          <circle
            key={`${r.variant}${r.topology}`}
            data-recorded={`${r.variant}|${r.topology}`}
            cx={xS(r.bw)}
            cy={yS(r.seconds)}
            r={4}
            fill="white"
            stroke={VARIANT_COLOUR[r.variant]}
            strokeWidth={2}
          >
            <title>{`${LETTER[r.variant]}, ${r.topology}: ${fixed(r.seconds, 2)} s (results.md)`}</title>
          </circle>
        ))}
        {crossings
          .filter((c) => c.x !== null)
          .map((c, i) => (
            <g
              key={`${c.a}${c.b}`}
              className="text-neutral-700 dark:text-neutral-300"
            >
              <line
                x1={xS(c.x!)}
                x2={xS(c.x!)}
                y1={H - m.b}
                y2={H - m.b - 8 - 8 * (i % 2)}
                stroke="currentColor"
                strokeWidth={1.5}
              />
            </g>
          ))}
        <line
          x1={xS(bw)}
          x2={xS(bw)}
          y1={m.t}
          y2={H - m.b}
          stroke="currentColor"
          strokeOpacity={0.6}
          strokeDasharray="4 3"
        />
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-700 dark:text-neutral-300">
        {VARIANTS.map((v) => (
          <li key={v} className="flex items-center gap-1">
            <svg width={22} height={10} aria-hidden="true">
              <line
                x1={1}
                x2={21}
                y1={5}
                y2={5}
                stroke={VARIANT_COLOUR[v]}
                strokeWidth={2.5}
                strokeDasharray={HYPOTHETICAL.includes(v) ? "7 4" : undefined}
              />
            </svg>
            {LETTER[v]}
            {HYPOTHETICAL.includes(v) ? " (hypothetical)" : ""}
          </li>
        ))}
        <li>○ recorded (results.md)</li>
        <li>| break-even</li>
      </ul>
      <div className="mt-3 min-w-0" data-testid="bars">
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          {bars === "time"
            ? `Where each variant's step goes at ${gbs(bw)} (step time on the right):`
            : `Energy per step, all 8 workers, at ${gbs(bw)} (J; compute, links, modules):`}
        </p>
        <svg
          width={width}
          height={rows.length * (barH + 6) + 4}
          role="img"
          aria-label="Per-variant step breakdown"
          className="block text-neutral-900 dark:text-neutral-100"
        >
          {rows.map((r, i) => {
            const y = 2 + i * (barH + 6);
            let x0 = labelW;
            const parts =
              bars === "time"
                ? CATEGORIES.map((c) => [c, r.hot[c] * bw2] as const)
                : ([
                    ["compute", (r.energy.compute / maxE) * bw2],
                    ["intra-DC link", (r.energy.link / maxE) * bw2],
                    ["module compute", (r.energy.module / maxE) * bw2],
                  ] as const);
            const total = r.energy.compute + r.energy.link + r.energy.module;
            return (
              <g key={r.v} data-bar={r.v}>
                <text
                  x={labelW - 6}
                  y={y + 15}
                  fontSize={12}
                  textAnchor="end"
                  fill="currentColor"
                >
                  {LETTER[r.v]}
                </text>
                {parts.map(([c, w]) => {
                  const el = (
                    <rect
                      key={c}
                      x={x0}
                      y={y}
                      width={Math.max(0, w)}
                      height={barH}
                      fill={CATEGORY_COLOUR[c]}
                    >
                      <title>{c}</title>
                    </rect>
                  );
                  x0 += Math.max(0, w);
                  return el;
                })}
                <text
                  x={labelW + bw2 + 6}
                  y={y + 15}
                  fontSize={12}
                  fill="currentColor"
                  className="font-mono"
                >
                  {bars === "time"
                    ? `${fixed(r.step * 1e3, 2)} ms`
                    : `${fixed(total, 2)} J`}
                </text>
              </g>
            );
          })}
        </svg>
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-700 dark:text-neutral-300">
          {(bars === "time"
            ? CATEGORIES
            : (["compute", "intra-DC link", "module compute"] as const)
          ).map((c) => (
            <li key={c} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block size-3 rounded-sm"
                style={{ background: CATEGORY_COLOUR[c] }}
              />
              {bars === "time"
                ? c
                : c === "compute"
                  ? "devices"
                  : c === "intra-DC link"
                    ? "links"
                    : "modules"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <AnimationPanel
      title="Time to 3.158 against WAN bandwidth"
      summary="Six variants, 8 workers in 2 or 8 data centres; the closed forms of Training_Transit_Sim, run live in your browser."
      stepper={stepper}
      stepLabel="bandwidth"
      caption={caption}
      visual={visual}
      equation={equation}
      testId={testId}
      stats={
        <ul
          className="grid gap-1 text-xs text-neutral-700 sm:grid-cols-2 dark:text-neutral-300"
          data-testid="crossings"
        >
          {crossings.map((c) => (
            <li key={`${c.a}${c.b}`}>
              {LETTER[c.a]} vs {LETTER[c.b]}:{" "}
              {c.x === null
                ? Number.isNaN(c.fLo) || Number.isNaN(c.fHi)
                  ? "neither reaches 3.158"
                  : `no break-even in 0.1 to 1,000 GB/s (${c.fLo < 0 ? LETTER[c.a] : LETTER[c.b]} faster throughout)`
                : `${LETTER[c.fLo < 0 ? c.a : c.b]} faster below ${gbs(c.x)}`}
            </li>
          ))}
        </ul>
      }
      params={
        <>
          <Segmented
            label="Module (E, E′)"
            value={mod}
            options={[
              { value: "low", label: "10 GFLOP/s" },
              { value: "high", label: "99 GFLOP/s" },
              { value: "free", label: "transform free" },
            ]}
            onChange={setMod}
          />
          <Segmented
            label="Steps for E, E′"
            value={steps}
            options={[
              { value: "e", label: "E's runs (hypothesis)" },
              { value: "exact", label: "exact band's" },
            ]}
            onChange={setSteps}
          />
          <Segmented
            label="ENOB of E's run"
            value={enob}
            options={["6", "8", "10", "12"].map((e) => ({
              value: e,
              label: e,
            }))}
            onChange={setEnob}
          />
          <Segmented
            label="Data centres"
            value={dcs}
            options={[
              { value: "2", label: "2 × 4 workers" },
              { value: "8", label: "8 × 1 worker" },
            ]}
            onChange={setDcs}
          />
          <Segmented
            label="Bars"
            value={bars}
            options={[
              { value: "time", label: "where the step goes" },
              { value: "energy", label: "energy per step" },
            ]}
            onChange={setBars}
          />
        </>
      }
    />
  );
}
