// SPDX-License-Identifier: GPL-3.0-or-later
// G215: Copy as Python runs and agrees with N62 (scripts/pydiff.ts). N62's answers are the engine's at the run, Python's
// sympy's in tests/golden/.venv; no expected value is written here but the stage's own verdict. Without the venv's
// pinned packages these tests fail, as the stage does: they never skip on it.
import { describe, expect, it } from "vitest";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { giacAvailable, nodeHost } from "../src/engine/nodeGiac.ts";
import { pasdegCommand } from "../src/engine/homeEval.ts";
import type { PyRow } from "../src/clipboard/python.ts";
import { INSTALL_LINE, MIN_COMPARED, corrupt, judgeGroup, n62Rows, probed, readGroups, venvPython, venvVersions, type Group, type GroupResult } from "./pydiff.ts";

const dir = join(resolve(fileURLToPath(import.meta.url), "../.."), "_out/pydiff-test");
const groups = readGroups();
const group = (id: string): Group => {
  const g = groups.find((x) => x.id === id);
  if (!g) throw new Error(`no group ${id} in pydiff-rows.yaml`);
  return g;
};
const py = venvPython();
async function judge(g: Group): Promise<GroupResult> {
  const host = await nodeHost();
  host.giac.eval(pasdegCommand("rad"));
  return judgeGroup(g, n62Rows(host, g.rows), py ?? "python-missing", dir);
}

describe("pydiff: the venv (G215)", () => {
  it("holds sympy, pint and uncertainties at the pinned versions", () => {
    const v = venvVersions(py);
    expect(v.ok ? "" : v.why).toBe("");
  });
  it("without a venv the stage says how to install it, never skips", () => {
    const v = venvVersions(null);
    expect(v.ok).toBe(false);
    expect(v.ok ? "" : v.why).toContain(INSTALL_LINE);
  });
});

describe("pydiff: the probes (no engine)", () => {
  const row = (input: string, o: Partial<PyRow> = {}): PyRow => ({ view: "home", input, ok: true, mark: "=", ...o });
  it("a probe follows each translated line and names its line in the file; a comment row has none", () => {
    const p = probed([row("2^3", { exact: "8" }), row("\\operatorname{median}\\left(1,2\\right)", { exact: "3/2" }), row("\\frac{1}{3}", { exact: "1/3" })]);
    const fileLines = p.file.split("\n");
    expect(p.probes.map((x) => [x.row, x.name, fileLines[x.fileLine - 1]])).toEqual([
      [0, "_1", "_1 = 2**3  # N62: = 8"],
      [2, "_3", "_3 = Rational(1, 3)  # N62: = 1/3"],
    ]);
    expect(p.comments).toEqual([1]);
    // the probed script is the file with the prelude and the probe lines added, nothing else
    const own = p.script.split("\n").filter((_, i) => (p.scriptLine[i] ?? 0) > 0);
    expect(`${own.join("\n")}\n`).toBe(p.file);
  });
});

describe.skipIf(!giacAvailable())("pydiff: the row set against N62's engine (G215)", () => {
  it("every row of every group: the file runs, each translated row agrees at 12 digits", { timeout: 120_000 }, async () => {
    let compared = 0;
    const problems: string[] = [];
    for (const g of groups) {
      const r = await judge(g);
      problems.push(...r.problems.map((p) => `${g.id}: ${p}`));
      compared += r.compared;
    }
    expect(problems).toEqual([]);
    expect(compared).toBeGreaterThanOrEqual(MIN_COMPARED);
  });

  it("a corrupted function-table entry fails and names the line", { timeout: 60_000 }, async () => {
    const restore = corrupt("sin=cos");
    let r: GroupResult;
    try {
      r = await judge(group("degrees"));
    } finally {
      restore();
    }
    // \sin(30) in DEG is the first row: line 3 of the file, after the N62 line and the imports
    expect(r.file.split("\n")[2]).toBe("_1 = cos(rad(30))  # N62: = 1/2");
    expect(r.problems.some((p) => p.startsWith("line 3: _1 = cos(rad(30))  # N62: = 1/2: Python "))).toBe(true);
    // the rows that write no sin still agree
    expect(r.problems.some((p) => /^line \d+: _\d+ = (tan|deg)\(/.test(p))).toBe(false);
    // restored: the same group passes again
    expect((await judge(group("degrees"))).problems).toEqual([]);
  });

  it("a corrupted row (N62's answer of another input) fails and names the line", { timeout: 60_000 }, async () => {
    const g = group("functions");
    const host = await nodeHost();
    host.giac.eval(pasdegCommand("rad"));
    const rows = n62Rows(host, g.rows);
    // factorial(5)'s line carries the value of 3! (a wrong answer in the row, not in the table)
    const k = g.rows.findIndex((x) => x.input === "\\operatorname{factorial}\\left(5\\right)");
    const other = rows[g.rows.findIndex((x) => x.input === "3!")]!;
    rows[k] = { ...rows[k]!, ...(other.value ? { value: other.value } : {}) };
    const r = judgeGroup(g, rows, py ?? "python-missing", dir);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatch(/^line \d+: _\d+ = factorial\(5\)  # N62: = 120: Python 120, N62 6 \(12 digits\)$/);
  });

  it("a NOT TRANSLATED line binds nothing, so the script still runs and the rows after it agree", { timeout: 60_000 }, async () => {
    const r = await judge(group("not translated"));
    expect(r.problems).toEqual([]);
    expect(r.comments).toBe(3);
    expect(r.compared).toBe(1);
    const lines = r.file.split("\n");
    expect(lines.filter((l) => l.startsWith("# N62 NOT TRANSLATED")).length).toBe(3);
    expect(lines.some((l) => /^b = /.test(l))).toBe(false);
    expect(lines.some((l) => l.startsWith("_4 = 7*6  # N62: "))).toBe(true);
  });
});
