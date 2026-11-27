// SPDX-License-Identifier: GPL-3.0-or-later
// R74f1: the clipboard lock excludes other workers. Headless Chromium may give each context its own clipboard, so the
// shared thing here is a file: every worker writes its own value, waits, and reads back its own; without the lock
// (useClipboardLock) a neighbour's write lands in between. The page clipboard is checked the same way.
// A281: every other spec has its own clipboard per context (helpers.ts ownClipboard); the tests below the lock's own check
// that, that a real Copy and Paste still works on Chromium's clipboard, and which files may hold the lock.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { devices, expect, test, type Page } from "@playwright/test";
import { acquireClipboardLock, CLIPBOARD_LOCK_FILES, CLIPBOARD_TICKETS, clipboardBudget, entryValue, KEYCOPY, KEYPASTE, open, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "parallel" });

const SHARED = resolve("test-results", "clipboard-lock-shared.txt");

test("a second acquire stays pending while the first holds the lock, and succeeds after the release", async () => {
  test.setTimeout(clipboardBudget(test.info().project.timeout)); // the wait for the lock (held by the suite's clipboard tests) must not eat the test's own budget, as in useClipboardLock
  const release = await acquireClipboardLock();
  try {
    await expect(acquireClipboardLock(300)).rejects.toThrow("clipboard lock not free");
  } finally {
    release();
  }
  (await acquireClipboardLock())();
});

// F202: the waiters are served in the order they came (a numbered ticket), not by whose poll lands first.
test("six waiters that start in order acquire in that order", async () => {
  test.setTimeout(clipboardBudget(test.info().project.timeout));
  const release = await acquireClipboardLock();
  const order: number[] = [];
  const waiters: Promise<void>[] = [];
  for (let i = 0; i < 6; i++) {
    waiters.push(
      acquireClipboardLock().then((rel) => {
        order.push(i);
        rel();
      }),
    );
    await new Promise((r) => setTimeout(r, 120)); // each one has asked before the next starts
  }
  release();
  await Promise.all(waiters);
  expect(order).toEqual([0, 1, 2, 3, 4, 5]);
});

test("a waiter that gives up leaves no ticket behind and does not block the next one", async () => {
  test.setTimeout(clipboardBudget(test.info().project.timeout));
  const release = await acquireClipboardLock();
  await expect(acquireClipboardLock(300)).rejects.toThrow("clipboard lock not free");
  const mine = (): string[] => {
    try {
      return readdirSync(CLIPBOARD_TICKETS).filter((n) => /^\d+$/.test(n) && readFileSync(`${CLIPBOARD_TICKETS}/${n}`, "utf8").startsWith(`${process.pid} `));
    } catch {
      return [];
    }
  };
  expect(mine()).toEqual([]); // this process is the only one of mine in the queue, and it is not there
  const next = acquireClipboardLock();
  release();
  (await next)();
});

test("a ticket whose process is dead is skipped", async () => {
  test.setTimeout(clipboardBudget(test.info().project.timeout));
  const dead = spawnSync(process.execPath, ["-e", "0"]).pid; // a pid that has ended
  mkdirSync(CLIPBOARD_TICKETS, { recursive: true });
  const ticket = `${CLIPBOARD_TICKETS}/000000000`; // lower than any live ticket
  writeFileSync(ticket, `${dead} gone`);
  (await acquireClipboardLock())();
  expect(existsSync(ticket)).toBe(false);
});

test.describe("workers", () => {
  useClipboardLock(); // R74f1: the lock's own test, on the shared clipboard and file on purpose
for (const v of ["alpha-1", "beta-2", "gamma-3", "delta-4"]) {
  test(`the shared clipboard holds ${v} until this test reads it`, async ({ page }) => {
    await open(page);
    mkdirSync(resolve("test-results"), { recursive: true });
    writeFileSync(SHARED, v);
    await page.evaluate((s) => navigator.clipboard.writeText(s), v);
    await page.waitForTimeout(600); // long enough for any unlocked neighbour to write
    expect(readFileSync(SHARED, "utf8")).toBe(v);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(v);
  });
}
  // A281: under the lock a page keeps Chromium's own clipboard (the app's real permission and API path): a real Copy of a
  // row and a real Paste of it, and the page's navigator.clipboard is the browser's, not the per-context store.
  test("a real Copy and Paste through Chromium's system clipboard", async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => Object.getPrototypeOf(navigator.clipboard) === Clipboard.prototype)).toBe(true);
    await copyRow(page, ["d7", "d7"]);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("77");
    expect(await pasteBack(page)).toBe("77");
  });
});

// A281: a test's clipboard is its own (the page's store, installed by `open`), so the specs that only copy and paste hold no lock.
const copyRow = async (page: Page, digits: string[]): Promise<void> => {
  await tap(page, [...digits, "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, KEYCOPY);
  await expect(page.getByTestId("notice")).toContainText("Copied");
};
const pasteBack = async (page: Page): Promise<string> => {
  await tap(page, ["esc", ...KEYPASTE]);
  await expect.poll(() => entryValue(page)).not.toBe("");
  return entryValue(page);
};

test("A281: two contexts of one browser each get their own text back from Copy and Paste (no lock held)", async ({ browser, baseURL }) => {
  const mk = () => browser.newContext({ ...devices["Pixel 7"], baseURL: baseURL ?? "", permissions: ["clipboard-read", "clipboard-write"] });
  const [c1, c2] = [await mk(), await mk()];
  try {
    const [p1, p2] = [await c1.newPage(), await c2.newPage()];
    await open(p1);
    await open(p2);
    await copyRow(p1, ["d1", "d1"]);
    await copyRow(p2, ["d2", "d2"]); // lands between the first Copy and its Paste
    const [a, b] = [await pasteBack(p1), await pasteBack(p2)];
    expect([a, b]).toEqual(["11", "22"]);
  } finally {
    await c1.close();
    await c2.close();
  }
});

// A281f1: the store lives in the test process (helpers.ts ownClipboard), not in the page an init script re-creates on each
// load: a text copied before a reload is pasted after it, and on a fresh page of the same context (persist.spec's relaunch).
test("A281f1: a text copied before reload() is pasted after it, and on a fresh page of the same context", async ({ page }) => {
  await open(page);
  await copyRow(page, ["d8", "d8"]);
  await page.reload();
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.n62 !== undefined);
  await page.evaluate(() => window.n62.entry.ready);
  expect(await pasteBack(page)).toBe("88");
  const next = await page.context().newPage();
  await open(next);
  expect(await pasteBack(next)).toBe("88");
});

test.describe("two workers at once", () => {
  test.describe.configure({ mode: "parallel" });
  const MARK = (n: string): string => resolve("test-results", `clipboard-own-${n}.txt`);
  for (const [n, digits, want] of [["a", ["d3", "d3"], "33"], ["b", ["d4", "d4"], "44"], ["c", ["d5", "d5"], "55"], ["d", ["d6", "d6"], "66"]] as const) {
    test(`${n}: Copy a row, a neighbour copies another, Paste gives ${want}`, async ({ page }) => {
      await open(page);
      mkdirSync(resolve("test-results"), { recursive: true });
      await copyRow(page, [...digits]);
      writeFileSync(MARK(n), String(Date.now()));
      // wait (at most 4 s) for a neighbour's Copy, so the Paste follows another test's write when the workers overlap
      const t0 = Date.now();
      while (Date.now() - t0 < 4000 && !["a", "b", "c", "d"].some((o) => o !== n && existsSync(MARK(o)) && Date.now() - Number(readFileSync(MARK(o), "utf8")) < 30_000)) await page.waitForTimeout(100);
      await page.waitForTimeout(300);
      expect(await pasteBack(page)).toBe(want);
    });
  }
});

// A281: the lock is for the files that test the real system clipboard on purpose; each call carries its reason on its line.
test("useClipboardLock is called only by the files listed in helpers.ts, each call with a one-line reason comment", () => {
  const calls: Record<string, string[]> = {};
  for (const f of readdirSync(resolve("test")).filter((n) => n.endsWith(".spec.ts"))) {
    const lines = readFileSync(resolve("test", f), "utf8").split("\n").filter((l) => /^\s*useClipboardLock\(\);/.test(l));
    if (lines.length > 0) calls[f] = lines;
  }
  for (const [f, lines] of Object.entries(calls)) {
    expect(Object.keys(CLIPBOARD_LOCK_FILES), `${f} calls useClipboardLock and is not in CLIPBOARD_LOCK_FILES (helpers.ts)`).toContain(f);
    for (const l of lines) expect(l, `${f}: a call without a reason comment beside it`).toMatch(/useClipboardLock\(\);\s*\/\/\s*\S+(\s+\S+){3,}/);
  }
  for (const f of Object.keys(CLIPBOARD_LOCK_FILES)) expect(Object.keys(calls), `${f} is in CLIPBOARD_LOCK_FILES and no longer calls useClipboardLock`).toContain(f);
});
