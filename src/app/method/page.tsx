/**
 * /method: the experiment's setup, the simulation's model, every limit and
 * everything illustrative, how the site is checked, and the provenance of
 * the vendored files. Server Component; numbers from the vendored data.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { Callout } from "@/components/ui/Callout";
import { A, Main, PageHeader, Section } from "@/components/ui/Page";
import {
  experimentMd,
  experimentResults,
  runsFile,
  simMd,
  vendored,
} from "@/lib/data/load";
import { fixed, int } from "@/lib/format";
import { G, row } from "@/lib/quote";
import {
  DEMO_PAPER,
  DISAGG_REPO,
  EXPERIMENT_REPO,
  fileAt,
  GITHUB_URL,
  MODULE_PAPER,
  repoFile,
  SIM_REPO,
  TRAINING_URL,
} from "@/lib/site";
import { SETUP } from "@/lib/transit/model";

export const metadata: Metadata = {
  title: "Method and limits",
  description:
    "How the fixed-band experiment and the training-transit simulation were run, what they did not test, what is illustrative, and the vendored files with their commits and SHA-256.",
};

export default function MethodPage(): JSX.Element {
  const emd = experimentMd();
  const smd = simMd();
  const header = emd
    .split("\n")
    .filter(
      (l) => l.startsWith("Hardware:") || l.startsWith("Bytes are per worker"),
    );
  const illustrative = /\*\*Measured, assumed and illustrative\.\*\* ([^\n]+)/
    .exec(smd)![1]!
    .replace(/\*\*/g, "");
  const simSetup = /Setup taken from the experiment: ([^\n]+)/
    .exec(smd)![1]!
    .replace(/\*\*/g, "");
  const v = vendored();
  const rows = experimentResults().rows;
  const evalEvery =
    runsFile().runs[0]!.evals.step[1]! - runsFile().runs[0]!.evals.step[0]!;
  const multi = rows.filter((r) => r.seeds > 1).length;
  const lr = (id: string) =>
    runsFile().runs.find((r) => r.group === id)!.config.lr;

  return (
    <Main>
      <PageHeader
        kicker="Method"
        title="How it was run, and what it does not show"
      >
        <p>
          Two pieces of work: an experiment that trained small GPTs with
          simulated data parallelism, and a simulation that took its
          measurements to data-centre scale. This page has their setups, their
          limits, what is illustrative, and how this site checks that it quotes
          them correctly.
        </p>
      </PageHeader>

      <Callout kind="prereq">
        <p>
          New to training? The Training site (in the Foundations track of the
          companion sites) trains a small decoder in your browser and explains
          every training idea this site uses: start with{" "}
          <a
            className={A}
            href={`${TRAINING_URL}/training/11-data-parallelism`}
          >
            data parallelism and all-reduce
          </a>{" "}
          (chapter 11), then{" "}
          <a className={A} href={`${TRAINING_URL}/training/13-slow-links`}>
            training over slow links
          </a>{" "}
          (chapter 13: top-k with error feedback, DeMo and DiLoCo).
        </p>
      </Callout>

      <Section id="experiment" title="The experiment">
        <p>
          <a className={A} href={EXPERIMENT_REPO}>
            DeMo_Fixed_Band_Experiment
          </a>{" "}
          implements{" "}
          <a className={A} href={DEMO_PAPER}>
            DeMo
          </a>{" "}
          (Peng et al.) with its top-k selection replaced by fixed bands of
          transform coefficients, and a band computed by an emulated optical
          transform, because a photonic link module (Kundu et al.,{" "}
          <a className={A} href={MODULE_PAPER}>
            arXiv:2608.21536
          </a>
          ) lists transforms and arithmetic but no comparisons. From its
          results.md:
        </p>
        {header.map((l) => (
          <blockquote key={l.slice(0, 20)}>{l.replace(/\*/g, "")}</blockquote>
        ))}
        <p>
          Every configuration ran {int(SETUP.steps)} steps on {SETUP.workers}{" "}
          simulated workers, evaluated every {int(evalEvery)} steps. {multi}{" "}
          configurations have three seeds; the rest one. Learning rates came
          from a short sweep on AdamW ({lr(G.A)}) and top-k ({lr(G.B)}), the
          latter reused for every DeMo variant.
        </p>
      </Section>

      <Section id="simulation" title="The simulation">
        <p>
          <a className={A} href={SIM_REPO}>
            Training_Transit_Sim
          </a>{" "}
          is a SimPy discrete-event model with closed forms it must agree with;
          devices and links come from{" "}
          <a className={A} href={DISAGG_REPO}>
            Disaggregated_Inference_Sim
          </a>{" "}
          (pinned at 69ffd2b). {simSetup}
        </p>
        <p>
          This site runs the closed forms only, ported to TypeScript. At zero
          background load the simulation&apos;s discrete-event engine reproduces
          them to rounding, and the port reproduces the engine&apos;s recorded
          results (results.md sections 1 to 8, and the extrapolations of section
          10). The simulation&apos;s queueing on a shared WAN (section 9) needs
          the engine, so the transit page shows its recorded runs instead, and
          says so.
        </p>
      </Section>

      <Section id="limits" title="Limits">
        <ul>
          <li>
            One model size ({int(SETUP.params)} parameters), {SETUP.workers}{" "}
            workers and {int(SETUP.steps)} steps. Steps to a loss were measured
            only there; the simulation&apos;s larger models and DiLoCo-style
            syncing are extrapolations, and the transit page labels them so (
            <Link className={A} href="/transit#extrapolations">
              extrapolations
            </Link>
            ).
          </li>
          <li>
            The learning rate was tuned only on top-k and AdamW, and reused for
            every fixed-band variant. AdamW&apos;s rate ({lr(G.A)}) is the
            higher of the two tried, so AdamW might do slightly better still.
          </li>
          <li>
            Single seeds for E, F and the 1-D 64-point band. That the repaired
            optics band beats the exact band ({fixed(row(G.E10).final_val, 3)}{" "}
            at ENOB 10 against {fixed(row(G.C1d256).final_val, 3)}) is a{" "}
            <Link href="/optics#hypothesis">hypothesis</Link>, so every
            in-transit result is also given on the exact band&apos;s steps.
          </li>
          <li>
            The optics noise model is the series&apos; own, not measured on the
            module.
          </li>
          <li>
            Steps to a loss are resolved to the evaluation interval (
            {int(evalEvery)} steps).
          </li>
          <li>
            In the simulation, compute and communication do not overlap, and a
            pluggable&apos;s processing and its collective run one after the
            other: both conservative for the variants they touch.
          </li>
          <li>
            C′ and E′ were not run: they assume that summing the band gives the
            same update as gathering it.
          </li>
          <li>
            GPU runs are close but not bit-identical between runs, and they ran
            on several GPU types.
          </li>
        </ul>
      </Section>

      <Section id="illustrative" title="What is illustrative">
        <Callout kind="illustrative">
          <p>{illustrative}</p>
        </Callout>
        <p>
          The module&apos;s figures and their sources are listed in the
          simulation&apos;s{" "}
          <a
            className={A}
            href={fileAt(
              SIM_REPO,
              v.vendored[4]!.commit,
              "src/training_transit_sim/hardware.py",
            )}
          >
            hardware.py
          </a>
          ; claims taken from the developer&apos;s website are cited as such
          there.
        </p>
      </Section>

      <Section id="checks" title="How this site checks itself">
        <ul>
          <li>
            Every vendored file is byte for byte its source at a pinned commit
            (the table below); CI re-fetches them and fails on any difference,
            and re-runs the simulation&apos;s Python package to regenerate the
            port&apos;s constants and parity fixtures.
          </li>
          <li>
            The TypeScript port equals the simulation&apos;s closed forms
            exactly, and its engine to rounding, on hundreds of configurations;
            formatted as results.py formats them, its numbers equal every cell
            of results.md it can reproduce, character for character (step times,
            times to the target, hot spots, energy, stage times, every
            break-even).
          </li>
          <li>
            The loss curves, the ladder, the energy averages and the optics
            table are recomputed from the run logs and checked against the
            experiment&apos;s results.json and results.md.
          </li>
          <li>
            A test greps the source and the build output for the module
            developer&apos;s name, which must not appear.
          </li>
        </ul>
        <p>
          The source, the tests and the scripts are in{" "}
          <a className={A} href={GITHUB_URL}>
            compute-in-transit-results
          </a>{" "}
          (
          <a className={A} href={repoFile("RUNBOOK.md")}>
            RUNBOOK.md
          </a>{" "}
          has the update procedure).
        </p>
      </Section>

      <Section id="vendored" title="Vendored files">
        <div
          className="min-w-0 overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Vendored files"
        >
          <table className="text-xs">
            <thead>
              <tr>
                <th>File here</th>
                <th>Source</th>
                <th>Commit</th>
                <th>SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {[...v.vendored, ...v.derived].map((f) => (
                <tr key={f.file}>
                  <td>
                    <code>{f.file}</code>
                    {f.generated_by ? ` (written by ${f.generated_by})` : ""}
                  </td>
                  <td>
                    <a className={A} href={`https://github.com/${f.source}`}>
                      {f.source.split("/")[1]}
                    </a>{" "}
                    <code>{f.path}</code>
                  </td>
                  <td>
                    <code>{f.commit.slice(0, 7)}</code>
                  </td>
                  <td>
                    <code>{f.sha256.slice(0, 16)}…</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </Main>
  );
}
