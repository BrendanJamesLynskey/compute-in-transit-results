"use client";

/**
 * Validation loss against training steps or cumulative wire bytes, for any
 * set of the experiment's configurations: the mean over seeds as a line,
 * the lowest to highest seed as a band. The animation replays training
 * evaluation by evaluation (every 200 steps), from the run logs.
 */
import { useMemo, useState } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Segmented } from "@/components/ui/Controls";
import { XAxis, YAxis } from "@/components/viz/Axes";
import { useWidth } from "@/components/viz/useWidth";
import { fixed, int } from "@/lib/format";
import { KIND_COLOUR } from "@/lib/viz/palette";
import {
  band,
  linear,
  linearTicks,
  log,
  logTicks,
  path,
} from "@/lib/viz/scale";

export type LossSeries = {
  id: string;
  short: string;
  kind: keyof typeof KIND_COLOUR;
  seeds: number;
  step: number[];
  /** Cumulative wire bytes per worker at each evaluation. */
  wire: number[];
  mean: number[];
  lo: number[];
  hi: number[];
};

const DASH = ["", "7 4", "2 3", "9 3 2 3", "4 4"];

export default function LossCurves({
  series,
  initial,
  title,
  summary,
  testId,
  compact = false,
}: {
  series: LossSeries[];
  initial: string[];
  title: string;
  summary: string;
  testId: string;
  compact?: boolean;
}): JSX.Element {
  const [shown, setShown] = useState<string[]>(initial);
  const [x, setX] = useState<"step" | "wire">("step");
  const steps = series[0]!.step;
  const stepper = useStepper(steps.length, {
    stepMs: 650,
    resetKey: `${shown.join()}|${x}`,
  });
  const [ref, width] = useWidth();

  const dash = useMemo(() => {
    const seen: Record<string, number> = {};
    return Object.fromEntries(
      series.map((s) => {
        const i = seen[s.kind] ?? 0;
        seen[s.kind] = i + 1;
        return [s.id, DASH[i % DASH.length]!];
      }),
    );
  }, [series]);

  const vis = series.filter((s) => shown.includes(s.id));
  const H = compact ? 260 : 340;
  const m = { l: 52, r: 12, t: 10, b: 44 };
  const yMax = Math.max(6, ...vis.map((s) => Math.max(...s.hi)));
  const yS = log(1.5, yMax * 1.05, H - m.b, m.t);
  const allWire = vis.flatMap((s) => s.wire);
  const xS =
    x === "step"
      ? linear(0, steps.at(-1)!, m.l, width - m.r)
      : log(
          Math.max(1e8, Math.min(...(allWire.length ? allWire : [1e9])) * 0.8),
          Math.max(...(allWire.length ? allWire : [2e11])) * 1.1,
          m.l,
          width - m.r,
        );
  const xOf = (s: LossSeries, i: number) =>
    xS(x === "step" ? s.step[i]! : s.wire[i]!);
  const k = stepper.step;
  const upto = (arr: number[]) => arr.slice(0, k + 1);

  const ranked = [...vis].sort((a, b) => a.mean[k]! - b.mean[k]!);
  const caption =
    vis.length === 0
      ? "Pick at least one configuration below."
      : `Step ${int(steps[k]!)}: ` +
        ranked
          .slice(0, compact ? 4 : 6)
          .map(
            (s) =>
              `${s.short} ${fixed(s.mean[k]!, 3)}${x === "wire" ? ` after ${fixed(s.wire[k]! / 1e9, 1)} GB` : ""}`,
          )
          .join(", ") +
        (ranked.length > (compact ? 4 : 6) ? ", …" : "") +
        " (validation loss, mean over seeds).";

  const toggle = (id: string) =>
    setShown((v) => (v.includes(id) ? v.filter((z) => z !== id) : [...v, id]));

  const visual = (
    <div ref={ref} className="min-w-0">
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Validation loss against ${x === "step" ? "training steps" : "cumulative wire bytes per worker"} for ${vis.map((s) => s.short).join("; ")}`}
        className="block text-neutral-900 dark:text-neutral-100"
      >
        <YAxis
          scale={yS}
          ticks={logTicks(1.5, yMax * 1.05).filter((t) => t >= 1.5)}
          x={m.l}
          right={width - m.r}
          label="validation loss (log)"
          format={(v) => fixed(v, v < 10 ? 1 : 0)}
        />
        <XAxis
          scale={xS}
          ticks={
            x === "step"
              ? linearTicks(0, steps.at(-1)!, width < 500 ? 3 : 6)
              : logTicks(xS.domain[0], xS.domain[1])
          }
          y={H - m.b}
          top={m.t}
          label={
            x === "step"
              ? "training step"
              : "wire bytes per worker, cumulative (log)"
          }
          format={(v) =>
            x === "step" ? int(v) : `${fixed(v / 1e9, v < 1e9 ? 1 : 0)} GB`
          }
        />
        {vis.map((s) => {
          const xs = upto(s.step).map((_, i) => xOf(s, i));
          const c = KIND_COLOUR[s.kind];
          return (
            <g key={s.id} data-series={s.id}>
              {s.seeds > 1 && (
                <path
                  d={band(xs, upto(s.lo).map(yS), upto(s.hi).map(yS))}
                  fill={c}
                  fillOpacity={0.18}
                />
              )}
              <path
                d={path(xs, upto(s.mean).map(yS))}
                fill="none"
                stroke={c}
                strokeWidth={2.25}
                strokeDasharray={dash[s.id]}
              />
              <circle
                cx={xs.at(-1)}
                cy={yS(s.mean[k]!)}
                r={3.5}
                fill={c}
                stroke="white"
                strokeWidth={1}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );

  return (
    <AnimationPanel
      title={title}
      summary={summary}
      kicker="Animated · replayed from the run logs"
      stepper={stepper}
      stepLabel="evaluation"
      caption={caption}
      visual={visual}
      testId={testId}
      params={
        <>
          <Segmented
            label="Horizontal axis"
            value={x}
            options={[
              { value: "step", label: "steps" },
              { value: "wire", label: "wire bytes" },
            ]}
            onChange={setX}
          />
          <div className="min-w-0 sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Configurations (band: lowest to highest seed)
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {series.map((s) => {
                const on = shown.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(s.id)}
                    data-toggle={s.id}
                    className={`focus-ring inline-flex min-h-11 items-center gap-2 rounded border px-2 text-left text-xs ${
                      on
                        ? "border-neutral-400 bg-white text-neutral-900 dark:border-neutral-500 dark:bg-neutral-950 dark:text-neutral-100"
                        : "border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    <svg width={22} height={10} aria-hidden="true">
                      <line
                        x1={1}
                        x2={21}
                        y1={5}
                        y2={5}
                        stroke={KIND_COLOUR[s.kind]}
                        strokeWidth={2.5}
                        strokeDasharray={dash[s.id]}
                        opacity={on ? 1 : 0.4}
                      />
                    </svg>
                    {s.short}
                    {s.seeds > 1 ? ` (${s.seeds} seeds)` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      }
    />
  );
}
