// SPDX-License-Identifier: GPL-3.0-or-later
// R865 (the owner's bug list 2026-11-22, point 12, way A; docs/05 3.10): Find stands out. The Find key (the tap of the key in the
// G2's Math place, the same key id in the unit view) wears a lens in its free top-right corner (its ::before, CSS gradients, no
// mask) and a 4 px bar along its foot (an inset shadow above the key shadow), both in --ring (Plain keys: --key-text; drawn dead,
// as over a sheet that does not use it: --key-text-dead). No other key has either; Enter stays the only key filled with --key-enter; the face "Find", its
// fitted size and box, and the legends' boxes stay where they were on phase-1 60f5dc50, before the change. N62, Black & White
// and Solarized, Light and Dark, High contrast and Plain keys on and off, at both phone sizes, in the main and the unit view.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

type Look = { family: string; brightness: string; contrast: string; keys: string };
const LOOKS: Look[] = ["n62", "bw", "solarized"].flatMap((family) =>
  ["dark", "light"].flatMap((brightness) =>
    ["normal", "high"].flatMap((contrast) => ["colour", "plain"].map((keys) => ({ family, brightness, contrast, keys }))),
  ),
);
const name = (l: Look): string => `${l.family} ${l.brightness}, ${l.contrast} contrast, ${l.keys} keys`;

const setLook = (page: Page, l: Look): Promise<void> =>
  page.evaluate(async (l) => {
    const url = "/src/theme/apply.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/apply.ts");
    await m.applyTheme(l as never, document.documentElement);
  }, l);

/** The Find key's face and legends on phase-1, before the change: [x, y, width, height] from the key's top left (CSS px). The
 *  legends of the unit view's Find cell are empty (their padding only); High contrast drops the Shift legend by --legend-drop. */
const BASE: Record<number, { face: number[]; shift: number[]; alpha: number[] }> = {
  412: { face: [10.66, 12, 34.17, 17], shift: [2, 0, 30.47, 10], alpha: [2, 31, 12, 10] },
  360: { face: [6.33, 12, 34.17, 17], shift: [2, 0, 30.47, 10], alpha: [2, 31, 12, 10] },
  1280: { face: [21.13, 28.39, 34.17, 17], shift: [2, 0, 30.47, 10], alpha: [2, 63.8, 12, 10] },
};
const LEGEND_DROP = 2.5;
const EMPTY_LEGEND_W = 4;

interface Seen {
  ring: string; text: string; dead: string; enterBg: string;
  lens: { content: string; color: string; x: number; y: number; w: number; h: number; mask: string };
  keyW: number; keyH: number; shadow: string; bg: string;
  face: { text: string; px: string; box: number[] }; shift: { text: string; box: number[] }; alpha: { text: string; box: number[] };
  scroll: number; client: number;
  /** every other key with a ::before or an inset shadow off its edge (a bar), and every key whose ground is --key-enter */
  others: string[]; enterKeys: string[];
}
const seen = (page: Page): Promise<Seen> =>
  page.locator(".pad").evaluate((pad) => {
    const tone = (v: string): string => {
      const probe = document.createElement("span");
      probe.style.color = `var(${v})`;
      pad.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    };
    const bgTone = (v: string): string => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = `var(${v})`;
      pad.append(probe);
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return c;
    };
    const key = pad.querySelector<HTMLElement>('.key[data-key="math"]') as HTMLElement;
    const k = key.getBoundingClientRect();
    const box = (sel: string): { text: string; px: string; box: number[] } => {
      const el = key.querySelector<HTMLElement>(sel);
      const r = el?.getBoundingClientRect();
      return { text: el?.textContent ?? "", px: el ? getComputedStyle(el).fontSize : "", box: r ? [r.x - k.x, r.y - k.y, r.width, r.height] : [] };
    };
    const b = getComputedStyle(key, "::before") as CSSStyleDeclaration & { webkitMaskImage?: string };
    const px = (s: string): number => parseFloat(s) || 0;
    const w = px(b.width);
    const h = px(b.height);
    // (an inset shadow with a y offset is a bar along an edge; the user keys' and prefix cells' outlines are inset 0 0 0)
    const barred = (s: string): boolean => s.split(/,(?![^(]*\))/).some((p) => p.includes("inset") && !/^\s*(?:rgba?\([^)]*\)\s*)?0px 0px/.test(p.trim()));
    const enterBg = bgTone("--key-enter");
    const others: string[] = [];
    const enterKeys: string[] = [];
    for (const el of pad.querySelectorAll<HTMLElement>(".key")) {
      const id = el.dataset["key"] ?? "?";
      const cs = getComputedStyle(el);
      if (cs.backgroundColor === enterBg) enterKeys.push(id);
      if (el === key) continue;
      const c = getComputedStyle(el, "::before").content;
      if (c !== "none" && c !== "normal") others.push(`${id}::before`);
      if (barred(cs.boxShadow)) others.push(`${id} bar: ${cs.boxShadow}`);
    }
    return {
      ring: tone("--ring"), text: tone("--key-text"), dead: tone("--key-text-dead"), enterBg,
      lens: { content: b.content, color: b.color, x: k.width - px(b.right) - w, y: px(b.top), w, h, mask: `${b.maskImage ?? ""} ${b.webkitMaskImage ?? ""}` },
      keyW: k.width, keyH: k.height, shadow: getComputedStyle(key).boxShadow, bg: getComputedStyle(key).backgroundColor,
      face: box(".main"), shift: box(".shiftlegend"), alpha: box(".alphalegend"), scroll: key.scrollWidth, client: key.clientWidth,
      others, enterKeys,
    };
  });

/** The checks of one look: the lens, the bar, no other key, Enter alone, nothing moved. */
function check(s: Seen, where: string, width: number, unit: boolean, high: boolean, ink: string): void {
  expect(s.lens.content, `${where}: the lens is drawn`).not.toMatch(/^(none|normal)$/);
  expect(s.lens.w > 0 && s.lens.h > 0, `${where}: the lens has a box ${s.lens.w} × ${s.lens.h}`).toBe(true);
  expect(s.lens.mask.trim(), `${where}: no mask (padarrows.spec.ts)`).toMatch(/^(none\s*)*$/);
  // in the key's top-right quarter, inside its box
  expect(s.lens.x, `${where}: the lens is right of the key's middle`).toBeGreaterThanOrEqual(s.keyW / 2);
  expect(s.lens.x + s.lens.w, `${where}: the lens ends inside the key`).toBeLessThanOrEqual(s.keyW + 0.5);
  expect(s.lens.y, `${where}: the lens starts inside the key`).toBeGreaterThanOrEqual(-0.5);
  expect(s.lens.y + s.lens.h, `${where}: the lens is in the key's top half`).toBeLessThanOrEqual(s.keyH / 2);
  expect(s.lens.w, `${where}: about 12 px`).toBeGreaterThanOrEqual(10);
  expect(s.lens.w, `${where}: about 12 px`).toBeLessThanOrEqual(14);
  expect(s.lens.color, `${where}: the lens's colour`).toBe(ink);
  expect(s.shadow, `${where}: a 4 px inset bar at the foot in the lens's colour`).toContain(`${ink} 0px -4px 0px 0px inset`);
  expect(s.others, `${where}: no other key has a ::before or a bar`).toEqual([]);
  expect(s.enterKeys, `${where}: Enter is the only key on --key-enter`).toEqual(["enter"]);
  expect(s.bg, `${where}: Find is not filled with the accent`).not.toBe(s.ring);
  // nothing moves
  const base = BASE[width] as { face: number[]; shift: number[]; alpha: number[] };
  expect(s.face.text, `${where}: the face`).toBe("Find");
  expect(s.face.px, `${where}: the face's fitted size`).toBe("17px");
  const near = (got: number[], want: number[], what: string): void => {
    expect(got.length, `${where}: ${what} is there`).toBe(4);
    got.forEach((v, i) => expect(Math.abs(v - (want[i] as number)), `${where}: ${what} [${got.map((n) => n.toFixed(2))}] against [${want}]`).toBeLessThanOrEqual(0.5));
  };
  near(s.face.box, base.face, "the face's box");
  const legend = (b: number[], drop: number): number[] => (unit ? [b[0] as number, (b[1] as number) + drop, EMPTY_LEGEND_W, b[3] as number] : [b[0] as number, (b[1] as number) + drop, b[2] as number, b[3] as number]);
  near(s.shift.box, legend(base.shift, high ? LEGEND_DROP : 0), "the Shift legend's box");
  near(s.alpha.box, legend(base.alpha, 0), "the letter legend's box");
  if (!unit) expect([s.shift.text, s.alpha.text], `${where}: the legends`).toEqual(["Mem", "B"]);
  if (width === 360) expect(s.scroll, `${where}: the key does not overflow`).toBeLessThanOrEqual(s.client);
}

async function unitView(page: Page): Promise<void> {
  await tap(page, ["d5", "shift", "tmpl"]);
  await page.waitForFunction(() => window.n62.unitView !== undefined && document.querySelector('.pad [data-key="math"][data-pad="keep"]') !== null);
}

for (const [width, height] of [[412, 915], [360, 740]] as const)
  for (const unit of [false, true])
    test(`R865: Find wears the lens and the foot bar in the ${unit ? "unit" : "main"} view at ${width} × ${height}, in every look`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height });
      await open(page);
      if (unit) await unitView(page);
      for (const l of LOOKS) {
        await setLook(page, l);
        await page.waitForTimeout(80);
        const s = await seen(page);
        check(s, `${unit ? "unit view" : "main view"}, ${name(l)}`, width, unit, l.contrast === "high", l.keys === "plain" ? s.text : s.ring);
      }
    });

// the wide layout (docs/05 3.9): the same key in its own column
test("R865: the wide layout, main and unit view: the lens and the bar, nothing moved", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const looks = LOOKS.filter((l) => l.family === "n62" && l.contrast === "normal");
  for (const unit of [false, true]) {
    if (unit) await unitView(page);
    for (const l of looks) {
      await setLook(page, l);
      await page.waitForTimeout(80);
      const s = await seen(page);
      check(s, `wide, ${unit ? "unit view" : "main view"}, ${name(l)}`, 1280, unit, false, l.keys === "plain" ? s.text : s.ring);
    }
  }
});

// R777, R820: a key drawn dead (data-dead) dims its lens and bar with its text, to --key-text-dead. In Plot no key is drawn dead (its
// dead presses are quiet ones, route.ts deadPress); over the Apps sheet, a short list that takes no letters, the Find key is
test("R865: drawn dead (the Apps sheet open), the lens and the bar take --key-text-dead", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page);
  await tap(page, ["@place"]);
  await expect(page.locator('.pad [data-key="math"]')).toHaveAttribute("data-dead", "true");
  for (const l of LOOKS.filter((x) => x.brightness === "dark" || x.family === "solarized")) {
    await setLook(page, l);
    await page.waitForTimeout(80);
    const s = await seen(page);
    const where = `the Apps sheet, ${name(l)}`;
    expect(s.lens.content, `${where}: the lens is drawn`).not.toMatch(/^(none|normal)$/);
    expect(s.lens.color, `${where}: the lens is dimmed`).toBe(s.dead);
    expect(s.shadow, `${where}: the bar is dimmed`).toContain(`${s.dead} 0px -4px 0px 0px inset`);
  }
});
