// SPDX-License-Identifier: GPL-3.0-or-later
// R729 (owner, 2026-11-17; docs/mockups/key-legends.html): the key legends. Nothing on a key moves: the face is always the tap,
// the top left the Shift layer, the bottom left the letter. What the next press does is lit, the rest dims: armed is a ring (an
// inset box-shadow, no fill), locked a fill (no ring), on the legends, the Shift and Alpha keys and the bar's ⇧/α button. An empty
// corner is an empty layer. At 412 (the Pixel 7) and 360 px wide.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { flick, hwOn, open, tap, tapHw, touch } from "./helpers.ts";

/** A CSS colour token as the browser resolves it (rgb(…)). */
const token = (page: Page, name: string): Promise<string> =>
  page.evaluate((n) => {
    const el = document.createElement("span");
    el.style.color = `var(--${n})`;
    document.querySelector(".pad")?.appendChild(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return c;
  }, name);
const style = (l: Locator): Promise<{ color: string; bg: string; shadow: string; text: string }> =>
  l.evaluate((e) => {
    const cs = getComputedStyle(e);
    return { color: cs.color, bg: cs.backgroundColor, shadow: cs.boxShadow, text: e.textContent ?? "" };
  });
const NONE = "rgba(0, 0, 0, 0)";
const part = (page: Page, key: string, sel: string): Locator => page.locator(`.pad [data-key="${key}"] ${sel}`);

/** A ring: an inset box-shadow and no fill. */
async function ringed(l: Locator): Promise<void> {
  const s = await style(l);
  expect(s.shadow, `${s.text}: a ring`).toContain("inset");
  expect(s.bg, `${s.text}: no fill`).toBe(NONE);
}
/** A fill in the given background, no ring. */
async function filled(l: Locator, bg: string, fg: string): Promise<void> {
  const s = await style(l);
  expect(s.shadow, `${s.text}: no ring`).not.toContain("inset");
  expect(s.bg, `${s.text}: the fill`).toBe(bg);
  expect(s.color, `${s.text}: the text on the fill`).toBe(fg);
}
async function plain(l: Locator): Promise<void> {
  const s = await style(l);
  expect(s.shadow, `${s.text}: no ring`).not.toContain("inset");
  expect(s.bg, `${s.text}: no fill`).toBe(NONE);
}

/** Every key's face and legend boxes, rounded to the half pixel. `widths: false` leaves the letter widths out (CAS changes their case). */
const boxes = (page: Page, widths = true) =>
  page.evaluate((w) => {
    const out: Record<string, number[]> = {};
    for (const key of document.querySelectorAll<HTMLElement>(".pad .key"))
      for (const sel of [".main", ".shiftlegend", ".alphalegend"]) {
        const el = key.querySelector<HTMLElement>(sel);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const letter = sel === ".alphalegend" || key.dataset["key"] === "alpha";
        out[`${key.dataset["key"]}${sel}`] = [r.left, r.top, r.height, ...(w || !letter ? [r.width] : [])].map((v) => Math.round(v * 2) / 2);
      }
    // (the ⇧/α button is there only while one is on: its fixed slot stands for it)
    for (const b of document.querySelectorAll<HTMLElement>('[data-testid="bar"] button:not(.mod), [data-testid="mod-slot"]')) {
      const r = b.getBoundingClientRect();
      out[`bar:${b.dataset["testid"] ?? b.getAttribute("aria-label")}`] = [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 2) / 2);
    }
    return out;
  }, widths);

for (const width of [412, 360])
  test.describe(`${width} px wide`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 839 });
      await open(page);
    });

    test("lit and dimmed: Shift lights the Shift legends, Alpha the letters; the faces stay the tap", async ({ page }) => {
      const [dead, text] = [await token(page, "key-text-dead"), await token(page, "key-text")];
      await tap(page, ["shift"]);
      await expect(part(page, "sin", ".main")).toHaveText("sin");
      expect((await style(part(page, "sin", ".main"))).color).toBe(dead);
      await expect(part(page, "sin", ".shiftlegend")).toHaveText("sin⁻¹");
      await ringed(part(page, "sin", ".shiftlegend"));
      expect((await style(part(page, "sin", ".alphalegend"))).color).toBe(dead);
      await tap(page, ["shift", "shift"]); // (the lock, then its end)
      await tap(page, ["alpha"]);
      await expect(part(page, "sin", ".main")).toHaveText("sin");
      expect((await style(part(page, "sin", ".main"))).color).toBe(dead);
      await expect(part(page, "sin", ".alphalegend")).toHaveText("G");
      await ringed(part(page, "sin", ".alphalegend"));
      expect((await style(part(page, "sin", ".shiftlegend"))).color).toBe(dead);
      expect((await style(part(page, "esc", ".main"))).color).toBe(text); // no letter: Alpha there is its tap
      await page.evaluate(() => window.n62.session.releaseModifiers());
      await tap(page, ["shift", "alpha"]);
      await expect(part(page, "sin", ".alphalegend")).toHaveText("g");
      await ringed(part(page, "sin", ".alphalegend"));
    });

    test("ring and fill: armed is a ring on the legend, the key and the bar's sign; locked a fill", async ({ page }) => {
      const [ks, oks, ka, oka, s, os, a, oa] = await Promise.all(["key-shift", "on-key-shift", "key-alpha", "on-key-alpha", "shift", "on-shift", "alpha", "on-alpha"].map((n) => token(page, n)));
      await hwOn(page);
      await tapHw(page, ["shift"]);
      await ringed(part(page, "sin", ".shiftlegend"));
      await ringed(part(page, "shift", ".main"));
      await ringed(page.getByTestId("mod-shift"));
      await tapHw(page, ["shift"]);
      await filled(part(page, "sin", ".shiftlegend"), ks!, oks!);
      await filled(part(page, "shift", ".main"), ks!, oks!);
      await filled(page.getByTestId("mod-shift"), s!, os!);
      await tapHw(page, ["shift"]);
      await plain(part(page, "sin", ".shiftlegend"));
      await plain(part(page, "shift", ".main"));
      await tapHw(page, ["alpha"]);
      await ringed(part(page, "sin", ".alphalegend"));
      await ringed(part(page, "alpha", ".main"));
      await ringed(page.getByTestId("mod-alpha"));
      await plain(part(page, "sin", ".shiftlegend"));
      await tapHw(page, ["alpha"]);
      await filled(part(page, "sin", ".alphalegend"), ka!, oka!);
      await filled(part(page, "alpha", ".main"), ka!, oka!);
      await filled(page.getByTestId("mod-alpha"), a!, oa!);
      await tapHw(page, ["alpha"]);
      await tapHw(page, ["shift", "alpha", "alpha"]); // the lower-case lock
      await expect(part(page, "sin", ".alphalegend")).toHaveText("g");
      await filled(part(page, "sin", ".alphalegend"), ka!, oka!);
      await filled(part(page, "alpha", ".main"), ka!, oka!);
      await filled(page.getByTestId("mod-alpha"), a!, oa!);
    });

    test("Enter rings and fills in --on-enter", async ({ page }) => {
      const [oe, ke] = [await token(page, "on-enter"), await token(page, "key-enter")];
      await tap(page, ["shift"]);
      const l = part(page, "enter", ".shiftlegend");
      await ringed(l);
      expect((await style(l)).color).toBe(oe);
      await tap(page, ["shift"]);
      await filled(l, oe, ke);
    });

    test("an empty corner is an empty layer: under Shift 7 and a b/c are dead, nothing on them is ringed", async ({ page }) => {
      await tap(page, ["shift"]);
      for (const k of ["d7", "frac"]) {
        await expect(part(page, k, ".shiftlegend")).toHaveText("");
        await expect(page.locator(`.pad [data-key="${k}"]`)).toHaveAttribute("data-dead", "true");
        for (const sel of [".main", ".shiftlegend", ".alphalegend"]) await plain(part(page, k, sel));
      }
      // the rule both ways: every key but Shift, Alpha and the free keys has a Shift legend exactly when Shift does something on it
      const odd = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".pad .key:not([data-user]):not([data-zone])")]
          .filter((k) => !["shift", "alpha"].includes(k.dataset["key"] ?? ""))
          .filter((k) => (k.querySelector(".shiftlegend")?.textContent ?? "") === "" !== (k.dataset["dead"] === "true"))
          .map((k) => k.dataset["key"]),
      );
      expect(odd).toEqual([]);
    });

    test("nothing moves: every face, legend and bar button keeps its box in every state and in CAS", async ({ page }) => {
      await hwOn(page);
      const rest = await boxes(page);
      for (const keys of [["shift"], ["shift", "shift"], ["alpha"], ["alpha", "alpha"], ["shift", "alpha"], ["shift", "alpha", "alpha"]]) {
        await page.evaluate(() => window.n62.session.releaseModifiers());
        await hwOn(page);
        await tapHw(page, keys);
        expect(await boxes(page), keys.join(" ")).toEqual(rest);
      }
      await page.evaluate(() => window.n62.session.releaseModifiers());
      await hwOn(page);
      const home = await boxes(page, false);
      await tapHw(page, ["@cas"]);
      expect(await boxes(page, false), "CAS").toEqual(home);
    });

    test("the pop shows the layer's text in its colour; a lock flick's bubble shows ⇧ filled, its unlock plain", async ({ page }) => {
      await tap(page, ["shift"]);
      const f = await touch(page, "sin");
      const pop = page.getByTestId("key-pop");
      await expect(pop).toHaveText("sin⁻¹");
      expect((await style(pop)).color).toBe(await token(page, "shift"));
      await f.end();
      const g = await touch(page, "shift");
      await g.move(0, -35);
      const bubble = page.getByTestId("flick-bubble");
      await expect(bubble).toHaveText("⇧");
      expect((await style(bubble)).bg).toBe(await token(page, "shift"));
      await g.end();
      const h = await touch(page, "shift");
      await h.move(0, -35);
      await expect(bubble).toHaveText("⇧");
      expect((await style(bubble)).bg).toBe((await style(page.locator(".pad"))).bg);
      await h.end();
      await flick(page, "alpha", "down");
      const k = await touch(page, "alpha");
      await k.move(0, 35);
      await expect(bubble).toHaveText("A"); // the capitals lock's own sign, plain: this flick ends it
      await k.end();
    });

    test("K4: the Alpha key shows a and A, the Shift key ⇧, at rest, inside the key", async ({ page }) => {
      await expect(part(page, "alpha", ".shiftlegend")).toHaveText("a");
      await expect(part(page, "alpha", ".alphalegend")).toHaveText("A");
      await expect(part(page, "shift", ".shiftlegend")).toHaveText("⇧");
      for (const [k, sel] of [["alpha", ".shiftlegend"], ["alpha", ".alphalegend"], ["shift", ".shiftlegend"]] as const) {
        const [key, el] = [await page.locator(`.pad [data-key="${k}"]`).boundingBox(), await part(page, k, sel).boundingBox()];
        expect(el!.x).toBeGreaterThanOrEqual(key!.x);
        expect(el!.x + el!.width).toBeLessThanOrEqual(key!.x + key!.width + 0.5);
        expect(el!.y + el!.height).toBeLessThanOrEqual(key!.y + key!.height + 0.5);
      }
      await tap(page, ["@cas"]); // in CAS the case follows the view: up types capitals there
      await expect(part(page, "alpha", ".shiftlegend")).toHaveText("A");
      await expect(part(page, "alpha", ".alphalegend")).toHaveText("a");
    });
  });
