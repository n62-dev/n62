// SPDX-License-Identifier: GPL-3.0-or-later
// R57: the decimal comma as a setting (Settings › Numbers › Decimal mark). In comma mode the . key shows and types the
// comma (MathLive's {,}), the , key shows and types ; (the argument separator), a hardware . or , types the mark, results
// are drawn and copied with the comma, and a pasted 1,5e-3 is a number. Key sequences on the real engine. Expected values
// are derived: 3,5 × 2 = 7, 1,5 ÷ 2 = 0,75, 1,5ᴇ-3 = 0,0015, 3,ᴇ3 = 3.ᴇ3 = 3000.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, lastResult, open, setClipboard, sheetKey, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
// The system clipboard is one for the whole browser: these tests run one after another.
test.describe.configure({ mode: "serial" });

useClipboardLock();

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.n62.session.setDecimalMark("comma"));
  await page.evaluate(() => window.n62.entry.focus());
});

const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const resultIs = async (page: Page, text: string, count: number): Promise<void> => {
  // 15 s: a result waits for the engine, which a full e2e run on a loaded machine starts slowly (run 340: 5 s was not enough)
  await expect(page.locator('[data-status="done"]')).toHaveCount(count, { timeout: 15_000 });
  await expect(lastResult(page)).toHaveAttribute("data-text", text);
};
/** max( ) as Find puts it on the line (R4a: a function's name is reached through Find); the cursor is inside the brackets. */
const maxCall = (page: Page): Promise<void> =>
  page.evaluate(() => window.n62.entry.run({ kind: "insert", latex: "\\operatorname{max}\\left(#0\\right)" }));
const face = (page: Page, id: string): Promise<string> => page.locator(`[data-key="${id}"] .main`).first().innerText();

test("the faces: . shows , and , shows ; in comma mode; point mode has them as before; the keys do not move", async ({ page }) => {
  const box = async (id: string) => page.locator(`[data-key="${id}"]`).first().boundingBox();
  const before = [await box("dot"), await box("comma")];
  expect((await face(page, "dot")).trim()).toBe(",");
  expect((await face(page, "comma")).trim()).toBe(";");
  expect([await box("dot"), await box("comma")]).toEqual(before);
  await page.evaluate(() => window.n62.session.setDecimalMark("point"));
  await expect.poll(async () => (await face(page, "dot")).trim()).toBe(".");
  expect((await face(page, "comma")).trim()).toBe(",");
  expect([await box("dot"), await box("comma")]).toEqual(before);
});

test("3 , 5 × 2 draws 7, and the line holds MathLive's decimal comma", async ({ page }) => {
  await tap(page, ["d3", "dot", "d5", "mul", "d2"]);
  expect(await entryValue(page)).toBe("3{,}5\\times2");
  await tap(page, ["enter"]);
  await resultIs(page, "7", 1);
});

test("1 , 5 ÷ 2 draws 0,75", async ({ page }) => {
  await tap(page, ["d1", "dot", "d5", "div", "d2", "enter"]);
  await resultIs(page, "0,75", 1);
  await expect(lastResult(page)).toContainText("0,75");
});

// R256 (bu-3, night review 2026-11-09): a power key or ÷ after a power takes the whole number with its comma as the base,
// as in point mode (L8, L9); it took only the digits after the comma: 3,5² ÷ 2 was 3·(5²/2) = 37,5. Expected values
// derived (3,5² = 12,25; 3,5²/2 = 6,125 also oracle); 1/12,25 = 0,0816326530612… to 12 digits.
for (const [name, keys, line, result] of [
  ["3 , 5 x² ÷ 2", ["d3", "dot", "d5", "sq", "div", "d2"], "\\frac{3{,}5^2}{2}", "6,125"],
  ["3 , 5 x² x²", ["d3", "dot", "d5", "sq", "sq"], "\\left(3{,}5^2\\right)^2", "150,0625"],
  ["3 , 5 xʸ 2 ▶ x⁻¹", ["d3", "dot", "d5", "pow", "d2", "right", "shift", "div"], "\\left(3{,}5^2\\right)^{-1}", "0,0816326530612"],
  ["12 , 25 x² ÷ 2", ["d1", "d2", "dot", "d2", "d5", "sq", "div", "d2"], "\\frac{12{,}25^2}{2}", "75,03125"],
] as const) {
  test(`${name} takes the whole number 3,5 (12,25) as the base: ${result}`, async ({ page }) => {
    await tap(page, [...keys]);
    expect(await entryValue(page)).toBe(line);
    await tap(page, ["enter"]);
    await resultIs(page, result, 1);
  });
}

test("Del before the 5 of 3,5² deletes the 5 alone and keeps the exponent, as before the 5 of 3.5²", async ({ page }) => {
  const delBefore5 = async (): Promise<string> => {
    await page.evaluate(() => {
      const mf = window.n62.entry.field;
      if (mf) mf.position = mf.lastOffset - 4; // before the 5: the 5, the exponent's sentinel, its 2 and ^2 follow
    });
    await tap(page, ["shift", "bksp"]);
    return entryValue(page);
  };
  await page.evaluate(() => window.n62.session.setDecimalMark("point"));
  await tap(page, ["d3", "dot", "d5", "sq"]);
  expect(await entryValue(page)).toBe("3.5^2");
  expect(await delBefore5()).toBe("3.^2");
  await page.evaluate(() => window.n62.session.setDecimalMark("comma"));
  await tap(page, ["esc", "d3", "dot", "d5", "sq"]);
  expect(await entryValue(page)).toBe("3{,}5^2");
  expect(await delBefore5()).toBe("3{,}^2");
});

// R256f1: the 10 right after a comma number is no 10ˣ mark, and the degrees before a DMS mark are the whole number: each
// comma sequence gives its point twin's line and ⌫ and Del results, the point replaced by the group {,}.
const twin = (l: string): string => l.replaceAll("{,}", ".");
/** Runs `go` in point mode, then in comma mode on a cleared line; the comma lines must equal the point lines. */
const sameAsPoint = async (page: Page, go: () => Promise<string[]>): Promise<{ point: string[]; comma: string[] }> => {
  await page.evaluate(() => window.n62.session.setDecimalMark("point"));
  const point = await go();
  await page.evaluate(() => window.n62.session.setDecimalMark("comma"));
  await tap(page, ["esc"]);
  const comma = await go();
  expect(comma.map(twin)).toEqual(point);
  return { point, comma };
};
const insertDms = (page: Page): Promise<void> =>
  page.evaluate(() => window.n62.entry.run({ kind: "insert", latex: "#@\\degree#?\\prime#?\\doubleprime" }));
const bkspTwice = async (page: Page): Promise<string[]> => {
  const out: string[] = [];
  for (let n = 0; n < 2; n++) {
    await tap(page, ["bksp"]);
    out.push(await entryValue(page));
  }
  return out;
};

test("3 , 1 0 x², cursor after the 0, then ⌫ ⌫ acts as 3.10²: the 10 is a digit pair of the number, not the 10ˣ mark", async ({ page }) => {
  const { point, comma } = await sameAsPoint(page, async () => {
    await tap(page, ["d3", "dot", "d1", "d0", "sq"]);
    await page.evaluate(() => {
      const mf = window.n62.entry.field;
      if (mf) mf.position = mf.lastOffset - 3; // after the 0, the end of the base: the exponent's sentinel, 2 and ^2 follow
    });
    return [await entryValue(page), ...(await bkspTwice(page))];
  });
  expect(point).toEqual(["3.10^2", "3.1^2", "3.^2"]); // the point-mode control
  expect(comma).toEqual(["3{,}10^2", "3{,}1^2", "3{,}^2"]);
});

test("3 , 1 0 x², Del before the 1 deletes the 1 alone and keeps the exponent, as 3.10²", async ({ page }) => {
  const { point, comma } = await sameAsPoint(page, async () => {
    await tap(page, ["d3", "dot", "d1", "d0", "sq"]);
    await page.evaluate(() => {
      const mf = window.n62.entry.field;
      if (mf) mf.position = mf.lastOffset - 5; // before the 1: the 1, the 0, the exponent's sentinel, its 2 and ^2 follow
    });
    await tap(page, ["shift", "bksp"]);
    return [await entryValue(page)];
  });
  expect(point).toEqual(["3.0^2"]); // the point-mode control
  expect(comma).toEqual(["3{,}0^2"]);
});

test("DMS after 3 , 5 takes 3,5 as its degrees: ⌫ inside the template acts as for 3.5", async ({ page }) => {
  const { point, comma } = await sameAsPoint(page, async () => {
    await tap(page, ["d3", "dot", "d5"]);
    await insertDms(page);
    const out = [await entryValue(page)];
    // the places of the number by position (the group {,} is three offsets, its parts included, in comma mode): ⌫ and Del there
    const isComma = (await page.evaluate(() => window.n62.session.settings.decimalMark)) === "comma";
    for (const k of [0, 1, 2, 3]) {
      for (const del of [false, true]) {
        await tap(page, ["esc", "d3", "dot", "d5"]);
        await insertDms(page);
        await page.evaluate((o) => {
          const mf = window.n62.entry.field;
          if (mf) mf.position = o;
        }, isComma && k > 1 ? k + 2 : k);
        await tap(page, del ? ["shift", "bksp"] : ["bksp"]);
        out.push(`${k}${del ? "Del" : "⌫"} ${await entryValue(page)}`);
      }
    }
    return out;
  });
  const dms = "\\degree\\placeholder{}\\prime\\placeholder{}\\doubleprime";
  expect(point[0]).toBe(`3.5${dms}`); // the point-mode control: Del before the 5 deletes the 5 and leaves the 3.
  expect(point[6]).toBe(`2Del 3.${dms}`);
  expect(point[7]).toBe(`3⌫ 3.${dms}`);
  expect(comma[0]).toBe(`3{,}5${dms}`);
});

test("max(1;2) typed with letters and the , key (;) gives 2; a list element is never read as a decimal", async ({ page }) => {
  await maxCall(page);
  await tap(page, ["d1", "comma", "d2"]);
  expect(await entryValue(page)).toMatch(/1;2/);
  await tap(page, ["enter"]);
  await resultIs(page, "2", 1);
});

test("a copied result reads 0,75, and copy → paste gives the value back", async ({ page }) => {
  await tap(page, ["d1", "dot", "d5", "div", "d2", "enter"]);
  await resultIs(page, "0,75", 1);
  await tap(page, ["copy"]);
  await expect.poll(() => clipboard(page)).toBe("0,75");
  await tap(page, ["esc", "paste"]);
  await expect.poll(() => entryValue(page)).toBe("0{,}75");
  await tap(page, ["mul", "d4", "enter"]);
  await resultIs(page, "3", 2);
});

test("a pasted 1,5e-3 evaluates to 0,0015; a pasted 1.5 is refused", async ({ page }) => {
  await setClipboard(page, "1,5e-3");
  await tap(page, ["paste"]);
  await expect.poll(() => entryValue(page)).toBe("1{,}5\\emark-3");
  await tap(page, ["enter"]);
  await resultIs(page, "0,0015", 1);
  await setClipboard(page, "1.5");
  await tap(page, ["paste"]);
  await expect(page.getByTestId("notice")).toHaveText("Paste: not a number");
});

test("selectENumber reads the comma: after a pasted 1,5ᴇ-3, ÷ takes the whole number", async ({ page }) => {
  await setClipboard(page, "1,5e-3");
  await tap(page, ["paste"]);
  await expect.poll(() => entryValue(page)).toBe("1{,}5\\emark-3"); // the paste is async: wait for the number before ÷ takes it
  await tap(page, ["div"]);
  await expect.poll(() => entryValue(page)).toBe("\\frac{1{,}5\\emark-3}{\\placeholder{}}");
  await tap(page, ["d2", "enter"]);
  await resultIs(page, "0,00075", 1);
});

test("hardware keys: both . and , type the mark, ; separates, e after 3, is the exponent key", async ({ page }) => {
  await page.keyboard.type("3,5*2");
  expect(await entryValue(page)).toBe("3{,}5\\times2");
  await page.keyboard.press("Enter");
  await resultIs(page, "7", 1);
  await page.keyboard.type("3.5*2");
  expect(await entryValue(page)).toBe("3{,}5\\times2");
  await page.keyboard.press("Enter");
  await resultIs(page, "7", 2);
  await maxCall(page);
  await page.keyboard.type("1;2");
  await page.keyboard.press("Enter");
  await resultIs(page, "2", 3);
  await page.keyboard.type("1,5e-3");
  expect(await entryValue(page)).toBe("1{,}5\\emark-3");
});

test("3 , ᴇ 3 types no 1 and gives what 3.ᴇ3 gives in point mode; max(1;ᴇ3) shows 1ᴇ3", async ({ page }) => {
  await tap(page, ["d3", "dot", "emark", "d3"]);
  expect(await entryValue(page)).toBe("3{,}\\emark3");
  await tap(page, ["enter"]);
  await resultIs(page, "3000", 1);
  await page.evaluate(() => window.n62.session.setDecimalMark("point"));
  await tap(page, ["d3", "dot", "emark", "d3", "enter"]);
  await resultIs(page, "3000", 2);
  await page.evaluate(() => window.n62.session.setDecimalMark("comma"));
  await maxCall(page);
  await tap(page, ["d1", "comma", "emark", "d3"]);
  expect(await entryValue(page)).toMatch(/1;1\\emark3/);
  await tap(page, ["enter"]);
  await resultIs(page, "1000", 3);
});

test("max(1,5) in point mode gives 5; after Settings › Numbers › Decimal mark: Comma, the row and the recalled entry show max(1;5) and still give 5 (R57f1, R100)", async ({ page }) => {
  await page.evaluate(() => window.n62.session.setDecimalMark("point"));
  await maxCall(page);
  await tap(page, ["d1", "comma", "d5"]);
  await tap(page, ["enter"]);
  await resultIs(page, "5", 1);
  await page.getByTestId("chip-format").tap();
  await tap(page, ["d6", "d2"]);
  const mark = page.getByTestId("menu").locator('[role="menuitem"][data-id="mark"]');
  await expect(mark.getByTestId("sheet-value")).toHaveText("Point");
  const active = page.getByTestId("menu").locator('[data-active="true"]');
  for (let n = 0; n < 8 && (await active.getAttribute("data-id")) !== "mark"; n++) await sheetKey(page, ["up"]);
  await expect(active).toHaveAttribute("data-id", "mark");
  await sheetKey(page, ["right"]);
  await expect(mark.getByTestId("sheet-value")).toHaveText("Comma");
  await tap(page, ["esc", "esc", "esc"]);
  await expect(page.getByTestId("menu")).toHaveCount(0);
  expect(await page.evaluate(() => window.n62.session.settings.decimalMark)).toBe("comma");
  // R100 (owner, 2026-10-31): the row and the recalled line draw the argument comma as ;
  const row = page.locator('.item[data-status="done"]').first().locator("button.in .math");
  await expect(row).toHaveAttribute("data-latex", /1;5/);
  await tap(page, ["up"]);
  await page.getByTestId("row-actions").getByRole("button", { name: "Recall" }).tap();
  expect(await entryValue(page)).toMatch(/1;5/);
  await tap(page, ["enter"]);
  await resultIs(page, "5", 2);
  await page.evaluate(() => window.n62.session.setDecimalMark("point"));
  await expect(row).toHaveAttribute("data-latex", /1,5/);
});

// R100 fix round 1: the units key on a picked row puts its input on the line as the row draws it, not as it was typed.
test("the units key on the row max(1,5), typed in point mode, puts max(1;5) on the line in comma mode", async ({ page }) => {
  await page.evaluate(() => window.n62.session.setDecimalMark("point"));
  await maxCall(page);
  await tap(page, ["d1", "comma", "d5", "enter"]);
  await resultIs(page, "5", 1);
  await page.evaluate(() => window.n62.session.setDecimalMark("comma"));
  await tap(page, ["up", "shift", "tmpl"]);
  await expect(page.getByTestId("unit-view")).toBeVisible();
  expect(await entryValue(page)).toMatch(/1;5/);
  await tap(page, ["esc"]);
  await expect(page.getByTestId("unit-view")).toBeHidden();
});

// R100 (vr-1, P5): a root copied from an app in comma mode pastes into Home as the same value. Expected: the readout
// itself (the oracle's sqrt(2) = 1.41421356237309504880… is appcopy.spec's).
test("Function: Plot › ☰ Root, Copy, then Home, Shift+Copy, Enter gives the same root", async ({ page }) => {
  await tap(page, ["@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
  await tap(page, ["x", "pow", "d2", "right", "sub", "d2", "enter", "@plot"]);
  await page.waitForFunction(() => window.n62.plot.board !== undefined);
  await tap(page, Array<string>(10).fill("right")); // x = 1
  await tap(page, ["@menu", "d1"]); // Root
  await expect(page.getByTestId("readout-x")).toHaveText("1,41421356237");
  await tap(page, ["copy"]);
  await expect.poll(() => clipboard(page)).toMatch(/^1,414213562373095048801/);
  const text = await clipboard(page);
  await tap(page, ["@home", "paste"]);
  await expect.poll(() => entryValue(page)).toBe(text.replace(",", "{,}"));
  await tap(page, ["enter"]);
  await resultIs(page, "1,41421356237", 1);
});

// R100 (fh-6): a list as comma-mode Copy writes it pastes back (derived: 1,5 = 3/2, 2,25 = 9/4)
test("a pasted {1,5;2,25} is the list 1,5 and 2,25; a pasted {1,5} is refused", async ({ page }) => {
  await setClipboard(page, "{1,5;2,25}");
  await tap(page, ["paste"]);
  await expect.poll(() => entryValue(page)).toBe("\\left\\{1{,}5;2{,}25\\right\\}");
  await tap(page, ["enter"]);
  await resultIs(page, "{1,5;2,25}", 1);
  await tap(page, ["copy"]);
  await expect.poll(() => clipboard(page)).toBe("{3/2;9/4}");
  await setClipboard(page, "{1,5}");
  await tap(page, ["paste"]);
  await expect(page.getByTestId("notice")).toHaveText("Paste: not a number");
});

// R99 (bu-3): the . key types MathLive's {,} in the apps too; their Num entry reads it as the mark (derived: y = 2·2,5 = 5).
test("Solve: a known x typed 2 , 5 with the keys is 2,5, and y=2x solves to 5; a letter is refused with a notice", async ({ page }) => {
  const row = (name: string) => page.locator(`[data-testid="solve-table"] tr[data-name="${name}"]`);
  await tap(page, ["@place", "d4", "@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("E1:");
  await tap(page, ["shift", "x", "shift", "dot", "d2", "x", "enter", "@num"]);
  await row("x").locator("th button").tap();
  await tap(page, ["esc", "d2", "dot", "d5"]);
  expect(await entryValue(page)).toBe("2{,}5");
  await tap(page, ["enter"]);
  await expect(row("x").locator("td")).toHaveAttribute("data-value", "2.5");
  await expect(row("x").locator("td")).toHaveText("2,5");
  await tap(page, ["esc", "x", "enter"]);
  await expect(page.getByTestId("notice")).toHaveText("Not a number");
  await expect(row("x").locator("td")).toHaveAttribute("data-value", "2.5");
  await row("y").locator("th button").tap();
  await tap(page, ["@menu", "d1"]); // Solve for y, x known
  await expect(row("y").locator("td")).toHaveText("5");
});

test("Function: a Num start typed 0 , 5 with the keys starts the table at 0,5; a , alone before 5 too", async ({ page }) => {
  await tap(page, ["@symb", "x", "enter", "@num"]);
  const firstX = page.locator('[data-testid="num-table"] td.x').first();
  await expect(firstX).toHaveAttribute("data-x", "0");
  await tap(page, ["@menu", "d1", "d0", "dot", "d5"]); // Start value
  expect(await entryValue(page)).toBe("0{,}5");
  await tap(page, ["enter"]);
  await expect(firstX).toHaveAttribute("data-x", "0.5");
  await expect(firstX).toHaveText("0,5");
  await tap(page, ["@menu", "d1", "dot", "d2", "enter"]); // ,2
  await expect(firstX).toHaveAttribute("data-x", "0.2");
});

// R99f1: selecting an unknown puts its value on the line in the mark's form; an Enter on the untouched line changes nothing.
test("Solve: selecting x (2,5) shows 2{,}5 on the line, Enter keeps 2.5 with no notice; point mode shows 2.5", async ({ page }) => {
  const row = (name: string) => page.locator(`[data-testid="solve-table"] tr[data-name="${name}"]`);
  await tap(page, ["@place", "d4", "@symb"]);
  await tap(page, ["shift", "x", "shift", "dot", "d2", "x", "enter", "@num"]);
  await row("x").locator("th button").tap();
  await tap(page, ["esc", "d2", "dot", "d5", "enter"]);
  await expect(row("x").locator("td")).toHaveAttribute("data-value", "2.5");
  await row("y").locator("th button").tap();
  await row("x").locator("th button").tap();
  await expect(page.getByTestId("entry-label")).toHaveText("x=");
  expect(await entryValue(page)).toBe("2{,}5");
  await tap(page, ["enter"]);
  await expect(page.getByTestId("notice")).toHaveCount(0);
  expect(await entryValue(page)).toBe("");
  await expect(row("x").locator("td")).toHaveAttribute("data-value", "2.5");
  await expect(row("x").locator("td")).toHaveText("2,5");
  await page.evaluate(() => window.n62.session.setDecimalMark("point"));
  await row("y").locator("th button").tap();
  await row("x").locator("th button").tap();
  expect(await entryValue(page)).toBe("2.5");
  await tap(page, ["enter"]);
  await expect(page.getByTestId("notice")).toHaveCount(0);
  await expect(row("x").locator("td")).toHaveAttribute("data-value", "2.5");
});
