import Link from "next/link";

import { WhatItFound, WhyThisExists } from "@/components/home/Story";
import { Callout } from "@/components/ui/Callout";
import { A, Main, PageHeader } from "@/components/ui/Page";
import { DotPlot, type DotRow } from "@/components/viz/DotPlot";
import { LossCurves } from "@/components/widgets/lazy";
import { simResults } from "@/lib/data/load";
import { lossSeries } from "@/lib/experiment/props";
import { findings } from "@/lib/findings";
import { fixed, trim } from "@/lib/format";
import { breakEven, G, loss, lossSd, mb, row } from "@/lib/quote";
import { DECKS, deck, DEMO_PAPER, HUB_URL, MODULE_PAPER } from "@/lib/site";
import {
  HYPOTHETICAL,
  LETTER,
  SETUP,
  TARGETS,
  VARIANT_NAME,
  type Variant,
} from "@/lib/transit/model";
import { BASE } from "@/lib/transit/presets";
import { KIND_COLOUR, VARIANT_COLOUR } from "@/lib/viz/palette";

const PAGES = [
  {
    href: "/experiment",
    title: "The experiment",
    text: "Loss curves for every configuration, loss against wire bytes, and the steps-to-loss ladder.",
  },
  {
    href: "/energy",
    title: "Captured energy",
    text: "Why the band loses: how much of the momentum's energy each selector keeps, over training.",
  },
  {
    href: "/optics",
    title: "The emulated optics",
    text: "Why the first optics runs diverged, the error-feedback fix, and ENOB and bit planes.",
  },
  {
    href: "/transit",
    title: "The simulation",
    text: "Time to a loss against WAN bandwidth, the module's stages, break-evens and energy, live.",
  },
  {
    href: "/notebook",
    title: "The notebook",
    text: "The Colab notebook that ran the sweep: read it, download it or open it in Colab.",
  },
  {
    href: "/method",
    title: "Method and limits",
    text: "The setup, what was not tested, what is illustrative, and the vendored files' hashes.",
  },
] as const;

/**
 * Landing page: the question; why this investigation exists (the process,
 * step by step) and what it found (each number read from the vendored
 * results); then the answer in one picture (the loss curves, then the final
 * losses), what the module could and could not do (the simulation's time to
 * the target), the pages, the hub and the five decks.
 */
export default function HomePage(): JSX.Element {
  const target = fixed(TARGETS[0]![0], 3);
  const found = findings();
  const series = lossSeries();
  const show = [G.A, G.B, G.C1d256, G.Frandom, G.E10];
  const hero: string[] = [...show, G.C2d, G.D, G.E8, G.Ectrl];
  const finals: DotRow[] = (
    [
      [G.A, "A"],
      [G.B, "B"],
      [G.C1d256, "C"],
      [G.C2d, "C"],
      [G.D, "D"],
      [G.Frandom, "F"],
      [G.E8, "E"],
      [G.E10, "E"],
    ] as const
  ).map(([id, kind]) => {
    const r = row(id);
    const s = series.find((x) => x.id === id)!;
    return {
      key: id,
      label: s.short,
      note: `${mb(r.wire_per_step)} a step on the wire, ${fixed(r.wire_ratio_vs_dense, 1)}x less than A`.replace(
        ", 1.0x less than A",
        " (the dense baseline)",
      ),
      value: r.final_val,
      lo: r.seeds > 1 ? r.final_val - r.final_val_sd : undefined,
      hi: r.seeds > 1 ? r.final_val + r.final_val_sd : undefined,
      colour: KIND_COLOUR[kind],
      text: r.seeds > 1 ? lossSd(id) : loss(id),
      hollow: r.seeds === 1,
    };
  });

  const sim = simResults();
  const variants: [Variant, string][] = [
    ["adamw", VARIANT_NAME.adamw],
    ["topk", VARIANT_NAME.topk],
    ["band", VARIANT_NAME.band],
    ["band-allreduce", VARIANT_NAME["band-allreduce"]],
    ["band-pluggable", `${VARIANT_NAME["band-pluggable"]} [free]`],
    ["band-switch", `${VARIANT_NAME["band-switch"]} [free]`],
  ];
  const times: DotRow[] = variants.map(([v, name]) => {
    const t = sim.time_to_target[name]![BASE]!;
    return {
      key: v,
      label: `${LETTER[v]} · ${name.slice(3).replace(" (hypothetical)", "").replace(" [free]", "")}`,
      note: HYPOTHETICAL.includes(v)
        ? "hypothetical: not run"
        : `${fixed(t.steps!, 0)} measured steps`,
      value: t.seconds!,
      colour: VARIANT_COLOUR[v]!,
      text: `${fixed(t.seconds!, 2)} s`,
      hollow: HYPOTHETICAL.includes(v),
    };
  });
  const epA = breakEven(
    VARIANT_NAME["band-switch"],
    VARIANT_NAME.adamw,
    "free",
    "E",
  );
  const epAx = breakEven(
    VARIANT_NAME["band-switch"],
    VARIANT_NAME.adamw,
    "free",
    "C (exact)",
  );
  const cpA = breakEven(
    VARIANT_NAME["band-allreduce"],
    VARIANT_NAME.adamw,
    "–",
    "measured",
  );
  const eA = breakEven(
    VARIANT_NAME["band-pluggable"],
    VARIANT_NAME.adamw,
    "free",
    "E",
  );
  const epCp = breakEven(
    VARIANT_NAME["band-switch"],
    VARIANT_NAME["band-allreduce"],
    "free",
    "C (exact)",
  );

  return (
    <Main>
      <PageHeader
        kicker="Compute in Transit · results"
        title="Can a fixed band replace DeMo's top-k?"
      >
        <p>
          <a className={A} href={DEMO_PAPER}>
            DeMo
          </a>{" "}
          compresses each worker&apos;s momentum by keeping the top-k
          coefficients of a chunked DCT. A photonic link module (
          <a className={A} href={MODULE_PAPER}>
            arXiv:2608.21536
          </a>
          ) can run the transform but not the comparisons top-k needs; a fixed
          band of positions needs none. An experiment on a{" "}
          {fixed(SETUP.params / 1e6, 1)}M-parameter model measured what the
          substitution costs, and a simulation asked when computing the band in
          the network could pay.
        </p>
      </PageHeader>

      <WhyThisExists f={found} />
      <WhatItFound f={found} />

      <div className="mt-12 grid items-start gap-6">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">
            The answer, in one picture
          </h2>
          <p className="mt-3 max-w-3xl text-neutral-700 dark:text-neutral-300">
            No. Top-k ends at {lossSd(G.B)}; the fixed low band at{" "}
            {lossSd(G.C1d256)}, though it sends half top-k&apos;s bytes (
            {mb(row(G.C1d256).wire_per_step)} against{" "}
            {mb(row(G.B).wire_per_step)} a step on the wire). Even a random
            fixed set of positions ({loss(G.Frandom)}, one seed) beats the low
            band, and the emulated optics, once repaired, does no better than{" "}
            {loss(G.E10)}. AdamW, the dense baseline, ends at {lossSd(G.A)}.
          </p>
        </div>
        <div className="min-w-0">
          <LossCurves
            series={series.filter((s) => hero.includes(s.id))}
            initial={show}
            title="Validation loss over training"
            summary="Mean over seeds, the band from the lowest to the highest seed. Toggle any configuration."
            testId="hero-home"
          />
        </div>
      </div>
      <h3 className="mt-8 text-base font-semibold">Final validation loss</h3>
      <DotPlot
        rows={finals}
        domain={[1.5, 3.6]}
        ticks={[1.5, 2, 2.5, 3, 3.5]}
        format={(v) => fixed(v, 1)}
        axisLabel="final validation loss (mean ± sd; hollow: one seed)"
        testId="final-losses"
      />

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          What the module could and couldn&apos;t do
        </h2>
        <p className="mt-3 max-w-3xl text-neutral-700 dark:text-neutral-300">
          The simulation (Training_Transit_Sim) takes the measured steps to a
          loss of {target} and asks how long each way of syncing takes on 8
          workers in two data centres joined by a 100 GbE WAN. A pluggable
          module computing the band as the delta leaves each worker (E) is
          slower than doing it on the GPU; summing the band at the switch (E′)
          is the case that can pay, below a few GB/s of WAN.
        </p>
        <DotPlot
          rows={times}
          domain={[0.3, 30]}
          logScale
          bars
          ticks={[0.3, 1, 3, 10, 30]}
          format={(v) => `${trim(v, 3)} s`}
          axisLabel={`seconds to ${target}, ${BASE} (log; transform not charged; hollow: hypothetical)`}
          testId="transit-times"
        />
        <ul className="mt-4 max-w-3xl list-disc space-y-1 pl-6 text-neutral-700 dark:text-neutral-300">
          <li>
            The pluggable all-gather (E) never breaks even with AdamW from 0.1
            to 1,000 GB/s of WAN ({eA[4]}): its all-gather still sends a quarter
            of AdamW&apos;s wire bytes, and it needs more steps.
          </li>
          <li>
            E′ beats AdamW below {epA[4]} with E&apos;s steps; with the exact
            band&apos;s steps, below {epAx[4]}.
          </li>
          <li>
            The same summation without a module (C′, the band ring all-reduced
            by the GPUs) beats AdamW below {cpA[4]}, and on the exact
            band&apos;s steps E′ never beats C′ ({epCp[4]}).
          </li>
        </ul>
        <Callout kind="hypothesis">
          <p>
            E reaches {target} in fewer steps than the exact band it emulates:
            one seed per run. Every in-transit result is also given on the exact
            band&apos;s steps. See{" "}
            <Link className={A} href="/optics#hypothesis">
              the optics page
            </Link>
            .
          </p>
        </Callout>
      </section>

      <nav
        aria-label="Pages"
        className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {PAGES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="focus-ring group rounded-lg border border-neutral-200 p-5 hover:border-accent dark:border-neutral-800 dark:hover:border-accent-light"
          >
            <h2 className="font-semibold">{t.title}</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {t.text}
            </p>
          </Link>
        ))}
      </nav>

      <section className="mt-12" aria-labelledby="decks">
        <h2 id="decks" className="text-xl font-semibold tracking-tight">
          The series
        </h2>
        <p className="mt-3 text-neutral-700 dark:text-neutral-300">
          The{" "}
          <a className={A} href={HUB_URL}>
            Compute in Transit hub
          </a>{" "}
          has the glossary and the code. Its five decks:
        </p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {DECKS.map((d) => (
            <li key={d.repo}>
              <a
                className="focus-ring flex min-h-11 items-center rounded border border-neutral-200 px-3 py-2 text-sm hover:border-accent dark:border-neutral-800 dark:hover:border-accent-light"
                href={deck(d.repo)}
              >
                <span className="mr-2 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  {String(d.n).padStart(2, "0")}
                </span>
                {d.title}
              </a>
            </li>
          ))}
        </ol>
      </section>
    </Main>
  );
}
