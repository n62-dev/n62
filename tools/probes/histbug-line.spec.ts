// SPDX-License-Identifier: GPL-3.0-or-later
// R746 (sandra's hist-bug probe, 2026-11-18): what a result tapped from history puts on the line, and where ◀ and a typed
// 7 then go: the line's value, the caret, the selection and MathLive's model (each atom's type, command and whether it
// captures the selection, a chip's mark). A probe, not a test: copy it into app/test/ and run it there
// (`PW_PORT=<free port> GIAC_OUT=<abs dir> npx playwright test test/histbug-line.spec.ts --reporter=line`); it prints.
import { expect, test, type Page } from "@playwright/test";
import { open, tap, tapTwice } from "../../app/test/helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

interface Atom {
  type: string;
  command?: string;
  value?: string;
  captureSelection?: boolean;
  branches?: string[];
  branch?: (b: string) => Atom[] | undefined;
}

const dump = (page: Page, tag: string): Promise<string> =>
  page.evaluate((tag) => {
    const mf = window.n62.entry.field;
    const root = (mf as unknown as { _mathfield?: { model?: { root?: Atom } } } | undefined)?._mathfield?.model?.root;
    const walk = (a: Atom | undefined): string => {
      if (!a) return "";
      const kids = (a.branches ?? []).map((b) => `${b}:[${(a.branch?.(b) ?? []).map(walk).join(",")}]`).join(" ");
      return `${a.type}${a.command ? `(${a.command})` : ""}${a.captureSelection ? "!cap" : ""}${a.value && a.type === "mord" ? `=${a.value}` : ""}${kids ? `{${kids}}` : ""}`;
    };
    return `${tag}: value=${JSON.stringify(mf?.value)} pos=${mf?.position} last=${mf?.lastOffset} sel=${JSON.stringify(mf?.selection)} model=${walk(root)}`;
  }, tag);

const cases: [string, string, "home" | "cas", boolean][] = [
  ["CAS 5/6", "\\frac{5}{6}", "cas", false],
  ["Home 5/6 after a b/c", "\\frac{5}{6}", "home", true],
  ["CAS -5/6", "-\\frac{5}{6}", "cas", false],
  ["CAS sqrt 2", "\\sqrt{2}", "cas", false],
  ["CAS 2x2 matrix", "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}", "cas", false],
];
for (const [name, latex, view, cycle] of cases)
  test(name, async ({ page }) => {
    await page.evaluate((v) => window.n62.session.setView(v), view);
    await page.evaluate((l) => window.n62.session.submit(l), latex);
    await expect(page.locator('[data-status="done"]')).toHaveCount(1);
    if (cycle) await tap(page, ["frac"]);
    console.log(name, "row:", await page.locator('[data-testid="result"] .result').last().getAttribute("data-text"));
    await tapTwice(page.locator('[data-testid="result"] .result').last());
    console.log(await dump(page, `${name} after insert`));
    await tap(page, ["left"]);
    console.log(await dump(page, `${name} after ◀`));
    await tap(page, ["d7"]);
    console.log(await dump(page, `${name} after 7`));
  });
