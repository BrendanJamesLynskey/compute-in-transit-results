/**
 * Every page renders at desktop and phone widths, in light and dark mode,
 * with no page errors, no console errors and no horizontal overflow.
 */
import { expect, test, type Page } from "@playwright/test";

import { PAGES } from "./pages.list";

async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

for (const scheme of ["light", "dark"] as const) {
  for (const width of [1280, 390]) {
    test.describe(`${scheme} @ ${width}px`, () => {
      test.use({ colorScheme: scheme, viewport: { width, height: 900 } });
      for (const path of PAGES) {
        test(`${path} renders cleanly`, async ({ page }) => {
          const errors = await collectErrors(page);
          const res = await page.goto(path);
          expect(res?.status()).toBe(200);
          await expect(page.locator("h1").first()).toBeVisible();
          await page.waitForLoadState("networkidle");
          // chapter interactives load after the page: wait for every one
          await expect(page.locator("[data-pending-widget]")).toHaveCount(0);
          const overflow = await page.evaluate(() => {
            const el = document.scrollingElement!;
            return el.scrollWidth - el.clientWidth;
          });
          expect(overflow, "horizontal overflow (px)").toBeLessThanOrEqual(0);
          const bg = await page.evaluate(
            () => getComputedStyle(document.body).backgroundColor,
          );
          expect(bg).toBe(
            scheme === "dark" ? "rgb(10, 10, 10)" : "rgb(255, 255, 255)",
          );
          expect(errors).toEqual([]);
        });
      }
    });
  }
}

test("the notebook is served for download, with the Colab link", async ({
  page,
  request,
}) => {
  const res = await request.get("/run_sweep.ipynb");
  expect(res.status()).toBe(200);
  const nb = await res.json();
  expect(nb.cells.length).toBeGreaterThan(3);
  await page.goto("/notebook");
  await expect(
    page.getByRole("link", { name: "Download run_sweep.ipynb" }),
  ).toHaveAttribute("href", "/run_sweep.ipynb");
  await expect(
    page.getByRole("link", { name: /Open in Colab/ }),
  ).toHaveAttribute(
    "href",
    "https://colab.research.google.com/github/BrendanJamesLynskey/DeMo_Fixed_Band_Experiment/blob/main/colab/run_sweep.ipynb",
  );
  // every code cell is rendered and highlighted
  const cells = nb.cells.filter(
    (c: { cell_type: string }) => c.cell_type === "code",
  ).length;
  await expect(page.locator("[data-testid=notebook] pre")).toHaveCount(cells);
  await expect(
    page.locator("[data-testid=notebook] .hljs-keyword").first(),
  ).toBeVisible();
});

test("the header links every page and the series hub; the home page links the five decks", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Site" });
  for (const name of [
    "Experiment",
    "Energy",
    "Optics",
    "Transit",
    "Notebook",
    "Method",
  ])
    await expect(nav.getByRole("link", { name })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Series hub/ })).toHaveAttribute(
    "href",
    "https://brendanjameslynskey.github.io/LLM_Hub_Compute_in_Transit/",
  );
  for (const repo of [
    "CiT_01_Compute_in_Transit",
    "CiT_02_Data_Movement_in_LLM_Training",
    "CiT_03_Data_Movement_in_LLM_Inference",
    "CiT_04_Fixed_Band_Experiment",
    "CiT_05_Training_Transit_Simulation",
  ])
    await expect(
      page
        .locator(`a[href="https://brendanjameslynskey.github.io/${repo}/"]`)
        .first(),
    ).toBeVisible();
});
