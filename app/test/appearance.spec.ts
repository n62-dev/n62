// SPDX-License-Identifier: GPL-3.0-or-later
// R50e (docs/05 3.4, 3.10; mockups/settings.html section 3): Settings › Appearance holds Theme, Brightness, High contrast
// and Plain keys. By touch and by keys; each value survives a reload; the first frame already has the stored theme;
// `prefers-contrast: more` counts at the first start only; a theme pick keeps the sheet open. The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { open, sheet, sheetKey, tap } from "./helpers.ts";

const title = (page: Page) => page.getByTestId("sheet-title");
const row = (page: Page, id: string) => sheet(page).locator(`[role="menuitem"][data-id="${id}"]`);
const root = (page: Page) => page.locator("html");
const look = (page: Page) => page.evaluate(() => window.n62.session.settings.look);
const attrs = (page: Page) =>
  page.evaluate(() => ["data-family", "data-brightness", "data-contrast", "data-keys"].map((a) => document.documentElement.getAttribute(a)));
/** The look written to IndexedDB (a reload reads this, not the page's memory). */
const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<unknown>((res) => {
        const req = indexedDB.open("n62");
        req.onsuccess = () => {
          const g = req.result.transaction("kv").objectStore("kv").get("settings");
          g.onsuccess = () => res((g.result as { value?: { look?: unknown } } | undefined)?.value?.look);
        };
      }),
  );
async function reload(page: Page): Promise<void> {
  await page.waitForTimeout(300); // the store writes behind the change
  await page.reload();
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.n62 !== undefined);
  await page.evaluate(() => window.n62.entry.ready);
  await page.waitForTimeout(150);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 372, height: 767 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
});
// every test but the last describe starts the app at once; "prefers-contrast: more" sets the media before the first start
test.beforeEach(async ({ page }, info) => {
  if (!info.title.startsWith("pc:")) await open(page);
});

test.describe("the level", () => {
  test("Mode, 6, 1: Theme with its dots and name, Brightness, and four switches with a line each (Key pop-ups: R163)", async ({ page }) => {
    await tap(page, ["@mode", "d6", "d1"]);
    await expect(title(page)).toHaveText("Mode › Settings › Appearance");
    await expect(sheet(page).getByRole("menuitem")).toHaveCount(6);
    await expect(row(page, "theme").getByTestId("row-dots").locator("i")).toHaveCount(5);
    await expect(row(page, "theme").getByTestId("sheet-value")).toHaveText("N62");
    await expect(row(page, "brightness").getByTestId("sheet-value")).toHaveText("System");
    await expect(row(page, "contrast").getByTestId("row-hint")).toHaveText("Text at 7:1, outlined keys");
    await expect(row(page, "plain").getByTestId("row-hint")).toHaveText("No colour coding");
    await expect(row(page, "shadow").getByTestId("row-hint")).toHaveText("A dark line under each key");
    await expect(row(page, "pops").getByTestId("row-hint")).toHaveText("A bubble over the key you press or flick");
  });

  test("by keys: ▶ ◀ step the theme in place, Enter lists the three, a digit picks and the sheet stays", async ({ page }) => {
    await tap(page, ["@mode", "d6", "d1"]);
    await sheetKey(page, ["right"]);
    await expect(root(page)).toHaveAttribute("data-family", "bw");
    await expect(row(page, "theme").getByTestId("sheet-value")).toHaveText("Black & White");
    await sheetKey(page, ["left", "left"]);
    await expect(row(page, "theme").getByTestId("sheet-value")).toHaveText("Solarized");
    await tap(page, ["enter"]);
    await expect(title(page)).toHaveText("Settings › Appearance › Theme");
    await expect(sheet(page).getByRole("menuitem")).toHaveCount(3);
    await expect(sheet(page).locator('[data-active="true"]')).toHaveAttribute("data-id", "solarized");
    await tap(page, ["d2"]);
    await expect(root(page)).toHaveAttribute("data-family", "bw");
    await expect(title(page)).toHaveText("Settings › Appearance › Theme"); // a pick keeps the sheet open
    await tap(page, ["esc"]);
    await expect(title(page)).toHaveText("Mode › Settings › Appearance");
    await sheetKey(page, ["down", "right", "right"]); // Brightness: Light, Dark
    await expect(row(page, "brightness").getByTestId("sheet-value")).toHaveText("Dark");
    await tap(page, ["d3", "d4"]);
    expect(await look(page)).toEqual({ family: "bw", brightness: "dark", contrast: true, plain: true, shadow: true, pops: true });
    await expect.poll(() => attrs(page)).toEqual(["bw", "dark", "high", "plain"]); // the lazy CSS is in first
  });

  test("by touch: a tap on Theme lists the three with their dots; a pick keeps the sheet open and the page follows", async ({ page }) => {
    await tap(page, ["@mode", "d6"]);
    await row(page, "appearance").tap();
    await row(page, "theme").locator(".label").tap();
    await expect(title(page)).toHaveText("Settings › Appearance › Theme");
    await expect(sheet(page).locator("[data-testid=row-dots]")).toHaveCount(3);
    await row(page, "bw").tap();
    await expect(sheet(page)).toBeVisible();
    await expect(root(page)).toHaveAttribute("data-family", "bw");
    await expect(row(page, "bw")).toHaveAttribute("data-selected", "true");
    // the status line above the sheet already wears the theme
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())).toBe("#000000");
    await sheet(page).getByRole("button", { name: "Back" }).tap();
    await row(page, "brightness").getByTestId("step-up").tap();
    await expect(root(page)).toHaveAttribute("data-brightness", "light");
    await row(page, "contrast").tap();
    await row(page, "plain").tap();
    await expect(root(page)).toHaveAttribute("data-contrast", "high");
    await expect(root(page)).toHaveAttribute("data-keys", "plain");
    await expect(sheet(page)).toBeVisible();
  });

  test("two theme picks in a row end in the last one", async ({ page }) => {
    await tap(page, ["@mode", "d6", "d1", "enter", "d2", "d3"]);
    await expect(root(page)).toHaveAttribute("data-family", "solarized");
    await page.waitForTimeout(400);
    await expect(root(page)).toHaveAttribute("data-family", "solarized");
  });
});

test.describe("R153: N62 in teal, Black & White, Solarized", () => {
  /** The first frame of a start with `mirror` as the stored look (index.html's localStorage mirror), main.ts held. */
  async function firstFrame(page: Page, mirror: Record<string, unknown>): Promise<{ attrs: (string | null)[]; bg: string; started: boolean }> {
    // An init script, not a setItem on the open page: the app's start-up applyLook writes the mirror after applyTheme and
    // can land after a setItem, so the reload read N62 with no switch (2 of 3 runs). This is the last write before index.html's inline script.
    await page.addInitScript((m) => localStorage.setItem("n62.look", JSON.stringify(m)), mirror);
    let release: () => void = () => {};
    const held = new Promise<void>((res) => (release = res));
    await page.route(/\/src\/main\.ts/, async (route) => {
      await held;
      await route.abort();
    });
    await page.goto("/?engine=fake&tips=off", { waitUntil: "commit" });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-family") && getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() !== "");
    const out = {
      attrs: await attrs(page),
      bg: await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()),
      started: await page.evaluate(() => window.n62 !== undefined),
    };
    release();
    return out;
  }
  test("Appearance lists N62, Black & White, Solarized in that order; N62 Dark is the deep teal", async ({ page }) => {
    await tap(page, ["@mode", "d6", "d1", "enter"]);
    await expect(title(page)).toHaveText("Settings › Appearance › Theme");
    await expect(sheet(page).getByRole("menuitem")).toHaveCount(3);
    await expect(sheet(page).getByRole("menuitem").locator(".label")).toHaveText(["N62", "Black & White", "Solarized"]);
    expect(await sheet(page).getByRole("menuitem").evaluateAll((els) => els.map((e) => e.getAttribute("data-id")))).toEqual(["n62", "bw", "solarized"]);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())).toBe("#092726");
  });
  // Plain keys on, so the first frame links n62.css (in the dev server style.css comes with main.ts, which is held here)
  test("a stored teal (the mirror) paints N62 in the first frame", async ({ page }) => {
    const f = await firstFrame(page, { family: "teal", brightness: "dark", contrast: false, plain: true, bg: "#529997" });
    expect(f).toEqual({ attrs: ["n62", "dark", null, "plain"], bg: "#092726", started: false });
    expect(await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute("content"))).toBe("#092726"); // not Teal's old screen
  });
  test("a stored bw paints Black & White in the first frame", async ({ page }) => {
    const f = await firstFrame(page, { family: "bw", brightness: "dark", contrast: false, plain: false, bg: "#000000" });
    expect(f).toEqual({ attrs: ["bw", "dark", null, null], bg: "#000000", started: false });
  });
});

test.describe("survives a reload", () => {
  test("each of the four values, set by touch", async ({ page }) => {
    await tap(page, ["@mode", "d6"]);
    await row(page, "appearance").tap();
    await row(page, "theme").getByTestId("step-up").tap();
    await row(page, "theme").getByTestId("step-up").tap(); // Solarized
    await row(page, "brightness").getByTestId("step-up").tap(); // Light
    await row(page, "contrast").tap();
    await row(page, "plain").tap();
    await expect.poll(() => stored(page)).toEqual({ family: "solarized", brightness: "light", contrast: true, plain: true, shadow: true, pops: true });
    await reload(page);
    expect(await look(page)).toEqual({ family: "solarized", brightness: "light", contrast: true, plain: true, shadow: true, pops: true });
    expect(await attrs(page)).toEqual(["solarized", "light", "high", "plain"]);
    await tap(page, ["@mode", "d6", "d1"]);
    await expect(row(page, "theme").getByTestId("sheet-value")).toHaveText("Solarized");
    await expect(row(page, "brightness").getByTestId("sheet-value")).toHaveText("Light");
    await expect(row(page, "contrast")).toHaveAttribute("data-selected", "true");
    await expect(row(page, "plain")).toHaveAttribute("data-selected", "true");
  });

  test("each of the four values, set by keys", async ({ page }) => {
    await tap(page, ["@mode", "d6", "d1"]);
    await sheetKey(page, ["left", "down", "left", "d3", "d4"]); // Solarized (left wraps), Dark, High contrast, Plain keys
    await expect.poll(() => stored(page)).toEqual({ family: "solarized", brightness: "dark", contrast: true, plain: true, shadow: true, pops: true });
    await reload(page);
    expect(await attrs(page)).toEqual(["solarized", "dark", "high", "plain"]);
    await tap(page, ["@mode", "d6", "d1"]);
    await expect(row(page, "theme").getByTestId("sheet-value")).toHaveText("Solarized");
  });

  test("switching the switches off again survives too", async ({ page }) => {
    await tap(page, ["@mode", "d6", "d1", "d3", "d4", "d3", "d4"]);
    await expect.poll(() => attrs(page)).toEqual(["n62", "dark", null, null]);
    await expect.poll(() => stored(page)).toEqual({ family: "n62", brightness: "system", contrast: false, plain: false, shadow: true, pops: true });
    await reload(page);
    expect(await attrs(page)).toEqual(["n62", "dark", null, null]);
  });
});

test.describe("the first frame", () => {
  test("shows the stored theme before main.ts has run (its file held)", async ({ page }) => {
    await tap(page, ["@mode", "d6", "d1"]);
    await sheetKey(page, ["left", "d3", "d4"]); // Solarized, High contrast, Plain keys
    await expect.poll(() => page.evaluate(() => localStorage.getItem("n62.look"))).toContain('"plain":true');
    await expect.poll(() => page.evaluate(() => localStorage.getItem("n62.look"))).toContain('"bg":"#');
    await page.waitForTimeout(300);
    const mirrorBg = await page.evaluate(() => (JSON.parse(localStorage.getItem("n62.look") ?? "{}") as { bg: string }).bg);
    let release: () => void = () => {};
    const held = new Promise<void>((res) => (release = res));
    await page.route(/\/src\/main\.ts/, async (route) => {
      await held;
      await route.abort();
    });
    await page.goto("/?engine=fake&tips=off", { waitUntil: "commit" });
    await page.waitForFunction(() => document.documentElement.getAttribute("data-family") === "solarized");
    expect(await page.evaluate(() => window.n62)).toBeUndefined(); // the app has not started
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())).toBe(mirrorBg);
    expect(await attrs(page)).toEqual(["solarized", "dark", "high", "plain"]);
    expect(await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute("content"))).toBe(
      await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()),
    );
    expect(await page.evaluate(() => [...document.querySelectorAll("link[rel=stylesheet]")].map((l) => l.getAttribute("href") ?? "").filter((h) => /theme\/(solarized|modes)\.css/.test(h)).length)).toBe(2);
    await page.screenshot({ path: "test-results/appearance-first-frame.png" });
    release();
  });

  test("Brightness Light in a Dark-scheme browser: the first frame is light", async ({ page }) => {
    await tap(page, ["@mode", "d6", "d1"]);
    await sheetKey(page, ["down", "right"]); // Light
    await expect(root(page)).toHaveAttribute("data-brightness", "light");
    await page.waitForTimeout(300);
    let release: () => void = () => {};
    const held = new Promise<void>((res) => (release = res));
    await page.route(/\/src\/main\.ts/, async (route) => {
      await held;
      await route.abort();
    });
    await page.goto("/?engine=fake&tips=off", { waitUntil: "commit" });
    await page.waitForFunction(() => document.documentElement.getAttribute("data-brightness") === "light");
    release();
  });
});

test.describe("prefers-contrast: more", () => {
  test("pc: turns High contrast on at the first start only", async ({ page }) => {
    await page.emulateMedia({ contrast: "more" });
    await open(page);
    expect(await attrs(page)).toEqual(["n62", "dark", "high", null]);
    expect((await look(page)).contrast).toBe(true);
    await page.emulateMedia({ contrast: "no-preference" });
    await reload(page);
    expect((await look(page)).contrast).toBe(true); // stored: the setting decides now
    expect(await attrs(page)).toEqual(["n62", "dark", "high", null]);
  });

  test("pc: a start with the setting off stays off even when the phone asks for more", async ({ page }) => {
    await page.emulateMedia({ contrast: "no-preference" });
    await open(page); // the first start: not asked
    expect((await look(page)).contrast).toBe(false);
    await page.emulateMedia({ contrast: "more" });
    await reload(page);
    expect((await look(page)).contrast).toBe(false);
    expect(await attrs(page)).toEqual(["n62", "dark", null, null]);
  });
});
