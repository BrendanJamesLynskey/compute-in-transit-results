/**
 * The interactives do what the pages say: the loss curves toggle and switch
 * axis; the bandwidth explorer re-runs the model when a setting changes and
 * draws the recorded points; the module's binding stage moves from the
 * compute budget to the optics as the budget grows; the break-even readout
 * is results.md's; the energy bars follow the tensor. Expected values are
 * read from the vendored results.md, never typed here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

const SIM_MD = readFileSync(
  join(process.cwd(), "src/data/vendor/sim/results.md"),
  "utf8",
);

function errors(page: Page): string[] {
  const out: string[] = [];
  page.on("pageerror", (e) => out.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") out.push(`console: ${m.text()}`);
  });
  return out;
}

async function ready(page: Page, path: string, id: string): Promise<Locator> {
  await page.goto(path);
  await expect(page.locator("[data-pending-widget]")).toHaveCount(0);
  const fig = page.getByTestId(id);
  await expect(fig).toBeVisible({ timeout: 30_000 });
  await fig.scrollIntoViewIfNeeded();
  return fig;
}

/** A 7a break-even cell ("1.57 GB/s (12.5 Gb/s)") of the simulation's results.md. */
function breakEven(
  x: string,
  y: string,
  module: string,
  steps: string,
): string {
  const line = SIM_MD.split("\n").find((l) =>
    l.startsWith(`| ${x} | ${y} | ${module} | ${steps} |`),
  );
  return line!.split("|")[5]!.trim();
}

test("loss curves: toggling a configuration draws it, and the axis switches to wire bytes", async ({
  page,
}) => {
  const errs = errors(page);
  const fig = await ready(page, "/experiment", "loss-curves");
  const before = await fig.locator("[data-series]").count();
  const off = fig.locator("[data-toggle][aria-pressed=false]").first();
  const id = await off.getAttribute("data-toggle");
  await off.click();
  await expect(fig.locator("[data-series]")).toHaveCount(before + 1);
  await expect(fig.locator(`[data-series="${id}"]`)).toHaveCount(1);
  await fig.getByRole("radio", { name: "wire bytes" }).click();
  await expect(fig.locator("svg").first()).toHaveAttribute(
    "aria-label",
    /wire bytes/,
  );
  expect(errs).toEqual([]);
});

test("the explorer re-runs when a setting changes and shows the recorded points", async ({
  page,
}) => {
  const errs = errors(page);
  const fig = await ready(page, "/transit", "explorer");
  // the recorded points of results.md at the default settings (transform free, 2 DC x 4)
  expect(await fig.locator("[data-recorded]").count()).toBeGreaterThanOrEqual(
    20,
  );
  await fig.getByTestId("scrub").fill("20");
  const cap = await fig.getByTestId("caption").textContent();
  expect(cap).toMatch(/fastest to 3\.158/);
  await fig.getByRole("radio", { name: "10 GFLOP/s" }).click();
  await fig.getByTestId("scrub").fill("20");
  await expect(fig.getByTestId("caption")).not.toHaveText(cap ?? "");
  // the exact band's steps: no recorded in-transit points are drawn
  await fig.getByRole("radio", { name: "exact band's" }).click();
  for (const v of ["band-pluggable", "band-switch"])
    await expect(fig.locator(`[data-recorded^="${v}|"]`)).toHaveCount(0);
  // the crossings list is results.md's for E' against A (transform free, E's steps)
  await fig.getByRole("radio", { name: "transform free" }).click();
  await fig.getByRole("radio", { name: "E's runs (hypothesis)" }).click();
  await expect(fig.getByTestId("crossings")).toContainText(
    breakEven(
      "E' band in transit, summed at the switch (hypothetical)",
      "A  AdamW, dense ring all-reduce",
      "free",
      "E",
    ),
  );
  expect(errs).toEqual([]);
});

test("the module's binding stage moves from the compute budget to the optics", async ({
  page,
}) => {
  const fig = await ready(page, "/transit", "stages");
  await fig.getByRole("button", { name: "Reset to the first step" }).click();
  await expect(fig.locator('[data-binding="true"]')).toHaveAttribute(
    "data-stage",
    "module compute",
  );
  const max = await fig.getByTestId("scrub").getAttribute("max");
  await fig.getByTestId("scrub").fill(max!);
  await expect(fig.locator('[data-binding="true"]')).toHaveAttribute(
    "data-stage",
    "module optics",
  );
  await fig.getByRole("radio", { name: "not charged" }).click();
  await fig.getByRole("button", { name: "Reset to the first step" }).click();
  await expect(fig.locator('[data-binding="true"]')).toHaveAttribute(
    "data-stage",
    "module optics",
  );
});

test("the break-even readout is results.md's, for both step sources", async ({
  page,
}) => {
  const fig = await ready(page, "/transit", "breakeven");
  const r = fig.getByTestId("breakeven-readout");
  const x = "E' band in transit, summed at the switch (hypothetical)";
  const y = "A  AdamW, dense ring all-reduce";
  await expect(r).toContainText(breakEven(x, y, "free", "E"));
  await expect(r).toContainText(breakEven(x, y, "free", "C (exact)"));
  await fig.getByRole("radio", { name: "99 GFLOP/s, charged" }).click();
  await expect(r).toContainText(breakEven(x, y, "high", "E"));
  await expect(r).toContainText(breakEven(x, y, "high", "C (exact)"));
});

test("the energy bars follow the tensor and the runs", async ({ page }) => {
  const fig = await ready(page, "/energy", "energy");
  await fig.getByTestId("scrub").fill("5");
  const cap = await fig.getByTestId("caption").textContent();
  await fig.getByRole("radio", { name: "delta" }).click();
  await fig.getByTestId("scrub").fill("5");
  await expect(fig.getByTestId("caption")).not.toHaveText(cap ?? "");
  await expect(fig.getByTestId("caption")).toContainText("delta");
  await fig
    .getByRole("combobox", { name: "Runs" })
    .selectOption({ label: "D · calibrated band, 2-D 64×64" });
  await expect(fig.locator('[data-selector="calib"]')).toHaveCount(1);
});
