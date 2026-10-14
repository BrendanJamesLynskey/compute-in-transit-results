/**
 * Smoke-check a deployment: every page and the notebook return 200 (no
 * redirects), each page carries its title and the companion sites'
 * four-track switch (this site current), and no response names the
 * module's developer (the same check as scripts/check-naming.mjs).
 *
 *   pnpm smoke https://compute-in-transit-results.vercel.app
 *   VERCEL_BYPASS=… pnpm smoke https://<protected-preview-url>
 */
// @ts-expect-error: a plain ES module script, no types
import { hits } from "./check-naming.mjs";

const PAGES: [string, string][] = [
  ["/", "Can a fixed band replace DeMo"],
  ["/experiment", "Loss against communication"],
  ["/energy", "Why a fixed band loses"],
  ["/optics", "Why the first optics runs diverged"],
  ["/transit", "When does computing the band in transit pay?"],
  ["/notebook", "Run the sweep yourself"],
  ["/method", "How it was run"],
  ["/run_sweep.ipynb", '"cells"'],
];

/** The author credit: the last line of /method, the page about the work (brief 35). */
const CREDIT = [
  'data-author-credit="true"',
  "Written and built by",
  'href="https://github.com/BrendanJamesLynskey">Brendan Lynskey</a>',
];

/** The site switch, in every page's header (not in the notebook). */
const SWITCH = [
  'data-site-switch="menu"',
  'href="https://transformer-training-explained.vercel.app"',
  'href="https://agent-orchestration-explained.vercel.app"',
  'href="https://agent-evals-explained.vercel.app"',
  'href="https://agent-security-explained.vercel.app"',
  'data-site-group="foundations"',
  'data-site-group="hardware"',
  'href="https://ai-racks-explained.vercel.app"',
  'data-site-place="transit"',
  'data-site-brand="true" class="focus-ring whitespace-nowrap rounded text-sm font-medium tracking-tight" href="/">Compute in Transit: Results</a>',
  'data-site-key="inference"',
  'href="https://inference-tradeoffs-explained.vercel.app"',
  'href="https://agent-context-explained.vercel.app"',
];

async function main(): Promise<void> {
  const base = (process.argv[2] ?? "").replace(/\/$/, "");
  if (!base) throw new Error("usage: smoke-check.ts <base url>");
  const headers: Record<string, string> = {};
  if (process.env.VERCEL_BYPASS)
    headers["x-vercel-protection-bypass"] = process.env.VERCEL_BYPASS;
  const bad: string[] = [];
  for (const [path, marker] of PAGES) {
    const res = await fetch(base + path, { headers, redirect: "manual" });
    const body = await res.text();
    const ok =
      body.includes(marker) || body.includes(marker.replace(/'/g, "&#x27;"));
    if (res.status !== 200) bad.push(`${path}: HTTP ${res.status}`);
    else if (!ok) bad.push(`${path}: no "${marker}"`);
    else if (path.endsWith("/") || !path.includes("."))
      for (const m of SWITCH)
        if (!body.includes(m)) bad.push(`${path}: no switch marker ${m}`);
    if (path === "/method")
      for (const m of CREDIT)
        if (!body.includes(m)) bad.push(`${path}: no credit marker ${m}`);
    if ((hits(body) as number[]).length)
      bad.push(`${path}: names the module's developer`);
    console.log(`${res.status} ${path}`);
  }
  if (bad.length) {
    console.error(bad.join("\n"));
    process.exit(1);
  }
  console.log("smoke check passed");
}

void main();
