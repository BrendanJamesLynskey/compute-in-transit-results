/**
 * The landing page's opening: why this investigation exists (the process,
 * as a stepper whose steps link to where each happened), what it found (one
 * card per finding, every number from the vendored results via
 * src/lib/findings.ts), and why a negative result is still a result.
 * Server Components.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import type { Findings } from "@/lib/findings";
import { fixed, trim } from "@/lib/format";
import { deck, EXPERIMENT_REPO, MODULE_PAPER } from "@/lib/site";
import { SETUP } from "@/lib/transit/model";
import { BW_RANGE } from "@/lib/transit/presets";
import { OKABE_ITO } from "@/lib/viz/palette";

import { A } from "../ui/Page";

type Step = {
  title: string;
  text: ReactNode;
  href: string;
  where: string;
  /** "fail": where it went wrong; "fix": where it was put right. */
  tone?: "fail" | "fix";
};

function steps(f: Findings): Step[] {
  return [
    {
      title: "Read the sources, and check them",
      text: "The photonic module's paper and DeMo, claim by claim, including what the paper leaves open: whether the optical transform counts against the compute budget.",
      href: deck("CiT_01_Compute_in_Transit"),
      where: "Deck 01",
    },
    {
      title: "Form a falsifiable hypothesis",
      text: "A fixed band of DCT positions, which needs no comparisons, converges as well as DeMo's top-k.",
      href: deck("CiT_04_Fixed_Band_Experiment"),
      where: "Deck 04",
    },
    {
      title: "Build the experiment, with tests",
      text: "DeMo, the fixed bands and an emulated optics path, written from scratch, with their own tests.",
      href: EXPERIMENT_REPO,
      where: "The repository",
    },
    {
      title: "Run it on real GPUs",
      text: `${f.runs} runs on Colab GPUs, from one notebook that resumes after a disconnect.`,
      href: "/notebook",
      where: "/notebook",
    },
    {
      title: "Find the failure",
      text: `Every one of the first optics design's ${f.firstRuns} runs diverged.`,
      href: "/optics#runs",
      where: "/optics",
      tone: "fail",
    },
    {
      title: "Diagnose it, fix it, re-run",
      text: "Error feedback was removing the exact band, not what the optics sent. Feeding back the values sent fixed it.",
      href: "/optics#loop",
      where: "/optics",
      tone: "fix",
    },
    {
      title: "Turn steps into time and energy",
      text: "A discrete-event simulation of training across data centres, from the measured steps and bytes.",
      href: "/transit",
      where: "/transit",
    },
    {
      title: "Publish every number, with the limits",
      text: "Each figure read from recorded results; what is illustrative, hypothetical or extrapolated says so.",
      href: "/method",
      where: "/method",
    },
  ];
}

const TONE = {
  fail: OKABE_ITO.vermillion,
  fix: OKABE_ITO.green,
} as const;

function StepLink({ s, children }: { s: Step; children: ReactNode }) {
  const cls =
    "focus-ring group flex h-full min-h-11 flex-col rounded-lg border border-neutral-200 bg-white p-4 hover:border-accent dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-accent-light";
  return s.href.startsWith("/") ? (
    <Link href={s.href} className={cls}>
      {children}
    </Link>
  ) : (
    <a href={s.href} className={cls}>
      {children}
    </a>
  );
}

export function WhyThisExists({ f }: { f: Findings }): JSX.Element {
  const list = steps(f);
  return (
    <section className="mt-10" aria-labelledby="why">
      <h2 id="why" className="text-xl font-semibold tracking-tight">
        Why this exists
      </h2>
      <p className="mt-4 max-w-3xl text-lg text-neutral-800 dark:text-neutral-200">
        I&apos;d read online about the possibility of computing on data in
        transit, doing useful work on it as it crosses the network, for LLM
        processing. I wanted to run a serious investigation in this area, and go
        through the real process in detail.
      </p>
      <p className="mt-4 max-w-3xl text-neutral-700 dark:text-neutral-300">
        It&apos;s an appealing idea, and an easy one to sketch on a slide. I
        didn&apos;t want a sketch. I wanted one real question taken through the
        whole process: could a photonic link module (
        <a className={A} href={MODULE_PAPER}>
          arXiv:2608.21536
        </a>
        ) take over the compression step of distributed training, and if so,
        when would it pay? That meant every stage, including the one that went
        wrong, with every number traceable to a recorded result and every limit
        stated.
      </p>
      <h3 className="mt-6 text-base font-semibold">
        The process, step by step
      </h3>
      <ol
        className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="process"
      >
        {list.map((s, i) => (
          <li key={s.title} className="relative min-w-0" data-tone={s.tone}>
            <StepLink s={s}>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-accent font-mono text-xs font-semibold text-neutral-900 dark:border-accent-light dark:text-neutral-100"
                  style={s.tone ? { borderColor: TONE[s.tone] } : undefined}
                >
                  {i + 1}
                </span>
                <span className="font-semibold leading-snug">{s.title}</span>
              </span>
              <span className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {s.text}
              </span>
              <span className="mt-auto pt-2 font-mono text-xs text-accent dark:text-accent-light">
                {s.tone === "fail"
                  ? "went wrong · "
                  : s.tone === "fix"
                    ? "put right · "
                    : ""}
                {s.where} →
              </span>
            </StepLink>
          </li>
        ))}
      </ol>
    </section>
  );
}

type Card = {
  key: string;
  big: string;
  bigNote: string;
  title: string;
  body: ReactNode;
  href: string;
  hypothesis?: boolean;
};

export function WhatItFound({ f }: { f: Findings }): JSX.Element {
  if (!f.pluggableNever || f.switchVsAllreduceExact !== "none in range")
    throw new Error("results.md 7a no longer says what this page says");
  const lo = trim(BW_RANGE[0] / 1e9, 3);
  const hi = fixed(BW_RANGE[1] / 1e9, 0);
  const cards: Card[] = [
    {
      key: "band",
      big: `${f.lowMin}–${f.lowMax}`,
      bigNote: `final loss; top-k ${f.topk}, AdamW ${f.adamw}`,
      title: "A fixed band is no substitute for top-k at this scale",
      body: (
        <>
          The fixed low band&apos;s final validation losses are {f.lowMin} to{" "}
          {f.lowMax} across three chunk shapes, against {f.topk} for top-k and{" "}
          {f.adamw} for AdamW.
        </>
      ),
      href: "/experiment",
    },
    {
      key: "energy",
      big: `${f.eLow2d} vs ${f.eTopk2d}`,
      bigNote: "share of momentum energy kept: low band vs top-k",
      title: "Why: the band misses where the energy is",
      body: (
        <>
          On real momentum, in 2-D 64x64 chunks, the low band keeps {f.eLow2d}{" "}
          of the energy, against top-k&apos;s {f.eTopk2d}; a random set of
          positions keeps {f.eRandom2d}. In 1-D 256-point chunks it does better
          ({f.eLow1d} against {f.eTopk1d}), and still loses.
        </>
      ),
      href: "/energy",
    },
    {
      key: "optics",
      big: `${f.firstMin}–${f.firstMax}`,
      bigNote: `final loss of the first optics runs; repaired ${f.repMin}–${f.repMax}`,
      title: "The emulated optics first diverged, then trained",
      body: (
        <>
          All {f.firstRuns} runs of the first design diverged, clipping{" "}
          {f.clipMin} to {f.clipMax} of values. Feeding back the values actually
          sent fixed it: the repaired runs ended at {f.repMin} to {f.repMax}.
          That the best of them beat the exact band ({f.exactBand}) is a{" "}
          <Link className={A} href="/optics#hypothesis">
            hypothesis
          </Link>
          : one seed per run.
        </>
      ),
      href: "/optics",
      hypothesis: true,
    },
    {
      key: "enob",
      big: `ENOB ${f.enobBreakEven}`,
      bigNote: "the break-even",
      title: `ENOB ${f.enobNever} never reaches the target; ${f.enobBreakEven} is the break-even`,
      body: (
        <>
          At ENOB {f.enobNever} the repaired optics never reaches {f.target}.
          Where an in-transit variant wins at all, the break-even ENOB is{" "}
          {f.enobBreakEven}, the lowest measured that trains.
        </>
      ),
      href: "/optics#enob",
    },
    {
      key: "module",
      big: `${f.switchVsA} GB/s`,
      bigNote: "below which switch summing might beat AdamW",
      title: "A pluggable module never breaks even; a switch might",
      body: (
        <>
          Computing the band in a pluggable module never beats AdamW at any WAN
          bandwidth tested ({lo} to {hi} GB/s). Summing it at a switch might,
          below {f.switchVsA} GB/s ({f.switchVsAExact} on the exact band&apos;s
          steps). But a GPU ring all-reduce of the band, with no module, beats
          AdamW below {f.allreduceVsA} GB/s, and on the exact band&apos;s steps
          the switch never beats it.
        </>
      ),
      href: "/transit#break-even",
    },
    {
      key: "wire",
      big: `${f.wireRatio}x, not ${f.payloadRatio}x`,
      bigNote: "fewer bytes on the wire than AdamW",
      title: "An all-gather gives back most of the saving",
      body: (
        <>
          The band&apos;s payload is {f.payloadRatio}x smaller than
          AdamW&apos;s, but an all-gather&apos;s wire bytes grow with the
          workers: on {f.workers} workers each sends {f.wireBand} bytes a step,
          only {f.wireRatio}x fewer than AdamW&apos;s all-reduce ({f.wireAdamw}
          ).
        </>
      ),
      href: "/experiment#bytes",
    },
  ];
  return (
    <section className="mt-12" aria-labelledby="found">
      <h2 id="found" className="text-xl font-semibold tracking-tight">
        What it found
      </h2>
      <ul
        className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="findings"
      >
        {cards.map((c) => (
          <li
            key={c.key}
            data-finding={c.key}
            className={`flex min-w-0 flex-col rounded-lg border p-4 ${
              c.hypothesis
                ? "border-rose-300 dark:border-rose-800"
                : "border-neutral-200 dark:border-neutral-800"
            }`}
          >
            <p className="font-mono text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              {c.big}
            </p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {c.bigNote}
            </p>
            <h3 className="mt-3 font-semibold leading-snug">{c.title}</h3>
            <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
              {c.body}
            </p>
            <p className="mt-auto flex flex-wrap items-center gap-2 pt-3">
              {c.hypothesis && (
                <span className="rounded border border-rose-300 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-widest text-rose-800 dark:border-rose-800 dark:text-rose-300">
                  hypothesis, not a result
                </span>
              )}
              <Link
                className={`${A} inline-flex min-h-11 items-center text-sm`}
                href={c.href}
              >
                The detail →
              </Link>
            </p>
          </li>
        ))}
      </ul>

      <h3 className="mt-8 text-base font-semibold">
        A negative result is still a result
      </h3>
      <p className="mt-2 max-w-3xl text-neutral-700 dark:text-neutral-300">
        The main hypothesis mostly failed. A fixed band did not replace top-k,
        and computing it in a pluggable module did not pay at any WAN bandwidth
        tested. That is worth knowing, and worth knowing early. It rules out a
        direction cheaply, with a {fixed(SETUP.params / 1e6, 1)}M-parameter
        model on rented GPUs, before anyone builds hardware for it. It says what
        the hardware would need instead: comparisons, so it can select top-k, or
        summing at the switch, and an optical transform that is not charged
        against its compute budget. It turns a vague promise into specific
        questions, such as whether the repaired optics&apos; advantage survives
        more seeds, and whether the measured steps hold at a larger scale. And
        the experiment, the simulator and the notebook are there to test the
        next idea.
      </p>
    </section>
  );
}
