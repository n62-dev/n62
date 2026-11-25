// SPDX-License-Identifier: GPL-3.0-or-later
// R24b: the unit pad drawn on the keys (`?pad=1`, dev only, until R24c opens it from the units key). Every cell, by
// keys and by touch (tap, flick up, flick down, Shift then the cell, Alpha then the cell), emits its action through the
// keypad's own gesture code; a user cell emits its unit; the cells are drawn in the keys' faces and legends, and every
// legend fits its key at 360 px.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, tap } from "./helpers.ts";

type Emit = { do: string; [k: string]: unknown };
interface Cell { key: string; kind: string; tap?: { emit: Emit }; up?: { emit: Emit }; down?: { emit: Emit } }

test.use({ viewport: { width: 360, height: 740 } });
test.beforeEach(async ({ page }) => {
  await open(page, "engine=fake&pad=1");
  await page.waitForFunction(() => (window.n62.unitPad?.model ?? null) !== null);
});

const cells = (page: Page): Promise<Cell[]> => page.evaluate(() => JSON.parse(JSON.stringify(window.n62.unitPad?.model?.cells ?? [])) as Cell[]);
const log = (page: Page): Promise<Emit[]> => page.evaluate(() => JSON.parse(JSON.stringify(window.n62.unitPad?.log ?? [])) as Emit[]);
const clear = (page: Page): Promise<void> => page.evaluate(() => void window.n62.unitPad?.log?.splice(0));
const onKey = (page: Page, id: string, layer?: "shift" | "alpha"): Promise<void> => page.evaluate(([i, l]) => window.n62.entry.onKey(i as string, l as never, false), [id, layer]);
const LAYERS = [["primary", "tap"], ["shift", "up"], ["alpha", "down"]] as const;

/** One press of `id` in `layer`, however the test reaches it. */
type Reach = (page: Page, id: string, layer: "primary" | "shift" | "alpha") => Promise<void>;
const ways: Record<string, Reach> = {
  "by keys": async (p, id, layer) => onKey(p, id, layer === "primary" ? undefined : layer),
  "by keys, Shift or Alpha then the cell": async (p, id, layer) => {
    if (layer !== "primary") await onKey(p, layer);
    await onKey(p, id);
  },
  "by touch, tap and flicks": async (p, id, layer) => (layer === "primary" ? tap(p, [id]) : flick(p, id, layer === "shift" ? "up" : "down")),
  "by touch, Shift or Alpha then the cell": async (p, id, layer) => tap(p, layer === "primary" ? [id] : [layer, id]),
};

for (const [name, reach] of Object.entries(ways))
  test(`every cell emits its action ${name}`, async ({ page }) => {
    // a sweep of every cell × 3 layers (≈ 150 gestures): 24 s alone by touch, so 30 s ran out under the full suite's
    // load (run 393); the budget follows the work, as unitpad.spec.ts's sweep does
    test.setTimeout(120_000);
    const all = await cells(page);
    expect(all.length).toBeGreaterThan(40);
    for (const c of all)
      for (const [layer, leg] of LAYERS) {
        await clear(page);
        await reach(page, c.key, layer);
        const got = await log(page);
        // ⌫ fires on touch and has no flicks (gestures.ts REPEAT_KEYS): a slide on it is the tap
        const flicked = name === "by touch, tap and flicks" && c.key === "bksp" && layer !== "primary";
        // an empty leg of a user cell opens Find, whose pick sets it (R24d); any other empty leg is a dead key
        const empty = c.kind === "user" ? [{ do: "find", into: { key: c.key, leg } }] : [];
        expect(got, `${c.key} ${layer}`).toEqual(flicked ? [{ do: "delete" }] : c[leg] ? [c[leg].emit] : empty);
      }
    // the pad typed nothing, and the one-shot Shift or Alpha was used up by each cell
    expect(await entryValue(page)).toBe("");
    expect(await page.evaluate(() => [window.n62.session.shift, window.n62.session.alpha])).toEqual([false, false]);
  });

test("a user cell emits its unit; an empty one shows a dim + and is dead", async ({ page }) => {
  await clear(page);
  await tap(page, ["u3"]);
  await flick(page, "u3", "up");
  await flick(page, "u4", "up");
  expect(await log(page)).toEqual([{ do: "unit", id: "s_ton" }, { do: "unit", id: "l_ton" }, { do: "unit", id: "eV" }]);
  await expect(page.locator('[data-key="u3"] .main')).toHaveText("ton");
  await expect(page.locator('[data-key="u3"] .shiftlegend')).toHaveText("l ton");
  await expect(page.locator('[data-key="u3"]')).toHaveAttribute("data-pad", "user");
  await page.evaluate(() => {
    const u = window.n62.unitPad;
    const m = u?.model;
    if (u && m) u.model = new (m.constructor as new (u: object) => NonNullable<typeof m>)({});
  });
  await expect(page.locator('[data-key="u1"] .main')).toHaveText("+");
  await expect(page.locator('[data-key="u1"]')).toHaveAttribute("data-pad", "empty");
  await clear(page);
  await tap(page, ["u1"]);
  expect(await log(page)).toEqual([{ do: "find", into: { key: "u1", leg: "tap" } }]); // an empty user cell opens Find (R24d)
});

test("a user cell shows its flick down as a legend, and the flick emits it", async ({ page }) => {
  const height = (): Promise<number | undefined> => page.locator(".pad").boundingBox().then((b) => b?.height);
  const before = await height();
  await page.evaluate(() => {
    const u = window.n62.unitPad;
    const m = u?.model;
    if (u && m) u.model = new (m.constructor as new (u: object) => NonNullable<typeof m>)({ u2: { tap: "H", down: "mH" } });
  });
  await expect(page.locator('[data-key="u2"] .main')).toHaveText("H");
  await expect(page.locator('[data-key="u2"] .alphalegend')).toHaveText("mH");
  await expect(page.locator('[data-key="u1"] .alphalegend')).toHaveCount(0); // a cell with no flick down has no line for it
  expect(await height()).toBe(before); // the keys below do not move (docs/03 rule 8)
  await clear(page);
  await flick(page, "u2", "down");
  expect(await log(page)).toEqual([{ do: "unit", id: "mH" }]);
});

test("the cells are the keys' own faces and legends, the prefixes in their own colour", async ({ page }) => {
  const text = (id: string, part: string) => page.locator(`[data-key="${id}"] .${part}`);
  await expect(text("d9", "main")).toHaveText("m");
  await expect(text("d9", "shiftlegend")).toHaveText("ft");
  await expect(text("d9", "alphalegend")).toHaveText("in");
  await expect(text("vars", "alphalegend")).toHaveText("mil");
  await expect(text("math", "main")).toHaveText("Find");
  await tap(page, ["shift"]);
  await expect(text("d9", "main")).toHaveText("ft");
  await expect(text("d9", "shiftlegend")).toHaveText("");
  await page.evaluate(() => window.n62.session.releaseModifiers()); // off again (a second Shift tap would lock it, R726)
  const bg = (id: string): Promise<string> => page.locator(`[data-key="${id}"]`).evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect(page.locator('[data-key="d1"]')).toHaveAttribute("data-pad", "prefix");
  await expect(page.locator('[data-key="d9"]')).toHaveAttribute("data-pad", "unit");
  expect(await bg("d1")).not.toBe(await bg("d9")); // the prefix m and the metre m never look alike
  expect(await bg("d1")).toBe(await bg("d7"));
  // the keys outside the pad are as they were
  await expect(text("esc", "main")).toHaveText("Esc");
  await tap(page, ["esc", "undo"]);
  expect(await log(page)).toEqual([]);
});

test("a flick on a cell shows its unit in the bubble; no flick there is ✕", async ({ page }) => {
  const { touch } = await import("./helpers.ts");
  const f = await touch(page, "d9");
  await f.move(0, -35);
  await expect(page.getByTestId("flick-bubble")).toHaveText("ft");
  await f.end();
  const g = await touch(page, "d1"); // the prefix m has no flick down
  await g.move(0, 35);
  await expect(page.getByTestId("flick-bubble")).toHaveText("✕");
  await g.end();
  expect(await log(page)).toEqual([{ do: "unit", id: "ft" }]);
});

test("every legend and face fits its key within the fit code's floor at 360 px", async ({ page }) => {
  for (const state of [[], ["shift"], ["alpha"]]) {
    await tap(page, state);
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      for (const key of document.querySelectorAll<HTMLElement>(".pad .key")) {
        const room = key.clientWidth - parseFloat(getComputedStyle(key).paddingLeft) - parseFloat(getComputedStyle(key).paddingRight);
        for (const el of key.querySelectorAll<HTMLElement>("[data-fit]")) {
          if (el.textContent === "") continue;
          const floor = el.dataset["fit"] === "legend" ? 8 : 9;
          if (el.scrollWidth > room + 0.5 || parseFloat(getComputedStyle(el).fontSize) < floor)
            out.push(`${key.dataset["key"]} ${el.className} "${el.textContent}" ${el.scrollWidth}/${room}px at ${getComputedStyle(el).fontSize}`);
        }
      }
      return out;
    });
    expect(bad, state.join("+") || "plain").toEqual([]);
    if (state.length) await tap(page, state); // off again
  }
});

// R907: a unit's size does not hang on the main key under it (the cell kept its key's class: J 17 px on a function key, W 20 px
// on a digit, Torr 16 px on a control key). Every unit and prefix cell's face has one size before fit.ts shrinks a long one (its
// inline size taken off for the reading), the digits' 20 px, in all three layers.
test("every unit and prefix face has one size before fitting, in all three layers", async ({ page }) => {
  for (const state of [[], ["shift"], ["alpha"]]) {
    await tap(page, state);
    const sizes = await page.evaluate(() => {
      const out: Record<string, string[]> = {};
      for (const key of document.querySelectorAll<HTMLElement>('.pad .key:is([data-pad="unit"], [data-pad="prefix"])')) {
        const el = key.querySelector<HTMLElement>(".main");
        if (!el) continue;
        const fitted = el.style.fontSize;
        el.style.fontSize = "";
        const px = getComputedStyle(el).fontSize;
        el.style.fontSize = fitted;
        (out[px] ??= []).push(`${key.dataset["key"]} "${el.textContent}"`);
      }
      return out;
    });
    const where = state.join("+") || "plain";
    expect(Object.values(sizes).flat().length, `${where}: the cells`).toBeGreaterThan(20);
    expect(Object.keys(sizes), `${where}: ${JSON.stringify(sizes)}`).toEqual(["20px"]);
    if (state.length) await tap(page, state); // off again
  }
});

// R803: the power keys read x², √x, x³, x⁴, ÷ and x⁻¹ (upright, as the main keypad's x²), whole at both phone widths
for (const [w, h] of [[412, 915], [360, 740]] as const)
  test(`the power cells read x², x³, x⁴, x⁻¹ and √x, whole and upright at ${w} × ${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const part = (id: string, cls: string) => page.locator(`[data-key="${id}"] .${cls}`);
    await expect(part("sq", "main")).toHaveText("x²");
    await expect(part("sq", "shiftlegend")).toHaveText("√x");
    await expect(part("pow", "main")).toHaveText("x³");
    await expect(part("pow", "shiftlegend")).toHaveText("x⁴");
    await expect(part("div", "shiftlegend")).toHaveText("x⁻¹");
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      for (const [id, cls] of [["sq", "main"], ["sq", "shiftlegend"], ["pow", "main"], ["pow", "shiftlegend"], ["div", "shiftlegend"]] as const) {
        const el = document.querySelector<HTMLElement>(`[data-key="${id}"] .${cls}`);
        if (!el) out.push(`${id} ${cls} missing`);
        else if (el.scrollWidth > el.clientWidth || getComputedStyle(el).fontStyle === "italic") out.push(`${id} ${cls} ${el.scrollWidth}/${el.clientWidth} ${getComputedStyle(el).fontStyle}`);
      }
      return out;
    });
    expect(bad).toEqual([]);
    await tap(page, ["shift"]);
    await expect(part("sq", "main")).toHaveText("√x");
    await expect(part("pow", "main")).toHaveText("x⁴");
    await expect(part("div", "main")).toHaveText("x⁻¹");
  });

// R861: the Math cell's face "Find" ends in ▾ (it opens Find on units, R143), and at 360 px face and mark fit its key at (within 5 %
// of) the size of the main keypad's Find, as menumark.spec.ts asks of the main pad (the per-key fit test above holds every cell to
// its key's room, the mark included)
test("the Find cell carries ▾ and fits at 360 px at the main keypad's size", async ({ page }) => {
  const size = (p: Page) =>
    p.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-key="math"] .main');
      const key = el?.closest(".key")?.getBoundingClientRect();
      if (!el || !key) return null;
      const px = parseFloat(getComputedStyle(el).fontSize);
      // the text fits its box (scrollWidth counts the mark, which hangs out of the flow in the key's side padding, on the main
      // keypad too: 42/34 px there at 360), and text plus mark (about half an em after it) end inside the key
      const range = document.createRange();
      range.selectNodeContents(el);
      const fits = range.getBoundingClientRect().width <= el.clientWidth + 0.5;
      return { text: el.textContent, opens: el.dataset["opens"], after: getComputedStyle(el, "::after").content, px, fits, past: el.getBoundingClientRect().right + 0.55 * px - key.right };
    });
  const main = await page.context().newPage();
  await main.setViewportSize({ width: 360, height: 740 });
  await open(main);
  const want = await size(main);
  await main.close();
  expect(want?.opens, "the main keypad's Find").toBe("true");
  const got = await size(page);
  expect(got?.text).toBe("Find");
  expect(got?.opens, "the Find cell opens a sheet").toBe("true");
  expect(got?.after).toBe('"▾"');
  expect(got?.fits, "Find fits its key").toBe(true);
  expect(got?.past ?? 1, "the mark ends inside its key").toBeLessThanOrEqual(0);
  expect(got?.px ?? 0).toBeGreaterThanOrEqual((want?.px ?? 0) * 0.95);
});

// R866 (the owner's list of 2026-11-22, point 9): a prefix cell's face ends in a slot line (G_), drawn by CSS (a pseudo-element
// of the face), because the colour step alone differs by 1.03 to 1.41:1 from the unit cells (N62 Dark: 1.11:1). The line is a
// box at least 2 px high and 0.3 em wide, starts within 0.15 em after the letter and sits on the text's baseline (read off the
// pixels drawn); no other cell or key has one; the text and the spoken names stay the letter; face and line fit the key and are
// centred in it together. In the unit view (5, then Shift + Tmpl), N62 Dark and Light, Plain keys off and on, High contrast.
const PREFIXES: Record<string, string> = { d7: "G", d8: "M", d4: "k", d5: "c", d1: "m", d2: "µ", d0: "n", dot: "p" };
const SLOT_LOOKS: [string, string, string][] = [["dark", "normal", "colour"], ["light", "normal", "colour"], ["dark", "normal", "plain"], ["light", "normal", "plain"], ["dark", "high", "colour"], ["light", "high", "plain"]];
const setLook = (page: Page, brightness: string, contrast: string, keys: string): Promise<void> =>
  page.evaluate(async ([brightness, contrast, keys]) => {
    const url = "/src/theme/apply.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/apply.ts");
    await m.applyTheme({ family: "n62", brightness, contrast, keys } as never, document.documentElement);
  }, [brightness, contrast, keys]);

/** Every face and legend with a pseudo-element that is neither empty nor R143's ▾: `key/part`. */
const slotted = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const k of document.querySelectorAll<HTMLElement>(".pad .key"))
      for (const part of ["shiftlegend", "main", "alphalegend"]) {
        const el = k.querySelector<HTMLElement>(`.${part}`);
        if (!el) continue;
        for (const pseudo of ["::before", "::after"]) {
          const c = getComputedStyle(el, pseudo).content;
          if (c !== "none" && c !== "normal" && c !== '"▾"') out.push(`${k.dataset["key"]}/${part}${pseudo}`);
        }
      }
    return out.sort();
  });

interface Geo { key: string; text: string; pad: string | undefined; font: number; textL: number; textR: number; base: number; mainT: number; mainB: number;
  keyL: number; keyR: number; keyScroll: number; keyClient: number; lineW: number; lineH: number; lineGap: number; face: number[]; bg: number[] }
const geometry = (page: Page, ids: string[]): Promise<Geo[]> =>
  page.evaluate((ids) => {
    const rgb = (c: string): number[] => (/rgba?\(([^)]*)\)/.exec(c)?.[1] ?? "0,0,0").split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number);
    return ids.map((id) => {
      const key = document.querySelector<HTMLElement>(`.pad [data-key="${id}"]`) as HTMLElement;
      const el = key.querySelector<HTMLElement>(".main") as HTMLElement;
      const range = document.createRange();
      range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      // the baseline: a probe of no size at the end of the text, on the baseline
      const probe = document.createElement("span");
      probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
      el.append(probe);
      const base = probe.getBoundingClientRect().bottom;
      probe.remove();
      const m = el.getBoundingClientRect();
      const k = key.getBoundingClientRect();
      const a = getComputedStyle(el, "::after");
      const px = (s: string): number => parseFloat(s) || 0;
      return {
        key: id, text: el.textContent ?? "", pad: key.dataset["pad"], font: px(getComputedStyle(el).fontSize), textL: t.left, textR: t.right, base,
        mainT: m.top, mainB: m.bottom, keyL: k.left, keyR: k.right, keyScroll: key.scrollWidth, keyClient: key.clientWidth,
        lineW: a.content === "none" ? 0 : px(a.width), lineH: a.content === "none" ? 0 : px(a.height), lineGap: px(a.marginLeft),
        face: rgb(getComputedStyle(el).color), bg: rgb(getComputedStyle(key).backgroundColor),
      };
    });
  }, ids);

/** The box of what is drawn right of each prefix's letter, in its face's line (CSS px, from a screenshot at CSS scale): the slot
 *  line's pixels, those that differ from the key's ground by at least 40 % of the face colour's difference. */
const drawn = async (page: Page, geo: Geo[]): Promise<({ l: number; r: number; t: number; b: number } | null)[]> => {
  const shot = await page.screenshot({ scale: "css" });
  return page.evaluate(async ([b64, geo]) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height);
    const g = c.getContext("2d") as OffscreenCanvasRenderingContext2D;
    g.drawImage(img, 0, 0);
    return geo.map((k) => {
      const x0 = Math.ceil(k.textR) + 1, x1 = Math.min(Math.floor(k.keyR) - 2, Math.ceil(k.textR + 0.9 * k.font));
      const y0 = Math.floor(k.mainT), y1 = Math.ceil(k.mainB) + 3;
      const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      const full = Math.abs(k.face[0]! - k.bg[0]!) + Math.abs(k.face[1]! - k.bg[1]!) + Math.abs(k.face[2]! - k.bg[2]!);
      let box: { l: number; r: number; t: number; b: number } | null = null;
      for (let y = 0; y < y1 - y0; y++)
        for (let x = 0; x < x1 - x0; x++) {
          const i = (y * (x1 - x0) + x) * 4;
          const diff = Math.abs(d[i]! - k.bg[0]!) + Math.abs(d[i + 1]! - k.bg[1]!) + Math.abs(d[i + 2]! - k.bg[2]!);
          if (diff < 0.4 * full) continue;
          const [px, py] = [x0 + x, y0 + y];
          box = box ? { l: Math.min(box.l, px), r: Math.max(box.r, px + 1), t: Math.min(box.t, py), b: Math.max(box.b, py + 1) } : { l: px, r: px + 1, t: py, b: py + 1 };
        }
      return box;
    });
  }, [shot.toString("base64"), geo] as const);
};

for (const [w, h] of [[360, 740], [412, 915]] as const)
  test(`the prefix keys end in a slot line (G_), only they, whole and centred: ${w} × ${h}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    // the main view: no key has a slot line
    expect(await slotted(page), "the main view").toEqual([]);
    await tap(page, ["d5", "shift", "tmpl"]);
    await page.waitForFunction(() => window.n62.unitView !== undefined && document.querySelector('[data-pad="prefix"]') !== null);
    const ids = Object.keys(PREFIXES);
    for (const [brightness, contrast, keys] of SLOT_LOOKS) {
      const look = `N62 ${brightness}, ${contrast} contrast, ${keys} keys`;
      await setLook(page, brightness, contrast, keys);
      await page.waitForTimeout(150);
      // only the prefix faces have one: no unit, op, keep or user cell, no legend
      expect(await slotted(page), look).toEqual(ids.map((id) => `${id}/main::after`).sort());
      const geo = await geometry(page, ids);
      const boxes = await drawn(page, geo);
      geo.forEach((k, i) => {
        const where = `${look}: ${k.key} "${k.text}"`;
        expect(k.pad, where).toBe("prefix");
        expect(k.text, `${where}: the text is the letter`).toBe(PREFIXES[k.key]);
        expect(k.lineH, `${where}: the line is 2 px high`).toBeGreaterThanOrEqual(2);
        expect(k.lineW, `${where}: the line is at least 0.3 em wide`).toBeGreaterThanOrEqual(0.3 * k.font);
        const box = boxes[i];
        expect(box, `${where}: the line is drawn`).not.toBeNull();
        if (!box) return;
        expect(box.r - box.l, `${where}: drawn at least 0.3 em wide`).toBeGreaterThanOrEqual(0.3 * k.font - 1);
        expect(box.b - box.t, `${where}: drawn as a line, not a glyph`).toBeLessThanOrEqual(4);
        expect(box.l - k.textR, `${where}: it starts within 0.15 em after the letter`).toBeLessThanOrEqual(0.15 * k.font + 1);
        expect(Math.abs(box.b - k.base), `${where}: its bottom is on the baseline`).toBeLessThanOrEqual(2);
        // it fits: the key does not scroll, and letter and line are centred in it together
        expect(k.keyScroll, `${where}: the key does not overflow`).toBeLessThanOrEqual(k.keyClient);
        const lineR = k.textR + k.lineGap + k.lineW;
        expect(Math.abs((k.textL + lineR) / 2 - (k.keyL + k.keyR) / 2), `${where}: letter and line centred in the key`).toBeLessThanOrEqual(1);
      });
    }
    // Shift armed: T (Shift + G) is a prefix and keeps its line; σ (Shift + 1, the uncertainty sheet) is no prefix: ▾ only
    await page.evaluate(() => {
      window.n62.session.shift = true;
    });
    await page.waitForTimeout(120);
    const face = (id: string) =>
      page.evaluate((id) => {
        const el = document.querySelector<HTMLElement>(`.pad [data-key="${id}"] .main`) as HTMLElement;
        return [el.textContent, getComputedStyle(el, "::after").content];
      }, id);
    expect(await face("d7")).toEqual(["T", '""']);
    expect(await face("d1")).toEqual(["σ", '"▾"']);
  });

test("the unit pad's spec no longer says the prefix and unit cells never look alike (R866)", async () => {
  const { readFileSync } = await import("node:fs");
  const yaml = readFileSync(new URL("../../spec/unit-pad.yaml", import.meta.url), "utf8");
  expect(yaml.includes("never look alike"), "spec/unit-pad.yaml still says \"never look alike\"").toBe(false);
  expect(yaml.includes("slot line"), "spec/unit-pad.yaml names the slot line").toBe(true);
});
