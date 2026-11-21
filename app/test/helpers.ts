// SPDX-License-Identifier: GPL-3.0-or-later
import { linkSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test, type Locator, type Page } from "@playwright/test";

/** The bar's controls (R15c1, R15c2, R722), for keys that left the cluster: `@place` (Apps ▾, the Apps sheet), `@menu`
 *  (☰), `@symb` / `@plot` / `@num` (the view tab; from Home or CAS the last app is opened first from the Apps sheet, as
 *  the old view keys did), `@home` and `@cas` (the bar's Home tab, and slot 2 when it holds CAS, one tap; else APP▾ › CAS), `@mode` (the Mode sheet on its
 *  Angle row, as Shift + Apps opened it before R15c2: in Home and CAS the format chip, in an app ☰ › Mode (R785), then ▲). */
async function statusTap(page: Page, id: string): Promise<void> {
  const apps = page.getByTestId("apps");
  const fromApps = async (row: string): Promise<void> => {
    if (!(await apps.isVisible())) await page.getByTestId("place").tap();
    await apps.locator(`[role="menuitem"][data-id="${row}"]`).tap();
  };
  if (id === "@place") return page.getByTestId("place").tap();
  if (id === "@menu") return page.getByTestId("menu-button").tap();
  if (id === "@home") return page.getByTestId("tab-home").tap();
  if (id === "@cas") {
    // R782: slot 2 holds CAS by default (one tap); when it holds an app, CAS is APP▾ › CAS. A tap on slot 2 while CAS is current is the sheet, never taken here.
    if ((await page.evaluate(() => window.n62.session.settings.barSlot)) === "cas") return page.getByTestId("tab-slot").tap();
    return fromApps("cas");
  }
  if (id === "@mode") {
    // R785: in Home and CAS the format and digits chip; in an app (no chip) ☰ and its Mode row
    if (await page.evaluate(() => window.n62.shell.app !== null)) {
      await page.getByTestId("menu-button").tap();
      await page.getByTestId("menu").locator('[role="menuitem"][data-id="mode"]').tap();
    } else await page.getByTestId("chip-format").tap();
    await page.getByTestId("menu").getByRole("menuitem").first().waitFor();
    return sheetKey(page, ["up"]);
  }
  const view = id.slice(1);
  if (!["symb", "plot", "num"].includes(view)) throw new Error(`no bar control ${id}`);
  const inApp = await page.evaluate(() => window.n62.shell.app !== null);
  if (!inApp) await fromApps(await page.evaluate(() => window.n62.shell.lastApp ?? "function"));
  await page.getByTestId(`tab-${view}`).tap();
}

/** Press keys the way a hardware keyboard does (R31: the keypad key with that character, in the current Shift/Alpha
 *  state), the path that steps an open sheet from a hardware keyboard. */
export async function sheetKey(page: Page, ids: string[]): Promise<void> {
  for (const id of ids) await page.evaluate((id) => window.n62.entry.onKey(id, undefined as never, false), id);
}

/**
 * Tap keys by their id in spec/keyboard.yaml (d0..d9, div, frac, shift, enter, ...). A sheet is in the viewport and never
 * over the keys (R770), so every key is tapped where it is, a sheet open or not. An id that starts with `@` is a bar
 * control (statusTap).
 */
export async function tap(page: Page, ids: string[]): Promise<void> {
  for (const id of ids) {
    if (id.startsWith("@")) await statusTap(page, id);
    else await page.locator(`[data-key="${id}"]`).tap({ timeout: 3000 });
  }
}

/** R783: a hardware keyboard is in use (input/hwSeen.svelte.ts): the ⇧ α badge shows on the unfolded bar too. A touch on the
 *  screen turns it off again, so a test that taps keys and reads the badge uses `tapHw`. */
export async function hwOn(page: Page, on = true): Promise<void> {
  await page.evaluate(async (v) => {
    const url = "/src/input/hwSeen.svelte.ts";
    ((await import(/* @vite-ignore */ url)) as typeof import("../src/input/hwSeen.svelte.ts")).hw.keys = v;
  }, on);
}

/** `tap`, each key followed by the hardware keyboard being in use again (the badge reads as it did before R783). */
export async function tapHw(page: Page, ids: string[]): Promise<void> {
  for (const id of ids) {
    await tap(page, [id]);
    await hwOn(page);
  }
}

/** How far a tap on the history must lie from the open sheet's box (px): more than the sheet's own margin (8 px at the sides, 4 above),
 *  so the point is the history and not the sheet's margin (R770f1). */
export const HISTORY_CLEAR = 10;

type Pt = { x: number; y: number };
/** A point of the history area (section.history) that lies outside the open sheet by HISTORY_CLEAR px: the old (20, 20) where it
 *  is outside, else the first of a coarse scan. Null when the sheet fills the view or the view has no history (Plot) and leaves nothing to tap (Mode, Settings
 *  levels and ☰ at 360 × 740; docs/05 3.1). Page coordinates. */
export async function historyPoint(page: Page): Promise<Pt | null> {
  if ((await page.locator("section.history").count()) === 0) return null; // an app's view (Plot) has no history at all
  const [h, s] = [await page.locator("section.history").first().boundingBox(), await page.locator('[role="menu"]').first().boundingBox()];
  if (!h || !s) throw new Error("no history or no open sheet to measure");
  const away = (p: Pt): number => Math.hypot(Math.max(s.x - p.x, 0, p.x - (s.x + s.width)), Math.max(s.y - p.y, 0, p.y - (s.y + s.height)));
  const xs = [20, h.width / 2, h.width - 20];
  const cands: Pt[] = [{ x: h.x + 20, y: h.y + 20 }];
  for (let y = 4; y < h.height; y += 16) for (const x of xs) cands.push({ x: h.x + x, y: h.y + y });
  return cands.find((p) => p.x >= h.x && p.x <= h.x + h.width && p.y >= h.y && p.y <= h.y + h.height && away(p) >= HISTORY_CLEAR) ?? null;
}
/** Tap the history outside the open sheet (a mouse click at that point); throws when the sheet leaves no history to tap. */
export async function tapHistory(page: Page): Promise<void> {
  const p = await historyPoint(page);
  if (!p) throw new Error("the sheet fills the view: no history point to tap");
  await page.mouse.click(p.x, p.y);
}

/** Close the open sheet the way its size allows: a tap on the history where the sheet leaves room, else its × button. */
export async function closeSheet(page: Page): Promise<void> {
  const p = await historyPoint(page);
  if (p) await page.mouse.click(p.x, p.y);
  else await page.locator('[role="menu"]').first().getByRole("button", { name: "Close" }).tap();
}

export const entryValue = (page: Page): Promise<string> => page.evaluate(() => window.n62.entry.value);

// R137: the helpers most specs had a copy of.
/** The newest result row's result (its `.result` part, not the row). */
export const lastResult = (page: Page): Locator => page.locator('[data-testid="result"]').last().locator(".result");
/** R147 (the G2's way): a first tap on a history row's result or input picks the row, a second inserts or recalls it. */
export async function tapTwice(l: Locator, how: "tap" | "click" = "tap"): Promise<void> {
  await l[how]();
  await l[how]();
}
/** The open pick sheet (the `menu` test id). */
export const sheet = (page: Page): Locator => page.getByTestId("menu");
/** ☰ → Copy › → Full value and ☰ → Paste on Home and CAS (R278: the Copy and Paste keys are gone; R720: the Menu's items 2 › 1 and 4). Copy takes the
 *  picked row, else the last result; Paste puts the clipboard's number on the line, and the keys after it wait for it. */
export const COPY: string[] = ["@menu", "d2", "d1"];
export const PASTE: string[] = ["@menu", "d4"];
/** Shift + Select, the Copy key (R723): what a hold on the picked row's result copies, else the last finished row's. */
export const KEYCOPY: string[] = ["shift", "select"];
/** Shift + Deselect, the Paste key (R723): ☰ → Paste's path. */
export const KEYPASTE: string[] = ["shift", "deselect"];

/** ☰ and the view's own item `id` (an app's Copy or CSV: the app menus have no numbers a test can rely on). */
export async function menuItem(page: Page, id: string): Promise<void> {
  await tap(page, ["@menu"]);
  await sheet(page).locator(`[data-id="${id}"]`).tap();
}

/** A system paste into the entry field (the `paste` event the context menu and Shift+Insert deliver, R114, with the clipboard's
 *  text), for the views whose ☰ has no Paste item (Solve, Function). The clipboard permissions are the spec's. */
export async function systemPaste(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const text = await navigator.clipboard.readText();
    const mf = window.n62.entry.field;
    if (!mf) throw new Error("no field");
    mf.focus();
    const target = mf.shadowRoot?.activeElement ?? mf.shadowRoot?.querySelector("textarea") ?? mf;
    const data = new DataTransfer();
    data.setData("text/plain", text);
    target.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true, composed: true }));
  });
}

/** Put text on the system clipboard (a spec that does holds the clipboard lock: useClipboardLock). */
export const setClipboard = (page: Page, text: string): Promise<void> => page.evaluate((s) => navigator.clipboard.writeText(s), text);
/** Press ⌫ once and return the line. */
export async function bksp(page: Page): Promise<string> {
  await tap(page, ["bksp"]);
  return entryValue(page);
}

export async function open(page: Page, query = "engine=fake"): Promise<void> {
  // R15c4: a fresh profile shows the first-start tips over the app; every other test runs without them (`tips=on` keeps them)
  await page.goto(`/?${query}${query.includes("tips=") ? "" : "&tips=off"}`);
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.n62 !== undefined);
  await page.evaluate(() => window.n62.entry.ready);
  await page.waitForTimeout(150);
}

/**
 * One finger on a key (K5): synthetic touch events through CDP (`Input.dispatchTouchEvent`), since `locator.tap`
 * only taps. `move` slides the finger to an offset (CSS px) from the key's centre, in `steps` moves; `end` lifts it.
 */
export async function touch(
  page: Page,
  id: string | Locator,
): Promise<{
  move: (dx: number, dy: number, steps?: number) => Promise<void>;
  end: () => Promise<void>;
  cancel: () => Promise<void>;
}> {
  // a key id, or a CSS selector (starting with "[") for a surface that is not a key (the pad's hub, R15c2)
  // (R743: or a locator, a history row)
  const box = await (typeof id !== "string" ? id : page.locator(id.startsWith("[") ? id : `[data-key="${id}"]`)).boundingBox();
  if (!box) throw new Error(`key ${String(id)} is not visible`);
  const x0 = box.x + box.width / 2;
  const y0 = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const at = (x: number, y: number) => [{ x: Math.round(x0 + x), y: Math.round(y0 + y), id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(0, 0) });
  let cx = 0;
  let cy = 0;
  return {
    async move(dx, dy, steps = 6) {
      const fx = cx;
      const fy = cy;
      for (let i = 1; i <= steps; i++) {
        cx = fx + ((dx - fx) * i) / steps;
        cy = fy + ((dy - fy) * i) / steps;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(cx, cy) });
      }
    },
    async end() {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
    },
    /** The browser takes the touch away (a scroll, a system gesture): pointercancel instead of a lift. */
    async cancel() {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      await cdp.detach();
    },
  };
}

/**
 * Two fingers: the first goes down on key `a` and stays, then a second comes down on key `b`; `end` lifts both
 * (second, then first). The first finger can be held (`page.waitForTimeout`) before `second` is called.
 */
export async function twoFingers(
  page: Page,
  a: string,
  b: string,
): Promise<{ second: () => Promise<void>; end: () => Promise<void> }> {
  const centre = async (id: string): Promise<{ x: number; y: number }> => {
    const box = await page.locator(`[data-key="${id}"]`).boundingBox();
    if (!box) throw new Error(`key ${id} is not visible`);
    return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  };
  const p1 = { ...(await centre(a)), id: 1 };
  const p2 = { ...(await centre(b)), id: 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p1] });
  return {
    async second() {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p1, p2] });
    },
    async end() {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [p1] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
    },
  };
}

/** Drag from a key's centre by (dx, dy) and lift. */
export async function drag(page: Page, id: string, dx: number, dy: number): Promise<void> {
  const f = await touch(page, id);
  await f.move(dx, dy);
  await f.end();
}

/** Flick a key up (its shift layer) or down (its letter): a 40 px slide, then lift (R9; FlickTracker arms at 20 px). */
export const flick = (page: Page, id: string, dir: "up" | "down"): Promise<void> => drag(page, id, 0, dir === "up" ? -40 : 40);

/** Record navigator.vibrate calls (call before `open`); read them with `vibrations`. */
export async function recordVibrations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as { __vib: unknown[] }).__vib = calls;
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: (p: unknown) => (calls.push(p), true) });
  });
}
export const vibrations = (page: Page): Promise<unknown[]> => page.evaluate(() => (window as unknown as { __vib: unknown[] }).__vib);

// R74f1: the system clipboard is one for every Playwright worker, so a test that writes or reads it holds this lock
// (an exclusive lock file under test-results, holding its owner's pid and a nonce) for its whole run. A lock whose
// owner process is dead (a killed worker) is taken over; a live owner is never overridden, however long it holds.
const LOCK = resolve("test-results", "clipboard.lock");

/** F202: a waiter first takes a numbered ticket in this directory (a file named by its number, holding its pid and a
 *  nonce); only the lowest live ticket may take the lock, so the waiters are served in the order they came. */
export const CLIPBOARD_TICKETS = resolve("test-results", "clipboard-tickets");

/** How long a test waits for the lock. The lock runs the suite's clipboard tests one at a time, and they hold it about
 *  230 s in all (G301, 16 workers); the waiters are served in turn (F202), so a late one waits through most of that. */
export const CLIPBOARD_WAIT_MS = 300_000;
/** A test's budget that holds the wait as well: its own timeout, the wait, and the time to give up cleanly. */
export const clipboardBudget = (timeout: number): number => timeout + CLIPBOARD_WAIT_MS + 30_000;

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** Take the next ticket: one number above the highest there is, made by an exclusive link (a ticket never shows half
 *  written; two waiters after the same number meet an EEXIST and the later one counts again). Returns its path. */
function takeTicket(token: string): string {
  mkdirSync(CLIPBOARD_TICKETS, { recursive: true });
  const tmp = resolve(CLIPBOARD_TICKETS, `.tmp-${process.pid}-${token.split(" ")[1]}`);
  writeFileSync(tmp, token);
  try {
    for (;;) {
      const top = ticketNames().reduce((m, n) => Math.max(m, Number(n)), 0);
      const path = resolve(CLIPBOARD_TICKETS, String(top + 1).padStart(9, "0"));
      try {
        linkSync(tmp, path);
        return path;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      }
    }
  } finally {
    rmSync(tmp, { force: true });
  }
}

const ticketNames = (): string[] => {
  try {
    return readdirSync(CLIPBOARD_TICKETS).filter((n) => /^\d+$/.test(n)).sort();
  } catch {
    return [];
  }
};

/** Is `path` (a ticket of mine) the lowest live ticket? A ticket whose owner process is dead is removed on the way. */
function myTurn(path: string): boolean {
  for (const name of ticketNames()) {
    const p = resolve(CLIPBOARD_TICKETS, name);
    if (p === path) return true;
    try {
      const pid = Number.parseInt(readFileSync(p, "utf8"), 10);
      if (Number.isInteger(pid) && !alive(pid)) rmSync(p, { force: true });
      else return false;
    } catch {
      /* taken back meanwhile */
    }
  }
  return false; // my ticket is gone (cannot happen unless something removed it): wait on
}

/** Wait for the clipboard lock and take it, in the order the waiters came (a numbered ticket, F202); returns the release
 *  function (safe to call twice; it removes only its own file). Throws once `timeoutMs` has passed without the lock, so
 *  a late acquisition never happens after the caller gave up, and withdraws the ticket first. */
export async function acquireClipboardLock(timeoutMs = CLIPBOARD_WAIT_MS): Promise<() => void> {
  mkdirSync(dirname(LOCK), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  const token = `${process.pid} ${Math.random().toString(36).slice(2)}`;
  const ticket = takeTicket(token);
  try {
    for (;;) {
      const turn = myTurn(ticket);
      if (turn) {
        try {
          writeFileSync(LOCK, token, { flag: "wx" });
          return () => {
            try {
              if (readFileSync(LOCK, "utf8") === token) rmSync(LOCK, { force: true });
            } catch {
              /* already gone */
            }
          };
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
          try {
            const pid = Number.parseInt(readFileSync(LOCK, "utf8"), 10);
            if (Number.isInteger(pid) && !alive(pid)) takeOverDead(pid);
          } catch {
            /* released meanwhile */
          }
        }
      }
      if (Date.now() >= deadline) throw new Error(`clipboard lock not free after ${timeoutMs} ms`);
      await new Promise((r) => setTimeout(r, turn ? 25 + Math.random() * 25 : 100 + Math.random() * 100));
    }
  } finally {
    rmSync(ticket, { force: true }); // taken the lock or given up: the ticket goes either way
  }
}

/** Remove a lock whose owner `pid` is dead: rename it away (only one waiter gets the file) and, if it turns out to
 *  belong to a live process after all, link it back. */
function takeOverDead(pid: number): void {
  const mine = `${LOCK}.dead-${process.pid}-${Math.random().toString(36).slice(2)}`;
  renameSync(LOCK, mine);
  try {
    if (Number.parseInt(readFileSync(mine, "utf8"), 10) !== pid) linkSync(mine, LOCK);
  } catch {
    /* nothing to restore */
  } finally {
    rmSync(mine, { force: true });
  }
}

/** Run `fn` holding the clipboard lock; the lock is released in a finally block. */
export async function withClipboardLock<T>(fn: () => Promise<T>): Promise<T> {
  const release = await acquireClipboardLock();
  try {
    return await fn();
  } finally {
    release();
  }
}

/** Call at the top of a spec file or describe: every test in it holds the clipboard lock from its first hook to its last. */
export function useClipboardLock(): void {
  let release: (() => void) | undefined;
  test.beforeEach(async () => {
    test.setTimeout(clipboardBudget(test.info().project.timeout)); // the wait for the lock must not eat the test's own budget
    release = await acquireClipboardLock();
  });
  test.afterEach(() => {
    release?.();
    release = undefined;
  });
}

/**
 * R122: the browser's save picker (`showSaveFilePicker`), set before `open`. Headless Chromium has one that closes at
 * once (AbortError, a cancelled save). "none" removes it, so a save offers the download; "fake" is a stand-in that
 * writes nothing to disk and keeps the text it was given for `savedText`.
 */
export async function savePicker(page: Page, kind: "none" | "fake"): Promise<void> {
  await page.addInitScript((k) => {
    const w = window as unknown as { showSaveFilePicker?: unknown; __saved?: { name: string; text: string } };
    if (k === "none") {
      delete w.showSaveFilePicker;
      w.showSaveFilePicker = undefined;
      return;
    }
    w.showSaveFilePicker = async (o: { suggestedName: string }) => ({
      createWritable: async () => {
        let text = "";
        return { write: async (t: string) => void (text += t), close: async () => void (w.__saved = { name: o.suggestedName, text }) };
      },
    });
  }, kind);
}
/** The file the stand-in picker saved last (savePicker "fake"), or undefined. */
export const savedText = (page: Page): Promise<{ name: string; text: string } | undefined> =>
  page.evaluate(() => (window as unknown as { __saved?: { name: string; text: string } }).__saved);

/**
 * The Android font scale (A4a point 4, R41): the WebView's text zoom multiplies every px font size and leaves the boxes
 * alone. Chromium on a desktop has no text zoom, so the `--fs-*` tokens are multiplied here, then the keypad is fitted
 * again (its effect runs when a modifier changes; on a device the scale is there before the first fit).
 */
export async function setFontScale(page: Page, scale: number): Promise<void> {
  await page.evaluate((s) => {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    for (const name of ["--fs-cell", "--fs-legend", "--fs-caption", "--fs-small", "--fs-note", "--fs-ui", "--fs-body", "--fs-key-fn", "--fs-glyph", "--fs-key", "--fs-input", "--fs-result", "--fs-entry"]) {
      const px = parseFloat(cs.getPropertyValue(name));
      if (px > 0) root.style.setProperty(name, `${px * s}px`);
    }
  }, scale);
  await tap(page, ["shift"]);
  await page.evaluate(() => window.n62.session.clearModifiers());
  await page.waitForTimeout(100);
}
