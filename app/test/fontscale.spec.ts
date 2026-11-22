// SPDX-License-Identifier: GPL-3.0-or-later
// R41 (A4a point 4): at the Android font scale 1.5 and 2.0 the keypad's text still fits: a face stays between its two legend
// lines, a legend inside its own line, nothing is cut by the key edge, in Home and CAS and in every layer. The bar
// keeps its chips on one line at 1.5 (at 2.0 its fixed 28 px bar cannot hold the text: R41's report). (The scale is emulated: helpers.ts setFontScale.)
// R703 (F383): the emulation scales only the app's --fs-* tokens; Android's WebView zooms every text after the CSS sizes, the
// sizes fit.ts writes too, and this test cannot see that. The gate for the phone is the device test,
// test-device/fontscale.device.ts (tools/fontscale-device.sh, at font_scale 1.3, 1.5 and 2.0).
import { expect, test, type Page } from "@playwright/test";
import { measure, walk } from "../test-device/fontscale-lib.ts";
import { open, setFontScale, tap } from "./helpers.ts";

const LAYERS: [string, string[]][] = [
  ["primary", []],
  ["shift", ["shift"]],
  ["alpha", ["alpha"]],
  ["shift+alpha", ["shift", "alpha"]],
];

for (const scale of [1.5, 2.0])
  for (const view of ["home", "cas"] as const)
    test(`the keypad's text fits its keys at font scale ${scale} (${view}, 360 px wide)`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await open(page);
      if (view === "cas") await tap(page, ["@cas"]);
      await setFontScale(page, scale);
      const faceSize = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fs-key")));
      expect(faceSize).toBeGreaterThan(20 * scale - 0.5); // the scale is on
      for (const [layer, keys] of LAYERS) {
        await page.evaluate(() => window.n62.session.clearModifiers());
        await tap(page, keys);
        const problems = await page.evaluate(() => {
          const out: string[] = [];
          for (const key of document.querySelectorAll<HTMLElement>(".pad .key")) {
            const id = key.dataset["key"];
            const kb = key.getBoundingClientRect();
            const main = key.querySelector<HTMLElement>(".main");
            const sh = key.querySelector<HTMLElement>(".shiftlegend");
            const al = key.querySelector<HTMLElement>(".alphalegend");
            const text = [main, sh, al].filter((e): e is HTMLElement => e !== null && (e.textContent ?? "").trim() !== "");
            for (const el of text) {
              const range = document.createRange();
              range.selectNodeContents(el);
              const tr = range.getBoundingClientRect();
              if (tr.left < kb.x - 0.5 || tr.right > kb.x + kb.width + 0.5) out.push(`${id}: "${el.textContent}" is cut by the key edge`);
            }
            const m = main?.getBoundingClientRect();
            const s = sh?.getBoundingClientRect();
            const a = al?.getBoundingClientRect();
            // R793: an empty user key whose Shift legend line has no text lifts its ＋ to the key's centre: it stays in the key;
            // every other key (a user key with a Shift slot set too) keeps its face below the legend line
            const lift = key.dataset["user"] === "empty" && (sh?.textContent ?? "").trim() === "";
            if (key.dataset["lift"] === "true" && !lift) out.push(`${id}: the face is lifted over a legend`);
            if (m && s && !lift && m.top < s.bottom - 0.5) out.push(`${id}: the face (${getComputedStyle(main!).fontSize}) rises into the shift legend line`);
            if (m && lift && m.top < kb.top - 0.5) out.push(`${id}: the face is cut at the key's top`);
            if (m && a && m.bottom > a.top + 0.5) out.push(`${id}: the face sinks into the letter line`);
            if (m && m.bottom > kb.bottom + 0.5) out.push(`${id}: the face is cut at the key's bottom`);
            // a legend's font is at most 1.1 times its own line (fit.ts LEGEND_MAX_EM, the design's ratio)
            for (const el of [sh, al])
              if (el && (el.textContent ?? "").trim() !== "" && parseFloat(getComputedStyle(el).fontSize) > el.getBoundingClientRect().height * 1.1 + 0.5)
                out.push(`${id}: the legend "${el.textContent}" (${getComputedStyle(el).fontSize}) is taller than its line`);
          }
          return out;
        });
        expect(problems, `${view} ${layer}`).toEqual([]);
      }
    });

for (const scale of [1.5])
  test(`the bar keeps its chips on one line at font scale ${scale}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page);
    await setFontScale(page, scale);
    const line = page.getByTestId("bar");
    const box = await line.boundingBox();
    expect(box).not.toBeNull();
    const m = await line.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, height: el.getBoundingClientRect().height }));
    expect(m.scroll).toBeLessThanOrEqual(m.client + 1);
  });

// R703: the device test's walk and checks (test-device/fontscale-lib.ts) at the browser's scale 1.0 (no text zoom): they pass, so a
// red on the device is the WebView's zoom, not a check that sees a problem everywhere
// (412 × 915, the probe emulator's Pixel 7: at 360 px Mode's "Number format" ends in … at every scale, by design)
test("the font-scale device checks pass in the browser at scale 1.0", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page, "engine=fake&tips=on");
  const problems: string[] = [];
  await walk(page, async (screen) => {
    await page.waitForTimeout(150);
    const m = await measure(page);
    expect(m.zoom).toBe(1);
    problems.push(...m.out.map((p) => `${screen}: ${p}`));
  });
  expect(problems).toEqual([]);
});

/** R856: the WebView's text zoom as the bar's fit reads it (keyboard/fit.ts textZoom: the body's 16 px, zoomed), with the
 *  tokens scaled as setFontScale does, so views/barFit.ts runs. (A size the fit writes is not zoomed again here, so a shrunk
 *  text is drawn smaller than on the phone: these cases check what is fitted and how, the device test the drawn sizes.) */
async function zoomText(page: Page, scale: number): Promise<void> {
  await page.evaluate((s) => (document.body.style.fontSize = `${16 * s}px`), scale);
  await setFontScale(page, scale);
}
const boxOf = (page: Page, id: string) =>
  page.evaluate((i) => {
    const r = document.querySelector(`[data-testid="${i}"]`)?.getBoundingClientRect();
    return r ? `${r.left.toFixed(1)},${r.width.toFixed(1)}` : "";
  }, id);

for (const place of ["home", "function"] as const)
  test(`at font scale 1.5 a tab whose name does not fit shows its glyph only, its box as at 1.0, never "Ho…" (R856, ${place})`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page);
    if (place === "function") {
      await page.evaluate(() => window.n62.shell.open("function", "symb"));
      await page.waitForFunction(() => window.n62.shell.loading === null && window.n62.shell.current !== null);
    }
    const at1 = { home: await boxOf(page, "tab-home"), slot: await boxOf(page, "tab-slot") };
    await zoomText(page, 1.5);
    await expect(page.locator('[data-testid="tab-home"] .nm')).toBeHidden();
    expect({ home: await boxOf(page, "tab-home"), slot: await boxOf(page, "tab-slot") }).toEqual(at1);
    const names = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".ptab .nm")].map((nm) => ({
        text: nm.textContent,
        shown: !nm.hidden,
        cut: nm.hasAttribute("data-cut") || nm.style.fontSize !== "" || nm.scrollWidth > nm.clientWidth + 0.5,
      })),
    );
    expect(names.filter((n) => n.shown && n.cut), "a name shown is whole, at its own size").toEqual([]);
    await expect(page.locator('[data-testid="tab-home"] svg')).toBeVisible(); // the house stays
    await expect(page.getByTestId("tab-home")).toHaveAttribute("aria-label", "Home");
  });

test("at font scale 2.0 the angle word is fitted inside its box, and STD 12 ▾ and the bar fit (R703, R856)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page);
  await page.evaluate(() => (window.n62.session.settings.angle = "deg"));
  await zoomText(page, 2.0);
  await expect(page.getByTestId("chip-angle")).toHaveText("DEG");
  const m = await page.evaluate(() => {
    const over = (el: HTMLElement): number => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect().width - el.clientWidth;
    };
    const word = document.querySelector<HTMLElement>('[data-testid="chip-angle"]')!;
    const fmt = document.querySelector<HTMLElement>('[data-testid="chip-format"]')!;
    const bar = document.querySelector<HTMLElement>('[data-testid="bar"]')!;
    return { word: over(word), fitted: word.style.fontSize !== "", fmt: over(fmt), bar: bar.scrollWidth - bar.clientWidth };
  });
  expect(m.fitted, "the word is one of the bar's fitted texts").toBe(true);
  expect(m.word).toBeLessThanOrEqual(0.5);
  expect(m.fmt).toBeLessThanOrEqual(0.5);
  expect(m.bar).toBeLessThanOrEqual(0);
});
