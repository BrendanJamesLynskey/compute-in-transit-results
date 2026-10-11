import type { Metadata } from "next";
import Link from "next/link";

import { EnergyEq } from "@/components/mdx/equations";
import { Callout } from "@/components/ui/Callout";
import { A, Main, PageHeader, Section } from "@/components/ui/Page";
import { EnergyRace } from "@/components/widgets/lazy";
import { energyProps } from "@/lib/experiment/props";
import { int } from "@/lib/format";
import { energy, G, loss } from "@/lib/quote";
import { deck } from "@/lib/site";

export const metadata: Metadata = {
  title: "Captured energy",
  description:
    "How much of the momentum's energy top-k, the fixed low band, zig-zag, high band and a random fixed set keep at the same k, over training, from the experiment's diagnostics.",
};

export default function EnergyPage(): JSX.Element {
  const data = energyProps();
  const F = "band/2d/64";
  return (
    <Main>
      <PageHeader kicker="Captured energy" title="Why a fixed band loses">
        <p>
          Every {int(data.families[0]!.step[1]! - data.families[0]!.step[0]!)}{" "}
          steps the experiment measured, on worker 0, how much of a
          tensor&apos;s energy each way of choosing k coefficients would keep:
          top-k, the fixed low band, a zig-zag, a high band, a random fixed set
          and, for D, the calibrated band. On the momentum of the fixed-band
          runs in 2-D chunks, top-k would keep {energy(F, "momentum/all/topk")}{" "}
          of the energy; the low band keeps {energy(F, "momentum/all/low")},
          less than a random set ({energy(F, "momentum/all/random")}).
        </p>
      </PageHeader>

      <Section id="race" title="Over training">
        <EnergyEq />
        <EnergyRace data={data} testId="energy" />
        <p>
          Three tensors: <em>momentum</em>, a plain momentum of the same decay
          that is never compressed; <em>delta</em>, what DeMo actually
          compresses, the momentum plus the residual that error feedback keeps;
          and the step&apos;s <em>gradient</em>. The gradient&apos;s low band is
          better ({energy(F, "grad/all/low")} in 2-D chunks), but DeMo
          compresses a momentum, and in the delta the band holds almost nothing
          ({energy(F, "delta/all/low")}): error feedback removes it every step,
          while the rest accumulates.
        </p>
        <p>
          A fixed band sends the same positions forever. The random fixed set,
          which does no better on energy, still trains to a lower loss (
          {loss(G.Frandom)} against {loss(G.C2d)} for the 2-D low band, one seed
          against three), which fits the idea that what hurts is never sending
          the other positions.
        </p>
        <Callout kind="deeper">
          <p>
            Section 2 of the experiment&apos;s results.md has every family,
            tensor and parameter group;{" "}
            <a className={A} href={deck("CiT_04_Fixed_Band_Experiment")}>
              CiT 04
            </a>{" "}
            walks through them. The optics page shows what this residual did to
            the emulated optics:{" "}
            <Link href="/optics">why the first optics runs diverged</Link>.
          </p>
        </Callout>
      </Section>
    </Main>
  );
}
