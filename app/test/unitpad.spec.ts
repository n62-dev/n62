// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: the unit view from the keys (docs/04 4.3, docs/archive/r9-unit-pad.md 2.1–2.8). The units key (a flick up on
// Tmpl, or Shift then Tmpl) on a line, on a picked history row and on an empty line opens the read-only formula with
// its slots and the pad up; pad presses fill the active slot and the reading follows; Enter goes on and evaluates in
// the end slot, a flick up on Enter evaluates at once; ◀ ▶ move between slots; Esc leaves and the line keeps its
// slots. Then the probe's 50 units replayed on the pad, and the check of 2026-10-19 (Part 2 point 5) on the engine.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { flick, open, recordVibrations, tap, vibrations } from "./helpers.ts";

type Tok = { prefix?: string; unit: string; power?: string };
/** The view is up once its pad is on the keys and its field has the focus (it loads with its first open). */
const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const unitsKey = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await up(page);
};
const shown = (page: Page) => page.getByTestId("unit-view");
const reading = (page: Page) => page.getByTestId("unit-reading");
const activeId = (page: Page): Promise<string | undefined> => page.evaluate(() => window.n62.unitView?.view.activeId);
const tokens = (page: Page, id: string): Promise<{ tokens: Tok[]; per?: number } | undefined> =>
  page.evaluate((id) => window.n62.unitView?.view.model(id)?.slot, id);
/** A slot as the probe writes what it means: "pfx:unit^exp", sorted (exponents below the ÷ negative). */
const meant = (s: { tokens: Tok[]; per?: number } | undefined): string =>
  (s?.tokens ?? [])
    .map((t, i) => {
      const [n, d] = (t.power ?? "1").split("/"); // (a power is "2", "-1" or "1/2")
      const p = (Number(n) / Number(d ?? "1")) * (s?.per !== undefined && i >= s.per ? -1 : 1);
      return `${t.prefix ? `${t.prefix}:` : ""}${t.unit}${p === 1 ? "" : `^${p}`}`;
    })
    .sort()
    .join(" ");

/** Press a probe step: a key id, ↑id (a flick up) or ↓id (a flick down). */
async function step(page: Page, s: string): Promise<void> {
  if (s.startsWith("↑")) await flick(page, s.slice(1), "up");
  else if (s.startsWith("↓")) await flick(page, s.slice(1), "down");
  else await tap(page, [s]);
}

test.describe("the unit view from the keys", () => {
  test.beforeEach(async ({ page }) => open(page, "engine=fake"));

  test("on a line: the slots with the pad up; presses fill the active slot, the reading follows every press", async ({ page }) => {
    await tap(page, ["d7", "d2"]);
    await unitsKey(page);
    await expect(shown(page)).toBeVisible();
    expect(await page.evaluate(() => window.n62.unitView?.view.formula)).toEqual({ latex: "72\\placeholder[u1]{}", slots: ["u1"] }); // R349: no end slot until → Check
    await expect(page.locator('[data-key="d9"][data-pad="unit"]')).toBeVisible(); // the pad is up
    await expect(page.locator('[data-key="d4"][data-pad="prefix"]')).toBeVisible();
    expect(await activeId(page)).toBe("u1");
    await tap(page, ["d4"]);
    await expect(reading(page)).toHaveText("");
    await tap(page, ["d9"]);
    await expect(reading(page)).toHaveText("kilometer");
    await tap(page, ["div"]);
    await flick(page, "d3", "up");
    await expect(reading(page)).toHaveText("kilometer per hour");
    expect(meant(await tokens(page, "u1"))).toBe("h^-1 k:m");
    // the field shows the slot (setPromptValue), never as text on the entry line
    expect(await page.evaluate(() => window.n62.unitView?.field.getPromptValue("u1"))).toContain("\\mathrm{km}");
    expect(await page.evaluate(() => window.n62.entry.value)).toBe("72");
    await page.getByTestId("unit-check").tap(); // R349: → Check brings the end slot
    expect(await activeId(page)).toBe("end");
    await tap(page, ["d9", "div", "d3"]);
    await expect(reading(page)).toHaveText("meter per second");
  });

  test("◀ ▶ move between slots and stop at the ends; Esc leaves and the line keeps its slots", async ({ page }) => {
    await tap(page, ["d1", "add", "d2"]);
    await tap(page, ["shift", "tmpl"]); // the G2 way: Shift, then the key
    await up(page);
    await tap(page, ["d9"]);
    await tap(page, ["right"]);
    expect(await activeId(page)).toBe("u2");
    await tap(page, ["d3", "right"]); // R349: no end slot until → Check, nothing after the last slot
    expect(await activeId(page)).toBe("u2");
    await page.getByTestId("unit-check").tap(); // R349: → Check brings the end slot
    expect(await activeId(page)).toBe("end");
    await tap(page, ["right"]); // nothing after the end slot
    expect(await activeId(page)).toBe("end");
    await tap(page, ["left", "left"]);
    expect(await activeId(page)).toBe("u1");
    await tap(page, ["esc"]); // (the end slot is empty: the line keeps the slots without it)
    await expect(shown(page)).toBeHidden();
    await expect(page.locator('[data-key="d9"][data-pad]')).toHaveCount(0); // the keypad is the keypad again
    expect(await page.evaluate(() => window.n62.entry.value)).toBe("1+2");
    await tap(page, ["d3"]);
    expect(await page.evaluate(() => window.n62.entry.value)).toBe("1+23");
    await tap(page, ["bksp"]);
    await unitsKey(page);
    await expect(shown(page)).toBeVisible();
    expect(meant(await tokens(page, "u1"))).toBe("m");
    expect(meant(await tokens(page, "u2"))).toBe("s");
  });

  test("a refused press shows its message and leaves the slot; a prefix alone cannot be left", async ({ page }) => {
    await unitsKey(page);
    await tap(page, ["sq"]); // a power with no unit before it
    await expect(page.getByTestId("unit-message")).toHaveText("A power needs a unit before it");
    await tap(page, ["d4", "enter"]);
    await expect(page.getByTestId("unit-message")).toHaveText("A prefix needs a unit after it");
    expect(await activeId(page)).toBe("u1");
    await tap(page, ["sin"]); // k A: allowed, if odd; the reading says it
    await expect(reading(page)).toHaveText("kiloampere");
  });

  test("on an empty line: the quantity 1 and its slot; on a picked history row: that row's input", async ({ page }) => {
    await unitsKey(page);
    await expect(shown(page)).toBeVisible();
    expect(await page.evaluate(() => window.n62.unitView?.view.formula.latex)).toBe("1\\placeholder[u1]{}"); // R349: no end slot until → Check
    await tap(page, ["esc"]);
    await tap(page, ["d5", "mul", "d3", "enter"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(1);
    await tap(page, ["up"]); // picks the row
    await unitsKey(page);
    await expect(shown(page)).toBeVisible();
    expect(await page.evaluate(() => window.n62.unitView?.view.formula.slots)).toEqual(["u1", "u2"]);
  });

  // (R313: a letter goes into the slot, `kmz` below; with no letter run open a digit is still its prefix cell)
  test("a hardware key on the field takes the keypad's path: a digit is its prefix cell", async ({ page }) => {
    await tap(page, ["d7", "d2"]);
    await unitsKey(page);
    await expect(shown(page)).toBeVisible();
    await page.keyboard.press("4");
    await page.keyboard.press("9");
    await page.keyboard.press("/");
    expect(meant(await tokens(page, "u1"))).toBe("k:m");
    await expect(reading(page)).toHaveText("kilometer");
    await page.keyboard.press("Backspace"); // the ÷
    await page.keyboard.press("Enter"); // R349: the last slot, so Enter evaluates
    expect(await activeId(page)).toBe("u1");
    await expect(page.locator('[data-testid="unit-result"], [data-testid="unit-message"]')).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(shown(page)).toBeHidden();
    expect(await page.evaluate(() => window.n62.entry.value)).toBe("72");
  });

  // R303 (fh-2): the view's capture listener stopped every chord and every letter, so a hardware keyboard reached no
  // unit: Alt+F (Math, the desktop table) was dead, and Find opened over the view took no typed letter
  test("R303: Alt+F opens Find on units; typed letters fill its query and Enter puts the kilometre in the slot", async ({ page }) => {
    await tap(page, ["d7", "d2"]);
    await page.evaluate(() => window.n62.entry.focus());
    await page.keyboard.press("Alt+U"); // the units key (spec/keyboard.yaml desktop: tmpl shift)
    await up(page);
    await page.keyboard.press("Alt+F");
    const find = page.getByTestId("find");
    await expect(find).toBeVisible();
    await page.keyboard.type("km");
    await expect.poll(() => page.evaluate(() => window.n62.shell.sheet?.level.filter)).toBe("km");
    await page.keyboard.press("Enter");
    await expect(find).toBeHidden();
    expect(meant(await tokens(page, "u1"))).toBe("k:m");
    await expect(reading(page)).toHaveText("kilometer");
    expect(await page.evaluate(() => window.n62.unitView?.field.value)).toMatch(/^72.*\\mathrm\{km\}/);
    await page.keyboard.press("Escape");
    await expect(shown(page)).toBeHidden();
    expect(await page.evaluate(() => window.n62.entry.value)).toBe("72");
  });

  test("R303: with Find opened by a tap over the unit view, typed letters fill its query", async ({ page }) => {
    await unitsKey(page);
    await tap(page, ["math"]);
    await expect(page.getByTestId("find")).toBeVisible();
    await page.keyboard.type("kel");
    await expect.poll(() => page.evaluate(() => window.n62.shell.sheet?.level.filter)).toBe("kel");
    await page.keyboard.press("Backspace");
    await expect.poll(() => page.evaluate(() => window.n62.shell.sheet?.level.filter)).toBe("ke");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("find")).toBeHidden();
    await expect(shown(page)).toBeVisible();
    expect(meant(await tokens(page, "u1"))).toBe("");
  });

  // (R313: with no sheet open letters now go into the slot, the R313 tests below; R303 had them do nothing, P14)
  test("R303 control: Ctrl+C stays the browser's", async ({ page }) => {
    await tap(page, ["d7", "d2"]);
    await unitsKey(page);
    const prevented = await page.evaluate(() => {
      const el = window.n62.unitView?.element;
      if (!el) return null;
      const ev = new KeyboardEvent("keydown", { key: "c", code: "KeyC", ctrlKey: true, bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(prevented, "Ctrl+C is not taken by the view").toBe(false);
    await expect(shown(page)).toBeVisible();
  });

  test("Delete, Backspace, the arrows, Enter and Escape press the same keys on the unit view as on the entry line (one map)", async ({ page }) => {
    // every hardware key the entry line or the unit view hands to the keypad goes through entry.onKey: record them
    await page.evaluate(() => {
      const e = window.n62.entry;
      const on = e.onKey;
      const log: [string, string][] = [];
      (window as unknown as { keyLog: [string, string][] }).keyLog = log;
      e.onKey = (id, layer, repeat) => {
        log.push([id, layer]);
        on(id, layer, repeat);
      };
    });
    const pressed = async (k: string): Promise<[string, string][]> => {
      await page.evaluate(() => ((window as unknown as { keyLog: unknown[] }).keyLog.length = 0));
      await page.keyboard.press(k);
      return page.evaluate(() => (window as unknown as { keyLog: [string, string][] }).keyLog);
    };
    await tap(page, ["d7", "d2"]);
    expect(await pressed("Delete"), "Delete on the entry line").toEqual([["bksp", "shift"]]);
    await tap(page, ["d2"]);
    await unitsKey(page);
    await tap(page, ["d4", "d9"]);
    expect(await pressed("Delete"), "Delete on the unit view: Shift + ⌫ (Del), as on the entry line").toEqual([["bksp", "shift"]]);
    expect(meant(await tokens(page, "u1")), "Del is no pad cell: the slot keeps its unit").toBe("k:m");
    expect(await pressed("Backspace")).toEqual([["bksp", "primary"]]);
    expect(meant(await tokens(page, "u1")), "⌫ removes the unit and arms its prefix again").toBe("");
    await tap(page, ["bksp"]); // and the armed k (a prefix alone cannot leave its slot)
    expect(await pressed("ArrowRight")).toEqual([["right", "primary"]]);
    expect(await activeId(page)).toBe("u1"); // R349: nothing after the last slot until → Check
    await page.getByTestId("unit-check").tap(); // R349: → Check brings the end slot
    expect(await activeId(page)).toBe("end");
    expect(await pressed("ArrowLeft")).toEqual([["left", "primary"]]);
    expect(await activeId(page)).toBe("u1");
    expect(await pressed("Enter")).toEqual([["enter", "primary"]]);
    expect(await activeId(page)).toBe("end");
    expect(await pressed("Escape")).toEqual([["esc", "primary"]]);
    await expect(shown(page)).toBeHidden();
  });

  test("Math opens Find on units; a pick goes into the slot, and the pad is back", async ({ page }) => {
    await unitsKey(page);
    await tap(page, ["math"]);
    const find = page.getByTestId("find");
    await expect(find).toBeVisible();
    await find.getByRole("menuitem").nth(1).tap(); // the empty query shows the units menu (R24d): Length
    await find.getByRole("menuitem").first().tap(); // m
    await expect(find).toBeHidden();
    expect(await tokens(page, "u1")).toEqual({ tokens: [{ unit: "m" }] });
    await expect(page.locator('[data-key="d9"][data-pad="unit"]')).toBeVisible();
  });
});

// R313 (night review 2026-11-14, the owner's answer 1; decisions.md P14): on a hardware keyboard a run of letters in a
// slot reads as a unit, the way Find reads an exact symbol (units/slot.ts readSymbol), read live; `*`, `/`, `^` and the
// digit after `^` end the run, as the pad builds the unit. The touch pad keeps its cells (the tests above and the probe's
// replay below).
test.describe("R313: letters typed in a unit slot on a hardware keyboard", () => {
  test.beforeEach(async ({ page }) => open(page, "engine=fake"));
  const message = (page: Page) => page.getByTestId("unit-message");
  const prompt = (page: Page, id: string): Promise<string | undefined> => page.evaluate((id) => window.n62.unitView?.field.getPromptValue(id), id);

  test("72, the units key, km: the slot holds the kilometre, read at every letter", async ({ page }) => {
    await tap(page, ["d7", "d2"]);
    await unitsKey(page);
    await page.keyboard.press("k");
    await expect(reading(page)).toHaveText("k"); // no unit yet: the letter as typed
    await page.keyboard.press("m");
    expect(meant(await tokens(page, "u1"))).toBe("k:m");
    await expect(reading(page)).toHaveText("kilometer");
    expect(await prompt(page, "u1")).toContain("\\mathrm{km}");
    await page.getByTestId("unit-check").tap(); // R349: → Check brings the end slot
    expect(await activeId(page)).toBe("end");
    expect(await page.evaluate(() => window.n62.unitView?.field.value)).toMatch(/^72.*\\mathrm\{km\}/);
    expect(await page.evaluate(() => window.n62.entry.value)).toBe("72");
  });

  test("9.81, the units key, m/s^2: m, ÷, s, ² as the pad builds them", async ({ page }) => {
    await tap(page, ["d9", "dot", "d8", "d1"]);
    await unitsKey(page);
    await page.keyboard.type("m/s^2");
    expect(meant(await tokens(page, "u1"))).toBe("m s^-2");
    await expect(reading(page)).toHaveText("meter per second squared");
    await page.keyboard.type("*4N"); // with no run open 4 is its prefix cell (k), then N: k·N, below the ÷ as on the pad
    expect(meant(await tokens(page, "u1"))).toBe("k:N^-1 m s^-2");
  });

  test("kWh is the kilowatt hour (Find's exact symbol), not k·W·h", async ({ page }) => {
    await unitsKey(page);
    await page.keyboard.type("kWh");
    expect(await tokens(page, "u1")).toEqual({ tokens: [{ prefix: "k", unit: "Wh" }] });
    await expect(reading(page)).toHaveText("kilowatt hour");
  });

  test("kmz is no unit: it stays as typed and marked, Enter names it and no value comes; ⌫ takes a letter back; Esc drops a run that reads as no unit", async ({ page }) => {
    await tap(page, ["d7", "d2"]);
    await unitsKey(page);
    await page.keyboard.type("kmz");
    expect(meant(await tokens(page, "u1"))).toBe("");
    await expect(reading(page)).toHaveText("kmz");
    expect(await prompt(page, "u1")).toContain("kmz");
    await page.keyboard.press("Enter");
    await expect(message(page)).toHaveText("kmz is not a unit");
    expect(await activeId(page)).toBe("u1");
    await flick(page, "enter", "up"); // evaluate at once: refused the same
    await expect(message(page)).toHaveText("kmz is not a unit");
    await expect(page.getByTestId("unit-result")).toHaveCount(0);
    await page.keyboard.press("Backspace");
    expect(meant(await tokens(page, "u1"))).toBe("k:m");
    await expect(reading(page)).toHaveText("kilometer");
    await page.keyboard.press("z");
    await page.keyboard.press("Escape"); // a run that reads as no unit is dropped (the slot as before it), the view leaves
    await expect(shown(page)).toBeHidden();
    expect(await page.evaluate(() => window.n62.entry.value)).toBe("72");
    await unitsKey(page);
    expect(meant(await tokens(page, "u1")), "kmz then Esc: the letters gone, the slot as before the run").toBe("");
  });

  // audit, fix round 2: Esc dropped a run that already read as a unit, so `km` the line showed was gone on the next open
  test("km then Esc: the run reads as a unit, so it ends and the line keeps its slot (as the pad's k m then Esc)", async ({ page }) => {
    await tap(page, ["d7", "d2"]);
    await unitsKey(page);
    await page.keyboard.type("km");
    await expect(reading(page)).toHaveText("kilometer");
    await page.keyboard.press("Escape");
    await expect(shown(page)).toBeHidden();
    expect(await page.evaluate(() => window.n62.entry.value)).toBe("72");
    await unitsKey(page);
    expect(meant(await tokens(page, "u1")), "the slot keeps the kilometre").toBe("k:m");
    await expect(reading(page)).toHaveText("kilometer");
  });
});

test("⌫ on an empty slot steps back to the slot before (as ⌫ at the start of a box on the entry line); on the first slot, and Shift + ⌫ anywhere, a dead key with the double pulse (R118, bu-11)", async ({ page }) => {
  await recordVibrations(page);
  await open(page, "engine=fake");
  await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
  await tap(page, ["d1", "add", "d2"]);
  await unitsKey(page);
  await tap(page, ["d4", "d9", "enter"]);
  expect(await activeId(page)).toBe("u2");
  /** The pulses `keys` give: one per key down, two more for a dead one; a key drawn dead gives only the two (R777). */
  const pulses = async (keys: string[]): Promise<number> => {
    const before = (await vibrations(page)).length;
    await tap(page, keys);
    await page.waitForTimeout(150);
    return (await vibrations(page)).length - before;
  };
  expect(await pulses(["bksp"]), "a step back is no dead key").toBe(1);
  expect(await activeId(page)).toBe("u1");
  expect(meant(await tokens(page, "u1")), "the slot before keeps its tokens").toBe("k:m");
  expect(await pulses(["bksp"])).toBe(1);
  expect(meant(await tokens(page, "u1")), "the next ⌫ removes its last token").toBe("");
  await tap(page, ["bksp"]); // the armed k
  expect(await page.evaluate(() => window.n62.unitView?.view.model("u1")?.empty)).toBe(true);
  expect(await pulses(["bksp"]), "⌫ on the first slot, empty: dead").toBe(3);
  expect(await activeId(page)).toBe("u1");
  await tap(page, ["d9", "enter"]);
  await tap(page, ["shift"]);
  expect(await pulses(["bksp"]), "Shift + ⌫ (Del): a slot has nothing after its last token").toBe(2);
  expect(await activeId(page)).toBe("u2");
  await expect(shown(page)).toBeVisible();
});

// The probe's 50 units, as the probe itself types them (tools/probes/unit-presses.mjs --json, flicks): each sequence,
// its count and what the slot must mean, so a change to the probe's typePad or to the pad changes this replay too.
type ProbeRow = { u: string; presses: string[]; count: number; meant: string; missing: string[] };
const PROBE = JSON.parse(
  execFileSync(process.execPath, [fileURLToPath(new URL("../../tools/probes/unit-presses.mjs", import.meta.url)), "--json"], { encoding: "utf8" }),
) as ProbeRow[];

test("the probe's 50 units replayed on the pad, each within the probe's count and meaning what the probe means", async ({ page }) => {
  test.setTimeout(180_000);
  expect(PROBE.length, "the probe's 50 units").toBe(50);
  await open(page, "engine=fake");
  await unitsKey(page);
  await expect(shown(page)).toBeVisible();
  const wrong: string[] = [];
  let replayed = 0;
  for (const r of PROBE) {
    if (r.missing.length) continue; // not on the pad: the probe counts a Find trip it does not type
    let pressed = 0;
    for (const s of r.presses) {
      await step(page, s);
      pressed++; // a tap or a flick is one press (docs/04 5.2), as the probe counts
    }
    const got = meant(await tokens(page, "u1"));
    if (got !== r.meant) wrong.push(`${r.u}: ${got} (pressed ${r.presses.join(" ")})`);
    else if (pressed > r.count) wrong.push(`${r.u}: ${pressed} presses, the probe counts ${r.count}`);
    else replayed++;
    // empty the slot again (⌫ until empty; the count is the probe's, so this is not counted)
    for (let i = 0; i < 12 && !(await page.evaluate(() => window.n62.unitView?.view.model("u1")?.empty)); i++) await tap(page, ["bksp"]);
  }
  expect(wrong, "units that did not mean what the probe means within its count").toEqual([]);
  expect(replayed, "units of the probe's 50 on the pad and replayed").toBeGreaterThanOrEqual(44);
});

test.describe("on the engine (check 2026-10-19, Part 2 point 5)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  });
  const message = (page: Page) => page.getByTestId("unit-message");
  const result = (page: Page) => page.getByTestId("unit-result");
  /** ± is Shift + `,` (R71). */
  const pm = (page: Page): Promise<void> => tap(page, ["shift", "comma"]);

  test("0 m + 1 s is refused (G35), not 1 s", async ({ page }) => {
    await tap(page, ["d0", "add", "d1"]);
    await unitsKey(page);
    await tap(page, ["d9", "enter", "d3"]);
    await flick(page, "enter", "up"); // evaluate at once
    await expect(message(page)).toContainText("Units don't match");
    await expect(result(page)).toHaveCount(0);
  });

  test("20 °C → K is 293.15 K; Enter in the end slot evaluates", async ({ page }) => {
    await tap(page, ["d2", "d0"]);
    await unitsKey(page);
    await flick(page, "space", "up");
    await expect(reading(page)).toHaveText("degree Celsius");
    await page.getByTestId("unit-check").tap(); // R349: → Check brings the end slot
    await tap(page, ["space", "enter"]);
    await expect(result(page)).toHaveAttribute("data-text", "293.15");
    await expect(result(page)).toHaveAttribute("data-unit", "K");
  });

  test("−(20 ± 0.5 °C) is refused with G35's message", async ({ page }) => {
    await tap(page, ["neg", "paren", "d2", "d0"]);
    await pm(page);
    await tap(page, ["d0", "dot", "d5"]);
    await unitsKey(page);
    await flick(page, "space", "up");
    await flick(page, "enter", "up");
    await expect(message(page)).toHaveText("Put the minus on the number, not before the bracket around °C");
  });

  test("cos(0 ± 0.1) shows σ with ⚠ and its why-line (G41)", async ({ page }) => {
    await tap(page, ["cos", "d0"]);
    await pm(page);
    await tap(page, ["d0", "dot", "d1"]);
    await unitsKey(page);
    await flick(page, "enter", "up");
    await expect(result(page)).toContainText("±");
    await expect(page.getByTestId("unit-warn")).toHaveText("⚠");
    await expect(page.getByTestId("unit-why")).toHaveText("first order does not hold here");
  });

  // R796 (the owner's K2): Alpha then the mol cell is the candela, so all seven SI base units are on the pad
  test("1, the units key, Alpha, mol cell: the slot holds cd, the reading names the candela, Enter gives 1 cd", async ({ page }) => {
    await tap(page, ["d1"]);
    await unitsKey(page);
    await expect(page.locator('[data-key="emark"][data-pad="unit"]')).toContainText("cd"); // its letter-line legend
    await tap(page, ["alpha", "emark"]);
    expect(meant(await tokens(page, "u1"))).toBe("cd");
    await expect(reading(page)).toHaveText("candela");
    await tap(page, ["enter"]); // R349: the last slot, so Enter evaluates
    await expect(result(page)).toHaveAttribute("data-text", "1");
    await expect(result(page)).toHaveAttribute("data-unit", "cd");
  });

  test("kg·m²/s³ → W on an empty line is 1 W; without an end slot the typed unit is kept", async ({ page }) => {
    await unitsKey(page);
    for (const s of "d4 d6 d9 sq div d3 pow".split(" ")) await step(page, s);
    await page.getByTestId("unit-check").tap(); // R349: → Check brings the end slot
    for (const s of "paren enter".split(" ")) await step(page, s);
    await expect(result(page)).toHaveAttribute("data-text", "1");
    await expect(result(page)).toHaveAttribute("data-unit", "W");
    await tap(page, ["esc", "d7", "d2"]);
    await unitsKey(page);
    for (const s of "d4 d9 div ↑d3".split(" ")) await step(page, s);
    await flick(page, "enter", "up");
    await expect(result(page)).toHaveAttribute("data-text", "72");
    await expect(result(page)).toHaveAttribute("data-unit", "km/h");
  });
});
