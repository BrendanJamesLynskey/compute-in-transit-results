/**
 * A dot (or bar) plot in HTML and CSS: one row per item, positioned in
 * percent, so it stays readable at any width without measuring it. Server
 * Component: the static charts of the results (final losses, ENOB, the
 * simulation's times) are rendered at build time.
 */
import type { ReactNode } from "react";

export type DotRow = {
  key: string;
  label: ReactNode;
  value: number;
  lo?: number;
  hi?: number;
  colour: string;
  /** Right-hand text (the value as results.md prints it, usually). */
  text: string;
  note?: string;
  /** Hollow marker (a hypothetical or single-seed value). */
  hollow?: boolean;
};

export type DotRef = { value: number; label: string; lo?: number; hi?: number };

export function DotPlot({
  rows,
  domain,
  logScale = false,
  refs = [],
  bars = false,
  axisLabel,
  ticks,
  format,
  testId,
}: {
  rows: DotRow[];
  domain: [number, number];
  logScale?: boolean;
  refs?: DotRef[];
  bars?: boolean;
  axisLabel: string;
  ticks: number[];
  format: (v: number) => string;
  testId?: string;
}): JSX.Element {
  const frac = (v: number) => {
    const [a, b] = domain;
    const t = logScale
      ? (Math.log10(v) - Math.log10(a)) / (Math.log10(b) - Math.log10(a))
      : (v - a) / (b - a);
    return Math.max(0, Math.min(1, t));
  };
  const pos = (v: number) => `${(100 * frac(v)).toFixed(2)}%`;
  // edge tick labels align inwards, so they never widen the page
  const shift = (v: number) =>
    frac(v) < 0.08 ? "0" : frac(v) > 0.92 ? "-100%" : "-50%";
  return (
    <div className="my-6 min-w-0" data-testid={testId}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.key}
            className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-center sm:gap-3"
          >
            <div className="min-w-0 text-sm text-neutral-800 dark:text-neutral-200">
              {r.label}
              {r.note && (
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                  {r.note}
                </span>
              )}
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative h-6 min-w-0 flex-1 rounded bg-neutral-100 dark:bg-neutral-900">
                {refs.map((f) =>
                  f.lo !== undefined && f.hi !== undefined ? (
                    <span
                      key={`b${f.label}`}
                      aria-hidden="true"
                      className="absolute inset-y-0 bg-neutral-400/30"
                      style={{
                        left: pos(f.lo),
                        width: `calc(${pos(f.hi)} - ${pos(f.lo)})`,
                      }}
                    />
                  ) : null,
                )}
                {refs.map((f) => (
                  <span
                    key={f.label}
                    aria-hidden="true"
                    className="absolute inset-y-0 w-px bg-neutral-700 dark:bg-neutral-300"
                    style={{ left: pos(f.value) }}
                  />
                ))}
                {bars ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1 left-0 rounded-sm"
                    style={{
                      width: pos(r.value),
                      background: r.colour,
                      opacity: r.hollow ? 0.55 : 1,
                    }}
                  />
                ) : (
                  <>
                    {r.lo !== undefined && r.hi !== undefined && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1/2 h-0.5 -translate-y-1/2"
                        style={{
                          left: pos(r.lo),
                          width: `calc(${pos(r.hi)} - ${pos(r.lo)})`,
                          background: r.colour,
                        }}
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                      style={{
                        left: pos(r.value),
                        borderColor: r.colour,
                        background: r.hollow ? "transparent" : r.colour,
                      }}
                    />
                  </>
                )}
              </div>
              <span className="w-28 shrink-0 text-right font-mono text-xs text-neutral-800 dark:text-neutral-200">
                {r.text}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-3">
        <span className="hidden sm:block" />
        <div className="flex min-w-0 items-start gap-2">
          <div className="relative h-8 min-w-0 flex-1 text-[0.7rem] text-neutral-500 dark:text-neutral-400">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute whitespace-nowrap"
                style={{ left: pos(t), transform: `translateX(${shift(t)})` }}
              >
                {format(t)}
              </span>
            ))}
            <span className="absolute inset-x-0 top-4 text-center">
              {axisLabel}
            </span>
          </div>
          <span className="w-28 shrink-0" />
        </div>
      </div>
      {refs.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-neutral-600 dark:text-neutral-400">
          {refs.map((f) => (
            <li key={f.label}>│ {f.label}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
