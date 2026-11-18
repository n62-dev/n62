// SPDX-License-Identifier: GPL-3.0-or-later
// R725: the Chars sheet (Shift + Vars, spec/keyboard.yaml `chars:`): its 46 cells in rows, the digit that picks a cell of
// the row with the focus, the names TalkBack reads, the parser's rules for the marks it brought (‰, ≈, µ, ∠, Π). The round
// trip of every sample is roundtrip.test.ts's (templates() holds the chr: cells); the keys on the real engine are
// test/chars.spec.ts.
import { beforeEach, describe, expect, it } from "vitest";
import { enPalettes } from "../i18n/enPalettes.ts";
import { latexToGiac } from "../input/latex-to-giac.ts";
import { tidyGiacLatex } from "../render/tidy.ts";
import { lastPicks } from "../views/picks.ts";
import { Sheet } from "../views/sheet.svelte.ts";
import { paletteItems } from "../views/tmplSheet.ts";
import { keyboard, type PaletteItem } from "./keyboard.ts";
import { charsRefusal } from "./shiftPalettes.ts";

const chars = keyboard.chars;
const ROWS = ["αβγδεζηθλμ", "νξρστυφχψω", "ΓΔΘΛΞΠΣΦΨΩ", "°′″±×·∠√∞‰", "≈≠≤≥µÅ"];
// each cell's character as the sheet draws it, by id (the LaTeX the cell inserts, drawn: \alpha is α)
const CHAR: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", lambda: "λ", mu: "μ",
  nu: "ν", xi: "ξ", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  deg: "°", minute: "′", second: "″", plusminus: "±", times: "×", cdot: "·", angle: "∠", sqrt: "√", inf: "∞", permille: "‰",
  approx: "≈", ne: "≠", le: "≤", ge: "≥", micro: "µ", aring: "Å",
};

describe("the Chars sheet's cells (R725)", () => {
  it("is 10 columns, 46 cells in the owner's five rows (no Latin look-alike capitals)", () => {
    expect(chars.columns).toBe(10);
    expect(chars.items).toHaveLength(46);
    const rows = [0, 1, 2, 3, 4].map((r) => chars.items.filter((c) => c.row === r).sort((a, b) => a.col - b.col));
    expect(rows.map((r) => r.map((c) => CHAR[c.id]).join(""))).toEqual(ROWS);
    expect(rows.map((r) => r.map((c) => c.col))).toEqual(rows.map((r) => r.map((_, i) => i))); // no gap in a row
    expect(chars.items.map((c) => `${c.row},${c.col}`)).toEqual([...new Set(chars.items.map((c) => `${c.row},${c.col}`))]);
  });

  it("has a name for TalkBack on every cell (chars.<id>), and a title", () => {
    for (const c of chars.items) expect(enPalettes, c.id).toHaveProperty(`chars.${c.id}`);
    expect(enPalettes["chars.title"]).toBe("Characters");
    expect(enPalettes["chars.permille"]).toMatch(/per mille/);
  });

  it("× ± ∠ √ insert what their keys insert; ° ′ ″ ∞ ≠ ≤ ≥ what Shift + 9 and Shift + 6 insert", () => {
    const cell = (id: string): PaletteItem => chars.items.find((c) => c.id === id) as PaletteItem;
    const keyed: [string, string, "primary" | "shift"][] = [["plusminus", "comma", "shift"], ["times", "mul", "primary"], ["angle", "mul", "shift"], ["sqrt", "sq", "shift"]];
    for (const [id, key, layer] of keyed) expect(cell(id).action, id).toEqual(keyboard.byId.get(key)?.actions[layer]);
    const same: [string, typeof keyboard.symbols][] = [["deg", keyboard.symbols], ["minute", keyboard.symbols], ["second", keyboard.symbols], ["inf", keyboard.symbols], ["ne", keyboard.relations], ["le", keyboard.relations], ["ge", keyboard.relations]];
    for (const [id, pal] of same) expect(cell(id).action.latex, id).toBe(pal.items.find((c) => c.id === id)?.action.latex);
  });

  it("the Greek cells insert what Shift + 9's insert, spelt as Giac needs (β γ ε φ Γ Φ Ψ Π take a `_`)", () => {
    for (const c of chars.items.filter((c) => c.row < 3)) {
      const old = keyboard.symbols.items.find((s) => s.id === c.id);
      if (old) expect(c.action.latex, c.id).toBe(old.action.latex);
      expect(latexToGiac(`2${c.action.latex}`), c.id).toBe(`2*${c.action.sample?.[1]?.slice(2)}`);
    }
    expect(latexToGiac("2\\Pi")).toBe("2*Pi_"); // Giac's Pi is π
    expect(latexToGiac("\\pi")).toBe("pi"); // π stays on Shift + 3
    // a result drawn back as the letters (Giac draws Pi_ and upsilon as upright words)
    expect(tidyGiacLatex("2\\mathrm{Pi\\_}")).toBe("2\\Pi");
    expect(tidyGiacLatex("\\mathrm{upsilon}x")).toBe("\\upsilon x");
  });

  it("the refused cells are ≈, µ and Å, each with a message, and the notice gives that message", () => {
    expect(chars.items.filter((c) => c.refused).map((c) => c.id)).toEqual(["approx", "micro", "aring"]);
    for (const id of ["approx", "micro", "aring"]) {
      const c = chars.items.find((x) => x.id === id) as PaletteItem;
      expect(() => latexToGiac(`2${c.action.latex}`), id).toThrow(/has no meaning|is a unit/);
      expect(charsRefusal(id), id).toMatch(/has no meaning|is a unit/);
    }
    expect(charsRefusal("micro")).toMatch(/μ/); // points to the Greek letter
    expect(charsRefusal("alpha")).toBeUndefined();
  });
});

describe("the parser's rules for the marks (R725)", () => {
  it("‰ is per mille, read as % is: 5‰ is 5/1000, 2·50‰ is 2·(50/1000)", () => {
    expect(latexToGiac("5‰")).toBe("5/1000");
    expect(latexToGiac("2\\cdot50‰")).toBe("2*(50/1000)");
    expect(latexToGiac("5\\permille")).toBe("5/1000"); // MathLive's own command for the mark
    expect(latexToGiac("5\\%")).toBe("5/100"); // the control: % is unchanged
  });
  it("‰ with no number before it, and ± n ‰, are refused", () => {
    expect(() => latexToGiac("‰")).toThrow(/needs a number or name/);
    expect(() => latexToGiac("4.7\\pm5‰\\placeholder[u1]{}", { units: true })).toThrow(/± n ‰/);
  });
  it("∠ is ∡: the same polar form", () => {
    expect(latexToGiac("2∠\\frac{\\pi}{6}")).toBe(latexToGiac("2\\mathbin{\\measuredangle}\\frac{\\pi}{6}"));
  });
  it("≈ and µ are refused where they stand, with their messages", () => {
    expect(() => latexToGiac("2\\approx3")).toThrow(/≈ has no meaning/);
    expect(() => latexToGiac("2≈3")).toThrow(/≈ has no meaning/);
    expect(() => latexToGiac("2µ")).toThrow(/µ.*has no meaning.*μ/);
    expect(latexToGiac("2\\mu")).toBe("2*mu"); // the Greek letter is a name
  });
});

describe("the sheet's digits (R725)", () => {
  beforeEach(() => lastPicks.clear()); // (a sheet opens on its last pick)
  const make = (log: string[] = []): Sheet => {
    const cells = paletteItems(chars.items, (p) => void log.push(p.id), (id) => id);
    return new Sheet("chars", "Characters", () => cells, { columns: chars.columns, digits: true, view: true });
  };
  it("rises over the view like a list that takes letters, so the digit keys stay uncovered", () => {
    expect(make().letters).toBe(true);
  });
  it("a digit picks that cell in the row with the focus: 3 is γ in row 1, then ▼ and 2 is ξ", () => {
    const first = make();
    expect(first.pickNumber(3)).toMatchObject({ kind: "run", item: { id: "gamma" } });
    lastPicks.clear();
    const s = make();
    s.level.move(1);
    expect(s.level.current?.id).toBe("nu");
    expect(s.pickNumber(2)).toMatchObject({ kind: "run", item: { id: "xi" } });
  });
  it("0 is the tenth cell of the row; row 5 has six, so 7 there picks nothing", () => {
    const s = make();
    expect(s.pickNumber(10)).toMatchObject({ kind: "run", item: { id: "mu" } });
    lastPicks.clear();
    const last = make();
    for (let i = 0; i < 4; i++) last.level.move(1);
    expect(last.level.current?.id).toBe("approx");
    expect(last.pickNumber(6)).toMatchObject({ kind: "run", item: { id: "aring" } });
    expect(last.pickNumber(7)).toEqual({ kind: "stay" });
    expect(last.pickKey("d3")).toBeUndefined(); // no cell is picked by the key at its place
  });
  it("each cell shows its digit in the corner: the nth of its row, 0 the tenth", () => {
    const s = make();
    expect(s.level.items.map((_, i) => ((i % 10) + 1) % 10).slice(0, 12)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2]);
  });
});
