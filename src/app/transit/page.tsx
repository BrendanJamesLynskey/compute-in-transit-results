import type { Metadata } from "next";

import { StepEq, StreamEq } from "@/components/mdx/equations";
import { Callout } from "@/components/ui/Callout";
import { A, Main, PageHeader, Section } from "@/components/ui/Page";
import {
  BreakEven,
  StageBars,
  TransitExplorer,
} from "@/components/widgets/lazy";
import type { RecordedPoint } from "@/components/widgets/TransitExplorer";
import { simMd, simResults } from "@/lib/data/load";
import { fixed } from "@/lib/format";
import { section, tableAfter } from "@/lib/md";
import { breakEven, simCell } from "@/lib/quote";
import { deck, fileAt, MODULE_PAPER, SIM_REPO } from "@/lib/site";
import {
  SETUP,
  TARGETS,
  TRANSIT,
  VARIANT_NAME,
  VARIANTS,
  type ModuleKey,
  type Variant,
} from "@/lib/transit/model";
import { BASE, TOPOLOGY_PRESETS } from "@/lib/transit/presets";

export const metadata: Metadata = {
  title: "The simulation",
  description:
    "Training_Transit_Sim live: time to a target loss against WAN bandwidth for six ways of syncing, the photonic link module's stages, break-even curves and the energy split.",
};

const COMMIT = "c6de1f4019547050ae7bacbb4ab13f9d9ee9586c";

function recorded(): RecordedPoint[] {
  const sim = simResults();
  const out: RecordedPoint[] = [];
  for (const [name, byTopo] of Object.entries(sim.time_to_target)) {
    const m = /^(.*?)(?: \[(low|high|free)\])?$/.exec(name)!;
    const v = VARIANTS.find((x) => VARIANT_NAME[x] === m[1]) as Variant;
    for (const p of TOPOLOGY_PRESETS) {
      const t = byTopo[p.name];
      if (!t || t.seconds === null || p.dcs === 1) continue;
      out.push({
        variant: v,
        module: TRANSIT.includes(v) ? (m[2] as ModuleKey) : null,
        dcs: p.dcs,
        bw: p.bw,
        seconds: t.seconds,
        topology: p.name,
      });
    }
  }
  return out;
}

export default function TransitPage(): JSX.Element {
  const target = fixed(TARGETS[0]![0], 3);
  const md = simMd();
  const illustrative =
    /\*\*Measured, assumed and illustrative\.\*\* ([^\n]+)/.exec(md)![1]!;
  const stagesLine = /One worker's dense delta through the module[^\n]+/.exec(
    md,
  )![0];
  const unbound = /stops being its bottleneck[^\n]*?at \*\*([^*]+)\*\*/.exec(
    md,
  )![1]!;
  const t7a = tableAfter(md, "### 7a.");
  const said = section(md, "## 11. What this says")
    .split("\n")
    .filter((l) => l.startsWith("* "))
    .map((l) => l.slice(2).replace(/\*\*/g, ""));
  const pluggable = breakEven(
    VARIANT_NAME["band-pluggable"],
    VARIANT_NAME.adamw,
    "free",
    "E",
  );

  return (
    <Main>
      <PageHeader
        kicker="The simulation"
        title="When does computing the band in transit pay?"
      >
        <p>
          <a className={A} href={SIM_REPO}>
            Training_Transit_Sim
          </a>{" "}
          is a SimPy model of data-parallel training across data centres. It
          takes the experiment&apos;s bytes per step and its measured steps to a
          loss, and asks how long, and how much energy, each way of syncing
          needs to reach {target} with {SETUP.workers} workers. The module is a
          photonic link module (
          <a className={A} href={MODULE_PAPER}>
            arXiv:2608.21536
          </a>
          ) modelled as a link kernel: a port, the optics, a compute budget and
          an FPGA stage.
        </p>
      </PageHeader>

      <Callout kind="hypothetical">
        <p>
          Six variants: A (AdamW, dense all-reduce), B (DeMo top-k, all-gather)
          and C (the fixed band on the GPU, all-gather) as measured; E, the band
          computed by each worker&apos;s pluggable module, then all-gathered
          (E&apos;s runs, one seed per ENOB); and two that were never run, which
          reuse measured steps because summing the band gives the same update as
          gathering it: C′, the band ring all-reduced by the GPUs, and E′, the
          band computed and summed at each data centre&apos;s switch, each
          worker&apos;s own band looped back.
        </p>
      </Callout>

      <Section id="explorer" title="Time to the target against WAN bandwidth">
        <p>
          The curves are the simulation&apos;s closed forms, ported to
          TypeScript and run in your browser; the dots are its recorded points,
          which the curves pass through (the port reproduces every recorded cell
          of its results.md: step times, times to the target, hot spots, energy
          and break-evens). Press play to sweep the bandwidth.
        </p>
        <TransitExplorer
          recorded={recorded()}
          equation={<StepEq />}
          testId="explorer"
        />
      </Section>

      <Section id="module" title="Inside the module: the slowest stage wins">
        <p>
          A stream through the module passes four pipelined stages, and the
          slowest sets its rate. With the optical transform charged against a
          compute budget in the series&apos; bracket of tens of GFLOP/s, the
          budget is the bottleneck; it stops binding at {unbound}, above which
          the optics does. {stagesLine}
        </p>
        <StageBars equation={<StreamEq />} testId="stages" />
      </Section>

      <Section id="break-even" title="Break-even curves">
        <p>
          Where two variants take equally long to reach {target}. The pluggable
          all-gather never breaks even with AdamW ({pluggable[4]}); summing in
          the network can, below a few GB/s of WAN, and the margin depends on
          whether E&apos;s fewer steps (the hypothesis) are real.
        </p>
        <BreakEven testId="breakeven" />
        <details className="my-4 min-w-0 text-sm">
          <summary className="focus-ring min-h-11 cursor-pointer rounded py-2 font-medium">
            Every break-even of results.md section 7a ({t7a.rows.length} rows)
          </summary>
          <div
            className="min-w-0 overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Break-even table"
          >
            <table className="text-xs">
              <thead>
                <tr>
                  {t7a.header.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t7a.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Section>

      <Section id="what-it-says" title="What the simulation says">
        <ul>
          {said.map((s) => (
            <li key={s.slice(0, 40)}>{s}</li>
          ))}
        </ul>
        <p>
          Energy on {BASE}: the devices dominate. AdamW uses{" "}
          {simCell("## 5. Energy", VARIANT_NAME.adamw, "Energy to target (kJ)")}{" "}
          kJ to {target}; E′ with the transform not charged uses{" "}
          {simCell(
            "## 5. Energy",
            `${VARIANT_NAME["band-switch"]} [free]`,
            "Energy to target (kJ)",
          )}{" "}
          kJ, its modules{" "}
          {simCell(
            "## 5. Energy",
            `${VARIANT_NAME["band-switch"]} [free]`,
            "Module share",
          )}{" "}
          of it.
        </p>
        <Callout kind="illustrative">
          <p>{illustrative.replace(/\*\*/g, "")}</p>
        </Callout>
        <Callout kind="deeper">
          <p>
            The simulation as slides:{" "}
            <a className={A} href={deck("CiT_05_Training_Transit_Simulation")}>
              CiT 05, training transit, simulated
            </a>
            . Its recorded results:{" "}
            <a
              className={A}
              href={fileAt(SIM_REPO, COMMIT, "examples/results.md")}
            >
              examples/results.md
            </a>
            .
          </p>
        </Callout>
      </Section>
    </Main>
  );
}
