/**
 * Every page renders at desktop and phone widths, in light and dark mode,
 * with no page errors, no console errors and no horizontal overflow; and the
 * companion sites' three-group switch is in the header, with this site current.
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

test("the site switch: four tracks, and the button and header say where you are", async ({
  page,
}) => {
  const menu = page.locator("[data-site-switch='menu']");
  const panel = menu.locator("summary + div");
  const site = (key: string) => panel.locator(`[data-site-key='${key}']`);
  const brand = page.locator("header [data-site-brand]");
  for (const width of [1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    // closed: the button reads "<Track> › <Site>", and the header shows the same place
    await expect(menu).toBeVisible();
    await expect(menu.locator("summary")).toHaveText(/^Compute in transit\W*$/);
    await expect(brand).toHaveText(/^Compute in transit\W*$/);
    expect(await brand.locator("[data-site-place]").textContent()).toBe(
      await menu.locator("summary [data-site-place]").textContent(),
    );
    if (width === 1280)
      expect((await brand.boundingBox())!.height).toBeLessThan(30);
    await expect(panel).toBeHidden();
    // one click opens every track, in the order Foundations, Hardware, Inference, Agents
    await menu.locator("summary").click();
    await expect(panel).toBeVisible();
    await expect(menu.locator("nav > p:first-child")).toHaveText([
      "Foundations",
      "Hardware",
      "Inference",
      "Agents",
    ]);
    await expect(menu.locator("nav > p:nth-child(2)")).toHaveText([
      "One small model, end to end",
      "The machines underneath, chip to rack",
      "Serving models at scale",
      "Building on models",
    ]);
    // every site, in order, with its name, its one-line description and its address
    const SITES = [
      [
        "decoder",
        "Decoder",
        "How it runs, one forward pass",
        "https://transformer-decoder-explained.vercel.app",
      ],
      [
        "training",
        "Training",
        "How it learns, from one step to many GPUs",
        "https://transformer-training-explained.vercel.app",
      ],
      [
        "kernels",
        "Kernels",
        "How a GPU executes the maths",
        "https://gpu-kernels-explained.vercel.app",
      ],
      [
        "silicon",
        "Silicon",
        "Inside a matrix engine",
        "https://systolic-arrays-explained.vercel.app",
      ],
      ["racks", "Racks", "GPUs, networks, power, cooling at scale", ""],
      [
        "inference",
        "Serving",
        "How real systems generate text",
        "https://llm-inference-explained.vercel.app",
      ],
      [
        "architectures",
        "Architectures",
        "How model designs differ",
        "https://llm-architectures-explained.vercel.app",
      ],
      [
        "numerics",
        "Numerics",
        "Number formats and quantisation",
        "https://numerics-explained.vercel.app",
      ],
      [
        "tradeoffs",
        "Trade-offs",
        "Which lever helps which metric",
        "https://inference-tradeoffs-explained.vercel.app",
      ],
      [
        "harnesses",
        "Harnesses",
        "The loop between a model and the world",
        "https://agent-harnesses-explained.vercel.app",
      ],
      [
        "protocols",
        "Protocols",
        "MCP, transports, auth and A2A",
        "https://agent-protocols-explained.vercel.app",
      ],
      [
        "context",
        "Context",
        "Retrieval, memory and context engineering",
        "https://agent-context-explained.vercel.app",
      ],
      [
        "orchestration",
        "Orchestration",
        "Graphs, multi-agent patterns, durability",
        "https://agent-orchestration-explained.vercel.app",
      ],
      ["evals", "Evals", "Measuring agents", ""],
      ["security", "Security", "Threats and defences", ""],
    ] as const;
    expect(
      await panel
        .locator("[data-site-key]")
        .evaluateAll((els) => els.map((e) => e.getAttribute("data-site-key"))),
    ).toEqual(SITES.map((s) => s[0]));
    for (const [key, name, blurb, href] of SITES) {
      await expect(site(key)).toContainText(name);
      await expect(site(key)).toContainText(blurb);
      if (href) await expect(site(key)).toHaveAttribute("href", href);
      // not live yet: shown, marked "(soon)", not a link
      else {
        await expect(site(key)).toContainText("(soon)");
        await expect(site(key)).not.toHaveAttribute("href", /./);
      }
    }
    // each track holds its own sites
    for (const [group, n] of [
      ["foundations", 2],
      ["hardware", 3],
      ["inference", 4],
      ["agents", 6],
    ] as const)
      await expect(
        menu.locator(`nav[data-site-group='${group}'] [data-site-key]`),
      ).toHaveCount(n);
    // no site is named after a track
    await expect(
      panel.getByRole("link", {
        name: /^(Foundations|Hardware|Inference|Agents)\b/,
      }),
    ).toHaveCount(0);
    // this site is unlisted (in no track), so nothing in the panel is highlighted
    await expect(panel.locator("[aria-current]")).toHaveCount(0);
    await expect(panel.getByText("Compute in transit")).toHaveCount(0);
    // every entry is a 44 px touch target
    expect(
      (await site("decoder").boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
    // the tracks sit side by side on desktop and stack on a phone
    const f = (await menu
      .locator("nav[data-site-group='foundations']")
      .boundingBox())!;
    const a = (await menu
      .locator("nav[data-site-group='agents']")
      .boundingBox())!;
    if (width >= 1024) expect(Math.round(a.y)).toBe(Math.round(f.y));
    else expect(a.y).toBeGreaterThan(f.y);
    // the open panel stays on screen and the page never scrolls sideways
    const p = (await panel.boundingBox())!;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x + p.width).toBeLessThanOrEqual(width);
    expect(p.y + p.height).toBeLessThanOrEqual(800);
    const overflow = await page.evaluate(
      () =>
        document.scrollingElement!.scrollWidth -
        document.scrollingElement!.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
  // keyboard: Enter on the button opens the menu (a native <details>, no JavaScript),
  // and Tab goes on to the first site
  await page.goto("/");
  await menu.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(site("decoder")).toBeFocused();
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

test("the method page sends readers new to training to the Training site", async ({
  page,
}) => {
  await page.goto("/method");
  const prereq = page.locator("[data-callout=prereq]");
  await expect(prereq).toContainText("New to training?");
  // it names the site, never "Part 2"
  await expect(prereq).toContainText("The Training site");
  await expect(prereq).not.toContainText("Part 2");
  await expect(
    prereq.getByRole("link", { name: "data parallelism and all-reduce" }),
  ).toHaveAttribute(
    "href",
    "https://transformer-training-explained.vercel.app/training/11-data-parallelism",
  );
  await expect(
    prereq.getByRole("link", { name: "training over slow links" }),
  ).toHaveAttribute(
    "href",
    "https://transformer-training-explained.vercel.app/training/13-slow-links",
  );
});
