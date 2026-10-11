/**
 * The topologies and module settings of the simulation's results.md
 * (examples/results.py's TOPOLOGIES and MODULES), built from the vendored
 * link presets. The unit tests check every recorded cell of results.md
 * against the port at these presets, so a wrong preset fails them.
 */
import { LINKS, type ModuleKey } from "./model";

export type Preset = { name: string; dcs: number; bw: number };

/** results.md's column order. */
export const TOPOLOGY_PRESETS: readonly Preset[] = [
  { name: "1 DC x 8", dcs: 1, bw: LINKS["eth-100g"]!.bandwidth },
  { name: "2 DC x 4, 100 GbE", dcs: 2, bw: LINKS["eth-100g"]!.bandwidth },
  { name: "2 DC x 4, 25 GbE", dcs: 2, bw: LINKS["eth-25g"]!.bandwidth },
  { name: "2 DC x 4, 400G", dcs: 2, bw: LINKS["wan-400g"]!.bandwidth },
  { name: "2 DC x 4, 800G", dcs: 2, bw: LINKS["wan-800g"]!.bandwidth },
  { name: "8 DC x 1, 100 GbE", dcs: 8, bw: LINKS["eth-100g"]!.bandwidth },
  { name: "8 DC x 1, 25 GbE", dcs: 8, bw: LINKS["eth-25g"]!.bandwidth },
  // results.py: "a WAN share of 1 GB/s (8 Gb/s): illustrative" (the 100 GbE preset at 1 GB/s)
  { name: "2 DC x 4, 8 Gb/s", dcs: 2, bw: 1e9 },
];

/** results.md's base topology for the per-topology tables. */
export const BASE = "2 DC x 4, 100 GbE";

export function preset(name: string): Preset {
  const p = TOPOLOGY_PRESETS.find((t) => t.name === name);
  if (!p) throw new Error(`no topology ${name}`);
  return p;
}

export const MODULE_TEXT: Record<ModuleKey, string> = {
  low: "10 GFLOP/s, transform charged",
  high: "99 GFLOP/s, transform charged",
  free: "transform not charged (99 GFLOP/s for the rest)",
};

/** The WAN range the break-evens are searched over (results.md 7a), bytes/s. */
export const BW_RANGE: readonly [number, number] = [1e8, 1e12];
