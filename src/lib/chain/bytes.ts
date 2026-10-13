/**
 * The chain animation's byte counts (Server-side only): read from the
 * experiment's results.json (A's payload is the dense delta; B is top-k,
 * values and positions; E sends the band's values only) and from the
 * simulation's results.md section 1 (what E′ sends up to the switch). Never
 * typed: a lookup that no longer resolves throws, failing the build.
 */
import type { ChainBytes } from "@/lib/chain/model";
import { G, row, simCell } from "@/lib/quote";
import { SETUP } from "@/lib/transit/model";

export function chainBytes(): ChainBytes {
  const a = row(G.A);
  const b = row(G.B);
  const e = row(G.E10);
  const up = simCell(
    "## 1.",
    "E' band in transit, summed at the switch (hypothetical)",
    "Model wire / step (bytes)",
  );
  return {
    dense: a.payload_per_step,
    bandPayload: e.payload_per_step,
    bandWire: e.wire_per_step,
    topkPayload: b.payload_per_step,
    topkWire: b.wire_per_step,
    switchUp: Number(up.replace(/,/g, "")),
    workers: SETUP.workers,
  };
}
