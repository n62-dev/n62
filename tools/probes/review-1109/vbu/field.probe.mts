// SPDX-License-Identifier: GPL-3.0-or-later
// vbu: the real makeField/runOnField with the real MathLive in a headless Chromium, no app server: bu-3 (comma + power keys) and the Undo claims of bu-5 and bu-8.
import { createRequire } from "node:module";
import { appendFileSync } from "node:fs";
const R = new URL("../../../../", import.meta.url).pathname;
const OUT = "/dev/stdout";
const APP = `${R}app`;
const req = createRequire(`${APP}/package.json`);
const esbuild = createRequire(`${APP}/package.json`)("esbuild");
const { chromium } = req("@playwright/test");
const log = (...a: unknown[]) => { appendFileSync(OUT, a.join(" ") + "\n"); };
const built = await esbuild.build({
  stdin: { contents: `import { MathfieldElement } from "mathlive"; import { makeField, runOnField } from "./field.ts"; (window as any).go = { MathfieldElement, makeField, runOnField };`, resolveDir: `${APP}/src/entry`, loader: "ts" },
  bundle: true, write: false, format: "iife", target: "es2022", logLevel: "error",
});
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on("pageerror", (e: Error) => log("PAGEERROR", e.message));
  await page.setContent("<!doctype html><div id=h></div>");
  await page.addScriptTag({ content: built.outputFiles[0].text });
  await page.evaluate("window.__name = (f) => f");
  const out: string[] = await page.evaluate(async () => {
    const g = (window as any).go;
    const host = document.getElementById("h");
    const on = { key: () => false, enter() {}, escape() {}, paste() {} };
    const mf = await g.makeField(g.MathfieldElement, host, on);
    const lines: string[] = [];
    const D = (t: string) => ({ kind: "type", text: t });
    const COMMA = { kind: "insert", latex: "{,}" };
    const POINT = D(".");
    const SQ = { kind: "insert", latex: "#@^{2}" };
    const POW = { kind: "insert", latex: "#@^{#?}" };
    const INV = { kind: "insert", latex: "#@^{-1}" };
    const DIV = { kind: "insert", latex: "\\frac{#@}{#?}" };
    const RIGHT = { kind: "cmd", name: "moveToNextChar" };
    const seqs: [string, unknown[]][] = [
      ["point 3.5 sq div 2", [D("3"), POINT, D("5"), SQ, DIV, D("2")]],
      ["comma 3,5 sq div 2", [D("3"), COMMA, D("5"), SQ, DIV, D("2")]],
      ["point 3.5 sq sq", [D("3"), POINT, D("5"), SQ, SQ]],
      ["comma 3,5 sq sq", [D("3"), COMMA, D("5"), SQ, SQ]],
      ["comma 3,5 pow 2 right inv", [D("3"), COMMA, D("5"), POW, D("2"), RIGHT, INV]],
      ["comma 3,5 sq", [D("3"), COMMA, D("5"), SQ]],
      ["comma 1,5 div 2", [D("1"), COMMA, D("5"), DIV, D("2")]],
      ["comma 12,25 sq div 2", [D("1"), D("2"), COMMA, D("2"), D("5"), SQ, DIV, D("2")]],
    ];
    for (const [name, acts] of seqs) {
      mf.value = "";
      for (const a of acts) g.runOnField(mf, a);
      const atoms: string[] = [];
      for (let o = 0; o <= mf.lastOffset; o++) { const i = mf.getElementInfo(o); atoms.push(`${o}:${i?.depth}:${i?.latex}`); }
      lines.push(`SEQ ${name} => ${mf.value}`);
      if (name === "comma 3,5 sq") lines.push(`ATOMS ${atoms.join(" | ")}`);
    }
    const walk = (name: string, steps: (() => void)[]) => {
      const vals: string[] = [];
      for (const s of steps) { s(); vals.push(JSON.stringify(mf.value)); }
      lines.push(`UNDO ${name}: ${vals.join(" -> ")}`);
    };
    const undo = () => mf.executeCommand("undo");
    // bu-5: the slot's text on the line, Esc (value ""), Enter (the app's setEntry("") again), Undo.
    mf.value = "";
    mf.value = "x^{2}";
    walk("bu-5 esc enter undo undo", [() => (mf.value = ""), () => (mf.value = ""), undo, undo]);
    // bu-5 with typing history before it
    mf.value = "";
    for (const k of ["x", "+", "1"]) g.runOnField(mf, D(k));
    walk("bu-5b typed, slot reload, esc, enter, undo×3", [() => (mf.value = "x^{2}"), () => (mf.value = ""), () => (mf.value = ""), undo, undo, undo]);
    // bu-8: a Home line, opening the app clears, Symb sets F1, closing clears, Undo…
    mf.value = "";
    for (const k of ["7", "+", "8"]) g.runOnField(mf, D(k));
    walk("bu-8 typed 7+8, clear, F1 set, clear, undo×4", [() => (mf.value = ""), () => (mf.value = "x^{2}"), () => (mf.value = ""), undo, undo, undo, undo]);
    return lines;
  });
  for (const l of out) log(l);
} finally {
  await browser.close();
}
log("DONE");
