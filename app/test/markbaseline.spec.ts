// SPDX-License-Identifier: GPL-3.0-or-later
// R913: the ▾ after a legend that opens a sheet (R143) sits on the text's baseline, on a key face (Vars, Find, Tmpl, ⚙) as on a
// Shift legend (Chars, Mem): before, a face's mark hung about 4 px above it. A pseudo-element has no box to measure, so the test
// puts a span with every computed style of the ::after in its place (the ::after itself switched off), a zero-height baseline
// probe at the start of the text and one inside the span; the ▾'s bottom is the span's baseline plus the glyph's ink descent in
// the span's own font (a canvas measure). Controls: the bar's ▾ marks keep their place (the same probe, unchanged before/after).
import { expect, test, type Page } from "@playwright/test";
import { open } from "./helpers.ts";

interface Seen { found: boolean; text: string; baseline: number; markBottom: number; markBaseline: number }
const measure = (page: Page, sel: string): Promise<Seen> =>
  page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return { found: false, text: "", baseline: 0, markBottom: 0, markBaseline: 0 };
    if (!document.getElementById("r913-off")) {
      const st = document.createElement("style");
      st.id = "r913-off";
      st.textContent = ".r913-probe::after { content: none !important; }";
      document.head.append(st);
    }
    const after = getComputedStyle(el, "::after");
    const span = document.createElement("span");
    for (const p of Array.from(after)) if (p !== "content") span.style.setProperty(p, after.getPropertyValue(p));
    span.textContent = after.content.replace(/^"|"$/g, "");
    const probe = (): HTMLElement => {
      const i = document.createElement("i");
      i.style.cssText = "display:inline-block;width:0;height:0;padding:0;border:0;margin:0;vertical-align:baseline";
      return i;
    };
    const p0 = probe();
    const p1 = probe();
    span.append(p1);
    el.classList.add("r913-probe");
    el.prepend(p0);
    el.append(span);
    const ctx = document.createElement("canvas").getContext("2d");
    const cs = getComputedStyle(span);
    if (ctx) ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const descent = ctx ? ctx.measureText("▾").actualBoundingBoxDescent : 0;
    const baseline = p0.getBoundingClientRect().top;
    const markBaseline = p1.getBoundingClientRect().top;
    const text = (el.textContent ?? "").replace("▾", "");
    span.remove();
    p0.remove();
    el.classList.remove("r913-probe");
    return { found: true, text, baseline, markBaseline, markBottom: markBaseline + descent };
  }, sel);

const setShift = async (page: Page, shift: boolean): Promise<void> => {
  await page.evaluate((s) => {
    window.n62.session.shift = s;
    window.n62.session.alpha = false;
  }, shift);
  await page.waitForTimeout(120);
};

// Vars, Find (math), Tmpl, ⚙ (help) faces; Chars (Shift legend of Vars), Mem (Shift legend of math)
const FACES: [string, string][] = [["Vars", "vars"], ["Find", "math"], ["Tmpl", "tmpl"], ["⚙", "help"]];
const LEGENDS: [string, string][] = [["Chars", "vars"], ["Mem", "math"]];

test("the ▾ of a key face and of a Shift legend sits on the text's baseline (within 1 px)", async ({ page }) => {
  await open(page);
  await setShift(page, false);
  const rows: [string, string][] = [
    ...FACES.map(([n, k]): [string, string] => [n, `.pad .key[data-key="${k}"] .main[data-opens="true"]`]),
    ...LEGENDS.map(([n, k]): [string, string] => [n, `.pad .key[data-key="${k}"] .shiftlegend[data-opens="true"]`]),
  ];
  for (const [name, sel] of rows) {
    const s = await measure(page, sel);
    expect(s.found, `${name}: ${sel}`).toBe(true);
    expect.soft(Math.abs(s.markBottom - s.baseline), `${name} "${s.text}": ▾ bottom ${s.markBottom.toFixed(1)}, baseline ${s.baseline.toFixed(1)}`).toBeLessThanOrEqual(1);
    expect.soft(Math.abs(s.markBaseline - s.baseline), `${name} "${s.text}": the ▾'s baseline is the text's`).toBeLessThanOrEqual(1);
  }
  // Shift armed: Chars and Mem are faces then, the same rule
  await setShift(page, true);
  for (const [name, k] of LEGENDS) {
    const s = await measure(page, `.pad .key[data-key="${k}"] .main[data-opens="true"]`);
    expect(s.found, name).toBe(true);
    expect.soft(Math.abs(s.markBottom - s.baseline), `Shift armed, ${name} "${s.text}": ▾ bottom ${s.markBottom.toFixed(1)}, baseline ${s.baseline.toFixed(1)}`).toBeLessThanOrEqual(1);
  }
});
