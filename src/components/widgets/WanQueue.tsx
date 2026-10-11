"use client";

/**
 * Queueing on a shared WAN (results.md section 9): each variant's mean step
 * time as other jobs' traffic loads the inter-DC links, stepped from no load
 * to 0.9 of their capacity. The frames are the simulation's recorded
 * discrete-event runs (results.json `background`), not the closed forms: the
 * closed forms cannot see queueing, so the port cannot reproduce them. The
 * closed form is drawn as a tick on every bar; at zero load the bar meets it.
 */
import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { useWidth } from "@/components/viz/useWidth";
import { fixed, pyG } from "@/lib/format";
import { VARIANT_COLOUR } from "@/lib/viz/palette";
import { log } from "@/lib/viz/scale";

export type QueueRow = {
  key: string;
  /** "A", "C′ (hypothetical)", … */
  label: string;
  analytic: number;
  loads: number[];
  step: number[];
  hypothetical: boolean;
};

export default function WanQueue({
  rows,
  testId,
}: {
  rows: QueueRow[];
  testId: string;
}): JSX.Element {
  const loads = rows[0]!.loads;
  const stepper = useStepper(loads.length, { stepMs: 1100 });
  const [ref, width] = useWidth();
  const i = stepper.step;
  const load = loads[i]!;

  const labelW = 104;
  const valW = 64;
  const barW = Math.max(80, width - labelW - valW);
  const x = log(0.5, 50, 0, barW); // milliseconds
  const rowH = 34;
  const H = rows.length * rowH + 30;

  const worst = rows.reduce((a, r) =>
    r.step[i]! / r.analytic > a.step[i]! / a.analytic ? r : a,
  );
  const least = rows.reduce((a, r) =>
    r.step[i]! / r.analytic < a.step[i]! / a.analytic ? r : a,
  );
  const caption =
    load === 0
      ? `No background traffic: every simulated step equals its closed form (${rows
          .map(
            (r) => `${r.label.split(" ")[0]} ${fixed(r.step[i]! * 1e3, 3)} ms`,
          )
          .join(", ")}).`
      : `Background load ${pyG(load, 3)} of the WAN: ${worst.label.split(" ")[0]}'s step grows most, to ${fixed(
          worst.step[i]! * 1e3,
          3,
        )} ms (${fixed(worst.step[i]! / worst.analytic, 2)}x its closed form); ${least.label.split(" ")[0]}'s least, to ${fixed(
          least.step[i]! * 1e3,
          3,
        )} ms (${fixed(least.step[i]! / least.analytic, 2)}x).`;

  const visual = (
    <div ref={ref} className="min-w-0">
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Mean step time per variant at a background WAN load of ${load}`}
        className="block text-neutral-900 dark:text-neutral-100"
      >
        {(barW < 260 ? [0.5, 5, 50] : [0.5, 1, 2, 5, 10, 20, 50]).map((v) => (
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
              textAnchor={v === 50 ? "end" : "middle"}
              fill="currentColor"
            >
              {pyG(v, 3)} ms
            </text>
          </g>
        ))}
        {rows.map((r, k) => {
          const v = r.step[i]! * 1e3;
          const y = 4 + k * rowH;
          const c = VARIANT_COLOUR[r.key]!;
          return (
            <g key={r.key} data-variant={r.key}>
              <text
                x={labelW - 6}
                y={y + 16}
                fontSize={12}
                textAnchor="end"
                fill="currentColor"
              >
                {r.label}
              </text>
              <rect
                x={labelW}
                y={y}
                width={Math.max(1, x(Math.max(0.5, v)))}
                height={22}
                fill={c}
                fillOpacity={r.hypothetical ? 0.35 : 0.85}
                stroke={c}
                strokeWidth={1.5}
                strokeDasharray={r.hypothetical ? "4 3" : undefined}
              />
              {/* the closed form: what the analytic model says at any load */}
              <line
                x1={labelW + x(r.analytic * 1e3)}
                x2={labelW + x(r.analytic * 1e3)}
                y1={y - 3}
                y2={y + 25}
                stroke="currentColor"
                strokeWidth={2}
              />
              <text
                x={labelW + barW + 4}
                y={y + 16}
                fontSize={12}
                fill="currentColor"
                className="font-mono"
              >
                {fixed(v, 3)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
        Bars: the simulated mean step (ms) at this load. Black tick: the closed
        form. Dashed: hypothetical variants (never run).
      </p>
    </div>
  );

  return (
    <AnimationPanel
      title="A shared WAN: the step grows as other traffic queues"
      summary="Mean step over 200 syncs on 2 DC x 4, 100 GbE, as background traffic (1 MB transfers, Poisson) loads each inter-DC link."
      kicker="Animated · recorded by the discrete-event engine"
      stepper={stepper}
      stepLabel="load"
      countFrom={0}
      caption={caption}
      visual={visual}
      testId={testId}
    />
  );
}
