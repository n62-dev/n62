// SPDX-License-Identifier: GPL-3.0-or-later
// History persistence and the lazy-loaded entry line.
import { expect, test } from "@playwright/test";
import { entryValue, open, PASTE, setClipboard, sheet, sheetKey, tap, tapTwice } from "./helpers.ts";
import { DATA_VERSION } from "../src/state/storage.ts";

// Not helpers.lastResult: this one is the whole result row, not its `.result` part.
const lastResult = (page: import("@playwright/test").Page) => page.locator('[data-testid="result"]').last();

test("history survives a reload and is drawn without calling the engine", async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastResult(page).locator(".result")).toBeVisible();
  await tap(page, ["@cas", "shift", "sq", "d8", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await page.waitForTimeout(800); // the store write is debounced (400 ms) and asynchronous
  await page.reload();
  await page.waitForFunction(() => window.n62 !== undefined);
  // the view that was open (CAS) comes back with its entry and its 2D result
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  expect(await lastResult(page).locator(".math").getAttribute("data-latex")).toBe("2\\sqrt{2}");
  await tap(page, ["@home"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await expect(lastResult(page).locator(".result")).toHaveAttribute("data-text", "0.333333333333");
});

test("keys pressed before MathLive has loaded are queued and replayed", async ({ page }) => {
  await page.goto("/?engine=fake&tips=off");
  await page.locator('[data-key="d1"]').waitFor();
  await tap(page, ["d1", "div", "d3"]);
  await page.waitForFunction(() => window.n62.entry.field !== undefined, undefined, { timeout: 20_000 });
  expect(await entryValue(page)).toBe("\\frac13");
});

test("a definition survives a reload (docs/04 6.2: the defs log is stored and replayed at engine start)", async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["d5", "shift", "emark", "alpha", "vars", "enter"]); // 5▶A
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await page.waitForTimeout(800); // the history and the defs log are written asynchronously
  await page.reload();
  await page.waitForFunction(() => window.n62?.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.n62.entry.ready);
  await tap(page, ["alpha", "vars", "mul", "d2", "enter"]); // A×2
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await expect(lastResult(page).locator(".result")).toHaveAttribute("data-text", "10"); // derived: 5·2
  // Vars and Find read the user's names from the session (docs/04 3.4)
  expect(await page.evaluate(() => window.n62.session.userNames.map((u) => `${u.name}:${u.kind}`))).toEqual(["A:var"]);
});

test("a single-letter function survives a reload (R56: the parser reads the stored names, not this session's parses)", async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  // p(x):=x²: shift alpha P is a lower-case p, alpha − is ":", shift . is "="
  await tap(page, ["shift", "alpha", "emark", "paren", "x", "right", "alpha", "sub", "shift", "dot", "x", "sq", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await page.waitForTimeout(800); // the history and the defs log are written asynchronously
  await page.reload();
  await page.waitForFunction(() => window.n62?.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.n62.entry.ready);
  await tap(page, ["shift", "alpha", "emark", "paren", "d2", "enter"]); // p(2)
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await expect(lastResult(page).locator(".result")).toHaveAttribute("data-text", "4"); // derived: 2²
  await expect(page.getByTestId("mark").last()).toHaveAttribute("data-mark", "=");
});

// R34 (F30): Android kills a background app when memory runs short; the half-typed line must survive it. A kill
// fires no pagehide, so the "kill" here is a hide (visibilitychange) followed by a fresh page on the same store,
// with the old page left as it was.
type Page = import("@playwright/test").Page;
async function hide(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300); // the store write is asynchronous
}
/** A fresh start of the app on the same IndexedDB, as after a kill. A killed page also lets go of the store's writer
 *  lock (R95): the old page does that here, without a flush, so the new one is the writer. */
async function relaunch(page: Page, query: string): Promise<Page> {
  await page.evaluate(() => window.n62.yieldWriter());
  const next = await page.context().newPage();
  await open(next, query);
  return next;
}
const cursorAtEnd = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const mf = window.n62.entry.field;
    return mf !== undefined && mf.selectionIsCollapsed && mf.position === mf.lastOffset;
  });
const engineReady = (page: Page) =>
  page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });

test("a half-typed line with a fraction and a result chip survives a kill (F30)", async ({ page }) => {
  await open(page, "");
  await engineReady(page);
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastResult(page).locator(".result")).toHaveAttribute("data-text", "0.333333333333");
  await tapTwice(lastResult(page).locator(".result"));
  await tap(page, ["add", "d1", "div", "d2"]);
  const line = await entryValue(page);
  expect(line).toBe("\\res{1}{0.333333333333}+\\frac12");
  const chips = await page.evaluate(() => window.n62.entry.chips);
  await hide(page);
  const next = await relaunch(page, "");
  expect(await entryValue(next)).toBe(line);
  expect(await next.evaluate(() => window.n62.entry.chips)).toEqual(chips);
  expect(await cursorAtEnd(next)).toBe(true);
  await engineReady(next);
  await tap(next, ["enter"]);
  await expect(next.locator('[data-status="done"]')).toHaveCount(2);
  await expect(lastResult(next).locator(".result")).toHaveAttribute("data-text", "0.833333333333"); // derived: 1/3 + 1/2 = 5/6
  // Enter cleared the stored line: a kill right after it brings back an empty line
  const third = await relaunch(next, "");
  expect(await entryValue(third)).toBe("");
});

test("Home and CAS share one line, kept with the view it was typed in; an empty line stays empty", async ({ page }) => {
  await open(page);
  await tap(page, ["d2", "add", "d3"]);
  await hide(page);
  const home = await relaunch(page, "engine=fake");
  expect(await home.evaluate(() => window.n62.session.view)).toBe("home");
  expect(await entryValue(home)).toBe("2+3");
  // Esc empties the line; the kill after it must not bring the old line back
  await tap(home, ["esc"]);
  await hide(home);
  const empty = await relaunch(home, "engine=fake");
  expect(await entryValue(empty)).toBe("");
  // a CAS line comes back in CAS
  await tap(empty, ["@cas", "d7", "mul", "d8"]);
  expect(await empty.evaluate(() => window.n62.session.view)).toBe("cas");
  await hide(empty);
  const cas = await relaunch(empty, "engine=fake");
  expect(await cas.evaluate(() => window.n62.session.view)).toBe("cas");
  expect(await entryValue(cas)).toBe("7\\times8");
  // a line kept from CAS never comes back into Home (Home computes it the numeric way)
  await cas.evaluate(() => window.n62.session.setView("home"));
  await cas.waitForTimeout(300);
  const other = await relaunch(cas, "engine=fake");
  expect(await other.evaluate(() => window.n62.session.view)).toBe("home");
  expect(await entryValue(other)).toBe("");
});

test("keys typed while the kept line loads go after it", async ({ page }) => {
  await open(page);
  await tap(page, ["d2"]);
  await hide(page);
  const next = await page.context().newPage();
  await next.goto("/?engine=fake&tips=off");
  await next.locator('[data-key="d3"]').waitFor();
  await tap(next, ["d3", "d4"]);
  await next.waitForFunction(() => window.n62?.entry.field !== undefined, undefined, { timeout: 20_000 });
  await next.evaluate(() => window.n62.entry.ready);
  expect(await entryValue(next)).toBe("234");
});

// R34 review: a hide before the kept line is on the field must leave the stored line alone (the field's value is
// still empty), so a second kill does not lose it.
test("a hide while the field still loads after a kill keeps the stored line", async ({ page }) => {
  await open(page);
  await tap(page, ["d2", "add", "d3"]);
  await hide(page);
  // the second start: MathLive held back 3 s, so the store answers first and the hide falls in the wait
  const slow = await page.context().newPage();
  await slow.route(/\.vite\/deps\/mathlive/, async (r) => {
    await new Promise((res) => setTimeout(res, 3000));
    await r.continue();
  });
  await slow.goto("/?engine=fake&tips=off");
  await slow.locator('[data-key="d3"]').waitFor();
  await slow.waitForTimeout(800);
  expect(await slow.evaluate(() => window.n62.entry.field)).toBeUndefined();
  await hide(slow);
  // killed while hidden: a third start on the same store
  const third = await relaunch(slow, "engine=fake");
  expect(await entryValue(third)).toBe("2+3");
});

test("a kept line the store hands over after the 1 s cap is kept for the next start", async ({ page }) => {
  await open(page);
  await tap(page, ["d2", "add", "d3"]);
  await hide(page);
  // the second start: the store answers the read of the kept line after 1.5 s, past the field's 1 s wait
  const late = await page.context().newPage();
  await late.addInitScript(() => {
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
      const req = get.call(this, key);
      if (key !== "entry") return req;
      const desc = Object.getOwnPropertyDescriptor(IDBRequest.prototype, "onsuccess");
      Object.defineProperty(req, "onsuccess", {
        set(fn: ((ev: Event) => void) | null) {
          desc?.set?.call(req, fn && ((ev: Event) => setTimeout(() => fn.call(req, ev), 1500)));
        },
        get: () => desc?.get?.call(req),
      });
      return req;
    };
  });
  await open(late, "engine=fake");
  expect(await entryValue(late)).toBe(""); // the cap fired: the field came up without the kept line
  await late.waitForTimeout(2000); // the late answer has arrived
  await hide(late);
  const third = await relaunch(late, "engine=fake");
  expect(await entryValue(third)).toBe("2+3");
});

test("a kept line whose chip entry is missing comes back without that chip, still parseable", async ({ page }) => {
  await open(page, "");
  // the stored record as storage.ts stamps it (DATA_VERSION 1), with the chip's table entry gone
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("n62", 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction("kv", "readwrite");
          const value = { view: "home", latex: "\\res{7}{0.5}+\\frac{1}{4}\\times\\res{8}{2}", chips: { "res:8": { value: "2", exact: true } } };
          tx.objectStore("kv").put({ "@n62": 1, value }, "entry");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  const next = await relaunch(page, "");
  // the chip without a value becomes the digits it showed; the chip with one stays a chip
  expect(await entryValue(next)).toBe("0.5+\\frac{1}{4}\\times\\res{8}{2}");
  await engineReady(next);
  await tap(next, ["enter"]);
  await expect(lastResult(next).locator(".result")).toHaveAttribute("data-text", "1"); // derived: 0.5 + 2/4
});

test("a definitions log stamped 2 is migrated at start, its steps loaded on demand (R103; G46's 2 → 3 step)", async ({ page }) => {
  await open(page, "");
  // version 2's helper pasexp is gone from the engine (G46): only the step's rewrite to exp gives the value 1
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("n62", 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction("kv", "readwrite");
          const value = [{ name: "A", kind: "var", cmds: ["A:=(pasexp(0))"], angle: "rad", preview: "1", view: "home", time: 0 }];
          tx.objectStore("kv").put({ "@n62": 2, value }, "defs");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  const next = await relaunch(page, "");
  await engineReady(next);
  await next.evaluate(() => window.n62.entry.ready);
  await tap(next, ["alpha", "vars", "enter"]); // A
  await expect(lastResult(next).locator(".result")).toHaveAttribute("data-text", "1"); // derived: exp(0)
  // written back under today's stamp (DATA_VERSION, not a literal: G371 stepped it), migrated
  await expect
    .poll(() =>
      next.evaluate(
        () =>
          new Promise<unknown>((resolve, reject) => {
            const req = indexedDB.open("n62", 1);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
              const r = req.result.transaction("kv").objectStore("kv").get("defs");
              r.onsuccess = () => resolve([r.result?.["@n62"], r.result?.value?.[0]?.cmds]);
              r.onerror = () => reject(r.error);
            };
          }),
      ),
    )
    .toEqual([DATA_VERSION, ["A:=(exp(0))"]]);
});

// R255 (bu-1): on a cold start with a stored history the keypad is up before MathLive's field; keys pressed then wait
// in the entry's queue, and the keys with an empty-line job must see them (and a kept line still to come) as text.
/** A cold start on `page`'s store with MathLive held back until `release()`; `stored` (Home) is typed and sent first,
 *  `kept` typed after it and left on the line for the kill to keep (R34). */
async function heldStart(page: Page, stored: string[], kept: string[] = [], also?: RegExp): Promise<{ next: Page; release: () => void; releaseAlso: () => void }> {
  await open(page, "");
  await engineReady(page);
  if (stored.length > 0) {
    await tap(page, [...stored, "enter"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  }
  if (kept.length > 0) await tap(page, kept);
  await page.waitForTimeout(800); // the history write is debounced (400 ms) and asynchronous
  await hide(page);
  await page.evaluate(() => window.n62.yieldWriter());
  let release = (): void => {};
  const gate = new Promise<void>((r) => (release = r));
  const next = await page.context().newPage();
  await next.route(/\.vite\/deps\/mathlive/, async (r) => {
    await gate;
    await r.continue();
  });
  // `also`: another module held back until `releaseAlso()` (R298: the clipboard code, so ☰ waits for it as on a cold phone)
  let releaseAlso = (): void => {};
  const second = new Promise<void>((r) => (releaseAlso = r));
  if (also)
    await next.route(also, async (r) => {
      await second;
      await r.continue();
    });
  await next.goto("/?tips=off");
  await next.locator('[data-key="d2"]').waitFor();
  const rows = stored.length > 0 ? 1 : 0;
  await next.waitForFunction((n) => window.n62?.session.items.length === n, rows);
  return { next, release, releaseAlso };
}
/** Release MathLive and wait until the field is up with the queued keys replayed, and the new page's engine is ready
 *  (heldStart waits for the first page's only; under the full suite's load a cold engine outlasted a row count's 5 s). */
async function fieldUp(next: Page, release: () => void): Promise<void> {
  expect(await next.evaluate(() => window.n62.entry.field)).toBeUndefined(); // every key above went in before the field
  release();
  await next.waitForFunction(() => window.n62.entry.field !== undefined, undefined, { timeout: 20_000 });
  await next.evaluate(() => window.n62.entry.ready);
  await engineReady(next);
}
const lastInput = (p: Page): Promise<string | undefined> => p.evaluate(() => window.n62.session.items.at(-1)?.latex);
const results = (p: Page): Promise<string[]> =>
  p.evaluate(() => window.n62.session.items.filter((i) => i.status === "done").map((i) => i.text));

test("R255: 2 + 3 Enter before the field, with a stored result: 5, no Ans in front", async ({ page }) => {
  const { next, release } = await heldStart(page, ["d7"]);
  await tap(next, ["d2", "add", "d3", "enter"]);
  await fieldUp(next, release);
  await expect(next.locator('[data-status="done"]')).toHaveCount(2);
  await expect(lastResult(next).locator(".result")).toHaveAttribute("data-text", "5"); // derived: 2 + 3
  expect(await lastInput(next)).not.toContain("\\ans");
});

test("R255: 2 + 3 Enter 4 before the field: the row is 5 and 4 stays on the line", async ({ page }) => {
  const { next, release } = await heldStart(page, ["d7"]);
  await tap(next, ["d2", "add", "d3", "enter", "d4"]);
  await fieldUp(next, release);
  await expect(next.locator('[data-status="done"]')).toHaveCount(2);
  await expect(lastResult(next).locator(".result")).toHaveAttribute("data-text", "5"); // derived: 2 + 3
  expect(await entryValue(next)).toBe("4");
});

test("R255: 2 Enter + 4 before the field: the + after Enter starts with Ans, as on a live line", async ({ page }) => {
  const { next, release } = await heldStart(page, ["d7"]);
  await tap(next, ["d2", "enter", "add", "d4"]);
  await fieldUp(next, release);
  await expect.poll(() => entryValue(next)).toMatch(/^\\ans\+4$/);
  // the queued 2 may still be pending: Session.submit drops an Enter while a job runs, so wait for both rows first
  await expect(next.locator('[data-status="done"]')).toHaveCount(2);
  await tap(next, ["enter"]);
  await expect(next.locator('[data-status="done"]')).toHaveCount(3);
  expect(await results(next)).toEqual(["7", "2", "6"]); // derived: 2, then Ans + 4 = 6
});

test("R255: Shift + Esc on a queued line clears the line, not the history", async ({ page }) => {
  const { next, release } = await heldStart(page, ["d7"]);
  await tap(next, ["d2", "shift", "esc"]);
  await fieldUp(next, release);
  expect(await entryValue(next)).toBe("");
  expect(await results(next)).toEqual(["7"]);
});

test("R255: a kept 5, then + 3 Enter before the field: 8, no Ans", async ({ page }) => {
  const { next, release } = await heldStart(page, ["d7"], ["d5"]);
  await tap(next, ["add", "d3", "enter"]);
  await fieldUp(next, release);
  await expect(next.locator('[data-status="done"]')).toHaveCount(2);
  await expect(lastResult(next).locator(".result")).toHaveAttribute("data-text", "8"); // derived: 5 + 3
  expect(await lastInput(next)).not.toContain("\\ans");
});

test("R255: a kept 5, then Shift + Esc before the field: the line goes, the history stays", async ({ page }) => {
  const { next, release } = await heldStart(page, ["d7"], ["d5"]);
  await tap(next, ["shift", "esc"]);
  await fieldUp(next, release);
  expect(await entryValue(next)).toBe("");
  expect(await results(next)).toEqual(["7"]);
});

test("R255 control: an empty history, 2 + 3 before the field: the line is 2+3", async ({ page }) => {
  const { next, release } = await heldStart(page, []);
  await tap(next, ["d2", "add", "d3"]);
  await fieldUp(next, release);
  expect(await entryValue(next)).toBe("2+3");
});

// R255f1: the units key reads the line, so it waits for the field as Enter does (R8: the keys keep their order)
test("R255f1: 5 then the units key before the field: the unit view opens on the line 5", async ({ page }) => {
  const { next, release } = await heldStart(page, ["d7"]);
  await tap(next, ["d5", "shift", "tmpl"]);
  await fieldUp(next, release);
  await next.waitForFunction(() => window.n62.unitView !== undefined && document.querySelector('[data-pad="unit"]') !== null, undefined, { timeout: 20_000 });
  expect(await next.evaluate(() => window.n62.unitView?.view.line)).toBe("5");
  expect(await entryValue(next)).toBe("5");
  expect(await results(next)).toEqual(["7"]);
});

// R298 (night review 2026-11-14, vr-1, vr-5): an insert made before the field is up (a paste, a result chip, the store
// sheet's name) takes its place among the queued keys (decisions.md R8: in the order pressed); a second tap on a row's
// input reads the queued keys as text on the line (R273: text on the line stays, the pick drops).
test.describe("R298: inserts before the field", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });
  test("R298: 2, then Paste of 3 before the field: Enter gives 23", async ({ page }) => {
    const { next, release, releaseAlso } = await heldStart(page, ["d5"], [], /\/src\/clipboard\/actions\.svelte\.ts/);
    await setClipboard(next, "3");
    await tap(next, ["d2", ...PASTE, "enter"]);
    releaseAlso();
    // Paste waited for its code with Enter behind it; the paste has landed in the entry's queue and its hold (route.ts
    // holdKeys) is over before the field: the queued Enter must still wait for the field (the order run 1195's load gave)
    await next.waitForFunction(() => (window.n62.entry as unknown as { queue: { kind: string }[] }).queue.some((a) => a.kind === "put"), undefined, { timeout: 20_000 });
    await expect(sheet(next)).toHaveCount(0);
    await next.waitForTimeout(500);
    await fieldUp(next, release);
    // (the rows with their status and the line, so a miss says what happened)
    const state = (): Promise<unknown> => next.evaluate(() => [window.n62.session.items.map((i) => `${i.status}:${i.text ?? ""}`), window.n62.entry.value]);
    await expect.poll(state, { timeout: 20_000 }).toEqual([["done:5", "done:23"], ""]); // derived: the digits in the order pressed
  });
});

const resultCell = (p: Page) => lastResult(p).locator(".result");

test("R298: 2 ×, a second tap on the result 5, − 1 before the field: Enter gives 9", async ({ page }) => {
  const { next, release } = await heldStart(page, ["d5"]);
  await tap(next, ["d2", "mul"]);
  await tapTwice(resultCell(next));
  await tap(next, ["sub", "d1", "enter"]);
  await fieldUp(next, release);
  await expect(next.locator('[data-status="done"]')).toHaveCount(2, { timeout: 20_000 });
  expect(await results(next)).toEqual(["5", "9"]); // derived: 2·5 − 1
});

test("R298: 5, Store ▶, a tap on A in the store sheet before the field: A holds 5", async ({ page }) => {
  const { next, release } = await heldStart(page, ["d7"]);
  await tap(next, ["d5", "shift", "emark"]);
  await next.getByTestId("store").locator('[data-id="name:A"]').tap();
  await fieldUp(next, release);
  await expect(next.locator('[data-status="done"]')).toHaveCount(2, { timeout: 20_000 });
  expect(await lastInput(next)).toMatch(/^5\\blacktriangleright ?A$/); // (MathLive puts a space after the command)
  expect(await results(next)).toEqual(["7", "5"]);
  expect(await next.evaluate(() => window.n62.session.userNames.map((u) => `${u.name}:${u.kind}`))).toEqual(["A:var"]);
  expect(await entryValue(next)).toBe("");
});

test("R298, R858: 2, then two taps on a row's input before the field: the 2 is text, the input goes in after it, the pick drops", async ({ page }) => {
  const { next, release } = await heldStart(page, ["d7"]);
  await tap(next, ["d2"]);
  await tapTwice(next.locator("article.item .in").last());
  await fieldUp(next, release);
  await expect.poll(() => entryValue(next)).toBe("27"); // (no recall over the queued 2: at the caret, as Enter on a lit input)
  await expect(next.locator('article.item[data-selected="true"]')).toHaveCount(0);
  expect(await results(next)).toEqual(["7"]);
});

test("R298 control: the same keys after the field is up: 2 ×, the result 5, − 1 gives 9", async ({ page }) => {
  await open(page, "");
  await engineReady(page);
  await tap(page, ["d5", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["d2", "mul"]);
  await tapTwice(resultCell(page));
  await tap(page, ["sub", "d1"]);
  expect(await entryValue(page)).toBe("2\\times\\res{1}{5}-1");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2, { timeout: 20_000 });
  expect(await results(page)).toEqual(["5", "9"]);
});

// R302 (night review 2026-11-14, bu-2): a matrix cell's edit (R189) is typed on the entry line; the line it set aside is
// the one a hide keeps (R34), as the name prompt's (R123), not the cell's text. The real engine; values by hand.
test.describe("R302: a cell edit keeps the user's line through a kill", () => {
  const grid = (p: Page) => p.getByTestId("matrix-grid");
  /** The text of the row `giac` gives in Home, sent as the line would. */
  async function run(p: Page, giac: string): Promise<string> {
    const n = await p.evaluate(() => window.n62.session.items.length);
    await p.evaluate((g) => window.n62.session.submit(g, g), giac);
    await p.waitForFunction((n) => window.n62.session.items.length > n && window.n62.session.items.at(-1)?.status !== "pending", n, { timeout: 20_000 });
    return p.evaluate(() => window.n62.session.items.at(-1)?.text ?? "");
  }
  /** M:=[[1,2],[3,4]] stored, `draft` typed on the line, M's grid open at (2,1). */
  async function gridOpen(p: Page, draft: string[]): Promise<void> {
    await p.setViewportSize({ width: 412, height: 915 }); // as matrixedit.spec.ts: the grid and the line in sight
    await open(p, "");
    await engineReady(p);
    await run(p, "M:=[[1,2],[3,4]]");
    await p.waitForFunction(() => window.n62.session.userNames.some((u) => u.name === "M"), undefined, { timeout: 20_000 });
    if (draft.length > 0) await tap(p, draft);
    await tap(p, ["shift", "d4"]);
    await sheetKey(p, ["d0"]);
    await expect(grid(p).locator("td[data-cell]")).toHaveCount(4);
    await tap(p, ["down"]);
    await expect(grid(p).locator('td[data-cell="2,1"]')).toHaveAttribute("data-active", "true");
  }
  /** The kill's next start: its line, and M as Home reads it. */
  async function after(p: Page): Promise<[string, string]> {
    const next = await relaunch(p, "");
    await engineReady(next);
    const line = await entryValue(next);
    return [line, await run(next, "M")];
  }

  test("2+3 on the line, a 9 typed in a cell, a hide and a kill: the line is 2+3, M unchanged", async ({ page }) => {
    await gridOpen(page, ["d2", "add", "d3"]);
    await tap(page, ["d9"]);
    await expect(grid(page).locator('td[data-cell="2,1"]')).toHaveAttribute("data-editing", "true");
    expect(await entryValue(page)).toBe("9");
    await hide(page);
    expect(await after(page)).toEqual(["2+3", "[[1,2],[3,4]]"]);
  });

  test("an empty line, a 9 typed in a cell, a hide and a kill: the line is empty", async ({ page }) => {
    await gridOpen(page, []);
    await tap(page, ["d9"]);
    expect(await entryValue(page)).toBe("9");
    await hide(page);
    expect(await after(page)).toEqual(["", "[[1,2],[3,4]]"]);
  });

  test("Clear during the edit leaves the kept line: 2+3 after a kill", async ({ page }) => {
    await gridOpen(page, ["d2", "add", "d3"]);
    await tap(page, ["d9", "shift", "esc"]);
    expect(await entryValue(page)).toBe("");
    await hide(page);
    expect(await after(page)).toEqual(["2+3", "[[1,2],[3,4]]"]);
  });

  test("control: Esc ends the edit, 2+3 comes back and a kill keeps it", async ({ page }) => {
    await gridOpen(page, ["d2", "add", "d3"]);
    await tap(page, ["d9", "esc"]);
    expect(await entryValue(page)).toBe("2+3");
    await hide(page);
    expect(await after(page)).toEqual(["2+3", "[[1,2],[3,4]]"]);
  });

  test("control: a written cell puts 2+3 back and a kill keeps it, with M written", async ({ page }) => {
    await gridOpen(page, ["d2", "add", "d3"]);
    await tap(page, ["d9", "enter"]);
    await expect(grid(page).locator('td[data-cell="2,1"]')).toHaveAttribute("data-text", "9");
    expect(await entryValue(page)).toBe("2+3");
    await page.waitForTimeout(800); // the definitions log is written asynchronously
    await hide(page);
    expect(await after(page)).toEqual(["2+3", "[[1,2],[9,4]]"]);
  });

  test("control: a hide with the grid open and no edit keeps 2+3", async ({ page }) => {
    await gridOpen(page, ["d2", "add", "d3"]);
    await hide(page);
    expect(await after(page)).toEqual(["2+3", "[[1,2],[3,4]]"]);
  });
});
