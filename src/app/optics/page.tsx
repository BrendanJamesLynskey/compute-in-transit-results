import type { Metadata } from "next";

import { FeedbackEq, NoiseEq } from "@/components/mdx/equations";
import { Callout } from "@/components/ui/Callout";
import { A, Main, PageHeader, Section } from "@/components/ui/Page";
import { DotPlot, type DotRow } from "@/components/viz/DotPlot";
import { ClipTimeline, FeedbackLoop } from "@/components/widgets/lazy";
import { experimentResults, runsFile } from "@/lib/data/load";
import { clipProps } from "@/lib/experiment/props";
import { energyOverTraining, shortLabel } from "@/lib/experiment/series";
import { fixed, pyG, trim } from "@/lib/format";
import { G, loss, lossSd, row } from "@/lib/quote";
import { deck, EXPERIMENT_REPO, fileAt } from "@/lib/site";
import { KIND_COLOUR } from "@/lib/viz/palette";

export const metadata: Metadata = {
  title: "The emulated optics",
  description:
    "Why the first emulated-optics runs diverged, the error-feedback fix (feed back what was sent), and how the repaired band depends on ENOB and bit planes.",
};

const COMMIT = "b1f62d394ac79250df9ce555d3a55d85cf1cd517";

export default function OpticsPage(): JSX.Element {
  const runs = runsFile().runs;
  const rows = experimentResults().rows.filter((r) => r.variant === "optics");
  const configOf = (group: string) =>
    runs.find((r) => r.group === group)!.config;
  const share = energyOverTraining(runs, "band/1d/256");
  const shareVals = share.energy["delta/all/low"]!.map((v) => v!);
  const exact = row(G.C1d256);
  const control = row(G.Ectrl);

  // first design against repaired, per ENOB and planes
  const first = rows.filter((r) =>
    r.label.includes("feedback of the exact band"),
  );
  const pairs: DotRow[] = first.flatMap((r) => {
    const c = configOf(r.group);
    const fixedLabel = r.label.replace(
      "full scale fixed, feedback of the exact band",
      "full scale re-set every 100 steps, feedback of the band sent",
    );
    const rep = rows.find((x) => x.label === fixedLabel)!;
    const title = `ENOB ${c.enob}, ${c.planes} planes`;
    return [
      {
        key: `${r.group}-first`,
        label: title,
        note: "first design",
        value: r.final_val,
        colour: KIND_COLOUR.E0,
        text: fixed(r.final_val, 3),
      },
      {
        key: `${r.group}-rep`,
        label: title,
        note: "repaired",
        value: rep.final_val,
        colour: KIND_COLOUR.E,
        text: fixed(rep.final_val, 3),
      },
    ];
  });
  const enobRows: DotRow[] = [
    G.E6,
    G.E8,
    G.E10,
    G.E12,
    G.E8p4,
    G.E8p12,
    G.E8fixed,
  ].map((id) => {
    const r = row(id);
    return {
      key: id,
      label: shortLabel(configOf(id)).replace("E · ", ""),
      value: r.final_val,
      colour: KIND_COLOUR.E,
      text: fixed(r.final_val, 3),
      hollow: true,
    };
  });

  return (
    <Main>
      <PageHeader
        kicker="The emulated optics"
        title="Why the first optics runs diverged, and the fix"
      >
        <p>
          Variant E computes the fixed band with an emulated optical transform:
          each value quantised to P bit planes against a full scale, each plane
          through the transform with readout noise at a given ENOB, the planes
          recombined. As first designed, all six E runs diverged while the same
          band computed exactly trained normally. The cause was error feedback,
          and the fix is to feed back what was actually sent.
        </p>
      </PageHeader>

      <Section id="loop" title="The loop">
        <FeedbackEq />
        <FeedbackLoop testId="feedback" />
        <p>
          In an all-gather every worker receives every worker&apos;s values, its
          own included, so a sender can see what the optics produced for its own
          data and remove that from its delta. That is feeding back the band
          sent. The full scale can also be re-set from the delta&apos;s mean
          square, a sum of squares, which needs no comparisons either.
        </p>
      </Section>

      <Section id="runs" title="What it did over training">
        <ClipTimeline
          runs={clipProps()}
          share={{ step: share.step, value: shareVals }}
          testId="clip"
        />
        <p>
          The residual is what the optics actually sees. Error feedback removes
          the band from the delta every step and keeps the rest, so in the exact
          band&apos;s own runs the band&apos;s share of the delta&apos;s energy
          falls from {pyG(shareVals[0]!, 2)} at the first diagnostic to{" "}
          {pyG(shareVals.at(-1)!, 2)} at the last. The input range is set by a
          quantity that is never sent; a full scale fixed at the end of
          calibration goes stale, and the quantisation and clipping errors
          repeat almost identically from step to step: a bias, not noise that
          averages out.
        </p>
        <DotPlot
          rows={pairs}
          domain={[2.5, 800]}
          logScale
          ticks={[3, 10, 30, 100, 300]}
          format={(v) => trim(v, 3)}
          refs={[
            {
              value: exact.final_val,
              label: `C, the exact band, 1-D 256 (${lossSd(G.C1d256)})`,
            },
          ]}
          axisLabel="final validation loss (log; one seed each)"
          testId="first-vs-repaired"
        />
      </Section>

      <Section id="enob" title="ENOB and bit planes, repaired">
        <NoiseEq />
        <p>
          With feedback of the band sent every run trains and clipping stays
          low. Below ENOB 8 the noise costs loss; four planes cost more than
          eight; twelve gain nothing. The perfect-optics control (no
          quantisation, no noise: C with power-of-2 chunks) ends at{" "}
          {loss(G.Ectrl)}.
        </p>
        <DotPlot
          rows={enobRows}
          domain={[2.7, 3.5]}
          ticks={[2.8, 3, 3.2, 3.4]}
          format={(v) => fixed(v, 1)}
          refs={[
            {
              value: exact.final_val,
              lo: exact.final_val - exact.final_val_sd,
              hi: exact.final_val + exact.final_val_sd,
              label: `C, the exact band, 1-D 256: ${lossSd(G.C1d256)} (shaded: ± sd)`,
            },
            {
              value: control.final_val,
              label: `E, perfect optics (control): ${loss(G.Ectrl)}`,
            },
          ]}
          axisLabel="final validation loss (one seed each)"
          testId="enob"
        />
        <Callout kind="hypothesis">
          <p id="hypothesis">
            From ENOB 8 up, the repaired optics band ends below the exact band
            it emulates ({loss(G.E10)} at ENOB 10 against {lossSd(G.C1d256)}).
            Every E run is a single seed. The experiment&apos;s note offers a
            hypothesis, untested: quantisation and clipping are non-linear, so
            the values sent carry a little of the large out-of-band residual,
            and feeding them back lets some out-of-band information reach the
            model. On TinyShakespeare the repaired optics ended slightly above
            the exact band. Testing it would take several seeds.
          </p>
        </Callout>
        <p>
          None of this rescues the fixed band: the best optics run (
          {loss(G.E10)}) is still far above top-k ({lossSd(G.B)}).
        </p>
        <Callout kind="deeper">
          <p>
            The full diagnosis, with the CPU check on TinyShakespeare that
            isolated it:{" "}
            <a
              className={A}
              href={fileAt(
                EXPERIMENT_REPO,
                COMMIT,
                "docs/optics_investigation.md",
              )}
            >
              docs/optics_investigation.md
            </a>
            . As slides:{" "}
            <a className={A} href={deck("CiT_04_Fixed_Band_Experiment")}>
              CiT 04
            </a>
            .
          </p>
        </Callout>
      </Section>
    </Main>
  );
}
