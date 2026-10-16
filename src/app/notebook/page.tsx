import type { Metadata } from "next";

import { Notebook } from "@/components/charts/Notebook";
import { Callout } from "@/components/ui/Callout";
import { A, Main, PageHeader, Section } from "@/components/ui/Page";
import { notebook, runsFile, vendored } from "@/lib/data/load";
import { allGroups } from "@/lib/experiment/props";
import { fixed, int } from "@/lib/format";
import { row } from "@/lib/quote";
import { COLAB_URL, EXPERIMENT_REPO, fileAt } from "@/lib/site";
import { withShare } from "@/lib/share";

export const metadata: Metadata = withShare("/notebook", {
  title: "The notebook",
  description:
    "The Colab notebook that ran the fixed-band DeMo sweep on GPUs: read it here, download it, or open it in Colab; with a guide to the GPU, the Drive copies, resuming, and the run time of each configuration.",
});

export default function NotebookPage(): JSX.Element {
  const nb = notebook();
  const v = vendored().vendored.find(
    (f) => f.file === "public/run_sweep.ipynb",
  )!;
  const runs = runsFile().runs;
  const devices = new Map<string, number>();
  for (const r of runs) devices.set(r.device, (devices.get(r.device) ?? 0) + 1);
  const saver = /def _saver\(period=(\d+)\)/.exec(
    nb.cells.map((c) => [c.source].flat().join("")).join("\n"),
  );
  const minutes = saver ? Number(saver[1]) / 60 : null;
  const groups = allGroups().filter((g) => g.kind !== "E0");
  const steps = runs[0]!.evals.step.at(-1)!;

  return (
    <Main>
      <PageHeader kicker="The notebook" title="Run the sweep yourself">
        <p>
          The experiment ran on Google Colab GPUs from one notebook. Here it is,
          as published: read it below, download it, or open it in Colab.
        </p>
      </PageHeader>

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href="/run_sweep.ipynb"
          download="run_sweep.ipynb"
          className="focus-ring inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
        >
          Download run_sweep.ipynb
        </a>
        <a
          href={COLAB_URL}
          className="focus-ring inline-flex min-h-11 items-center rounded border border-neutral-300 px-4 text-sm font-medium hover:border-accent dark:border-neutral-700 dark:hover:border-accent-light"
        >
          Open in Colab ↗
        </a>
      </div>
      <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
        The copy here is{" "}
        <a className={A} href={fileAt(EXPERIMENT_REPO, v.commit, v.path)}>
          colab/run_sweep.ipynb at commit {v.commit.slice(0, 7)}
        </a>{" "}
        (SHA-256 {v.sha256.slice(0, 12)}…). Colab opens the repository&apos;s
        main branch.
      </p>

      <Section id="guide" title="A short guide">
        <h3>Which GPU</h3>
        <p>
          Colab assigns the GPU, and may give a different one from the one you
          asked for, so check: the notebook&apos;s test cell prints{" "}
          <code>device</code>, and every run log records it in its first line (
          <code>
            &quot;hardware&quot;: {"{"}… &quot;device&quot;: …{"}"}
          </code>
          ). The experiment&apos;s {int(runs.length)} runs used:
        </p>
        <ul>
          {[...devices.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([d, n]) => (
              <li key={d}>
                {d}: {int(n)} {n === 1 ? "run" : "runs"}
              </li>
            ))}
        </ul>
        <h3>Drive copies and resuming</h3>
        <p>
          The work happens on Colab&apos;s local disk; results, checkpoints and
          the tokenised data are copied to{" "}
          <code>MyDrive/DeMo_Fixed_Band_Experiment_state</code> with rsync
          {minutes !== null ? ` every ${int(minutes)} minutes` : ""} and when
          the sweep ends, and restored from there at the start of each session.
          If the session disconnects, reconnect and run all again: finished runs
          are skipped and an interrupted run resumes from its last checkpoint.
          To stop early, interrupt the sweep cell and run{" "}
          <code>save_to_drive()</code> before disconnecting.
        </p>
        <h3>How long each configuration took</h3>
        <p>
          Wall time per run of {int(steps)} steps, mean over seeds, from the run
          logs (results.json&apos;s <code>seconds</code>), with the GPUs the
          runs used. Times vary with the GPU.
        </p>
        <div
          className="min-w-0 overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Run time per configuration"
        >
          <table>
            <thead>
              <tr>
                <th>Configuration</th>
                <th>Seeds</th>
                <th>Minutes per run</th>
                <th>GPU</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const r = row(g.id);
                const gpus = [
                  ...new Set(
                    g.runs.map((x) => x.device.replace("NVIDIA ", "")),
                  ),
                ].join(", ");
                return (
                  <tr key={g.id}>
                    <td>{g.short}</td>
                    <td>{r.seeds}</td>
                    <td>{fixed(r.seconds / 60, 1)}</td>
                    <td>{gpus}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Callout kind="deeper">
          <p>
            Without Colab, the same sweep runs from the repository with{" "}
            <code>experiment/sweep.py</code>:{" "}
            <a className={A} href={EXPERIMENT_REPO}>
              DeMo_Fixed_Band_Experiment
            </a>{" "}
            (README, &quot;Run it&quot;).
          </p>
        </Callout>
      </Section>

      <Section id="cells" title="The notebook">
        <Notebook nb={nb} />
      </Section>
    </Main>
  );
}
