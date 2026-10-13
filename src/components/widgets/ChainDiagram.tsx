"use client";

/**
 * The proposed system end to end, TX input data to RX output data: one
 * chunk of 256 values on each of eight workers, stage by stage through the
 * TX GPU, the photonic link module, the fibre and network and the RX GPU,
 * with the error-feedback loop. Every frame is computed by the TypeScript
 * port of the experiment's code (src/lib/chain/model.ts, checked against
 * the experiment's functions in tests/unit/chain.test.ts) and drawn by
 * src/lib/chain/render.ts, the same drawing the decks use. The byte counts
 * come from the vendored results (src/lib/chain/bytes.ts).
 */
import { useMemo, useState } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Segmented } from "@/components/ui/Controls";
import { useWidth } from "@/components/viz/useWidth";
import {
  chainRun,
  chainStages,
  type ChainBytes,
  type ChainInputs,
  type ChainMode,
} from "@/lib/chain/model";
import {
  TAG,
  blockLabel,
  bytesSvg,
  diagramSvg,
  legendSvg,
  viewSvg,
} from "@/lib/chain/render";

const PLANES = ["4", "8", "12", "exact"] as const;
const ENOBS = ["6", "8", "10", "12", "exact"] as const;
type Planes = (typeof PLANES)[number];
type Enob = (typeof ENOBS)[number];

export default function ChainDiagram({
  inputs,
  bytes,
  testId,
}: {
  inputs: ChainInputs;
  bytes: ChainBytes;
  testId: string;
}): JSX.Element {
  const [mode, setMode] = useState<ChainMode>("E");
  const [planes, setPlanes] = useState<Planes>("8");
  const [enob, setEnob] = useState<Enob>("10");
  const stages = useMemo(() => {
    const run = chainRun(inputs, {
      mode,
      planes: planes === "exact" ? null : Number(planes),
      enob: enob === "exact" ? null : Number(enob),
      seed: 1,
    });
    return chainStages(run, inputs, bytes);
  }, [inputs, bytes, mode, planes, enob]);
  const stepper = useStepper(stages.length, {
    stepMs: 2200,
    resetKey: `${mode}|${planes}|${enob}`,
  });
  const [ref, width] = useWidth();
  const s = stages[stepper.step]!;
  const done = stages.slice(0, stepper.step).map((x) => x.block);
  const visual = (
    <div
      ref={ref}
      className="min-w-0 text-neutral-800 dark:text-neutral-200"
      data-block={s.block}
    >
      <div dangerouslySetInnerHTML={{ __html: legendSvg(width) }} />
      <div
        className="mt-2"
        dangerouslySetInnerHTML={{
          __html: diagramSvg(width, mode, s.block, done),
        }}
      />
      <p className="mt-3 font-mono text-xs text-neutral-600 dark:text-neutral-400">
        Stage {stepper.step + 1}: {blockLabel(s.block, mode)} · source{" "}
        {s.tags.map((t) => TAG[t].name).join(", ")}
      </p>
      <div
        className="mt-1 rounded bg-white p-1 ring-1 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800"
        data-testid="chain-view"
        dangerouslySetInnerHTML={{
          __html: viewSvg(s.view, Math.max(240, width - 10)),
        }}
      />
      {s.bytes && (
        <div className="mt-2" data-testid="chain-bytes">
          <p className="font-mono text-xs text-neutral-600 dark:text-neutral-400">
            Bytes per worker per step, the whole model (results.json
            {mode === "Eprime" && s.block === "net"
              ? "; the simulation's results.md §1"
              : ""}
            )
          </p>
          <div
            dangerouslySetInnerHTML={{
              __html: bytesSvg(s.bytes, bytes, width),
            }}
          />
        </div>
      )}
    </div>
  );
  return (
    <AnimationPanel
      title="The whole chain, TX input data to RX output data"
      summary="One chunk of 256 values on each of 8 workers, through the TX GPU, the photonic link module, the network and the RX GPU, and back round the error-feedback loop. Each frame is computed by a port of the experiment's code; the inputs are illustrative."
      stepper={stepper}
      stepLabel="stage"
      caption={s.caption}
      visual={visual}
      testId={testId}
      params={
        <>
          <Segmented
            label="Where the band is computed"
            value={mode}
            options={[
              { value: "E", label: "E: pluggable, all-gather" },
              { value: "Eprime", label: "E′: switch sums (hypothetical)" },
            ]}
            onChange={setMode}
          />
          <Segmented
            label="Bit planes"
            value={planes}
            options={PLANES.map((p) => ({ value: p, label: p }))}
            onChange={setPlanes}
          />
          <Segmented
            label="Readout ENOB"
            value={enob}
            options={ENOBS.map((p) => ({ value: p, label: p }))}
            onChange={setEnob}
          />
        </>
      }
    />
  );
}
