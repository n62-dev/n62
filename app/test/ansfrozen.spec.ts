// SPDX-License-Identifier: GPL-3.0-or-later
// G640 (owner, 2026-11-20 night, H3): a history row that used Ans draws and copies the value Ans had (frozen in history); on
// the line Ans stays live (the engine side: src/state/ansFrozen.engine.test.ts). No app code: the cases R836 (the chip drawn,
// the text writers) makes pass are in KNOWN_FAIL and marked test.fail() (as bksp-grid.spec.ts keeps them), so a known-fail
// that passes fails the run and R836 deletes each line as it turns green. Expected values are derived: 5² = 25, 1/3 to 12
// digits is 0.333333333333 and 1/3 · 3 = 1; the σ row's chip is compared with what its source row draws, never typed in.
import { expect, test, type Page } from "@playwright/test";
import { finger } from "./core-lib.ts";
import { open, savePicker, savedText, setClipboard, tap } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const rows = (page: Page) => page.locator("article.item[data-status]");
/** The chip drawn in row k's input (`\ans` and a result chip draw on the chip tint, entry/macros.ts). */
const chipIn = (page: Page, k: number) => rows(page).nth(k).locator('.in [style*="--chip-tint"]');
const bare = (s: string | null): string => (s ?? "").replace(/\s+/g, "");

async function ready(page: Page): Promise<void> {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
}
/** Each line put on the entry and entered, finished before the next. */
async function enter(page: Page, ...lines: string[]): Promise<void> {
  const done = page.locator('[data-status="done"]');
  for (const latex of lines) {
    const before = await done.count();
    await page.evaluate((l) => window.n62.entry.insert(l), latex);
    await tap(page, ["enter"]);
    await expect(done).toHaveCount(before + 1, { timeout: 30_000 });
  }
}
/** ☰ › Share session: on a device that cannot share, one line per entry on the clipboard. */
async function shareSession(page: Page): Promise<string[]> {
  await tap(page, ["@menu"]);
  await expect(page.getByTestId("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: /^\d Share session$/ }).click();
  await expect(page.getByTestId("notice")).toHaveText("This device cannot share: copied instead");
  return (await clipboard(page)).split("\n");
}

// ---- cases that fail today, each with the package that makes it pass (that package deletes its line) ------------------
const KNOWN_FAIL = new Map<string, string>([
  ["draws-5", "R836"],
  ["copies-5", "R836"],
  ["session-5", "R836"],
  ["tex-5", "R836"],
  ["draws-third", "R836"],
  ["sigma-chip", "R836"],
]);
const known = (id: string, what: string, fn: (page: Page) => Promise<void>): void => {
  const pkg = KNOWN_FAIL.get(id);
  test(`${pkg ? `${pkg} (known-fail) ` : ""}${what}`, async ({ page }) => {
    if (pkg) test.fail();
    await fn(page);
  });
};

// ---- pins: green today, kept green ----
test("a row stored before G213f1 (no `ans`) draws the word Ans and a hold on its input copies Ans^2, after a relaunch", async ({ page }) => {
  await ready(page);
  await enter(page, "5", "\\ans^{2}");
  await page.evaluate(() => {
    const s = window.n62.session;
    delete s.home[1]?.ans; // the row as G213f1's predecessors stored it
    s.flushHistory();
  });
  await page.waitForTimeout(800); // the store write is asynchronous
  await page.reload();
  await page.waitForFunction(() => window.n62 !== undefined);
  await expect(rows(page)).toHaveCount(2);
  expect(await page.evaluate(() => window.n62.session.home[1]?.ans)).toBeUndefined();
  await expect(chipIn(page, 1)).toHaveText("Ans");
  await expect(rows(page).nth(1).locator(".result")).toHaveAttribute("data-text", "25");
  await setClipboard(page, "before");
  await finger(page, "input:last", { ms: 700 });
  await expect.poll(() => clipboard(page)).toBe("Ans^2");
});

test("G×5.972ᴇ24, then Ans×2: the result shows σ (G355)", async ({ page }) => {
  await ready(page);
  await gTimesM(page);
  await enter(page, "\\ans\\times2");
  expect(await page.evaluate(() => window.n62.session.sigma(window.n62.session.home[1]!))).toMatch(/^σ = /);
});

/** G (the Find constant, with its σ) × 5.972ᴇ24 as the keys put it on the line, entered. */
async function gTimesM(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const url = "/src/find/finder.ts";
    const f = (await import(/* @vite-ignore */ url)) as { loadIndex(u: boolean): Promise<{ byId: Map<string, unknown> }>; putOnLine(e: unknown, it: unknown): void };
    f.putOnLine(window.n62.entry, (await f.loadIndex(true)).byId.get("const:G"));
  });
  await tap(page, ["mul", "d5", "dot", "d9", "d7", "d2", "emark", "d2", "d4", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1, { timeout: 30_000 });
}

// ---- known-fail until R836 ----
known("draws-5", "5, then Ans²: the row draws [5]² (a chip whose text is 5) and = 25", async (page) => {
  await ready(page);
  await enter(page, "5", "\\ans^{2}");
  await expect(rows(page).nth(1).locator(".result")).toHaveAttribute("data-text", "25");
  await expect(chipIn(page, 1)).toHaveText("5", { timeout: 2000 });
});

known("copies-5", "5, then Ans²: a hold on the row's input copies 5^2", async (page) => {
  await ready(page);
  await enter(page, "5", "\\ans^{2}");
  await setClipboard(page, "before");
  await finger(page, "input:last", { ms: 700 });
  await expect.poll(() => clipboard(page), { timeout: 2000 }).toBe("5^2");
});

known("session-5", "5, then Ans²: Share session writes the row as 5^2 = 25", async (page) => {
  await ready(page);
  await enter(page, "5", "\\ans^{2}");
  expect((await shareSession(page))[1]).toBe("5^2 = 25");
});

known("tex-5", "5, then Ans²: the .tex export writes the row with 5, not \\mathrm{Ans}", async (page) => {
  await savePicker(page, "fake");
  await ready(page);
  await enter(page, "5", "\\ans^{2}");
  await tap(page, ["@menu", "d4"]);
  await page.getByTestId("menu").locator('[data-id="latex"]').tap();
  await expect(page.getByTestId("notice")).toHaveText("LaTeX saved");
  const line = (await savedText(page))?.text.split("\n").find((l) => l.includes("&=") && l.includes("25"));
  expect(line).toBeDefined();
  expect(line).not.toContain("\\mathrm{Ans}");
  expect(line).toMatch(/\{?5\}?\^\{?2\}?/);
});

known("draws-third", "1/3, then Ans×3: the row reads [0.333 333 333 333]×3 = 1", async (page) => {
  await ready(page);
  await enter(page, "\\frac{1}{3}", "\\ans\\times3");
  await expect(rows(page).nth(1).locator(".result")).toHaveAttribute("data-text", "1");
  await expect(rows(page).nth(1).locator('[data-testid="mark"]')).toHaveText("=");
  await expect.poll(async () => bare(await chipIn(page, 1).textContent()), { timeout: 2000 }).toBe("0.333333333333");
});

known("sigma-chip", "G×5.972ᴇ24, then Ans×2: the row's chip draws the source row's value with its σ, and the result shows σ", async (page) => {
  await ready(page);
  await gTimesM(page);
  await enter(page, "\\ans\\times2");
  expect(await page.evaluate(() => window.n62.session.sigma(window.n62.session.home[1]!))).toMatch(/^σ = /);
  const source = bare(await rows(page).nth(0).locator(".result").textContent());
  expect(source).not.toBe("");
  await expect.poll(async () => bare(await chipIn(page, 1).textContent()), { timeout: 2000 }).toBe(source);
});
