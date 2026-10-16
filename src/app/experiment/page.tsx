import type { Metadata } from "next";
import Link from "next/link";

import { Ladder } from "@/components/charts/Ladder";
import { WireEq } from "@/components/mdx/equations";
import { Callout } from "@/components/ui/Callout";
import { A, Main, PageHeader, Section } from "@/components/ui/Page";
import { DotPlot } from "@/components/viz/DotPlot";
import { LossCurves } from "@/components/widgets/lazy";
import { experimentMd } from "@/lib/data/load";
import { allGroups, ladderProps, lossSeries } from "@/lib/experiment/props";
import { fixed, int } from "@/lib/format";
import { expCell, G, lossSd, mb, row } from "@/lib/quote";
import { deck, EXPERIMENT_REPO } from "@/lib/site";
import { KIND_COLOUR } from "@/lib/viz/palette";
import { withShare } from "@/lib/share";

export const metadata: Metadata = withShare("/experiment", {
  title: "The experiment",
  description:
    "Validation-loss curves for every configuration of the fixed-band DeMo experiment, toggleable with seed bands; loss against cumulative wire bytes; the steps-to-loss ladder.",
});

export default function ExperimentPage(): JSX.Element {
  const md = experimentMd();
  const setup = /Model: ([^\n]+?)\. Data: ([^\n]+?)\.\n/.exec(md)!;
  const series = lossSeries((g) => g.kind !== "E0");
  const groups = allGroups();
  const ladder = ladderProps();
  const steps = groups[0]!.runs[0]!.evals.step.at(-1)!;
  const intRow = /Top-k with int64 indices[^\n]+/.exec(md)![0];
  const wireRows = [G.A, G.B, G.C1d256].map((id) => {
    const r = row(id);
    const g = groups.find((x) => x.id === id)!;
    return {
      key: id,
      label: g.short,
      note: `payload ${mb(r.payload_per_step)}, ${fixed(r.ratio_vs_dense, 1)}x less than A`,
      value: r.wire_per_step,
      colour: KIND_COLOUR[g.kind],
      text: `${mb(r.wire_per_step)}`,
    };
  });

  return (
    <Main>
      <PageHeader kicker="The experiment" title="Loss against communication">
        <p>
          A GPT trained with simulated data parallelism: {setup[1]}. Data:{" "}
          {setup[2]}. Every configuration except the optics runs kept the same
          fraction of transform coefficients; they differ in which ones. From
          the run logs of{" "}
          <a className={A} href={EXPERIMENT_REPO}>
            DeMo_Fixed_Band_Experiment
          </a>
          .
        </p>
      </PageHeader>

      <Section id="curves" title="Validation loss, every configuration">
        <p>
          Each line is the mean over its seeds; the shaded band runs from the
          lowest to the highest seed (three seeds for A to D, one for the
          others). Switch the horizontal axis to wire bytes to see loss against
          what each worker has sent. The first optics design, which diverged, is
          on <Link href="/optics">the optics page</Link>.
        </p>
        <LossCurves
          series={series}
          initial={[G.A, G.B, G.C1d256, G.C2d, G.D, G.Frandom]}
          title="Validation loss over training"
          summary="Every completed configuration; mean over seeds, the band from the lowest to the highest seed."
          testId="loss-curves"
        />
      </Section>

      <Section id="bytes" title="What each worker sends">
        <p>
          Bytes per worker per step, BF16 values. AdamW all-reduces the dense
          gradient; the DeMo variants all-gather their compressed values, and an
          all-gather&apos;s wire bytes grow with the number of workers while an
          all-reduce&apos;s do not, so the saving on the wire is smaller than
          the saving in payload.
        </p>
        <WireEq />
        <DotPlot
          bars
          rows={wireRows}
          domain={[0, row(G.A).wire_per_step * 1.05]}
          ticks={[0, 2e7, 4e7]}
          format={(v) => `${fixed(v / 1e6, 0)} MB`}
          axisLabel="wire bytes per worker per step"
          testId="wire"
        />
        <p>
          The fixed band&apos;s payload is{" "}
          {expCell("## 1. Loss", row(G.C1d256).label, "vs dense")} smaller than
          the dense gradient, but its wire bytes only{" "}
          {expCell("## 1. Loss", row(G.C1d256).label, "Wire vs dense")} smaller.{" "}
          {intRow.replace(/^\* /, "")}
        </p>
      </Section>

      <Section id="ladder" title="Steps to reach a loss">
        <p>
          The targets are the final losses of the multi-seed configurations. A
          cell is the first evaluation (every{" "}
          {int(
            groups[0]!.runs[0]!.evals.step[1]! -
              groups[0]!.runs[0]!.evals.step[0]!,
          )}{" "}
          steps) at or below the target, averaged over seeds, shown only when
          every seed gets there. Top-k reaches the fixed band&apos;s final loss
          in a fraction of the steps and bytes; no fixed band reaches
          top-k&apos;s ({lossSd(G.B)}).
        </p>
        <Ladder targets={ladder.targets} rows={ladder.rows} maxSteps={steps} />
        <Callout kind="deeper">
          <p>
            The experiment as slides:{" "}
            <a className={A} href={deck("CiT_04_Fixed_Band_Experiment")}>
              CiT 04, the fixed-band experiment
            </a>
            . Why the band loses is on{" "}
            <Link href="/energy">the energy page</Link>.
          </p>
        </Callout>
      </Section>
    </Main>
  );
}
