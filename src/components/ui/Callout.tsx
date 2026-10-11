/**
 * Boxed asides used on the pages:
 *   prereq       — "read this first";
 *   deeper       — "go deeper": the decks, the repositories, the papers;
 *   illustrative — flags numbers that are illustrative, not measured;
 *   hypothesis   — the repaired optics beating the exact band (one seed per run);
 *   hypothetical — the simulated variants that were never run (C′, E′).
 * Server Component.
 */
import type { ReactNode } from "react";

const STYLES = {
  prereq: {
    label: "Before this",
    cls: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
  },
  deeper: {
    label: "Go deeper",
    cls: "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30",
  },
  illustrative: {
    label: "Illustrative",
    cls: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
  },
  hypothesis: {
    label: "Hypothesis, not a result",
    cls: "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30",
  },
  hypothetical: {
    label: "Hypothetical variants",
    cls: "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30",
  },
} as const;

export function Callout({
  kind,
  children,
}: {
  kind: keyof typeof STYLES;
  children: ReactNode;
}): JSX.Element {
  const s = STYLES[kind];
  return (
    <aside
      data-callout={kind}
      className={`my-6 rounded-lg border px-4 py-3 text-sm ${s.cls}`}
    >
      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
        {s.label}
      </p>
      <div className="callout-body">{children}</div>
    </aside>
  );
}
