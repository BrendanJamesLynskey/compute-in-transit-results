/**
 * Screenshots of every page at 390 and 1280 px in light and dark mode, and
 * of each interactive in two states, for reading by eye (the visual
 * standard §4) and for the README. Needs the site running (`pnpm build &&
 * pnpm start`).
 *
 *   BASE_URL=http://localhost:3000 SHOTS_DIR=docs/screenshots pnpm screenshots
 *   SHOTS=pages|states   (default: both)
 *
 * External requests are blocked; animations are paused and set to a step so
 * frames are reproducible. Fails on any page error or horizontal overflow.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Locator, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.SHOTS_DIR ?? "docs/screenshots";
const WHAT = process.env.SHOTS ?? "both";
const PAGES = [
  "/",
  "/experiment",
  "/energy",
  "/optics",
  "/transit",
  "/notebook",
  "/method",
];

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () => document.querySelectorAll("[data-pending-widget]").length === 0,
    null,
    {
      timeout: 30_000,
    },
  );
  // pause every animation where it is
  for (const b of await page.getByTestId("play").all())
    if ((await b.getAttribute("aria-label")) === "Pause") await b.click();
  await page.waitForTimeout(400);
}

async function scrubTo(fig: Locator, step: number | "end"): Promise<void> {
  const scrub = fig.getByTestId("scrub");
  const max = Number(await scrub.getAttribute("max"));
  await scrub.fill(String(step === "end" ? max : Math.min(step, max)));
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const problems: string[] = [];
  const name = (p: string) => (p === "/" ? "home" : p.slice(1));

  if (WHAT !== "states")
    for (const scheme of ["light", "dark"] as const)
      for (const width of [390, 1280]) {
        const ctx = await browser.newContext({
          colorScheme: scheme,
          viewport: { width, height: 900 },
        });
        await ctx.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
        const page = await ctx.newPage();
        page.on("pageerror", (e) =>
          problems.push(`${scheme} ${width}: pageerror ${e.message}`),
        );
        for (const p of PAGES) {
          await page.goto(BASE + p);
          await settle(page);
          const over = await page.evaluate(
            () =>
              document.scrollingElement!.scrollWidth -
              document.scrollingElement!.clientWidth,
          );
          if (over > 0)
            problems.push(
              `${p} ${scheme} ${width}: ${over}px horizontal overflow`,
            );
          await page.screenshot({
            path: join(OUT, `${name(p)}-${width}-${scheme}.png`),
            fullPage: true,
          });
        }
        await ctx.close();
      }

  if (WHAT !== "pages") {
    // each interactive in two states, light at 1280 and dark at 390
    const states: [
      string,
      string,
      (f: Locator) => Promise<void>,
      (f: Locator) => Promise<void>,
    ][] = [
      ["/", "hero-home", (f) => scrubTo(f, 3), (f) => scrubTo(f, "end")],
      [
        "/experiment",
        "loss-curves",
        (f) => scrubTo(f, "end"),
        async (f) => {
          await f.getByRole("radio", { name: "wire bytes" }).click();
          await scrubTo(f, "end");
        },
      ],
      [
        "/energy",
        "energy",
        (f) => scrubTo(f, 6),
        async (f) => {
          await f.getByRole("radio", { name: "delta" }).click();
          await scrubTo(f, "end");
        },
      ],
      [
        "/optics",
        "feedback",
        (f) => scrubTo(f, "end"),
        async (f) => {
          await f.getByRole("radio", { name: /band sent/ }).click();
          await scrubTo(f, "end");
        },
      ],
      [
        "/optics",
        "clip",
        (f) => scrubTo(f, 4),
        async (f) => {
          await f
            .getByRole("combobox", { name: "ENOB and planes" })
            .selectOption({ index: 0 });
          await scrubTo(f, "end");
        },
      ],
      [
        "/transit",
        "explorer",
        (f) => scrubTo(f, 12),
        async (f) => {
          await f.getByRole("radio", { name: "10 GFLOP/s" }).click();
          await f.getByRole("radio", { name: "energy per step" }).click();
          await scrubTo(f, 30);
        },
      ],
      ["/transit", "stages", (f) => scrubTo(f, 0), (f) => scrubTo(f, "end")],
      [
        "/transit",
        "breakeven",
        async () => {},
        async (f) => {
          await f
            .getByRole("combobox", { name: "Pair" })
            .selectOption({ index: 4 });
        },
      ],
    ];
    for (const [scheme, width] of [
      ["light", 1280],
      ["dark", 390],
    ] as const) {
      const ctx = await browser.newContext({
        colorScheme: scheme,
        viewport: { width, height: 1000 },
      });
      await ctx.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
      const page = await ctx.newPage();
      page.on("pageerror", (e) =>
        problems.push(`${scheme} ${width}: pageerror ${e.message}`),
      );
      for (const [p, id, a, b] of states) {
        await page.goto(BASE + p);
        await settle(page);
        const fig = page.getByTestId(id);
        await fig.scrollIntoViewIfNeeded();
        for (const [tag, act] of [
          ["a", a],
          ["b", b],
        ] as const) {
          await act(fig);
          await page.waitForTimeout(300);
          await fig.screenshot({
            path: join(OUT, `state-${id}-${tag}-${width}-${scheme}.png`),
          });
        }
      }
      await ctx.close();
    }
  }
  await browser.close();
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(`screenshots in ${OUT}`);
}

void main();
