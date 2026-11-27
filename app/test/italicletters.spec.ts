// SPDX-License-Identifier: GPL-3.0-or-later
// R142 (owner, 2026-11-06; ISO 80000-2): a legend that types a variable is italic in every mode, no bold anywhere, and
// Plain keys changes colour only. Every key and layer, with Plain keys off and on: a legend is italic exactly when its
// action types one letter, and the italic is the face the entry line draws a typed letter in (MathLive's math italic),
// not a synthesised slant of "STIX Two Math"; nothing on the keys, the sheet rows or the bubble is above weight 400;
// the unit cells drawn on the keys are upright.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { parse } from "yaml";
import { open, tap, touch } from "./helpers.ts";

const here = dirname(fileURLToPath(import.meta.url));
interface Act { type?: string }
interface SpecKey { id: string; user?: boolean; label?: { primary?: string; shift?: string; alpha?: string }; primary?: Act; shift?: Act; alpha?: Act }
const spec = (parse(readFileSync(join(here, "../../spec/keyboard.yaml"), "utf8")) as { keys: SpecKey[] }).keys;
const isLetter = (a: Act | undefined): boolean => a?.type !== undefined && /^\p{L}$/u.test(a.type);

const set = (page: Page, keys: string): Promise<void> =>
  page.evaluate(async (keys) => {
    const url = "/src/theme/apply.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/apply.ts");
    await m.applyTheme({ family: "n62", brightness: "dark", contrast: "normal", keys } as never, document.documentElement);
  }, keys);

/** The family MathLive draws a typed single letter in (its `.ML__mathit`), read from the entry line itself. */
async function variableFamily(page: Page): Promise<string> {
  await tap(page, ["alpha", "vars"]); // A
  const fam = await page.evaluate(() => {
    const mf = document.querySelector("math-field");
    const el = mf?.shadowRoot?.querySelector(".ML__mathit");
    return el ? getComputedStyle(el).fontFamily : "";
  });
  await page.evaluate(() => window.n62.entry.clear());
  return fam;
}
const first = (family: string): string => (family.split(",")[0] ?? "").trim().replace(/["']/g, "");

interface Seen { key: string; part: string; text: string; style: string; weight: string; family: string }
const legends = (page: Page): Promise<Seen[]> =>
  page.evaluate(() => {
    const out: { key: string; part: string; text: string; style: string; weight: string; family: string }[] = [];
    for (const k of document.querySelectorAll<HTMLElement>(".pad .key"))
      for (const part of ["shiftlegend", "main", "alphalegend"]) {
        const el = k.querySelector<HTMLElement>(`.${part}`);
        if (!el) continue;
        const c = getComputedStyle(el);
        out.push({ key: k.dataset["key"] ?? "", part, text: el.textContent ?? "", style: c.fontStyle, weight: c.fontWeight, family: c.fontFamily });
      }
    return out;
  });

/** What the spec says a legend is, in every layer state: italic exactly when its action types one letter. R729: the face is
 *  always the tap and both legends always show, so the state changes none of it. */
function expected(): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const k of spec) {
    const hasShiftHint = k.label?.shift !== undefined;
    const hasAlphaHint = k.label?.alpha !== undefined;
    m.set(`${k.id}/main`, isLetter(k.primary));
    m.set(`${k.id}/shiftlegend`, hasShiftHint && isLetter(k.shift));
    m.set(`${k.id}/alphalegend`, hasAlphaHint && isLetter(k.alpha));
  }
  // R864: the Alpha key's corners (R729's K4) are the letters its layers type, a and A
  m.set("alpha/shiftlegend", true);
  m.set("alpha/alphalegend", true);
  return m;
}

const STATES: [string, boolean, boolean, boolean][] = [
  ["tap", false, false, false],
  ["Shift armed", true, false, false],
  ["Alpha armed", false, true, false],
  ["Shift + Alpha (lower case)", true, true, false],
  ["CAS view, tap (the letter line in lower case, R728)", false, false, true],
  ["CAS view, Alpha (lower case)", false, true, true],
  ["CAS view, Shift + Alpha (capitals)", true, true, true],
];

for (const keys of ["colour", "plain"])
  test(`a legend is italic exactly when its action types one letter, in a real italic face, never bold: Plain keys ${keys === "plain" ? "on" : "off"}`, async ({ page }) => {
    await open(page);
    const mathit = first(await variableFamily(page));
    expect(mathit, "MathLive's variable face").not.toBe("");
    await set(page, keys);
    for (const [name, shift, alpha, cas] of STATES) {
      if (cas) await tap(page, ["@cas"]); // (once: the helper does nothing while CAS is the view)
      await page.evaluate(([s, a]) => {
        window.n62.session.shift = s as boolean;
        window.n62.session.alpha = a as boolean;
      }, [shift, alpha]);
      await page.waitForTimeout(120);
      const want = expected();
      let italics = 0;
      for (const s of await legends(page)) {
        if (s.text === "") continue;
        const w = want.get(`${s.key}/${s.part}`);
        const where = `${name}: ${s.key} ${s.part} "${s.text}"`;
        expect(s.style === "italic", where).toBe(w);
        expect(Number(s.weight), `${where}: weight`).toBeLessThanOrEqual(400);
        if (w) {
          italics++;
          expect(first(s.family), `${where}: family`).toBe(mathit);
          expect(s.family, where).not.toContain("STIX Two Math");
        }
      }
      expect(italics, `${name}: some legends are variables`).toBeGreaterThan(20);
    }
  });

test("`:`, `;`, `#`, digits, operators and functions are upright on the Alpha layer and the tap layer", async ({ page }) => {
  await open(page);
  for (const [shift, alpha] of [[false, true], [false, false], [true, false]] as const) {
    await page.evaluate(([s, a]) => {
      window.n62.session.shift = s as boolean;
      window.n62.session.alpha = a as boolean;
    }, [shift, alpha]);
    await page.waitForTimeout(120);
    for (const s of await legends(page))
      if (/^[:;#0-9+−×÷().,=_≈±∡]$/.test(s.text) || /^(sin|cos|tan|ln|log|Ans|√|π)/.test(s.text)) expect(s.style, `${s.key} ${s.part} "${s.text}"`).toBe("normal");
  }
});

test("the flick bubble's letter is italic, a function's is upright; no bold either way, in both modes", async ({ page }) => {
  await open(page);
  for (const keys of ["colour", "plain"]) {
    await set(page, keys);
    const f = await touch(page, "vars");
    await f.move(0, 35);
    const b = page.getByTestId("flick-bubble");
    await expect(b).toHaveText("A");
    expect(await b.evaluate((e) => [getComputedStyle(e).fontStyle, getComputedStyle(e).fontWeight])).toEqual(["italic", "400"]);
    await f.end();
    await page.evaluate(() => window.n62.entry.clear());
    const g = await touch(page, "sin");
    await g.move(0, -35);
    await expect(b).toHaveText("sin⁻¹");
    expect(await b.evaluate((e) => [getComputedStyle(e).fontStyle, getComputedStyle(e).fontWeight])).toEqual(["normal", "400"]);
    await g.end();
    await page.evaluate(() => window.n62.entry.clear());
  }
});

test("the sheet's row numbers are not bold, Plain keys on or off", async ({ page }) => {
  await open(page);
  for (const keys of ["colour", "plain"]) {
    await set(page, keys);
    await page.evaluate(() => window.n62.shell.showMenu("Test", ["a", "b", "c"].map((n) => ({ id: n, label: n, run: () => {} }))));
    const n = page.getByTestId("menu").locator(".n").first();
    await n.waitFor();
    expect(Number(await n.evaluate((e) => getComputedStyle(e).fontWeight))).toBeLessThanOrEqual(400);
    await tap(page, ["esc"]);
  }
});

test("a user key's legend follows the action it holds", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.n62.userKeys.set("u1", "primary", { label: "k", action: { type: "k" } } as never);
    window.n62.userKeys.set("u2", "primary", { label: "sin", action: { type: "s" } } as never);
    window.n62.userKeys.set("u3", "primary", { label: "ab", action: { type: "ab" } } as never);
  });
  await page.waitForTimeout(150);
  const seen = await legends(page);
  const st = (id: string): string | undefined => seen.find((s) => s.key === id && s.part === "main")?.style;
  expect([st("u1"), st("u2"), st("u3")]).toEqual(["italic", "italic", "normal"]);
});

test("the unit cells drawn on the keys are upright", async ({ page }) => {
  await open(page, "engine=fake&pad=1");
  await page.waitForFunction(() => (window.n62.unitPad?.model ?? null) !== null);
  for (const [shift, alpha] of [[false, false], [true, false], [false, true]] as const) {
    await page.evaluate(([s, a]) => {
      window.n62.session.shift = s as boolean;
      window.n62.session.alpha = a as boolean;
    }, [shift, alpha]);
    await page.waitForTimeout(120);
    const cells = await page.evaluate(() => (window.n62.unitPad?.model?.cells ?? []).map((c) => c.key));
    expect(cells.length).toBeGreaterThan(10);
    const seen = (await legends(page)).filter((s) => cells.includes(s.key) && s.text !== "");
    expect(seen.length).toBeGreaterThan(10);
    for (const s of seen) expect(s.style, `${s.key} ${s.part} "${s.text}"`).toBe("normal");
  }
});

test("the italic font arriving after the first paint moves no key or legend", async ({ page }) => {
  // layout-shift entries that name a keypad node, from the load until the fonts are settled; and every legend box's
  // size before and after the fonts are ready (the legend lines have fixed heights, the keys fixed cells)
  await page.addInitScript(() => {
    const w = window as unknown as { __shifts: string[] };
    w.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; sources?: { node?: Element }[] }[])
        for (const s of e.sources ?? []) if (e.value > 0 && s.node instanceof Element && s.node.closest(".pad")) w.__shifts.push(`${e.value} ${s.node.className}`);
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/?engine=fake&tips=off");
  const boxes = (): Promise<string> =>
    page.evaluate(() => [...document.querySelectorAll(".pad .key")].map((k) => { const r = k.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(","); }).join(";"));
  await page.waitForFunction(() => document.querySelector(".pad .key") !== null);
  const early = await boxes();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  expect(await boxes()).toBe(early);
  expect(await page.evaluate(() => (window as unknown as { __shifts: string[] }).__shifts)).toEqual([]);
});

// R864 (owner, 2026-11-22, point 16): the letter that stands for the operand of a template is a variable too, in the same face; the
// rest of the legend (e, 10, √, |, the digits, ⁻¹) and every letter of a b/c stay upright. The raised letters (ʸ ˣ ⁿ) are drawn as
// the plain letter, raised, in that face.
/** key/part → [the italic letters in order, the upright rest, which italic letters are raised]. */
const TEMPLATES: Record<string, [string[], string, boolean[]]> = {
  "sq/main": [["x"], "²", [false]],
  "pow/main": [["x", "y"], "", [false, true]],
  "pow/shiftlegend": [["n"], "√", [true]],
  "neg/shiftlegend": [["x"], "||", [false]],
  "div/shiftlegend": [["x"], "⁻¹", [false]],
  "ln/shiftlegend": [["x"], "e", [true]],
  "log/shiftlegend": [["x"], "10", [true]],
  "frac/main": [[], "a b/c", []],
};
interface Part { text: string; italic: boolean; family: string; weight: string; raised: boolean }
/** The italic runs of a face or legend (its elements in the italic style) and the text left upright, with each run raised or not
 *  (its bottom above the bottom of the rest by 0.2 em). */
const runs = (page: Page, ids: string[], root = ".pad"): Promise<Record<string, { parts: Part[]; rest: string; style: string } | null>> =>
  page.evaluate(([ids, root]) => {
    const out: Record<string, { parts: Part[]; rest: string; style: string } | null> = {};
    for (const id of ids) {
      const [key, part] = id.split("/");
      const el = document.querySelector<HTMLElement>(key === "*" ? root : `${root} [data-key="${key}"] .${part}`);
      if (!el) {
        out[id] = null;
        continue;
      }
      const kids = [...el.querySelectorAll<HTMLElement>("*")].filter((e) => getComputedStyle(e).fontStyle === "italic");
      const px = parseFloat(getComputedStyle(el).fontSize);
      let base = -Infinity;
      for (const n of el.childNodes) {
        if (n instanceof HTMLElement && kids.includes(n) && n.getBoundingClientRect().height < px * 0.9) continue;
        const r = document.createRange();
        r.selectNode(n);
        base = Math.max(base, r.getBoundingClientRect().bottom);
      }
      const parts = kids.map((e) => {
        const c = getComputedStyle(e);
        return { text: e.textContent ?? "", italic: true, family: c.fontFamily, weight: c.fontWeight, raised: e.getBoundingClientRect().bottom < base - 0.2 * px };
      });
      let rest = "";
      for (const n of el.childNodes) if (!(n instanceof HTMLElement && kids.includes(n))) rest += n.textContent ?? "";
      out[id] = { parts, rest, style: getComputedStyle(el).fontStyle };
    }
    return out;
  }, [ids, root] as const);

function checkTemplates(seen: Awaited<ReturnType<typeof runs>>, want: Record<string, [string[], string, boolean[]]>, mathit: string, where: string): void {
  for (const [id, [letters, rest, raised]] of Object.entries(want)) {
    const s = seen[id];
    const at = `${where}: ${id}`;
    expect(s, at).not.toBeNull();
    if (!s) continue;
    expect(s.style, `${at}: the legend itself upright`).toBe("normal");
    expect(s.parts.map((p) => p.text), `${at}: the italic letters`).toEqual(letters);
    expect(s.rest, `${at}: the upright rest`).toBe(rest);
    s.parts.forEach((p, i) => {
      expect(first(p.family), `${at} "${p.text}": the variable face`).toBe(mathit);
      expect(p.family, `${at} "${p.text}"`).not.toContain("STIX Two Math");
      expect(p.weight, `${at} "${p.text}": weight`).toBe("400");
      expect(p.raised, `${at} "${p.text}": raised`).toBe(raised[i]);
    });
  }
}

for (const [w, h] of [[412, 915], [360, 740]] as const)
  test(`the letter of a template is italic and the rest of its legend upright, every state, Plain keys off and on: ${w} × ${h}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    const mathit = first(await variableFamily(page));
    for (const keys of ["colour", "plain"]) {
      await set(page, keys);
      await page.evaluate(() => window.n62.session.releaseModifiers());
      for (const [name, shift, alpha, cas] of STATES) {
        if (cas) await tap(page, ["@cas"]);
        await page.evaluate(([s, a]) => {
          window.n62.session.shift = s as boolean;
          window.n62.session.alpha = a as boolean;
        }, [shift, alpha]);
        await page.waitForTimeout(120);
        checkTemplates(await runs(page, Object.keys(TEMPLATES)), TEMPLATES, mathit, `${keys}, ${name}`);
      }
      await tap(page, ["@home"]);
    }
  });

test("the variable face has no italic of the modifier letters ʸ ˣ ⁿ (so they are drawn as the letter, raised)", async ({ page }) => {
  await open(page);
  const mathit = first(await variableFamily(page));
  // (to verify, docs: R864) a glyph the face lacks falls back: drawn with two different fallbacks behind it, its width differs
  const covered = await page.evaluate(async (fam) => {
    await document.fonts.load(`20px "${fam}"`, "xʸˣⁿ");
    const c = document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D;
    const w = (ch: string, fb: string): number => {
      c.font = `italic 40px "${fam}", ${fb}`;
      return c.measureText(ch).width;
    };
    return Object.fromEntries(["x", "ʸ", "ˣ", "ⁿ"].map((ch) => [ch, w(ch, "monospace") === w(ch, "serif")]));
  }, mathit);
  expect(covered["x"], "the probe sees the face's own x").toBe(true);
  for (const ch of ["ʸ", "ˣ", "ⁿ"]) {
    if (covered[ch]) test.info().annotations.push({ type: "R864", description: `${mathit} has ${ch}: it could be drawn as itself` });
    expect.soft(covered[ch], `${mathit} has no ${ch}`).toBe(false);
  }
});

test("the key pop and the flick bubble draw a template's letter italic as its legend does", async ({ page }) => {
  await open(page);
  const mathit = first(await variableFamily(page));
  for (const keys of ["colour", "plain"]) {
    await set(page, keys);
    const f = await touch(page, "sq");
    await expect(page.getByTestId("key-pop")).toHaveText("x²");
    checkTemplates(await runs(page, ["*/pop"], '[data-testid="key-pop"]'), { "*/pop": [["x"], "²", [false]] }, mathit, `${keys}: the key pop of x²`);
    await f.end();
    const g = await touch(page, "pow");
    await g.move(0, -35);
    await expect(page.getByTestId("flick-bubble")).toHaveText("n√");
    checkTemplates(await runs(page, ["*/bubble"], '[data-testid="flick-bubble"]'), { "*/bubble": [["n"], "√", [true]] }, mathit, `${keys}: the bubble of ⁿ√`);
    await g.move(0, 0);
    await g.end();
    await page.evaluate(() => window.n62.entry.clear());
  }
});

// R864: R729's K4 puts a (top left) and A (bottom left) on the Alpha key, the letters its layers type: italic in the variable face;
// its face and the Shift key's face stay upright
test("the Alpha key's a and A are italic in the variable face at rest, Shift armed and Alpha armed; the faces of Alpha and Shift upright", async ({ page }) => {
  await open(page);
  const mathit = first(await variableFamily(page));
  for (const [name, shift, alpha] of [["at rest", false, false], ["Shift armed", true, false], ["Alpha armed", false, true]] as const) {
    await page.evaluate(([s, a]) => {
      window.n62.session.shift = s as boolean;
      window.n62.session.alpha = a as boolean;
    }, [shift, alpha]);
    await page.waitForTimeout(120);
    const seen = await legends(page);
    const at = (key: string, part: string): Seen => seen.find((s) => s.key === key && s.part === part) as Seen;
    for (const part of ["shiftlegend", "alphalegend"]) {
      const s = at("alpha", part);
      expect(s.text, `${name}: alpha ${part}`).toBe(part === "shiftlegend" ? "a" : "A");
      expect(s.style, `${name}: alpha ${part}`).toBe("italic");
      expect(first(s.family), `${name}: alpha ${part}`).toBe(mathit);
      expect(s.weight).toBe("400");
    }
    expect(at("alpha", "main").style, `${name}: the Alpha face`).toBe("normal");
    expect(at("shift", "main").style, `${name}: the Shift face`).toBe("normal");
  }
});

test("a user key's own legend is drawn as typed: a backtick in it is no marker (R864)", async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.n62.userKeys.set("u1", "primary", { label: "`x`²", action: { type: "+" } } as never));
  await expect(page.locator('[data-key="u1"] .main')).toHaveText("`x`²");
  expect(await page.locator('[data-key="u1"] .main *').count()).toBe(0);
});
