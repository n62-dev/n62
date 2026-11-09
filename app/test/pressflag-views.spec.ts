// SPDX-License-Identifier: GPL-3.0-or-later
// R164 (F191): the status line's, the sheets' and the update note's presses use R161's flag, `data-down`, not CSS `:active`
// (Chrome's touch `:active` shows late and can stick on one element in fast tapping). Touch pointers are dispatched on the
// elements (as pressflag.spec.ts does for the keys), so the real handlers run and every check is synchronous with the
// event; removal times come from a MutationObserver, so no check depends on how late a test timer fires.
import { expect, test, type Page } from "@playwright/test";
import { open } from "./helpers.ts";

const MIN_MS = 80;

type Log = { downs: [string, number][]; offs: [string, number][] };
type Pf = {
  fire: (type: string, sel: string, pid?: number) => number;
  lit: () => string[];
  look: (sel: string) => string;
  log: Log;
};

/** Installs window.__pv: fire a touch pointer event on an element (a selector) and log every flag removal. */
const install = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const log: Log = { downs: [], offs: [] };
    const elOf = (sel: string): HTMLElement => {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) throw new Error(`no ${sel}`);
      return el;
    };
    new MutationObserver((ms) => {
      for (const m of ms) {
        const el = m.target as HTMLElement;
        if (m.oldValue !== null && !el.hasAttribute("data-down")) log.offs.push([el.dataset["testid"] ?? el.className, performance.now()]);
      }
    }).observe(document.body, { attributes: true, attributeFilter: ["data-down"], attributeOldValue: true, subtree: true });
    const pf: Pf = {
      fire(type, sel, pid = 1) {
        const el = elOf(sel);
        const r = el.getBoundingClientRect();
        const t = performance.now();
        if (type === "pointerdown") log.downs.push([el.dataset["testid"] ?? el.className, t]);
        el.dispatchEvent(
          new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: pid, pointerType: "touch", isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }),
        );
        return t;
      },
      lit: () => [...document.querySelectorAll("[data-down]")].map((e) => (e as HTMLElement).dataset["testid"] ?? e.className),
      look: (sel) => {
        const cs = getComputedStyle(elOf(sel));
        return `${cs.backgroundColor}|${cs.color}`;
      },
      log,
    };
    (window as unknown as { __pv: Pf }).__pv = pf;
  });

/** What each element is called in the log (its testid, else its class) and how to find it. */
const TARGETS = [
  { name: "place", sel: '[data-testid="place"]', before: "" },
  { name: "menu-button", sel: '[data-testid="menu-button"]', before: "" },
  { name: "update-note", sel: '[data-testid="update-note"]', before: "update" },
  { name: "step-up", sel: '[data-id="digits"] [data-testid="step-up"]', before: "mode" },
  { name: "opt", sel: '[data-id="format"] [data-option="sci"]', before: "mode" },
] as const;

test.beforeEach(async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const url = "/src/state/updateOffer.svelte.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/state/updateOffer.svelte.ts");
    m.updateOffer.restart = () => {};
  });
  await expect(page.getByTestId("update-note")).toBeVisible();
  await install(page);
});

const prepare = async (page: Page, before: string): Promise<void> => {
  if (before === "mode") {
    await page.getByTestId("chip-format").tap();
    await expect(page.getByTestId("menu")).toBeVisible();
  }
};

for (const t of TARGETS) {
  test(`${t.name}: lit at the pointerdown, at least 80 ms, then not; a long hold until the lift; drawn from the flag`, async ({ page }) => {
    await prepare(page, t.before);
    const r = await page.evaluate(
      async (sel: string) => {
        const pf = (window as unknown as { __pv: Pf }).__pv;
        const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
        const rest = pf.look(sel);
        pf.fire("pointerdown", sel);
        const atDown = pf.lit();
        const down = pf.look(sel);
        pf.fire("pointerup", sel);
        const atUp = pf.lit();
        while (pf.lit().length && pf.log.offs.length === 0) await sleep(10);
        await sleep(20);
        const after = pf.lit();
        const offs1 = pf.log.offs.length;
        pf.fire("pointerdown", sel);
        await sleep(200);
        const held = pf.lit();
        pf.fire("pointerup", sel);
        return { rest, down, atDown, atUp, after, held, lifted: pf.lit(), offs1, log: pf.log };
      },
      t.sel,
    );
    expect(r.atDown, "lit at the down").toHaveLength(1);
    expect(r.atUp, "a quick tap still shows after the lift").toHaveLength(1);
    expect(r.after).toEqual([]);
    expect(r.held, "a hold past 80 ms stays lit").toHaveLength(1);
    expect(r.lifted, "and goes out at the lift").toEqual([]);
    expect(r.down, "the flag changes the look").not.toBe(r.rest);
    for (const [k, off] of r.log.offs) {
      const downs = r.log.downs.filter(([d, at]) => d === k && at <= off).map(([, at]) => at);
      expect(downs.length, `${k} went off without a down`).toBeGreaterThan(0);
      expect(off - Math.max(...downs), `${k} lit at least ${MIN_MS} ms`).toBeGreaterThanOrEqual(MIN_MS - 0.5);
    }
  });

  test(`${t.name}: a pointercancel clears it at once`, async ({ page }) => {
    await prepare(page, t.before);
    const r = await page.evaluate(
      (sel: string) => {
        const pf = (window as unknown as { __pv: Pf }).__pv;
        pf.fire("pointerdown", sel);
        const lit = pf.lit();
        pf.fire("pointercancel", sel);
        return { lit, cancelled: pf.lit() };
      },
      t.sel,
    );
    expect(r.lit).toHaveLength(1);
    expect(r.cancelled).toEqual([]);
  });
}

test("10 taps 60 ms apart on a Settings ◀ ▶ step light it each time and step 10 times", async ({ page }) => {
  await prepare(page, "mode");
  const sel = '[data-id="digits"] [data-testid="step-up"]';
  const r = await page.evaluate(
    async (sel: string) => {
      const pf = (window as unknown as { __pv: Pf }).__pv;
      const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
      const digits = (): number => (window as unknown as { n62: { session: { settings: { digits: number } } } }).n62.session.settings.digits;
      const start = digits();
      const seen: { lit: number; value: number }[] = [];
      for (let i = 0; i < 10; i++) {
        pf.fire("pointerdown", sel);
        const lit = pf.lit().length;
        pf.fire("pointerup", sel);
        (document.querySelector(sel) as HTMLElement | null)?.click(); // (a synthetic touch makes no click of its own)
        seen.push({ lit, value: digits() });
        await sleep(60);
      }
      await sleep(120);
      return { start, seen, end: pf.lit(), log: pf.log };
    },
    sel,
  );
  expect(r.seen.map((s) => s.lit)).toEqual(Array(10).fill(1));
  expect(r.seen.map((s) => s.value)).toEqual(Array.from({ length: 10 }, (_, i) => r.start + i + 1));
  expect(r.end).toEqual([]);
  for (const [k, off] of r.log.offs) {
    const downs = r.log.downs.filter(([d, at]) => d === k && at <= off).map(([, at]) => at);
    expect(off - Math.max(...downs), `${k} lit at least ${MIN_MS} ms`).toBeGreaterThanOrEqual(MIN_MS - 0.5);
  }
});
