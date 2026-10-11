/**
 * The steps-to-loss ladder (results.md section 1) as a picture: for each
 * target loss, the configurations that reach it, as bars of the steps they
 * need (mean over seeds, the first evaluation at or below the target), with
 * results.md's cell beside each. Server Component; the cells are recomputed
 * from the run logs and checked against results.md in the unit tests.
 */
import { DotPlot } from "@/components/viz/DotPlot";
import type { LadderRow } from "@/lib/experiment/props";
import { fixed, int } from "@/lib/format";
import { KIND_COLOUR } from "@/lib/viz/palette";

export function Ladder({
  targets,
  rows,
  maxSteps,
}: {
  targets: { loss: number; letter: string }[];
  rows: LadderRow[];
  maxSteps: number;
}): JSX.Element {
  return (
    <div className="space-y-8" data-testid="ladder">
      {targets.map((t, j) => {
        const reach = rows
          .filter((r) => r.steps[j] !== null)
          .sort((a, b) => a.steps[j]! - b.steps[j]!);
        const miss = rows.filter((r) => r.steps[j] === null);
        return (
          <div key={t.loss} className="min-w-0">
            <h3 className="text-base font-semibold">
              To {fixed(t.loss, 3)}{" "}
              <span className="font-normal text-neutral-600 dark:text-neutral-400">
                ({t.letter}&apos;s mean final loss)
              </span>
            </h3>
            {reach.length > 0 ? (
              <DotPlot
                bars
                rows={reach.map((r) => ({
                  key: r.id,
                  label: r.short,
                  value: r.steps[j]!,
                  colour: KIND_COLOUR[r.kind],
                  text: r.cells[j]!,
                  hollow: r.kind === "E" || r.kind === "Ec" || r.kind === "F",
                }))}
                domain={[0, maxSteps]}
                ticks={[0, 1000, 2000, 3000].filter((x) => x <= maxSteps)}
                format={int}
                axisLabel="steps (payload per worker in brackets; hollow: one seed)"
              />
            ) : null}
            {miss.length > 0 && (
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Not reached by every seed in {int(maxSteps)} steps:{" "}
                {miss.map((r) => r.short).join("; ")}.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
