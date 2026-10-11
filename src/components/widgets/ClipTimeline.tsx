"use client";

/**
 * The optics runs over training, from their logs: validation loss and the
 * share of inputs clipped in each interval, for the first design (full
 * scale fixed, feedback of the exact band) and the repaired one (full scale
 * re-set, feedback of the band sent) at the same ENOB and planes, with the
 * perfect-optics control; and, from the exact band's own runs, how little
 * of the delta's energy is in the band the optics extracts.
 */
import { useState } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { useWidth } from "@/components/viz/useWidth";
import type { ClipSeries } from "@/lib/experiment/props";
import { fixed, int, sci, sup } from "@/lib/format";
import { KIND_COLOUR } from "@/lib/viz/palette";
import { linear, log, logTicks, path } from "@/lib/viz/scale";
import { XAxis, YAxis } from "@/components/viz/Axes";

export default function ClipTimeline({
  runs,
  share,
  testId,
}: {
  runs: ClipSeries[];
  /** Band share of the delta's energy per diagnostic, the exact band's runs (C, 1-D 256, mean over seeds). */
  share: { step: number[]; value: number[] };
  testId: string;
}): JSX.Element {
  const settings = [
    ...new Set(
      runs.filter((r) => r.kind === "E0").map((r) => `${r.enob}|${r.planes}`),
    ),
  ];
  const [setting, setSetting] = useState(
    settings.includes("8|8") ? "8|8" : settings[0]!,
  );
  const [enob, planes] = setting.split("|").map(Number) as [number, number];
  const first = runs.find(
    (r) => r.kind === "E0" && r.enob === enob && r.planes === planes,
  )!;
  const fixedRun = runs.find(
    (r) =>
      r.kind === "E" &&
      r.enob === enob &&
      r.planes === planes &&
      r.short.includes("full scale fixed"),
  );
  const repaired = runs.find(
    (r) =>
      r.kind === "E" &&
      r.enob === enob &&
      r.planes === planes &&
      !r.short.includes("full scale fixed"),
  )!;
  const control = runs.find((r) => r.kind === "Ec")!;
  const lines = [first, repaired, ...(fixedRun ? [fixedRun] : []), control];
  const stepper = useStepper(first.step.length, {
    stepMs: 650,
    resetKey: setting,
  });
  const [ref, width] = useWidth();
  const k = stepper.step;
  const steps = first.step;

  const half = width >= 640 ? (width - 16) / 2 : width;
  const H = 220;
  const m = { l: 52, r: 10, t: 10, b: 44 };
  const xS = linear(0, steps.at(-1)!, m.l, half - m.r);
  const lossMax = Math.max(...lines.flatMap((l) => l.loss));
  const yL = log(2.5, lossMax * 1.1, H - m.b, m.t);
  const yC = linear(0, 0.7, H - m.b, m.t);
  const xShare = linear(0, share.step.at(-1)!, m.l, width - m.r);
  const shareMin = Math.min(...share.value);
  const shareMax = Math.max(...share.value);
  const yS = log(shareMin / 1.5, shareMax * 1.5, 160 - m.b, m.t);
  const dash = (r: ClipSeries) =>
    r === fixedRun ? "7 4" : r === control ? "2 3" : undefined;
  const sk = Math.min(k, share.step.length - 1);

  const caption =
    `Step ${int(steps[k]!)}, ENOB ${enob}, ${planes} planes: the first design's loss is ${fixed(first.loss[k]!, 3)}` +
    (first.clip[k] !== null
      ? ` with ${fixed(100 * first.clip[k]!, 1)}% of inputs clipped in the interval`
      : "") +
    `; repaired, ${fixed(repaired.loss[k]!, 3)}` +
    (repaired.clip[k] !== null
      ? ` with ${fixed(100 * repaired.clip[k]!, 1)}% clipped`
      : "") +
    `. The band holds ${sci(share.value[sk]!, 2)} of the exact band runs' delta energy at step ${int(share.step[sk]!)}.`;

  const legend = (
    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-700 dark:text-neutral-300">
      {lines.map((r) => (
        <li key={r.id} className="flex items-center gap-1">
          <svg width={22} height={10} aria-hidden="true">
            <line
              x1={1}
              x2={21}
              y1={5}
              y2={5}
              stroke={KIND_COLOUR[r.kind]}
              strokeWidth={2.5}
              strokeDasharray={dash(r)}
            />
          </svg>
          {r.short}
        </li>
      ))}
    </ul>
  );

  const visual = (
    <div ref={ref} className="min-w-0">
      <div className="flex min-w-0 flex-wrap gap-4">
        <svg
          width={half}
          height={H}
          role="img"
          aria-label="Validation loss of the optics runs over training"
          className="block text-neutral-900 dark:text-neutral-100"
        >
          <YAxis
            scale={yL}
            ticks={logTicks(2.5, lossMax * 1.1)}
            x={m.l}
            right={half - m.r}
            label="val loss (log)"
            format={(v) => fixed(v, v < 10 ? 1 : 0)}
          />
          <XAxis
            scale={xS}
            ticks={[0, 1000, 2000, 3000].filter((t) => t <= steps.at(-1)!)}
            y={H - m.b}
            top={m.t}
            label="training step"
            format={int}
          />
          {lines.map((r) => (
            <path
              key={r.id}
              data-run={r.id}
              d={path(
                r.step.slice(0, k + 1).map(xS),
                r.loss.slice(0, k + 1).map(yL),
              )}
              fill="none"
              stroke={KIND_COLOUR[r.kind]}
              strokeWidth={2.25}
              strokeDasharray={dash(r)}
            />
          ))}
        </svg>
        <svg
          width={half}
          height={H}
          role="img"
          aria-label="Share of inputs clipped per interval"
          className="block text-neutral-900 dark:text-neutral-100"
        >
          <YAxis
            scale={yC}
            ticks={[0, 0.2, 0.4, 0.6]}
            x={m.l}
            right={half - m.r}
            label="inputs clipped"
            format={(v) => `${fixed(100 * v, 0)}%`}
          />
          <XAxis
            scale={xS}
            ticks={[0, 1000, 2000, 3000].filter((t) => t <= steps.at(-1)!)}
            y={H - m.b}
            top={m.t}
            label="training step"
            format={int}
          />
          {lines
            .filter((r) => r.clip.some((c) => c !== null))
            .map((r) => (
              <path
                key={r.id}
                d={path(
                  r.step.slice(0, k + 1).map(xS),
                  r.clip.slice(0, k + 1).map((c) => (c === null ? NaN : yC(c))),
                )}
                fill="none"
                stroke={KIND_COLOUR[r.kind]}
                strokeWidth={2.25}
                strokeDasharray={dash(r)}
              />
            ))}
        </svg>
      </div>
      {legend}
      <svg
        width={width}
        height={160}
        role="img"
        aria-label="Band share of the delta's energy in the exact band's runs"
        className="mt-3 block text-neutral-900 dark:text-neutral-100"
      >
        <YAxis
          scale={yS}
          ticks={logTicks(shareMin / 1.5, shareMax * 1.5).filter((t) =>
            Number.isInteger(Math.log10(t)),
          )}
          x={m.l}
          right={width - m.r}
          label="band share"
          format={(v) => `10${sup(Math.round(Math.log10(v)))}`}
        />
        <XAxis
          scale={xShare}
          ticks={[0, 1000, 2000, 3000]}
          y={160 - m.b}
          top={m.t}
          label="training step (exact band, C 1-D 256)"
          format={int}
        />
        <path
          d={path(
            share.step.slice(0, sk + 1).map(xShare),
            share.value.slice(0, sk + 1).map(yS),
          )}
          fill="none"
          stroke={KIND_COLOUR.C}
          strokeWidth={2.25}
        />
      </svg>
    </div>
  );

  return (
    <AnimationPanel
      title="What the optics did over training"
      summary="Loss and clipping for the first design and the repaired one at the same ENOB and planes (one seed each), and the band's share of the delta."
      kicker="Animated · replayed from the run logs"
      stepper={stepper}
      stepLabel="evaluation"
      caption={caption}
      visual={visual}
      testId={testId}
      params={
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
            ENOB and planes
          </span>
          <select
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
            className="focus-ring h-11 rounded border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-950"
          >
            {settings.map((s) => {
              const [e, p] = s.split("|");
              return (
                <option key={s} value={s}>
                  ENOB {e}, {p} planes
                </option>
              );
            })}
          </select>
        </label>
      }
    />
  );
}
