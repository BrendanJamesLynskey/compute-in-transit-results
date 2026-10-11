"use client";

/**
 * One worker's dense delta through the module: the four pipelined stages
 * (port, optics, compute budget, FPGA), each its time for the whole delta,
 * from the port of Module.stage_times. The slowest stage sets the stream's
 * time. The animation sweeps the compute budget from 1 to 100,000 GFLOP/s.
 */
import { useState, type ReactNode } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Segmented } from "@/components/ui/Controls";
import { useWidth } from "@/components/viz/useWidth";
import { fixed, pyG } from "@/lib/format";
import {
  bandKernel,
  moduleOf,
  plan,
  STAGES,
  stageTimes,
  streamTime,
  topology,
} from "@/lib/transit/model";
import { CATEGORY_COLOUR } from "@/lib/viz/palette";
import { log } from "@/lib/viz/scale";

const BUDGETS = Array.from({ length: 41 }, (_, i) => 1e9 * 10 ** (i / 8));

export default function StageBars({
  equation,
  testId,
}: {
  equation?: ReactNode;
  testId: string;
}): JSX.Element {
  const [planes, setPlanes] = useState("8");
  const [charged, setCharged] = useState<"yes" | "no">("yes");
  const stepper = useStepper(BUDGETS.length, {
    stepMs: 450,
    resetKey: `${planes}|${charged}`,
  });
  const [ref, width] = useWidth();
  const g = BUDGETS[stepper.step]!;
  const pl = Number(planes);
  const m = moduleOf("high", {
    gflops: g,
    planes: pl,
    transform_charged: charged === "yes",
  });
  const dense = plan({
    variant: "band-pluggable",
    topo: topology(2, 12.5e9),
    module: m,
  }).dense;
  const st = stageTimes(m, dense, bandKernel(pl));
  const [t, binding] = streamTime(m, dense, bandKernel(pl));

  const labelW = 112;
  const valW = 78;
  const barW = Math.max(80, width - labelW - valW);
  const x = log(0.1, 1000, 0, barW); // milliseconds
  const rowH = 32;
  const H = STAGES.length * rowH + 30;

  const caption =
    `At ${pyG(g / 1e9, 3)} GFLOP/s${charged === "yes" ? " (transform charged)" : " (transform not charged)"}, ${pl} planes: ` +
    `${binding} binds at ${fixed(st[binding] * 1e3, 3)} ms; ` +
    STAGES.filter((s) => s !== binding)
      .map((s) => `${s} ${fixed(st[s] * 1e3, 3)} ms`)
      .join(", ") +
    `. The stream takes ${fixed(t * 1e3, 3)} ms.`;

  const visual = (
    <div ref={ref} className="min-w-0">
      <svg
        width={width}
        height={H}
        role="img"
        aria-label="Stage times for one dense delta"
        className="block text-neutral-900 dark:text-neutral-100"
      >
        {[0.1, 1, 10, 100, 1000].map((v) => (
          <g key={v} className="text-neutral-500 dark:text-neutral-400">
            <line
              x1={labelW + x(v)}
              x2={labelW + x(v)}
              y1={2}
              y2={H - 22}
              stroke="currentColor"
              strokeOpacity={0.18}
            />
            <text
              x={labelW + x(v)}
              y={H - 8}
              fontSize={11}
              textAnchor="middle"
              fill="currentColor"
            >
              {pyG(v, 3)} ms
            </text>
          </g>
        ))}
        {STAGES.map((s, i) => {
          const v = st[s] * 1e3;
          const y = 4 + i * rowH;
          const on = s === binding;
          return (
            <g key={s} data-stage={s} data-binding={on ? "true" : "false"}>
              <text
                x={labelW - 6}
                y={y + 16}
                fontSize={12}
                textAnchor="end"
                fill="currentColor"
                fontWeight={on ? 700 : 400}
              >
                {s}
              </text>
              {v > 0 ? (
                <rect
                  x={labelW}
                  y={y}
                  width={Math.max(1, x(Math.max(0.1, v)))}
                  height={22}
                  fill={CATEGORY_COLOUR[s]}
                  fillOpacity={on ? 1 : 0.35}
                  stroke={on ? "currentColor" : "none"}
                  strokeWidth={1.5}
                />
              ) : null}
              <text
                x={labelW + barW + 4}
                y={y + 16}
                fontSize={12}
                fill="currentColor"
                className="font-mono"
              >
                {v > 0 ? `${fixed(v, 3)}` : "0"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );

  return (
    <AnimationPanel
      title="The module's stages: the slowest wins"
      summary="One worker's dense BF16 delta (2 bytes per parameter) through a module, stage by stage, as the compute budget grows."
      stepper={stepper}
      stepLabel="budget"
      caption={caption}
      visual={visual}
      equation={equation}
      testId={testId}
      params={
        <>
          <Segmented
            label="Bit planes (optical passes)"
            value={planes}
            options={["4", "8", "12"].map((p) => ({ value: p, label: p }))}
            onChange={setPlanes}
          />
          <Segmented
            label="Transform charged to the budget?"
            value={charged}
            options={[
              { value: "yes", label: "charged" },
              { value: "no", label: "not charged" },
            ]}
            onChange={setCharged}
          />
        </>
      }
    />
  );
}
