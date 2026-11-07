// SPDX-License-Identifier: GPL-3.0-or-later
// R162 (F191): the key pop. At finger-down a bubble above the pressed key shows what the tap will type in this layer (the
// press look says a key was taken; under a thumb it is hidden). It reuses the flick bubble's box and offset in the key's
// text colour, stays until the lift and at least 80 ms, is replaced at once by the next key's down (never two), gives way to
// an armed flick's bubble, and shows nothing for the trackpad, the hub or a key with an empty face. Touch pointers are
// dispatched on the keys (as pressflag.spec.ts does), so the real handlers run; "before the next frame" is checked in a
// requestAnimationFrame callback, which runs before that frame is painted.
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap, touch } from "./helpers.ts";

type Seen = { n: number; text: string | null; box: [number, number, number, number] | null; key: [number, number, number, number]; style: string[] };
type Pp = { fire: (type: string, sel: string, pid: number) => void; seen: (sel: string) => Seen; frame: () => Promise<void> };

const install = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const elOf = (sel: string): HTMLElement => {
      const el = document.querySelector<HTMLElement>(sel.startsWith("[") ? `.pad ${sel}` : `.pad [data-key="${sel}"]`);
      if (!el) throw new Error(`no ${sel}`);
      return el;
    };
    const rect = (e: Element): [number, number, number, number] => {
      const r = e.getBoundingClientRect();
      return [r.left, r.top, r.right, r.bottom];
    };
    const pp: Pp = {
      fire(type, sel, pid) {
        const el = elOf(sel);
        const r = el.getBoundingClientRect();
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true, cancelable: true, pointerId: pid, pointerType: "touch", isPrimary: pid === 1,
            clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
          }),
        );
      },
      seen(sel) {
        const pops = document.querySelectorAll<HTMLElement>('[data-testid="key-pop"]');
        const p = pops[0];
        const cs = p && getComputedStyle(p);
        return {
          n: pops.length,
          text: p ? p.textContent : null,
          box: p ? rect(p) : null,
          key: rect(elOf(sel)),
          style: cs ? [cs.fontStyle, cs.pointerEvents, cs.color, cs.borderTopColor] : [],
        };
      },
      frame: () => new Promise((res) => requestAnimationFrame(() => res())),
    };
    (window as unknown as { __pp: Pp }).__pp = pp;
  });

test.beforeEach(async ({ page }) => {
  await open(page);
  await install(page);
});

const pop = (page: Page) => page.getByTestId("key-pop");

test("a down shows the pop above the key, centred, before the next frame, with the face the tap types", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const pp = (window as unknown as { __pp: Pp }).__pp;
    pp.fire("pointerdown", "d7", 1);
    await pp.frame();
    const s = pp.seen("d7");
    pp.fire("pointerup", "d7", 1);
    return s;
  });
  expect(r.n).toBe(1);
  expect(r.text).toBe("7");
  const [l, t, rr, b] = r.box ?? [0, 0, 0, 0];
  const [kl, kt, kr] = r.key;
  expect(b, "above the key").toBeLessThanOrEqual(kt + 0.5);
  expect(Math.abs((l + rr) / 2 - (kl + kr) / 2), "centred on the key (offsetLeft rounds)").toBeLessThanOrEqual(1);
  expect(t).toBeGreaterThanOrEqual(0);
  expect(r.style[1], "never takes a touch").toBe("none");
  expect(r.style[2], "in the key's text colour").toBe(r.style[3]);
});

test("the face follows the layer: Shift the shift legend, Alpha the letter (italic for a variable)", async ({ page }) => {
  await tap(page, ["shift"]);
  let r = await page.evaluate(async () => {
    const pp = (window as unknown as { __pp: Pp }).__pp;
    pp.fire("pointerdown", "sin", 1);
    await pp.frame();
    const s = pp.seen("sin");
    pp.fire("pointerup", "sin", 1);
    return s;
  });
  expect(r.text).toBe("sin⁻¹");
  expect(r.style[0], "a function is upright").toBe("normal");
  await page.evaluate(() => window.n62.entry.clear());
  await page.waitForTimeout(150);
  await tap(page, ["alpha"]);
  r = await page.evaluate(async () => {
    const pp = (window as unknown as { __pp: Pp }).__pp;
    pp.fire("pointerdown", "vars", 1);
    await pp.frame();
    const s = pp.seen("vars");
    pp.fire("pointerup", "vars", 1);
    return s;
  });
  expect(r.text).toBe("A");
  expect(r.style[0], "a one-letter variable is italic as on the key (R142)").toBe("italic");
});

test("it stays 80 ms and until the lift; a long hold keeps it, the lift removes it", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const pp = (window as unknown as { __pp: Pp }).__pp;
    const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
    const count = (): number => document.querySelectorAll('[data-testid="key-pop"]').length;
    let goneAt = 0;
    new MutationObserver(() => {
      if (!goneAt && count() === 0) goneAt = performance.now();
    }).observe(document.querySelector(".pad") as Element, { childList: true, subtree: true });
    const t0 = performance.now();
    pp.fire("pointerdown", "d7", 1);
    pp.fire("pointerup", "d7", 1);
    await pp.frame();
    const quick = count();
    while (count() > 0 && performance.now() - t0 < 1000) await sleep(5);
    await sleep(20);
    const quickMs = goneAt - t0;
    pp.fire("pointerdown", "d8", 1);
    await sleep(250);
    const held = count();
    pp.fire("pointerup", "d8", 1);
    await sleep(20);
    return { quick, quickMs, held, lifted: count() };
  });
  expect(r.quick, "a quick tap's pop is still there after the lift").toBe(1);
  expect(r.quickMs).toBeGreaterThanOrEqual(79);
  expect(r.quickMs, "not stuck").toBeLessThan(400);
  expect(r.held).toBe(1);
  expect(r.lifted).toBe(0);
});

test("the next key's down replaces it at once: never two", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const pp = (window as unknown as { __pp: Pp }).__pp;
    pp.fire("pointerdown", "d1", 1);
    pp.fire("pointerdown", "d2", 2);
    await pp.frame();
    const a = pp.seen("d2");
    pp.fire("pointerup", "d1", 1);
    pp.fire("pointerup", "d2", 2);
    pp.fire("pointerdown", "d3", 1);
    pp.fire("pointerup", "d3", 1);
    pp.fire("pointerdown", "d4", 1);
    await pp.frame();
    const b = pp.seen("d4");
    pp.fire("pointerup", "d4", 1);
    return { a, b };
  });
  expect(r.a.n).toBe(1);
  expect(r.a.text).toBe("2");
  expect(r.b.n).toBe(1);
  expect(r.b.text).toBe("4");
  // the older key's 80 ms run out later and take nothing from the newer pop
  await page.waitForTimeout(30);
  await expect(pop(page)).toHaveCount(0, { timeout: 1000 });
});

test("an old key's 80 ms never remove the new key's pop while its finger is down", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const pp = (window as unknown as { __pp: Pp }).__pp;
    const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
    pp.fire("pointerdown", "d1", 1);
    pp.fire("pointerup", "d1", 1);
    pp.fire("pointerdown", "d2", 1);
    await sleep(200);
    const s = pp.seen("d2");
    pp.fire("pointerup", "d2", 1);
    return s;
  });
  expect(r.n).toBe(1);
  expect(r.text).toBe("2");
});

test("an armed flick hides the pop and the flick bubble shows alone", async ({ page }) => {
  const f = await touch(page, "vars");
  await expect(pop(page)).toHaveText(/.+/);
  await f.move(0, 35);
  await expect(page.getByTestId("flick-bubble")).toHaveText("A");
  await expect(pop(page)).toHaveCount(0);
  await f.end();
  await expect(pop(page)).toHaveCount(0);
  await page.evaluate(() => window.n62.entry.clear());
  await flick(page, "vars", "down");
  await expect(pop(page)).toHaveCount(0);
});

test("the trackpad zone, the hub and a key that types nothing (an empty face, or dimmed in this layer) show none", async ({ page }) => {
  await tap(page, ["alpha"]); // 0 has no letter: it is dimmed in this layer and types nothing
  const r = await page.evaluate(async () => {
    const pp = (window as unknown as { __pp: Pp }).__pp;
    const n = (): number => document.querySelectorAll('[data-testid="key-pop"]').length;
    const out: Record<string, number> = {};
    for (const [name, sel] of [
      ["empty", "d0"], // (first: a tap on the zone would use up the one-shot Alpha)
      ["zone", "up"],
      ["hub", '[data-testid="pad-hub"]'],
    ] as const) {
      pp.fire("pointerdown", sel, 1);
      await pp.frame();
      out[name] = n();
      pp.fire("pointerup", sel, 1);
    }
    // a pop that is up goes at once when a zone is touched
    pp.fire("pointerdown", "d5", 1);
    pp.fire("pointerdown", "up", 2);
    await pp.frame();
    out["afterZone"] = n();
    pp.fire("pointerup", "up", 2);
    pp.fire("pointerup", "d5", 1);
    return out;
  });
  expect(r).toEqual({ zone: 0, hub: 0, empty: 0, afterZone: 0 });
});

test("a top-row key pops inside the screen at 360 px, over the entry line", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.waitForTimeout(200);
  for (const id of ["esc"]) {
    const r = await page.evaluate(async (id) => {
      const pp = (window as unknown as { __pp: Pp }).__pp;
      pp.fire("pointerdown", id, 1);
      await pp.frame();
      const s = pp.seen(id);
      pp.fire("pointerup", id, 1);
      return s;
    }, id);
    expect(r.n, id).toBe(1);
    const [l, t, rr, b] = r.box ?? [0, 0, 0, 0];
    expect(l, `${id} left`).toBeGreaterThanOrEqual(0);
    expect(rr, `${id} right`).toBeLessThanOrEqual(360);
    expect(t, `${id} top`).toBeGreaterThanOrEqual(0);
    expect(b, `${id} above the key`).toBeLessThanOrEqual(r.key[1] + 0.5);
    await page.waitForTimeout(150);
  }
});

test("a real touch (CDP) shows the pop at once and removes it after the lift", async ({ page }) => {
  const f = await touch(page, "d5");
  await expect(pop(page)).toHaveText("5");
  await f.end();
  await expect(pop(page)).toHaveCount(0, { timeout: 1000 });
});
