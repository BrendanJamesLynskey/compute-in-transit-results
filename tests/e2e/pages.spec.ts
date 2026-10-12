/**
 * Every page renders at desktop and phone widths, in light and dark mode,
 * with no page errors, no console errors and no horizontal overflow; and the
 * companion sites' two-group switch is in the header, with this site current.
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
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
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

test("the two-group site switch: a toggle and a row on desktop, a dropdown below lg", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const full = page.locator("[data-site-switch='full']");
  await expect(full).toBeVisible();
  const llm = full.locator("nav[data-site-group='llm']");
  const agents = full.locator("nav[data-site-group='agents']");
  // starts on this site's group
  await expect(llm).toBeVisible();
  await expect(agents).toBeHidden();
  await expect(
    llm.getByRole("link", { name: "Compute in transit" }),
  ).toHaveAttribute("aria-current", "true");
  // the row fits inside the header, next to this site's own nav
  const header = await page.getByRole("banner").locator("> div").boundingBox();
  const row = await llm.boundingBox();
  expect(row!.x + row!.width).toBeLessThanOrEqual(header!.x + header!.width);
  for (const [name, href] of [
    ["Decoder", "https://transformer-decoder-explained.vercel.app"],
    ["Inference", "https://llm-inference-explained.vercel.app"],
    ["Architectures", "https://llm-architectures-explained.vercel.app"],
    ["Kernels", "https://gpu-kernels-explained.vercel.app"],
    ["Numerics", "https://numerics-explained.vercel.app"],
    ["Silicon", "https://systolic-arrays-explained.vercel.app"],
    ["Trade-offs", "https://inference-tradeoffs-explained.vercel.app"],
    ["Compute in transit", "https://compute-in-transit-results.vercel.app"],
  ] as const)
    await expect(llm.getByRole("link", { name })).toHaveAttribute("href", href);
  // the toggle shows the agent sites (CSS only)
  await full.getByText("Agents", { exact: true }).click();
  await expect(agents).toBeVisible();
  await expect(llm).toBeHidden();
  await expect(agents.getByRole("link", { name: "Harnesses" })).toHaveAttribute(
    "href",
    "https://agent-harnesses-explained.vercel.app",
  );
  await expect(agents.getByRole("link", { name: "Protocols" })).toHaveAttribute(
    "href",
    "https://agent-protocols-explained.vercel.app",
  );
  await expect(agents.getByRole("link", { name: "Context" })).toHaveAttribute(
    "href",
    "https://agent-context-explained.vercel.app",
  );
  for (const soon of ["Orchestration", "Evals", "Security"]) {
    await expect(agents.getByText(soon)).toBeVisible();
    await expect(agents.getByRole("link", { name: soon })).toHaveCount(0);
  }
  // keyboard: the toggle is a pair of radio buttons
  await page.getByRole("radio", { name: "Show the LLM systems sites" }).focus();
  await page.keyboard.press("Space");
  await expect(llm).toBeVisible();

  // below lg (not sm): the dropdown
  await page.setViewportSize({ width: 768, height: 800 });
  await expect(full).toBeHidden();
  const compact = page.locator("[data-site-switch='compact']");
  await expect(compact).toBeVisible();
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(compact).toBeVisible();
  await compact.locator("summary").click();
  // the header wraps here, so the dropdown must still open on-screen
  const panel = await compact.locator("summary + div").boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  await expect(compact.getByText("LLM systems")).toBeVisible();
  await expect(compact.getByText("Agents", { exact: true })).toBeVisible();
  await expect(
    compact.getByRole("link", { name: "Compute in transit" }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    compact.getByRole("link", { name: "Harnesses" }),
  ).toHaveAttribute("href", "https://agent-harnesses-explained.vercel.app");
  await expect(
    compact.getByRole("link", { name: "Protocols" }),
  ).toHaveAttribute("href", "https://agent-protocols-explained.vercel.app");
  await expect(compact.getByRole("link", { name: "Context" })).toHaveAttribute(
    "href",
    "https://agent-context-explained.vercel.app",
  );
  await expect(compact.getByText("Security")).toBeVisible();
  await expect(compact.getByRole("link", { name: "Security" })).toHaveCount(0);
  await expect(
    compact.getByRole("link", { name: "Trade-offs" }),
  ).toHaveAttribute("href", "https://inference-tradeoffs-explained.vercel.app");
  const box = await compact
    .getByRole("link", { name: "Decoder" })
    .boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(
    () =>
      document.scrollingElement!.scrollWidth -
      document.scrollingElement!.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the home page says why it exists and what it found, before the charts", async ({
  page,
}) => {
  await page.goto("/");
  const why = page.getByRole("heading", { name: "Why this exists" });
  const found = page.getByRole("heading", { name: "What it found" });
  await expect(why).toBeVisible();
  await expect(found).toBeVisible();
  // eight process steps, each a link to where it happened
  const steps = page.getByTestId("process").locator("li a");
  await expect(steps).toHaveCount(8);
  for (const href of await steps.evaluateAll((as) =>
    as.map((a) => a.getAttribute("href")),
  ))
    expect(href).toMatch(/^(\/|https:\/\/)/);
  await expect(
    page.getByTestId("process").locator('li[data-tone="fail"]'),
  ).toHaveCount(1);
  // six findings; the optics one is labelled a hypothesis
  const cards = page.getByTestId("findings").locator("li");
  await expect(cards).toHaveCount(6);
  await expect(
    page
      .locator('[data-finding="optics"]')
      .getByText("hypothesis, not a result"),
  ).toBeVisible();
  await expect(
    page.getByText("A negative result is still a result"),
  ).toBeVisible();
  // both come before the detailed charts
  const y = async (l: import("@playwright/test").Locator) =>
    (await l.boundingBox())!.y;
  const chart = page.getByRole("heading", {
    name: "The answer, in one picture",
  });
  expect(await y(found)).toBeLessThan(await y(chart));
  expect(await y(why)).toBeLessThan(await y(found));
});
