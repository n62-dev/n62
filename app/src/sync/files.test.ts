// SPDX-License-Identifier: GPL-3.0-or-later
// G218: what the sync folder receives. The clock is given (local dates), the rows are fixed; the `.py` text expected is
// G213's own translation of each row (python.test.ts pins those templates), here its place in the appended file.
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decimalFromString, ZERO_VALUE, type ComplexValue } from "../engine/format.ts";
import { validName } from "../clipboard/folder.ts";
import { sessionLine } from "../state/sessionLine.ts";
import type { HistoryItem } from "../state/session.svelte.ts";
import type { ChipTable } from "../input/chips.ts";
import { deviceSlug, filesFor, processId, syncFilesState, type SyncFile, type SyncFilesState } from "./files.ts";
import { SyncQueue } from "./queue.ts";
import { fakeFolder, fakePort, memKv } from "./fakeFolder.ts";
import type { UnitRow } from "../units/types.ts";
import { runPython } from "../../scripts/pydiff.ts";
import { venvPython } from "../../scripts/pyunits-check.ts";

const APP = "0.1.0";
const HEAD = "# N62 0.1.0 · Copy as Python · preview: the form of this file can change";
const re = (s: string): ComplexValue => ({ re: decimalFromString(s) ?? ZERO_VALUE, im: ZERO_VALUE });
/** A done exact Home row: its input, Giac's exact text and its decimal. */
const done = (latex: string, exact: string, dec: string, o: Partial<HistoryItem> = {}): HistoryItem => ({
  id: 1,
  view: "home",
  latex,
  status: "done",
  resultLatex: "",
  text: dec,
  approximate: false,
  startedAt: 0,
  value: re(dec),
  facts: { exact: true, reliableDigits: null, digits: 12 },
  full: exact,
  fullExact: true,
  angle: "rad",
  digits: 12,
  reads: [],
  ...o,
});
const res = (k: number, value: string): ChipTable => ({ [`res:${k}`]: { value, exact: true, reliableDigits: null } });
const START1 = new Date(2026, 10, 8, 9, 0, 0);
const START2 = new Date(2026, 10, 8, 14, 0, 0);
const P1 = processId(START1);
const P2 = processId(START2);
const at = (h: number, m: number, day = 8): Date => new Date(2026, 10, day, h, m, 0);

/** Hands the rows over in order, one minute apart from `t0`; every file's appended text, by file name. */
function run(items: HistoryItem[], state: SyncFilesState, t0: Date, device = "tab-1a2b", into = new Map<string, string>()): { out: Map<string, string>; state: SyncFilesState; each: SyncFile[][] } {
  const each: SyncFile[][] = [];
  items.forEach((item, n) => {
    const r = filesFor(item, state, device, new Date(t0.getTime() + n * 60_000));
    state = r.state;
    each.push(r.files);
    for (const f of r.files) into.set(f.file, (into.get(f.file) ?? "") + f.text);
  });
  return { out: into, state, each };
}

describe("filesFor: the names (G218)", () => {
  it("n62-<device>-<local date>.jsonl and .py beside it", () => {
    const { files } = filesFor(done("2", "2", "2"), syncFilesState(APP, START1), "tab-1a2b", at(14, 30));
    expect(files.map((f) => f.file)).toEqual(["n62-tab-1a2b-2026-11-08.jsonl", "n62-tab-1a2b-2026-11-08.py"]);
  });

  it("a row one minute past local midnight goes to the next day's files", () => {
    const s = syncFilesState(APP, START1);
    expect(filesFor(done("2", "2", "2"), s, "tab-1a2b", at(23, 59)).files[0]?.file).toBe("n62-tab-1a2b-2026-11-08.jsonl");
    expect(filesFor(done("2", "2", "2"), s, "tab-1a2b", at(0, 1, 9)).files.map((f) => f.file)).toEqual([
      "n62-tab-1a2b-2026-11-09.jsonl",
      "n62-tab-1a2b-2026-11-09.py",
    ]);
  });

  it("a device name with / (or a space, a colon) is sanitised so validName passes", () => {
    const { files } = filesFor(done("2", "2", "2"), syncFilesState(APP, START1), "SM-X200/EU: 1a2b", at(10, 0));
    expect(files.map((f) => f.file)).toEqual(["n62-SM-X200-EU-1a2b-2026-11-08.jsonl", "n62-SM-X200-EU-1a2b-2026-11-08.py"]);
    for (const f of files) expect(validName(f.file)).toBe(true);
    expect(deviceSlug("../")).toBe("device");
    expect(new TextEncoder().encode(deviceSlug("é".repeat(100))).length).toBeLessThanOrEqual(64);
  });
});

describe("filesFor: the .jsonl text", () => {
  it("is sessionLine plus \\n, one per row, at the time given", () => {
    const rows = [done("\\frac{1}{3}", "1/3", "0.333333333333", { uid: "r-1" }), done("2^3", "8", "8", { uid: "r-2" })];
    const { out } = run(rows, syncFilesState(APP, START1), at(10, 0));
    const lines = rows.map((r, n) => sessionLine(r, { t: at(10, n), app: APP }));
    expect(out.get("n62-tab-1a2b-2026-11-08.jsonl")).toBe(`${lines[0]}\n${lines[1]}\n`);
  });

  it("a row that is no result adds nothing and leaves the state", () => {
    const s = syncFilesState(APP, START1);
    const r = filesFor({ ...done("x", "x", "0"), status: "note" }, s, "tab-1a2b", at(10, 0));
    expect(r.files).toEqual([]);
    expect(r.state).toBe(s);
  });
});

describe("filesFor: the .py text", () => {
  it("G213's first line once, imports when first used, each row a # %% cell", () => {
    const { each } = run(
      [
        done("\\frac{1}{3}", "1/3", "0.333333333333"),
        done("\\res{1}{\\frac{1}{3}}\\times3", "1", "1", { chips: res(1, "1/3") }),
        done("\\sqrt{2}", "sqrt(2)", "1.41421356237", { facts: { exact: false, reliableDigits: null, digits: 12 } }),
        done("\\frac{1}{2}", "1/2", "0.5"),
      ],
      syncFilesState(APP, START1),
      at(10, 0),
    );
    expect(each.map((f) => f[1]?.text)).toEqual([
      `${HEAD}\n# %%\nfrom sympy import Rational\n_1_${P1} = Rational(1, 3)  # N62: = 1/3\n`,
      `# %%\n_2_${P1} = _1_${P1}*3  # N62: = 1\n`,
      `# %%\nfrom sympy import sqrt\n_3_${P1} = sqrt(2)  # N62: ≈ 1.41421356237\n`,
      `# %%\n_4_${P1} = Rational(1, 2)  # N62: = 1/2\n`,
    ]);
  });

  it("a stored name read is bound once, to the value read, right before the row; again when it held another value", () => {
    const { each } = run(
      [
        done("a+1", "6", "6", { reads: [{ name: "a", value: "5", exact: true }] }),
        done("a\\times2", "10", "10", { reads: [{ name: "a", value: "5", exact: true }] }),
        done("a+1", "10", "10", { reads: [{ name: "a", value: "9", exact: true }] }),
      ],
      syncFilesState(APP, START1),
      at(10, 0),
    );
    expect(each.map((f) => f[1]?.text)).toEqual([
      `${HEAD}\n# %%\na = 5  # N62: stored, = 5\n_1_${P1} = a + 1  # N62: = 6\n`,
      `# %%\n_2_${P1} = a*2  # N62: = 10\n`,
      `# %%\na = 9  # N62: stored, = 9\n_3_${P1} = a + 1  # N62: = 10\n`,
    ]);
  });

  it("a second process's first row emits G213's line, its imports and its stored values again", () => {
    const one = run([done("a+\\frac{1}{3}", "16/3", "5.33333333333", { reads: [{ name: "a", value: "5", exact: true }] })], syncFilesState(APP, START1), at(10, 0));
    const two = run([done("a+\\frac{1}{3}", "16/3", "5.33333333333", { reads: [{ name: "a", value: "5", exact: true }] })], syncFilesState(APP, START2), at(15, 0), "tab-1a2b", one.out);
    expect(two.out.get("n62-tab-1a2b-2026-11-08.py")).toBe(
      [HEAD, "# %%", "from sympy import Rational", "a = 5  # N62: stored, = 5", `_1_${P1} = a + Rational(1, 3)  # N62: = 16/3`]
        .concat([HEAD, "# %%", "from sympy import Rational", "a = 5  # N62: stored, = 5", `_1_${P2} = a + Rational(1, 3)  # N62: = 16/3`])
        .join("\n") + "\n",
    );
  });

  it("a row not translated keeps its comment cell", () => {
    const err: HistoryItem = { ...done("\\frac{1}{0}", "", "0"), status: "error", text: "Division by 0" };
    const { each } = run([err], syncFilesState(APP, START1), at(10, 0));
    expect(each[0]?.[1]?.text).toBe(`${HEAD}\n# %%\n# N62 NOT TRANSLATED (N62 gave no result): \\frac{1}{0}\n# N62: Division by 0\n`);
  });
});

/** The file read top to bottom as Python would bind names: each code line `name = expr` reads the names in expr (string
 *  literals and attributes left out) and binds `name`; `from sympy import …` (fractions, pint too) binds its names. */
function bindings(py: string): { twice: string[]; unbound: string[] } {
  const bound = new Set<string>();
  const twice: string[] = [];
  const unbound: string[] = [];
  for (const line of py.split("\n")) {
    const imp = /^from (?:sympy|fractions|pint) import (.+)$/.exec(line);
    if (imp) {
      for (const n of (imp[1] as string).split(", ")) bound.add(n);
      continue;
    }
    const m = /^([A-Za-z_]\w*) = (.*?)(?: {2}#.*)?$/.exec(line);
    if (!m) continue;
    const expr = (m[2] as string).replace(/'[^']*'/g, "''").replace(/\.[A-Za-z_]\w*/g, "");
    for (const n of expr.match(/[A-Za-z_]\w*/g) ?? []) if (!bound.has(n)) unbound.push(n);
    const name = m[1] as string;
    if (name.startsWith("_") && bound.has(name)) twice.push(name);
    bound.add(name);
  }
  return { twice, unbound };
}

describe("filesFor: a Python name is bound once per file", () => {
  it("two processes, each with a row 3 and a later row that uses it: the file runs and each use reads its own", () => {
    const proc = (third: string, dec: string, times: string, prod: string): HistoryItem[] => [
      done("1", "1", "1"),
      done("2", "2", "2"),
      done(third, `1/${times}`, dec),
      done("4", "4", "4"),
      done(`\\res{3}{${third}}\\times${times}`, prod, prod, { chips: res(3, `1/${times}`) }),
    ];
    const one = run(proc("\\frac{1}{3}", "0.333333333333", "3", "1"), syncFilesState(APP, START1), at(10, 0));
    const two = run(proc("\\frac{1}{7}", "0.142857142857", "7", "1"), syncFilesState(APP, START2), at(15, 0), "tab-1a2b", one.out);
    const py = two.out.get("n62-tab-1a2b-2026-11-08.py") as string;
    expect(bindings(py)).toEqual({ twice: [], unbound: [] });
    expect(py).toContain(`\n_3_${P1} = Rational(1, 3)  # N62: = 1/3\n`);
    expect(py).toContain(`\n_5_${P1} = _3_${P1}*3  # N62: = 1\n`);
    expect(py).toContain(`\n_3_${P2} = Rational(1, 7)  # N62: = 1/7\n`);
    expect(py).toContain(`\n_5_${P2} = _3_${P2}*7  # N62: = 1\n`);
    expect(P1).not.toBe(P2);
  });

  it("the check above sees a name bound twice and a name read before it is bound", () => {
    expect(bindings("_3 = 1\n_3 = 2\n_4 = a*_9\n")).toEqual({ twice: ["_3"], unbound: ["a", "_9"] });
    expect(bindings("_1 = (5*ureg.kg).to('lb')\nfrom pint import UnitRegistry\nureg = UnitRegistry()\n")).toEqual({ twice: [], unbound: ["ureg"] });
  });
});

/** G216f1: a done unit-view row: its line, filled slots by prompt id, its unit and dimension; the exact answer and its
 *  decimal are the row's own (5 kg is 500000000/45359237 lb by lb = 0.45359237 kg; 20 °C is 68 °F: derived). */
const unitDone = (latex: string, slots: UnitRow["slots"], unit: string, dim: string, exact: string, dec: string): HistoryItem =>
  done(latex, exact, dec, { units: { slots, unit, dim, dimText: null, latex: "", text: ` ${unit}`, input: latex } });
const KG_LB = unitDone("5", { u1: { tokens: [{ unit: "kg" }] }, end: { tokens: [{ unit: "lb" }] } }, "lb", "kg1", "500000000/45359237", "11.0231131092");
const C_F = unitDone("20", { u1: { tokens: [{ unit: "oC" }] }, end: { tokens: [{ unit: "oF" }] } }, "°F", "K1", "68", "68");

describe("filesFor: unit rows in the .py (G216f1)", () => {
  const PY = venvPython();
  /** Each process's part of the file (it starts at G213's first line). */
  const parts = (py: string): string[] => py.split(`${HEAD}\n`).filter((p) => p !== "");
  const count = (part: string, line: string): number => part.split("\n").filter((l) => l === line).length;

  it("a Home row, 5 kg → lb, 20 °C → °F: Copy's imports, the registry and Q_ once; a second process binds its own; it runs", () => {
    const one = run([done("\\frac{1}{3}", "1/3", "0.333333333333"), KG_LB, C_F], syncFilesState(APP, START1), at(10, 0));
    expect(one.each.map((f) => f[1]?.text)).toEqual([
      `${HEAD}\n# %%\nfrom sympy import Rational\n_1_${P1} = Rational(1, 3)  # N62: = 1/3\n`,
      `# %%\nfrom pint import UnitRegistry\nureg = UnitRegistry()\n_2_${P1} = (5*ureg.kg).to('lb')  # N62: = 500000000/45359237 lb\n`,
      `# %%\nQ_ = ureg.Quantity\n_3_${P1} = Q_(20, 'degC').to('degF')  # N62: = 68 °F\n`,
    ]);
    const two = run([C_F, KG_LB], syncFilesState(APP, START2), at(15, 0), "tab-1a2b", one.out);
    const py = two.out.get("n62-tab-1a2b-2026-11-08.py") as string;
    for (const l of py.split("\n").filter((x) => x.startsWith("from sympy import "))) expect(l).not.toMatch(/\b(?:Fraction|ureg|Q_|UnitRegistry)\b/);
    const [p1, p2] = parts(py) as [string, string];
    expect(parts(py)).toHaveLength(2);
    for (const p of [p1, p2]) {
      expect(count(p, "ureg = UnitRegistry()")).toBe(1);
      expect(count(p, "Q_ = ureg.Quantity")).toBe(1);
    }
    // the second process's registry before its first unit cell
    expect(p2.indexOf("ureg = UnitRegistry()")).toBeLessThan(p2.indexOf(`_1_${P2} = `));
    expect(p2.indexOf("Q_ = ureg.Quantity")).toBeLessThan(p2.indexOf(`_1_${P2} = `));
    expect(bindings(py)).toEqual({ twice: [], unbound: [] });
    // the file as the sync folder holds it runs, as the pydiff stage runs a file (no venv: fails, never skips)
    expect(PY, "no tests/golden/.venv with sympy and pint (tests/golden/README.md)").toBeTruthy();
    const r = runPython(PY as string, join(import.meta.dirname, "../../_out/files-test/units.py"), py);
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
  }, 60_000);

  it("a Fraction and a unit in one cell: Python's import, then sympy's, then pint's", () => {
    const row = unitDone("2.5", { u1: { tokens: [{ unit: "kg" }] } }, "kg", "kg1", "5/2", "2.5");
    const { each } = run([done("\\sqrt{2}", "sqrt(2)", "1.41421356237", { facts: { exact: false, reliableDigits: null, digits: 12 } }), row], syncFilesState(APP, START1), at(10, 0));
    expect(each[1]?.[1]?.text).toBe(`# %%\nfrom fractions import Fraction\nfrom pint import UnitRegistry\nureg = UnitRegistry()\n_2_${P1} = Fraction('2.5')*ureg.kg  # N62: = 5/2 kg\n`);
  });
});

describe("through the sync queue (G219f1): a crash between the append and the dequeue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("the .py binds no name twice and each cell runs once: a = a + 1 stays one step, _5 stays 12", async () => {
    // batch one binds a = 5; batch two rebinds a from its own value (= 6) and reads it (_5 = a*2, = 12)
    const rows = [
      done("2", "2", "2", { uid: "r-1" }),
      done("3", "3", "3", { uid: "r-2" }),
      done("5\\blacktriangleright a", "5", "5", { uid: "r-3" }),
      done("a+1\\blacktriangleright a", "6", "6", { uid: "r-4", reads: [{ name: "a", value: "5", exact: true }] }),
      done("a\\times2", "12", "12", { uid: "r-5", reads: [{ name: "a", value: "6", exact: true }] }),
    ];
    const { each } = run(rows, syncFilesState(APP, START1), at(10, 0));
    const kv = memKv();
    const dir = fakeFolder();
    const q = new SyncQueue(fakePort(dir, kv));
    await q.start();
    for (const files of each.slice(0, 3)) await q.add(files);
    await q.flush();
    for (const files of each.slice(3)) await q.add(files);
    dir.afterAppend = () => (kv.frozen = true); // batch two lands, the dequeue's write never does
    await q.flush();
    kv.frozen = false;
    dir.afterAppend = () => {};
    const again = new SyncQueue(fakePort(dir, kv));
    await again.start();
    await again.idle();
    const py = dir.files.get("n62-tab-1a2b-2026-11-08.py") as string;
    expect(bindings(py)).toEqual({ twice: [], unbound: [] });
    expect(py).toBe(each.map((f) => f[1]?.text).join(""));
    expect(py.split("\n").filter((l) => l.startsWith("a = a + 1"))).toEqual(["a = a + 1  # N62: = 6"]);
    expect(py).toContain(`\n_5_${P1} = a*2  # N62: = 12\n`);
    const ids = (dir.files.get("n62-tab-1a2b-2026-11-08.jsonl") as string).split("\n").filter((l) => l !== "").map((l) => (JSON.parse(l) as { id: string }).id);
    expect(ids).toEqual(["r-1", "r-2", "r-3", "r-4", "r-5"]);
  });
});
