// SPDX-License-Identifier: GPL-3.0-or-later
// R794 (owner's K9, 2026-11-20): the four arrows of the round pad sit on its axes, at one distance from its centre, the
// same size. Measured in pixels (the ink, wherever it is drawn), at 4 device px per CSS px, so a box edge is good to
// 0.25 px: each arrow's ink box centre within 0.5 px of its axis, the four distances equal within 0.5 px, the four boxes
// (along and across their arrow) equal within 0.5 px. The zones keep their hit boxes and names (controls below).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const set = (page: Page, brightness: string, theme: Record<string, string> = {}): Promise<void> =>
  page.evaluate(async (t) => {
    const url = "/src/theme/apply.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/apply.ts");
    await m.applyTheme({ family: "n62", contrast: "normal", keys: "colour", ...t } as never, document.documentElement);
  }, { brightness, ...theme });

const IDS = ["up", "down", "left", "right"];

/** Each arrow path's computed fill, and the token colours it may take (resolved by a probe in the pad). */
const fills = (page: Page): Promise<{ fills: Record<string, string>; text: string; dead: string; alpha: string }> =>
  page.locator(".pad").evaluate((pad) => {
    const tone = (v: string): string => {
      const probe = document.createElement("span");
      probe.style.color = `var(${v})`;
      pad.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    };
    const fills: Record<string, string> = {};
    for (const p of pad.querySelectorAll<SVGPathElement>(".trackpad svg.arrows path[data-arrow]"))
      fills[p.dataset["arrow"] ?? "?"] = getComputedStyle(p).fill;
    return { fills, text: tone("--key-text"), dead: tone("--key-text-dead"), alpha: tone("--key-alpha") };
  });

type Ink = { cx: number; cy: number; along: number; across: number; max: number };

/** The ink box of each arrow, centre as an offset from the circle's centre (CSS px), and the circle's diameter. */
async function arrows(page: Page): Promise<{ d: number; ink: Record<string, Ink> }> {
  const box = await page.locator(".pad .trackpad").boundingBox();
  if (!box) throw new Error("no trackpad");
  // (2 px either side: at 360 px the circle fills its grid area's width, and the keys' gap is 4 px)
  const clip = { x: Math.floor(box.x) - 2, y: Math.floor(box.y), width: Math.ceil(box.width) + 5, height: Math.ceil(box.height) + 2 };
  const png = await page.screenshot({ clip, scale: "device" });
  return page.evaluate(
    async ({ b64, clip, box }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const cv = document.createElement("canvas");
      [cv.width, cv.height] = [bmp.width, bmp.height];
      const g = cv.getContext("2d", { willReadFrequently: true });
      if (!g) throw new Error("no canvas");
      g.drawImage(bmp, 0, 0);
      const px = g.getImageData(0, 0, bmp.width, bmp.height).data;
      const s = bmp.width / clip.width; // device px per CSS px
      const at = (x: number, y: number): number[] => [...px.slice((y * bmp.width + x) * 4, (y * bmp.width + x) * 4 + 3)];
      // the circle as drawn (it may sit a fraction of a px off its layout box): where a pixel is half the way from the page's
      // colour to the pad's, on two rows, the one through the layout box's centre and one 0.7 of the radius above it (the
      // drop shadow is a copy moved down, hidden at the sides on and above the centre): the centre from the two chords
      const [bx, by] = [Math.round((box.x + box.width / 2 - clip.x) * s), Math.round((box.y + box.height / 2 - clip.y) * s)];
      const bg = at(bx, by); // the hub draws nothing: the pad's own colour
      const page = at(0, by);
      const t = (p: number[]): number => {
        const v = bg.map((b, i) => b - (page[i] ?? 0));
        const n = v.reduce((a, b) => a + b * b, 0);
        return v.reduce((a, b, i) => a + b * ((p[i] ?? 0) - (page[i] ?? 0)), 0) / n;
      };
      const edge = (from: number, step: number, pt: (i: number) => number[]): number => {
        for (let i = from; i + step >= 0 && i + step < bmp.width; i += step) {
          const [a, b] = [t(pt(i)), t(pt(i + step))];
          if (b >= 0.5) return i + 0.5 + (step * (0.5 - a)) / (b - a || 1); // between the two pixels' centres, where t is one half
        }
        throw new Error("no edge of the circle");
      };
      const chord = (y: number): [number, number] => {
        const [l, r] = [edge(0, 1, (x) => at(x, y)), edge(bmp.width - 1, -1, (x) => at(x, y))];
        return [(l + r) / 2, (r - l) / 2];
      };
      const [ox, ca] = chord(by);
      const yb = Math.round(by - 0.7 * ca);
      const [, cb] = chord(yb);
      const [ya, yc] = [by + 0.5, yb + 0.5]; // the rows' centres
      const oy = (yc * yc - ya * ya - (ca * ca - cb * cb)) / (2 * (yc - ya));
      const r = Math.sqrt(ca * ca + (ya - oy) ** 2); // the circle's centre and radius, in device px of the clip
      const sectors: Record<string, { diff: number; x: number; y: number }[]> = { up: [], down: [], left: [], right: [] };
      for (let y = 0; y < bmp.height; y++)
        for (let x = 0; x < bmp.width; x++) {
          const [dx, dy] = [x + 0.5 - ox, y + 0.5 - oy];
          if (Math.hypot(dx, dy) > 0.47 * 2 * r) continue; // off the circle's anti-aliased edge
          const p = at(x, y);
          const diff = Math.max(...p.map((v, i) => Math.abs(v - (bg[i] ?? v))));
          const side = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
          sectors[side]?.push({ diff, x, y });
        }
      const ink: Record<string, Ink> = {};
      for (const [id, pts] of Object.entries(sectors)) {
        const max = Math.max(...pts.map((p) => p.diff));
        const on = pts.filter((p) => p.diff >= max / 2);
        const [x0, x1] = [Math.min(...on.map((p) => p.x)), Math.max(...on.map((p) => p.x)) + 1];
        const [y0, y1] = [Math.min(...on.map((p) => p.y)), Math.max(...on.map((p) => p.y)) + 1];
        const [w, h] = [(x1 - x0) / s, (y1 - y0) / s];
        const vertical = id === "up" || id === "down";
        ink[id] = { cx: ((x0 + x1) / 2 - ox) / s, cy: ((y0 + y1) / 2 - oy) / s, along: vertical ? h : w, across: vertical ? w : h, max };
      }
      return { d: (2 * r) / s, ink };
    },
    { b64: png.toString("base64"), clip, box },
  );
}

const ROUND = (v: number): number => Math.round(v * 100) / 100;

for (const viewport of [
  { width: 412, height: 915 },
  { width: 360, height: 740 },
])
  test.describe(`${viewport.width} × ${viewport.height}`, () => {
    test.use({ viewport, deviceScaleFactor: 4 });
    for (const brightness of ["dark", "light"])
      test(`the pad's four arrows: on its axes, one distance from its centre, one size (N62 ${brightness})`, async ({ page }) => {
        await open(page);
        await set(page, brightness);
        const { d, ink } = await arrows(page);
        const all = Object.entries(ink);
        const said = JSON.stringify({ d: ROUND(d), ink: Object.fromEntries(all.map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([a, b]) => [a, ROUND(b)]))])) });
        for (const [id, a] of all) {
          expect(a.max, `${id}: ink drawn ${said}`).toBeGreaterThan(40);
          const off = id === "up" || id === "down" ? a.cx : a.cy;
          expect(Math.abs(off), `${id}: on its axis ${said}`).toBeLessThanOrEqual(0.5);
        }
        const dist = all.map(([, a]) => Math.hypot(a.cx, a.cy));
        expect(Math.max(...dist) - Math.min(...dist), `one distance ${said}`).toBeLessThanOrEqual(0.5);
        for (const r of dist) expect(r / d, `about a third of the diameter ${said}`).toBeGreaterThan(0.3);
        for (const r of dist) expect(r / d, `about a third of the diameter ${said}`).toBeLessThan(0.36);
        for (const k of ["along", "across"] as const) {
          const v = all.map(([, a]) => a[k]);
          expect(Math.max(...v) - Math.min(...v), `one size, ${k} ${said}`).toBeLessThanOrEqual(0.5);
        }
        // R774's press dot centres on the arrow: its centre (the pad's ::after, laid out from the circle's box) within 0.5 px of the ink's
        await expect(page.locator('.pad [data-key="sin"]')).toHaveAttribute("aria-description", /Shift/); // (placeDot comes with the key names)
        for (const [id, a] of all) {
          const zone = await page.locator(`.pad [data-key="${id}"]`).boundingBox();
          if (!zone) throw new Error(`no ${id}`);
          await page.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2);
          await page.mouse.down();
          await expect(page.locator(`.pad [data-key="${id}"][data-down]`)).toHaveCount(1);
          const dot = await page.locator(".pad .trackpad").evaluate((el) => {
            const c = getComputedStyle(el, "::after");
            return { x: parseFloat(c.left) - el.clientWidth / 2, y: parseFloat(c.top) - el.clientHeight / 2, on: c.visibility };
          });
          await page.mouse.up();
          expect(dot.on, `${id}: dot shown`).toBe("visible");
          expect(Math.hypot(dot.x - a.cx, dot.y - a.cy), `${id}: dot at (${ROUND(dot.x)}, ${ROUND(dot.y)}) ${said}`).toBeLessThanOrEqual(0.5);
        }
      });

    // the arrows are an inline SVG filled with the key's text colour, not a CSS mask: Chromium reads the bare mask only from
    // 120, the WebView floor is 111 (decisions.md), where a masked layer would be a solid disc (audit, round 1); and no
    // element of the keypad carries a mask (a masked layer moved the user keys' faces 1.2 px, userplus.spec.ts)
    test("the arrows are an inline SVG in the text colour, no mask anywhere in the keypad; the zones' glyphs are hidden", async ({ page }) => {
      await open(page);
      const r = await page.locator(".pad").evaluate((pad) => {
        const svg = pad.querySelector(".trackpad svg.arrows");
        const masked: string[] = [];
        for (const el of [pad, ...pad.querySelectorAll("*")])
          for (const pseudo of [null, "::before", "::after"]) {
            const c = getComputedStyle(el, pseudo) as CSSStyleDeclaration & { webkitMaskImage?: string };
            if ((c.maskImage && c.maskImage !== "none") || (c.webkitMaskImage && c.webkitMaskImage !== "none"))
              masked.push(`${el.tagName.toLowerCase()}.${el.getAttribute("class") ?? ""}${pseudo ?? ""}`);
          }
        const key = pad.querySelector<HTMLElement>('[data-key="up"]');
        return {
          paths: svg?.querySelectorAll("path").length ?? 0,
          fill: svg ? getComputedStyle(svg).fill : "",
          text: key ? getComputedStyle(key).color : "?",
          hidden: svg?.getAttribute("aria-hidden"),
          masked,
        };
      });
      expect(r.paths).toBe(4);
      expect(r.fill).toBe(r.text);
      expect(r.hidden).toBe("true");
      expect(r.masked).toEqual([]);
      // (R794f1: transparent, not visibility hidden, so the glyph stays in the accessibility tree)
      for (const id of IDS) await expect(page.locator(`.pad [data-key="${id}"] .main`)).toHaveCSS("opacity", "0");
    });

    // R794f1: the arrows take the layer's colour as the zones' faces did on phase-1 (Alpha's under Alpha), and Plain keys' text
    // colour there; the dead colour still wins (the Shift test below)
    test("Alpha on fills the four arrows with the Alpha colour; under Plain keys with the key text colour", async ({ page }) => {
      await open(page);
      await tap(page, ["alpha"]);
      await expect(page.locator(".pad.alphaed")).toHaveCount(1);
      const on = await fills(page);
      expect(on.alpha).not.toBe(on.text);
      for (const id of IDS) expect(on.fills[id], `${id} with Alpha`).toBe(on.alpha);
      // (Solarized dark with High contrast: the one Plain keys palette whose Alpha colour is not its key text colour, so the
      // rule in modes.css is what makes the arrows plain, not the palette)
      await set(page, "dark", { family: "solarized", contrast: "high", keys: "plain" });
      await expect(page.locator(":root[data-keys='plain'][data-family='solarized']")).toHaveCount(1);
      const plain = await fills(page);
      expect(plain.alpha).not.toBe(plain.text);
      for (const id of IDS) expect(plain.fills[id], `${id} with Alpha under Plain keys`).toBe(plain.text);
      for (const id of IDS) await expect(page.locator(`.pad [data-key="${id}"] .main`)).toHaveCSS("color", plain.text); // (as the zones' faces)
    });

    // R794f1: a zone's face is transparent, not hidden, so before keyNames.ts labels it the arrow still names it
    test("a zone without its aria-label is named by its arrow", async ({ page }) => {
      await open(page);
      await expect(page.locator('.pad [data-key="sin"]')).toHaveAttribute("aria-description", /Shift/); // (the key names are in)
      const glyph: Record<string, string> = { up: "▲", down: "▼", left: "◀", right: "▶" };
      for (const id of IDS) {
        const zone = page.locator(`.pad [data-key="${id}"]`);
        await zone.evaluate((el) => el.removeAttribute("aria-label"));
        await expect(zone).toHaveAccessibleName(new RegExp(glyph[id] ?? "?"));
      }
    });

    // an arrow whose zone does nothing in this layer is dimmed, as the zone's glyph was on phase-1: Shift gives no arrow an action
    test("Shift on dims the four arrows to the dead text colour; Shift off brings the text colour back", async ({ page }) => {
      await open(page);
      const ids = IDS;
      const off = await fills(page);
      expect(off.dead).not.toBe(off.text);
      for (const id of ids) expect(off.fills[id], `${id} before Shift`).toBe(off.text);
      await tap(page, ["shift"]);
      for (const id of ids) await expect(page.locator(`.pad [data-key="${id}"]`)).toHaveAttribute("data-dead", "true");
      const on = await fills(page);
      for (const id of ids) expect(on.fills[id], `${id} with Shift`).toBe(on.dead);
      await page.evaluate(() => window.n62.session.clearModifiers()); // (a second Shift tap locks it, R726)
      for (const id of ids) await expect(page.locator(`.pad [data-key="${id}"]`)).not.toHaveAttribute("data-dead", "true");
      const back = await fills(page);
      for (const id of ids) expect(back.fills[id], `${id} after Shift`).toBe(back.text);
    });

    // R873 (owner, 2026-11-22, point 4): the round pad is filled with its own role, --key-pad, which stands 1.25:1 from the
    // keypad (theme-gen.test.ts); --key-ctl, which it wore before, sat 1.01 to 1.11 from it
    for (const look of [{ brightness: "dark" }, { brightness: "light" }, { brightness: "dark", family: "bw" }, { brightness: "light", family: "solarized" }])
      test(`the round pad's fill is --key-pad, not --key-ctl (${look.family ?? "n62"} ${look.brightness})`, async ({ page }) => {
        await open(page);
        const { brightness, ...rest } = look;
        await set(page, brightness, rest);
        const r = await page.locator(".pad").evaluate((pad) => {
          const tone = (v: string): string => {
            const probe = document.createElement("span");
            probe.style.backgroundColor = `var(${v}, rgb(1, 2, 3))`;
            pad.append(probe);
            const c = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return c;
          };
          const tp = pad.querySelector(".trackpad");
          return { fill: tp ? getComputedStyle(tp).backgroundColor : "no pad", pad: tone("--key-pad"), ctl: tone("--key-ctl") };
        });
        expect(r.pad, "--key-pad is set").not.toBe("rgb(1, 2, 3)");
        expect(r.pad, "--key-pad differs from --key-ctl").not.toBe(r.ctl);
        expect(r.fill).toBe(r.pad);
      });

    // controls: the zones keep their boxes (the four keys tile the pad's grid area as before) and their spoken names
    test("the four zones keep their hit boxes and names; a tap on each moves the cursor", async ({ page }) => {
      await open(page);
      await expect(page.locator('.pad [data-key="sin"]')).toHaveAttribute("aria-description", /Shift/); // (the key names are in)
      const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
      for (const id of ["up", "down", "left", "right"]) {
        const b = await page.locator(`.pad [data-key="${id}"]`).boundingBox();
        if (!b) throw new Error(`no ${id}`);
        boxes[id] = b;
        expect(await page.locator(`.pad [data-key="${id}"]`).getAttribute("aria-label")).toBeTruthy();
      }
      const [u, dn, l, rt] = [boxes["up"], boxes["down"], boxes["left"], boxes["right"]];
      if (!u || !dn || !l || !rt) throw new Error("no zones");
      // up and down span the pad's two columns, left and right one each, in three rows: the grid's cells, as on phase-1
      for (const b of [dn, l]) expect(Math.abs(b.x - u.x)).toBeLessThan(1);
      for (const b of [dn, rt]) expect(Math.abs(b.x + b.width - (u.x + u.width))).toBeLessThan(1);
      expect(l.y).toBeGreaterThanOrEqual(u.y + u.height - 1);
      expect(Math.abs(rt.y - l.y)).toBeLessThan(1);
      expect(dn.y).toBeGreaterThanOrEqual(l.y + l.height - 1);
      await tap(page, ["d1", "d2", "left", "d3"]);
      expect(await entryValue(page)).toBe("132");
    });
  });
