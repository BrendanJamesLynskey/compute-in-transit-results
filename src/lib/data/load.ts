/**
 * The vendored and derived data, read from disk at build time (Server
 * Components and tests only: the pages hand slim views of it to the client
 * widgets as props, so the 0.6 MB of run logs never reach the browser).
 *
 * - src/data/vendor/: byte-for-byte copies at the pinned commits
 *   (VENDORED.json has each file's SHA-256; tests/unit/vendor.test.ts checks
 *   them);
 * - src/data/derived/: written by scripts/vendor.py (the run logs) and
 *   scripts/transit_reference.py (the simulation's constants).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ExperimentResults,
  RunsFile,
  SimResults,
  Vendored,
} from "./types";

const cache = new Map<string, unknown>();

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function once<T>(key: string, f: () => T): T {
  if (!cache.has(key)) cache.set(key, f());
  return cache.get(key) as T;
}

export const runsFile = (): RunsFile =>
  once(
    "runs",
    () => JSON.parse(read("src/data/derived/runs.json")) as RunsFile,
  );
export const experimentResults = (): ExperimentResults =>
  once(
    "ej",
    () =>
      JSON.parse(
        read("src/data/vendor/experiment/results.json"),
      ) as ExperimentResults,
  );
export const experimentMd = (): string =>
  once("emd", () => read("src/data/vendor/experiment/results.md"));
export const opticsMd = (): string =>
  once("omd", () => read("src/data/vendor/experiment/optics_investigation.md"));
export const simResults = (): SimResults =>
  once(
    "sj",
    () => JSON.parse(read("src/data/vendor/sim/results.json")) as SimResults,
  );
export const simMd = (): string =>
  once("smd", () => read("src/data/vendor/sim/results.md"));
export const vendored = (): Vendored =>
  once("v", () => JSON.parse(read("VENDORED.json")) as Vendored);
export const notebook = (): Notebook =>
  once("nb", () => JSON.parse(read("public/run_sweep.ipynb")) as Notebook);

export type Notebook = {
  cells: {
    cell_type: "markdown" | "code";
    source: string[] | string;
    outputs?: unknown[];
  }[];
  metadata: Record<string, unknown>;
};
