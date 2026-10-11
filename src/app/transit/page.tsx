import type { Metadata } from "next";

import { StepEq, StreamEq } from "@/components/mdx/equations";
import { Callout } from "@/components/ui/Callout";
import { A, Main, PageHeader, Section } from "@/components/ui/Page";
import { DotPlot, type DotRow } from "@/components/viz/DotPlot";
import {
  BreakEven,
  StageBars,
  TransitExplorer,
  WanQueue,
} from "@/components/widgets/lazy";
import type { RecordedPoint } from "@/components/widgets/TransitExplorer";
import type { QueueRow } from "@/components/widgets/WanQueue";
import { simMd, simResults } from "@/lib/data/load";
import { fixed, trim } from "@/lib/format";
import { section, tableAfter, type Table } from "@/lib/md";
import { breakEven, simCell } from "@/lib/quote";
import { deck, fileAt, MODULE_PAPER, SIM_REPO } from "@/lib/site";
import {
  EXTRAPOLATE,
  HYPOTHETICAL,
  hotSpot,
  LETTER,
  moduleOf,
  plan,
  SETUP,
  TARGETS,
  timeTo,
  topology,
  TRANSIT,
  VARIANT_NAME,
  VARIANTS,
  type Config,
  type ModuleKey,
  type Variant,
} from "@/lib/transit/model";
import { BASE, preset, TOPOLOGY_PRESETS } from "@/lib/transit/presets";
import { VARIANT_COLOUR } from "@/lib/viz/palette";

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

/** A results.md row name → its variant and module setting. */
function parseName(name: string): { variant: Variant; module: ModuleKey } {
  const m = /^(.*?)(?: \[(low|high|free)\])?$/.exec(name)!;
  const variant = VARIANTS.find((x) => VARIANT_NAME[x] === m[1]) as Variant;
  return { variant, module: (m[2] as ModuleKey | undefined) ?? "high" };
}

function short(v: Variant, module?: ModuleKey): string {
  const tag = TRANSIT.includes(v) && module ? ` [${module}]` : "";
  return `${LETTER[v]}${tag} · ${HYPOTHETICAL.includes(v) ? "hypothetical" : VARIANT_NAME[v].slice(3).split(",")[0]}`;
}

const QUEUE_NAME: Record<Variant, string> = {
  adamw: "AdamW",
  topk: "top-k",
  band: "band",
  "band-pluggable": "pluggable",
  "band-allreduce": "not run",
  "band-switch": "not run",
};

/** Section 9's recorded runs (results.json), for the queueing animation. */
function queueRows(): QueueRow[] {
  return Object.entries(simResults().background).map(([name, b]) => {
    const { variant } = parseName(name);
    return {
      key: variant,
      label: `${LETTER[variant]} · ${QUEUE_NAME[variant]}`,
      analytic: b.analytic,
      loads: b.loads,
      step: b.step,
      hypothetical: HYPOTHETICAL.includes(variant),
    };
  });
}

/** A config on the base topology (results.md section 10). */
function base(variant: Variant, module: ModuleKey): Config {
  const p = preset(BASE);
  return { variant, module: moduleOf(module), topo: topology(p.dcs, p.bw) };
}

function MdTable({ t, label }: { t: Table; label: string }): JSX.Element {
  return (
    <div
      className="mt-4 min-w-0 overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <table className="text-xs">
        <thead>
          <tr>
            {t.header.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  const t9 = tableAfter(md, "## 9. Queueing");
  const q9 = (name: string, col: string) => {
    const j = t9.header.indexOf(col);
    const r = t9.rows.find((x) => x[0] === name);
    if (j < 0 || !r) throw new Error(`results.md 9: no ${name} / ${col}`);
    return r[j]!;
  };
  const t10a = tableAfter(md, "## 10. Extrapolations", 0);
  const t10b = tableAfter(md, "## 10. Extrapolations", 1);
  const q10h = (name: string, col: string) => {
    const j = t10b.header.indexOf(col);
    const r = t10b.rows.find((x) => x[0] === name);
    if (j < 0 || !r) throw new Error(`results.md 10: no ${name} / ${col}`);
    return r[j]!;
  };
  const llama = EXTRAPOLATE.sizes.at(-1)![1]!;
  const sizeRows: DotRow[] = t10a.rows.map((r) => {
    const { variant, module } = parseName(r[0]!);
    const c = { ...base(variant, module), params: llama };
    const t = timeTo(c);
    return {
      key: r[0]!,
      label: short(variant, TRANSIT.includes(variant) ? module : undefined),
      note: `hot spot: ${hotSpot(plan(c))}`,
      value: t,
      colour: VARIANT_COLOUR[variant]!,
      text: `${fixed(t, 0)} s`,
      hollow: HYPOTHETICAL.includes(variant),
    };
  });

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

      <Section id="shared-wan" title="A shared WAN: queueing">
        <p>
          The closed forms assume the WAN is the training job&apos;s alone. The
          simulation&apos;s discrete-event engine can share it: other jobs send
          1 MB transfers at a given fraction of each inter-DC link&apos;s
          capacity, queued first come, first served with the sync. This page
          cannot rerun that (it needs the SimPy engine; the port has only the
          closed forms), so the animation and the table below are the
          simulation&apos;s <strong>recorded</strong> runs, from its
          results.json and results.md section 9, at seed 0.
        </p>
        <WanQueue rows={queueRows()} testId="queue" />
        <p>
          At 0.9 load, AdamW&apos;s step grows from{" "}
          {q9(VARIANT_NAME.adamw, "Closed form (ms)")} ms to{" "}
          {q9(VARIANT_NAME.adamw, "Load 0.9")} ms, because it sends the most
          bytes over the WAN; E′, which sends only the band sum across it, from{" "}
          {q9(`${VARIANT_NAME["band-switch"]} [free]`, "Closed form (ms)")} ms
          to {q9(`${VARIANT_NAME["band-switch"]} [free]`, "Load 0.9")} ms. In
          these runs a busy WAN hurts most the variants that send most across
          it; the closed forms, and so the break-evens above, leave this out.
        </p>
        <details className="my-4 min-w-0 text-sm">
          <summary className="focus-ring min-h-11 cursor-pointer rounded py-2 font-medium">
            results.md section 9, as recorded (mean step in ms)
          </summary>
          <MdTable t={t9} label="Queueing table" />
        </details>
      </Section>

      <Section
        id="extrapolations"
        title="Extrapolations: bigger models, rarer syncs"
      >
        <Callout kind="extrapolation">
          <p>
            Nothing in this section was measured. The experiment ran one model
            size ({fixed(SETUP.params / 1e6, 1)}M parameters), {SETUP.workers}{" "}
            workers and {fixed(SETUP.steps, 0)} steps, syncing every step. Here
            the simulation keeps the measured steps to {target} and changes the
            size or the sync interval: an assumption the experiment did not
            test. Read these as what the model implies if the steps held, not as
            results.
          </p>
        </Callout>
        <h3 className="mt-6 text-base font-semibold">Model size</h3>
        <p>
          Bytes scale with the parameter count by each variant&apos;s measured
          bytes per parameter, and compute with it too. At the Llama-3-8B shape
          ({trim(llama / 1e9, 3)}B parameters, {BASE}) the order is unchanged:
          top-k fastest, the fixed band on the GPU slower than AdamW because it
          needs more steps, and the in-transit variants slowest, bound by the
          module. The E and E′ rows use E&apos;s steps, so they also carry the
          hypothesis (one seed). Chart: computed by the port (the same closed
          forms, at that size); table: results.md&apos;s.
        </p>
        <DotPlot
          rows={sizeRows}
          domain={[300, 10000]}
          logScale
          bars
          ticks={[300, 1000, 3000, 10000]}
          format={(v) => `${trim(v, 3)} s`}
          axisLabel={`EXTRAPOLATED seconds to ${target} at the Llama-3-8B shape, if the measured steps held (log; hollow: hypothetical)`}
          testId="extrapolate-size"
        />
        <MdTable t={t10a} label="Model-size extrapolation table" />
        <h3 className="mt-8 text-base font-semibold">
          Syncing every H steps (DiLoCo-style)
        </h3>
        <p>
          Syncing every H steps instead of every step divides each step&apos;s
          communication by H. The steps to {target} are assumed unchanged, which
          is the larger assumption: DiLoCo also changes the optimiser. On this
          100 GbE WAN, E′ is already slower than AdamW at H = 1 (
          {q10h(`${VARIANT_NAME["band-switch"]} [free]`, "H = 1: time (s)")} s
          against {q10h(VARIANT_NAME.adamw, "H = 1: time (s)")} s); at H = 100
          AdamW takes {q10h(VARIANT_NAME.adamw, "H = 100")} s and E′{" "}
          {q10h(`${VARIANT_NAME["band-switch"]} [free]`, "H = 100")} s. Rarer
          syncs shrink the very communication the band saves, and with it the
          band&apos;s only advantage.
        </p>
        <MdTable t={t10b} label="Sync-interval extrapolation table" />
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
