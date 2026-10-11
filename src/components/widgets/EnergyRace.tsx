"use client";

/**
 * Captured energy over training: the share of a tensor's energy each
 * selector would keep at the same k (top-k, the fixed low band, zig-zag,
 * high band, a random fixed set, the calibrated band), at every diagnostic
 * of the run logs (worker 0, every 200 steps, mean over seeds). The ticks
 * on the bars are results.md section 2's averages after the warm-up.
 */
import { useState } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Segmented } from "@/components/ui/Controls";
import { useWidth } from "@/components/viz/useWidth";
import type { EnergyProps } from "@/lib/experiment/props";
import { fixed, int, sci } from "@/lib/format";
import { SELECTOR_COLOUR } from "@/lib/viz/palette";

const SELECTORS = [
  ["topk", "top-k"],
  ["low", "low band"],
  ["zigzag", "zig-zag"],
  ["high", "high band"],
  ["random", "random"],
  ["calib", "calibrated"],
] as const;

type Tensor = "momentum" | "delta" | "grad";
type GroupKey = "all" | "attn" | "mlp" | "embed";

function val(v: number): string {
  return v !== 0 && v < 0.001 ? sci(v, 2) : fixed(v, 3);
}

export default function EnergyRace({
  data,
  initialFamily = "band/2d/64",
  testId,
}: {
  data: EnergyProps;
  initialFamily?: string;
  testId: string;
}): JSX.Element {
  const [fam, setFam] = useState(initialFamily);
  const [tensor, setTensor] = useState<Tensor>("momentum");
  const [grp, setGrp] = useState<GroupKey>("all");
  const f = data.families.find((x) => x.key === fam)!;
  const stepper = useStepper(f.step.length, {
    stepMs: 800,
    resetKey: `${fam}|${tensor}|${grp}`,
  });
  const [ref, width] = useWidth();
  const k = stepper.step;

  const sels = SELECTORS.filter(
    ([s]) => f.energy[`${tensor}/${grp}/${s}`] !== undefined,
  );
  const labelW = 86;
  const valueW = 64;
  const barW = Math.max(80, width - labelW - valueW - 8);
  const rowH = 30;
  const H = sels.length * rowH + 34;
  const x = (v: number) => labelW + v * barW;

  const now = (s: string) => f.energy[`${tensor}/${grp}/${s}`]![k] ?? null;
  const top = sels
    .map(([s, name]) => [name, now(s)] as const)
    .filter(([, v]) => v !== null) as [string, number][];
  const caption =
    `Step ${int(f.step[k]!)}, ${f.title}, ${tensor} (${grp}): ` +
    top.map(([n, v]) => `${n} keeps ${val(v)}`).join(", ") +
    (sels.some(([s]) => now(s) === null)
      ? "; the calibrated band is chosen at the end of calibration"
      : "") +
    ".";

  const visual = (
    <div ref={ref} className="min-w-0">
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Captured energy share per selector at step ${f.step[k]}`}
        className="block text-neutral-900 dark:text-neutral-100"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t} className="text-neutral-500 dark:text-neutral-400">
            <line
              x1={x(t)}
              x2={x(t)}
              y1={4}
              y2={H - 26}
              stroke="currentColor"
              strokeOpacity={0.18}
            />
            <text
              x={x(t)}
              y={H - 12}
              fontSize={11}
              textAnchor="middle"
              fill="currentColor"
            >
              {fixed(t, 2)}
            </text>
          </g>
        ))}
        <line
          x1={x(data.keep)}
          x2={x(data.keep)}
          y1={4}
          y2={H - 26}
          stroke="currentColor"
          strokeDasharray="3 3"
          strokeOpacity={0.7}
        />
        {sels.map(([s, name], i) => {
          const v = now(s);
          const avg = data.families.find((z) => z.key === fam)!.average[
            `${tensor}/${grp}/${s}`
          ];
          const y = 6 + i * rowH;
          return (
            <g key={s} data-selector={s}>
              <text
                x={labelW - 6}
                y={y + 15}
                fontSize={12}
                textAnchor="end"
                fill="currentColor"
              >
                {name}
              </text>
              <rect
                x={labelW}
                y={y}
                width={barW}
                height={20}
                fill="currentColor"
                fillOpacity={0.06}
              />
              {v !== null && (
                <rect
                  x={labelW}
                  y={y}
                  width={Math.max(1, v * barW)}
                  height={20}
                  fill={SELECTOR_COLOUR[s]}
                  stroke={s === "random" ? "#525252" : "none"}
                />
              )}
              {avg !== undefined && (
                <line
                  x1={x(avg)}
                  x2={x(avg)}
                  y1={y - 2}
                  y2={y + 22}
                  stroke="currentColor"
                  strokeWidth={2}
                />
              )}
              <text
                x={labelW + barW + 6}
                y={y + 15}
                fontSize={12}
                fill="currentColor"
                className="font-mono"
              >
                {v === null ? "–" : val(v)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
        Dashed line: the keep fraction ({fixed(data.keep, 4)}), about what a
        random set keeps. Black ticks: the average after step {data.after}{" "}
        (results.md, section 2).
      </p>
    </div>
  );

  return (
    <AnimationPanel
      title="Captured energy over training"
      summary="The share of a tensor's energy each selector keeps at the same k, at every diagnostic (worker 0, mean over seeds)."
      kicker="Animated · replayed from the run logs"
      stepper={stepper}
      stepLabel="diagnostic"
      caption={caption}
      visual={visual}
      testId={testId}
      params={
        <>
          <label className="flex min-w-0 flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Runs
            </span>
            <select
              value={fam}
              onChange={(e) => setFam(e.target.value)}
              className="focus-ring h-11 rounded border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-950"
            >
              {data.families.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.title}
                </option>
              ))}
            </select>
          </label>
          <Segmented
            label="Tensor"
            value={tensor}
            options={[
              { value: "momentum", label: "momentum" },
              { value: "delta", label: "delta" },
              { value: "grad", label: "gradient" },
            ]}
            onChange={setTensor}
          />
          <Segmented
            label="Parameters"
            value={grp}
            options={[
              { value: "all", label: "all" },
              { value: "attn", label: "attention" },
              { value: "mlp", label: "MLP" },
              { value: "embed", label: "embedding" },
            ]}
            onChange={setGrp}
          />
        </>
      }
    />
  );
}
