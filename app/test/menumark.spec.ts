// SPDX-License-Identifier: GPL-3.0-or-later
// R143 (owner, 2026-11-06): every keytop legend whose layer opens a sheet instead of typing carries the mark ▾ (drawn in CSS on
// `data-opens`, in the legend's own colour); no typing legend does; a user key set to Menu shows it. N62 Dark and Light, Plain
// keys on and off, High contrast on and off; the keys' text is not shrunk for it at 360 px.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { parse } from "yaml";
import { open, tap } from "./helpers.ts";

const here = dirname(fileURLToPath(import.meta.url));
interface Act { special?: string; opens?: boolean }
interface SpecKey { id: string; label?: { primary?: string; shift?: string }; primary?: Act; shift?: Act }
const spec = (parse(readFileSync(join(here, "../../spec/keyboard.yaml"), "utf8")) as { keys: SpecKey[] }).keys;
// the specials that open a sheet (opens.ts), spelled out here on purpose: the test is the owner's list (R871: Shift + Fmt, the Fmt key cycle's page)
const SHEET = new Set(["vars", "find", "memory", "tmpl", "relations", "symbols", "chars", "mode", "settings", "fmtSettings", "apps", "menu", "base", "help", "matrix", "uncertainty"]);
// (and an insert flagged `opens: true`: Store ▶ on Shift + ᴇ, whose sheet "Store in" route.ts opens after it, R912)
const opens = (a: Act | undefined): boolean => a?.opens === true || (a?.special !== undefined && SHEET.has(a.special));

const look = (page: Page, brightness: string, contrast: string, keys: string): Promise<void> =>
  page.evaluate(async ([brightness, contrast, keys]) => {
    const url = "/src/theme/apply.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/apply.ts");
    await m.applyTheme({ family: "n62", brightness, contrast, keys } as never, document.documentElement);
  }, [brightness, contrast, keys]);

const setShift = async (page: Page, shift: boolean): Promise<void> => {
  await page.evaluate((s) => {
    window.n62.session.shift = s;
    window.n62.session.alpha = false;
  }, shift);
  await page.waitForTimeout(120);
};

interface Seen { key: string; pad: string | undefined; part: string; text: string; opens: string | undefined; after: string; color: string; afterColor: string }
const legends = (page: Page): Promise<Seen[]> =>
  page.evaluate(() => {
    const out: Seen[] = [];
    for (const k of document.querySelectorAll<HTMLElement>(".pad .key"))
      for (const part of ["shiftlegend", "main", "alphalegend"]) {
        const el = k.querySelector<HTMLElement>(`.${part}`);
        if (!el) continue;
        out.push({
          key: k.dataset["key"] ?? "", pad: k.dataset["pad"], part, text: el.textContent ?? "", opens: el.dataset["opens"],
          after: getComputedStyle(el, "::after").content, color: getComputedStyle(el).color, afterColor: getComputedStyle(el, "::after").color,
        });
      }
    return out;
  });

const LOOKS: [string, string, string][] = [["dark", "normal", "colour"], ["light", "normal", "colour"], ["dark", "normal", "plain"], ["light", "normal", "plain"], ["dark", "high", "plain"], ["light", "high", "colour"]];
for (const [brightness, contrast, keys] of LOOKS)
  test(`the legends that open a sheet carry ▾, no typing legend does: N62 ${brightness}, ${keys} keys, ${contrast} contrast`, async ({ page }) => {
    await open(page);
    await look(page, brightness, contrast, keys);
    // (R728: the CAS view too, where the letter line draws lower case; no letter carries the mark there either)
    for (const [cas, shift] of [[false, false], [false, true], [true, false], [true, true]] as const) {
      if (cas) await tap(page, ["@cas"]);
      await setShift(page, shift);
      const marked: string[] = [];
      for (const s of await legends(page)) {
        if (s.text === "") continue;
        const k = spec.find((x) => x.id === s.key);
        const want =
          s.part === "alphalegend" ? false : s.part === "shiftlegend" ? k?.label?.shift !== undefined && opens(k.shift) : opens(k?.primary);
        const where = `${cas ? "CAS " : ""}${shift ? "Shift" : "tap"}: ${s.key} ${s.part} "${s.text}"`;
        expect(s.opens === "true", where).toBe(want);
        if (want) {
          marked.push(`${s.key}/${s.part}`);
          expect(s.after, where).toBe('"▾"');
          expect(s.afterColor, `${where}: the mark has the legend's colour`).toBe(s.color);
        } else expect(["none", "normal"], where).toContain(s.after);
      }
      // the tap layer: Vars, Math, Tmpl; Help and its Shift legend Settings (r0c4, R723), the Shift legends: Memory (Math), ≤≠, α∞, Base (Shift + −), Matrix (Shift + 4, R187), σ (Shift + 1, the uncertainty sheet, R327), Chars (Shift + Vars, R725), Store (Shift + ᴇ, R912), Cycle (Shift + Fmt, R871); Copy and Paste (Shift + Select and Shift + Deselect, R723) open no sheet; Shift armed: the same (R729: nothing on a key moves)
      expect(marked.sort(), `${cas ? "CAS, " : ""}${shift ? "Shift armed" : "tap"}`).toEqual(
        ["d1/shiftlegend", "d4/shiftlegend", "d6/shiftlegend", "d9/shiftlegend", "emark/shiftlegend", "fmt/shiftlegend", "help/main", "help/shiftlegend", "math/main", "math/shiftlegend", "sub/shiftlegend", "tmpl/main", "vars/main", "vars/shiftlegend"],
      );
    }
  });

// R912 (owner-style hunt 2026-11-23, h1 #7): Shift + ᴇ opens the "Store … in" sheet (R281), so its legend Store ends in ▾ as
// Mat▾, σ▾ and Chars▾ do; its tap ᴇ types and has none
test("Store, the Shift legend of ᴇ, carries ▾; ᴇ does not", async ({ page }) => {
  await open(page);
  const seen = (part: string): Promise<[string | undefined, string]> =>
    page.evaluate((part) => {
      const el = document.querySelector<HTMLElement>(`.pad [data-key="emark"] .${part}`);
      return [el?.dataset["opens"], el ? getComputedStyle(el, "::after").content : ""] as [string | undefined, string];
    }, part);
  expect(await seen("shiftlegend")).toEqual(["true", '"▾"']);
  expect((await seen("main"))[0]).toBeUndefined();
});

test("a user key set to Menu (or any sheet) shows the mark on that layer; one set to a typing action does not", async ({ page }) => {
  await open(page);
  const mark = (id: string, part: string): Promise<string | undefined> =>
    page.evaluate(([id, part]) => document.querySelector<HTMLElement>(`.pad [data-key="${id}"] .${part}`)?.dataset["opens"], [id, part] as const);
  await page.evaluate(() => {
    window.n62.userKeys.set("u1", "primary", { label: "Menu", action: { special: "menu" } });
    window.n62.userKeys.set("u1", "shift", { label: "Find", action: { special: "find" } });
    window.n62.userKeys.set("u2", "primary", { label: "π", action: { insert: "\\pi" } });
    window.n62.userKeys.set("u3", "primary", { label: "Home", action: { special: "home" } });
  });
  await page.waitForTimeout(120);
  expect(await mark("u1", "main")).toBe("true");
  expect(await mark("u1", "shiftlegend")).toBe("true");
  expect(await mark("u2", "main")).toBeUndefined();
  expect(await mark("u3", "main")).toBeUndefined();
  expect(await mark("u4", "main")).toBeUndefined();
  await page.evaluate(() => window.n62.userKeys.reset());
});

test("at 360 px the mark never shrinks Vars, Math, Tmpl or α∞ by more than 5 %", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page);
  const sizes = (): Promise<Record<string, number>> =>
    page.evaluate(() => {
      const px = (sel: string): number => {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) return -1;
        return parseFloat(getComputedStyle(el).fontSize);
      };
      return {
        vars: px('[data-key="vars"] .main'), math: px('[data-key="math"] .main'), tmpl: px('[data-key="tmpl"] .main'),
        sin: px('[data-key="sin"] .main'), tan: px('[data-key="tan"] .main'),
        sym: px('[data-key="d9"] .shiftlegend'), rel: px('[data-key="d6"] .shiftlegend'), plain: px('[data-key="d8"] .shiftlegend'), mode: px('[data-key="deselect"] .shiftlegend'),
      };
    });
  const s = await sizes();
  // and the mark stays inside its key: a legend's text plus the mark ends before the key's right edge
  const out = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-opens="true"]')].map((el) => {
      const k = el.closest(".key")?.getBoundingClientRect();
      // (the mark hangs out of the flow: about half an em wide, after the text)
      return k ? el.getBoundingClientRect().right + 0.55 * parseFloat(getComputedStyle(el).fontSize) - k.right : 0;
    }),
  );
  expect(Math.max(...out), "the mark ends inside its key").toBeLessThanOrEqual(0);
  for (const [k, v] of Object.entries(s)) expect(v, `${k} is drawn`).toBeGreaterThan(0);
  // the faces of the fn class keep (all but) the size of the unmarked ones (the mark takes the key's side padding; Math, the
  // widest, loses at most 5 % of 17 px); the legends keep the legend size of an unmarked one ({ })
  for (const k of ["vars", "math", "tmpl"]) expect(s[k], k).toBeGreaterThanOrEqual((s["sin"] as number) * 0.95);
  expect(s["sym"], "α∞").toBe(s["plain"]);
  expect(s["rel"], "≤≠").toBe(s["plain"]);
});

// R861 (the owner's bug list 2026-11-22, point 12): in the unit view (Shift + Tmpl) the pad's Math cell still opens a sheet (Find on
// units), so its face "Find" keeps its ▾; σ (Shift + 1's uncertainty sheet, passed through over the prefix cell d1, R327) keeps its
// own, and so does Store (Shift + ᴇ's "Store in", passed through over the mol cell emark, R353, R912); no other cell (units, prefixes, ops, ⌫, Enter and Eval, the user cells) carries one, and the keys that are no cell keep the
// main view's rule. N62 Dark and Light, Plain keys off and on, at both phone widths.
for (const [w, h] of [[412, 915], [360, 740]] as const)
  test(`in the unit view the legends that open a sheet carry ▾: ${w} × ${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    await tap(page, ["shift", "tmpl"]);
    await page.waitForFunction(() => window.n62.unitView !== undefined && document.querySelector('[data-pad="unit"]') !== null);
    const cells = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".pad .key[data-pad]")].map((k) => k.dataset["key"] ?? ""));
    expect(cells.length, "the pad is up").toBeGreaterThan(40);
    for (const [brightness, keys] of [["dark", "colour"], ["light", "colour"], ["dark", "plain"], ["light", "plain"]] as const) {
      await look(page, brightness, "normal", keys);
      await page.waitForTimeout(120);
      const marked: string[] = [];
      for (const s of await legends(page)) {
        if (s.text === "") continue;
        const where = `${brightness} ${keys}: ${s.key} ${s.part} "${s.text}"`;
        const k = spec.find((x) => x.id === s.key);
        const want = cells.includes(s.key)
          ? (s.key === "math" && s.part === "main") || (["d1", "emark"].includes(s.key) && s.part === "shiftlegend")
          : s.part === "alphalegend" ? false : s.part === "shiftlegend" ? k?.label?.shift !== undefined && opens(k.shift) : opens(k?.primary);
        expect(s.opens === "true", where).toBe(want);
        if (!want) {
          // (a prefix cell's face and its prefix legends T, h, f end in their slot line instead, R866 and R908: an empty
          // pseudo-element, unitpad-draw.spec.ts)
          expect(s.pad === "prefix" ? ['""'] : ["none", "normal"], where).toContain(s.after);
          continue;
        }
        if (cells.includes(s.key)) marked.push(`${s.key}/${s.part} ${s.text}`);
        expect(s.after, where).toBe('"▾"');
        expect(s.afterColor, `${where}: the mark has the legend's colour`).toBe(s.color);
      }
      expect(marked.sort(), `${brightness} ${keys}: the cells with ▾`).toEqual(["d1/shiftlegend σ", "emark/shiftlegend Store", "math/main Find"]);
    }
  });
