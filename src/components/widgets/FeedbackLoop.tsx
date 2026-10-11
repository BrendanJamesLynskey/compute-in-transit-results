"use client";

/**
 * The error-feedback loop of one DeMo step on one worker, with the band
 * computed by the emulated optics, stage by stage, in the two designs the
 * experiment ran: feedback of the exact band (the first design, which
 * diverged) and feedback of the band sent (the fix). A schematic of the
 * order of operations (the experiment's experiment/train.py and
 * docs/optics_investigation.md); the numbers are in the charts below it.
 */
import { useState } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Segmented } from "@/components/ui/Controls";

type Mode = "exact" | "sent";

const STAGES: {
  title: string;
  body: Record<Mode, string>;
  caption: Record<Mode, string>;
}[] = [
  {
    title: "Delta",
    body: { exact: "Δ = momentum + residual", sent: "Δ = momentum + residual" },
    caption: {
      exact:
        "The worker's delta: its momentum plus the residual error feedback has kept from earlier steps. Late in training it is almost all residual.",
      sent: "The worker's delta: its momentum plus the residual error feedback has kept from earlier steps. Late in training it is almost all residual.",
    },
  },
  {
    title: "Full scale",
    body: {
      exact: "fixed once: κ × RMS(Δ), then clip",
      sent: "re-set from the mean square, then clip",
    },
    caption: {
      exact:
        "The input full scale was set once, at the end of calibration. The residual keeps growing, so the inputs soon saturate.",
      sent: "The full scale is re-set every 100 steps from the delta's mean square (multiply-accumulates only), so few inputs clip.",
    },
  },
  {
    title: "Bit planes through the optics",
    body: {
      exact: "P planes, transform, readout noise at the ENOB",
      sent: "P planes, transform, readout noise at the ENOB",
    },
    caption: {
      exact:
        "Each value enters as P binary bit planes; each plane passes through the optical transform and is read out with noise at the given ENOB, then recombined.",
      sent: "Each value enters as P binary bit planes; each plane passes through the optical transform and is read out with noise at the given ENOB, then recombined.",
    },
  },
  {
    title: "Band out",
    body: {
      exact: "b̂ = the optics' band (with its errors)",
      sent: "b̂ = the optics' band (with its errors)",
    },
    caption: {
      exact:
        "Out comes b̂: the fixed band as the optics computed it, quantisation, clipping and noise included.",
      sent: "Out comes b̂: the fixed band as the optics computed it, quantisation, clipping and noise included.",
    },
  },
  {
    title: "All-gather",
    body: {
      exact: "every worker receives every b̂, its own too",
      sent: "every worker receives every b̂, its own too",
    },
    caption: {
      exact:
        "The all-gather sends b̂ to every worker. The update every worker applies is built from b̂, not from the exact band.",
      sent: "The all-gather sends b̂ to every worker, the sender included: so the sender can see exactly what it sent.",
    },
  },
  {
    title: "Error feedback",
    body: {
      exact: "residual ← Δ − b  (the exact band)",
      sent: "residual ← Δ − b̂  (the band sent)",
    },
    caption: {
      exact:
        "The sender removes the exact band b, believing it sent b. The difference b − b̂ is never fed back: a nearly identical error every step, and DeMo applies the sign of the update, so it pushes the same way step after step.",
      sent: "The sender removes b̂, what was actually sent. The optics' errors stay in the residual and are sent on later steps, like any other part of the delta.",
    },
  },
];

export default function FeedbackLoop({
  testId,
}: {
  testId: string;
}): JSX.Element {
  const [mode, setMode] = useState<Mode>("exact");
  const stepper = useStepper(STAGES.length, { stepMs: 1600, resetKey: mode });
  const k = stepper.step;
  const visual = (
    <ol
      className="grid min-w-0 gap-2 sm:grid-cols-3"
      aria-label="The error-feedback loop"
    >
      {STAGES.map((s, i) => {
        const active = i === k;
        const done = i < k;
        const bad = mode === "exact" && i === STAGES.length - 1;
        return (
          <li
            key={s.title}
            data-stage={i}
            data-active={active ? "true" : "false"}
            className={`min-w-0 rounded border p-3 text-sm transition-colors ${
              active
                ? bad
                  ? "border-[#D55E00] bg-[#D55E00]/10 ring-2 ring-[#D55E00]"
                  : "border-[#0072B2] bg-[#0072B2]/10 ring-2 ring-[#0072B2]"
                : done
                  ? "border-neutral-300 opacity-70 dark:border-neutral-700"
                  : "border-neutral-200 dark:border-neutral-800"
            }`}
          >
            <p className="font-mono text-[0.7rem] text-neutral-700 dark:text-neutral-300">
              {i + 1} · {s.title}
              {i === STAGES.length - 1 ? " ↺ back to 1" : " →"}
            </p>
            <p className="mt-1 break-words font-medium text-neutral-900 dark:text-neutral-100">
              {s.body[mode]}
            </p>
          </li>
        );
      })}
    </ol>
  );
  return (
    <AnimationPanel
      title="Error feedback through the optics"
      summary="One DeMo step on one worker, with the band computed by the emulated optics: the first design against the fix."
      kicker="Stepped · the order of operations in one step"
      stepper={stepper}
      stepLabel="stage"
      caption={STAGES[k]!.caption[mode]}
      visual={visual}
      testId={testId}
      params={
        <Segmented
          label="Error feedback removes"
          value={mode}
          options={[
            { value: "exact", label: "the exact band (first design)" },
            { value: "sent", label: "the band sent (the fix)" },
          ]}
          onChange={setMode}
        />
      }
    />
  );
}
