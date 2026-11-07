// SPDX-License-Identifier: GPL-3.0-or-later
// R161 (F191): the pressed key is the app's own flag, `data-down`, set in the pad's pointerdown and removed at the later
// of the lift and 80 ms after the down; never CSS `:active` (Chrome sets that on a touch screen from Android's tap
// detector: late, and stuck on one key in fast typing). Touch pointers are dispatched on the keys (as keypadBench.ts
// does), so the real handlers run and every check is synchronous with the event; removal times come from a
// MutationObserver, so no check depends on how late a test timer fires.
import { expect, test, type Page } from "@playwright/test";
import { open, touch } from "./helpers.ts";

const MIN_MS = 80;

type Log = { downs: [string, number][]; offs: [string, number][] };
type Pf = {
  fire: (type: string, sel: string, pid: number) => number;
  lit: () => string[];
  log: Log;
  hide: () => void;
};

/** Installs window.__pf: fire a touch pointer event on a key (or a selector) and log every flag removal. */
const install = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const log: Log = { downs: [], offs: [] };
    const elOf = (sel: string): HTMLElement => {
      const el = document.querySelector<HTMLElement>(sel.startsWith("[") ? `.pad ${sel}` : `.pad [data-key="${sel}"]`);
      if (!el) throw new Error(`no ${sel}`);
      return el;
    };
    const name = (el: Element): string => (el as HTMLElement).dataset["key"] ?? (el as HTMLElement).dataset["testid"] ?? el.className;
    new MutationObserver((ms) => {
      for (const m of ms)
        if (m.oldValue !== null && !(m.target as Element).hasAttribute("data-down")) log.offs.push([name(m.target as Element), performance.now()]);
    }).observe(document.querySelector(".pad") as Element, { attributes: true, attributeFilter: ["data-down"], attributeOldValue: true, subtree: true });
    const pf: Pf = {
      fire(type, sel, pid) {
        const el = elOf(sel);
        const r = el.getBoundingClientRect();
        const t = performance.now();
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true, cancelable: true, pointerId: pid, pointerType: "touch", isPrimary: pid === 1,
            clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
          }),
        );
        if (type === "pointerdown") log.downs.push([sel, t]);
        return t;
      },
      lit: () => [...document.querySelectorAll(".pad [data-down]")].map(name),
      log,
      hide() {
        Object.defineProperty(document, "hidden", { value: true, configurable: true });
        Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      },
    };
    (window as unknown as { __pf: Pf }).__pf = pf;
  });

/** Every removal of a key's flag came at least MIN_MS after that key's last down before it. */
function offsKeepMin(log: Log): void {
  for (const [k, off] of log.offs) {
    const downs = log.downs.filter(([d, t]) => d === k && t <= off).map(([, t]) => t);
    expect(downs.length, `${k} went off without a down`).toBeGreaterThan(0);
    expect(off - Math.max(...downs), `${k} lit at least ${MIN_MS} ms`).toBeGreaterThanOrEqual(MIN_MS - 0.5);
  }
}

test.beforeEach(async ({ page }) => {
  await open(page);
  await install(page);
});

test("a tap lights its key at the down, at least 80 ms, then not; a long hold until the lift", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const pf = (window as unknown as { __pf: Pf }).__pf;
    const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
    pf.fire("pointerdown", "d7", 1);
    const atDown = pf.lit();
    pf.fire("pointerup", "d7", 1);
    const atUp = pf.lit();
    while (pf.lit().length && pf.log.offs.length === 0) await sleep(10);
    await sleep(20);
    const after = pf.lit();
    pf.fire("pointerdown", "d8", 1);
    await sleep(200);
    const held = pf.lit();
    pf.fire("pointerup", "d8", 1);
    return { atDown, atUp, after, held, lifted: pf.lit(), log: pf.log };
  });
  expect(r.atDown).toEqual(["d7"]);
  expect(r.atUp, "a quick tap still shows after the lift").toEqual(["d7"]);
  expect(r.after).toEqual([]);
  expect(r.held).toEqual(["d8"]);
  expect(r.lifted, "a hold past 80 ms goes out at the lift").toEqual([]);
  offsKeepMin(r.log);
  const off = r.log.offs.find(([k]) => k === "d7");
  const down = r.log.downs.find(([k]) => k === "d7");
  expect(off && down && off[1] - down[1], "not stuck").toBeLessThan(400);
});

test("20 taps 60 ms apart light each key in turn and none is lit 120 ms after the last", async ({ page }) => {
  const keys = ["d1", "d2", "d3", "d5", "d5", "d5", "d6", "d4", "d9", "d8", "d7", "d0", "d0", "d1", "d2", "d3", "d4", "d5", "d6", "d7"];
  const r = await page.evaluate(async (keys) => {
    const pf = (window as unknown as { __pf: Pf }).__pf;
    const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
    const seen: { key: string; prev: string | undefined; lit: string[] }[] = [];
    let prev: string | undefined;
    for (const k of keys) {
      pf.fire("pointerdown", k, 1);
      seen.push({ key: k, prev, lit: pf.lit() });
      pf.fire("pointerup", k, 1);
      prev = k;
      await sleep(60);
    }
    await sleep(120 - 60);
    return { seen, end: pf.lit(), log: pf.log, entry: (window as unknown as { n62: { entry: { value: string } } }).n62.entry.value };
  }, keys);
  for (const s of r.seen) {
    expect(s.lit, `${s.key} lit at its down`).toContain(s.key);
    for (const k of s.lit) expect([s.key, s.prev], `only ${s.key} and the key before`).toContain(k);
  }
  expect(r.end).toEqual([]);
  offsKeepMin(r.log);
  expect(r.entry.replace(/\D/g, "")).toBe(keys.map((k) => k.slice(1)).join(""));
});

test("a second finger lights its key while the first shows out its 80 ms", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const pf = (window as unknown as { __pf: Pf }).__pf;
    const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
    pf.fire("pointerdown", "d1", 1);
    await sleep(20);
    pf.fire("pointerdown", "d2", 2);
    const both = pf.lit();
    await sleep(150);
    const held = pf.lit();
    pf.fire("pointerup", "d2", 2);
    const lifted = pf.lit();
    pf.fire("pointerup", "d1", 1);
    return { both, held, lifted, end: pf.lit(), log: pf.log };
  });
  expect(r.both).toContain("d2");
  for (const k of r.both) expect(["d1", "d2"]).toContain(k);
  expect(r.held, "the second finger's key stays lit while it is down; the first's went out").toEqual(["d2"]);
  expect(r.lifted).toEqual([]);
  expect(r.end).toEqual([]);
  offsKeepMin(r.log);
});

test("a pointercancel and the page hidden clear every flag at once", async ({ page }) => {
  const r = await page.evaluate(() => {
    const pf = (window as unknown as { __pf: Pf }).__pf;
    pf.fire("pointerdown", "d3", 1);
    pf.fire("pointercancel", "d3", 1);
    const cancelled = pf.lit();
    pf.fire("pointerdown", "d4", 1);
    pf.fire("pointerup", "d4", 1);
    pf.fire("pointerdown", "d6", 1);
    const two = pf.lit();
    pf.fire("pointercancel", "d6", 1);
    const cancelledTwo = pf.lit();
    pf.fire("pointerdown", "d7", 1);
    pf.fire("pointerup", "d7", 1);
    pf.fire("pointerdown", "d8", 1);
    pf.hide();
    return { cancelled, two, cancelledTwo, hidden: pf.lit() };
  });
  expect(r.cancelled).toEqual([]);
  expect(r.two.sort()).toEqual(["d4", "d6"]);
  expect(r.cancelledTwo).toEqual([]);
  expect(r.hidden).toEqual([]);
});

test("a trackpad zone gets the flag (its full opacity), the hub none", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const pf = (window as unknown as { __pf: Pf }).__pf;
    const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
    const zone = document.querySelector<HTMLElement>('.pad [data-key="up"]') as HTMLElement;
    const rest = getComputedStyle(zone).opacity;
    pf.fire("pointerdown", "up", 1);
    const lit = pf.lit();
    const held = getComputedStyle(zone).opacity;
    pf.fire("pointerup", "up", 1);
    await sleep(150);
    const after = getComputedStyle(zone).opacity;
    pf.fire("pointerdown", '[data-testid="pad-hub"]', 1);
    const hub = pf.lit();
    pf.fire("pointerup", '[data-testid="pad-hub"]', 1);
    return { rest, lit, held, after, hub, end: pf.lit() };
  });
  expect(r.lit).toEqual(["up"]);
  expect(Number(r.held)).toBeGreaterThan(Number(r.rest));
  expect(r.after).toBe(r.rest);
  expect(r.hub).toEqual([]);
  expect(r.end).toEqual([]);
});

test("⌫ stays lit while held and repeating, and goes out at the lift", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const pf = (window as unknown as { __pf: Pf }).__pf;
    const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
    for (const k of ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"]) {
      pf.fire("pointerdown", k, 1);
      pf.fire("pointerup", k, 1);
    }
    await sleep(120);
    const entry = (): string => (window as unknown as { n62: { entry: { value: string } } }).n62.entry.value;
    const before = entry();
    pf.fire("pointerdown", "bksp", 1);
    const lit: string[][] = [];
    for (let i = 0; i < 6; i++) {
      await sleep(100);
      lit.push(pf.lit());
    }
    const during = entry();
    pf.fire("pointerup", "bksp", 1);
    return { before, during, lit, end: pf.lit() };
  });
  for (const l of r.lit) expect(l).toEqual(["bksp"]);
  expect(r.during.length, "⌫ repeated while held").toBeLessThan(r.before.length - 1);
  expect(r.end).toEqual([]);
});

test("a real touch (CDP) lights the key at once and lets it go after the lift", async ({ page }) => {
  const f = await touch(page, "d5");
  expect(await page.evaluate(() => (window as unknown as { __pf: Pf }).__pf.lit())).toEqual(["d5"]);
  await f.end();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __pf: Pf }).__pf.lit()), { timeout: 1000 }).toEqual([]);
});
