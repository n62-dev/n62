// SPDX-License-Identifier: GPL-3.0-or-later
// G200 (F197): `oracle.py` runs clean on the tree, names a wrong value or a broken oracle expression and goes on, and the gate stage's helpers.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { oracleVenvPython, setupLine } from "./g2check.ts";
import { problemLines, touchesOracle } from "./oraclecheck.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim();
const py = oracleVenvPython(repo, common ? resolve(common, "..") : repo);
const oracle = join(repo, "tests/golden/oracle.py");
// the whole tree is about 10 s alone; under the full suite's parallel load several times that
const TREE_MS = 180_000;
const SPAWN_MS = 30_000;

function run(args: string[]): { code: number; out: string } {
  const r = spawnSync(py as string, [oracle, ...args], { encoding: "utf8" });
  return { code: r.status ?? 1, out: `${r.stdout}${r.stderr}` };
}

/** home.yaml (a mark file) in a temp dir holding these case lines; oracle.py is given its absolute path. */
function rows(...lines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "oraclecheck-"));
  const file = join(dir, "home.yaml");
  writeFileSync(file, `cases:\n${lines.map((l) => `  - ${l}`).join("\n")}\n`);
  return file;
}

describe("oracle.py (G200, F197)", () => {
  it("has the oracle venv", () => {
    if (py === null) throw new Error(`no oracle venv for the G200 tests; set it up: ${setupLine}`);
  });
  it("exits 0 on the tree", () => {
    const r = run([]);
    expect(r.out).toMatch(/checked \d+ file\(s\); problems: 0/);
    expect(r.code).toBe(0);
  }, TREE_MS);
  it("a wrong expect gives its PROBLEM line and exit 1", () => {
    const r = run([rows('{ id: "t-wrong", input: "1/3", oracle: "F(1,3)", expect: "0.4", mark: "≈", source: "oracle" }')]);
    expect(r.out).toMatch(/^PROBLEM home\.yaml t-wrong: expect '0\.4' but oracle '0\.333333333333'/m);
    expect(r.code).toBe(1);
  }, SPAWN_MS);
  it("a broken oracle expression is one PROBLEM for its row and the run goes on", () => {
    const r = run([
      rows(
        '{ id: "t-ok1", input: "1/4", oracle: "F(1,4)", expect: "0.25", mark: "=", source: "oracle" }',
        '{ id: "t-broken", input: "x", oracle: "atanh(mpc(F(1,5),F(1,10)))", expect: "0.2+0.1*i", mark: "≈", source: "derived" }',
        '{ id: "t-syntax", input: "x", oracle: "F(1,", expect: "1", mark: "=", source: "derived" }',
        '{ id: "t-after", input: "1/3", oracle: "F(1,3)", expect: "0.4", mark: "≈", source: "oracle" }',
      ),
    ]);
    expect(r.out.match(/^PROBLEM home\.yaml t-broken: /gm)).toHaveLength(1);
    expect(r.out.match(/^PROBLEM home\.yaml t-syntax: /gm)).toHaveLength(1);
    expect(r.out).not.toMatch(/t-ok1/);
    expect(r.out).toMatch(/^PROBLEM home\.yaml t-after: expect '0\.4'/m);
    expect(r.out).not.toMatch(/Traceback/);
    expect(r.code).toBe(1);
  }, SPAWN_MS);
  it("an = or ≈ with no oracle value needs a note; a ⚠ and digits passes like ⚠", () => {
    const bare = run([rows('{ id: "t-nonote", input: "f(1)", expect: "0.25", mark: "=", source: "derived" }')]);
    expect(bare.out).toMatch(/^PROBLEM home\.yaml t-nonote: /m);
    expect(bare.code).toBe(1);
    const bareApprox = run([rows('{ id: "t-nonote2", input: "f(1)", expect: "0.25", mark: "≈", source: "derived" }')]);
    expect(bareApprox.out).toMatch(/^PROBLEM home\.yaml t-nonote2: /m);
    const ok = run([
      rows(
        '{ id: "t-note", input: "f(1)", expect: "0.25", mark: "=", source: "derived", note: "a device value, the oracle has no expression for it" }',
        '{ id: "t-warn11", input: "f(2)", expect: "0.25", mark: "⚠11", source: "derived", note: "11 digits confirmed" }',
        '{ id: "t-warn11-nonote", input: "f(2)", expect: "0.25", mark: "⚠11", source: "derived" }',
      ),
    ]);
    expect(ok.out).not.toMatch(/t-note|t-warn11:/);
    expect(ok.out).toMatch(/^PROBLEM home\.yaml t-warn11-nonote: mark ⚠ needs a note/m);
  }, SPAWN_MS);
  it("leaves corpus.yaml out of a whole-tree run", () => {
    const r = run(["--g2", "--check"]);
    expect(r.code).toBe(0);
  }, SPAWN_MS);
});

/** A temp copy of tests/golden (no venv) holding only g2.yaml, corpus.yaml and a home.yaml of these lines: its own oracle.py, its own oracle-counts.json. */
function goldenCopy(...lines: string[]): { dir: string; script: string; counts: string } {
  // no lines: the whole tree's case files stay
  const dir = mkdtempSync(join(tmpdir(), "oraclecounts-"));
  cpSync(join(repo, "tests/golden"), dir, { recursive: true, filter: (src) => !src.includes(".venv") });
  rmSync(join(dir, "oracle-counts.json"), { force: true });
  if (lines.length > 0) {
    for (const f of readdirSync(dir)) if (f.endsWith(".yaml") && f !== "g2.yaml" && f !== "corpus.yaml") rmSync(join(dir, f));
    writeFileSync(join(dir, "home.yaml"), `cases:\n${lines.map((l) => `  - ${l}`).join("\n")}\n`);
  }
  return { dir, script: join(dir, "oracle.py"), counts: join(dir, "oracle-counts.json") };
}

function runIn(script: string, args: string[]): { code: number; out: string } {
  const r = spawnSync(py as string, [script, ...args], { encoding: "utf8" });
  return { code: r.status ?? 1, out: `${r.stdout}${r.stderr}` };
}

describe("oracle.py --counts (G202)", () => {
  // expect is YAML text: "0.25", or ["0.5", "3"] for a list (no mark on a list)
  const row = (id: string, oracleExpr: string, expect: string, src = "oracle", mark = "") =>
    `{ id: "${id}", input: "x", oracle: "${oracleExpr}", expect: ${expect}, ${mark ? `mark: "${mark}", ` : ""}source: "${src}" }`;
  it("writes sorted keys and a final newline, and a second run leaves the bytes unchanged", () => {
    const g = goldenCopy(row("t-a", "F(1,4)", '"0.25"', "oracle", "="), row("t-b", "sqrt(2)", '"1.41421356237"', "oracle", "≈"));
    const r = runIn(g.script, ["--counts"]);
    expect(r.code).toBe(0);
    const text = readFileSync(g.counts, "utf8");
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
    const parsed = JSON.parse(text) as Record<string, number>;
    expect(Object.keys(parsed)).toEqual(["exact", "mpmath"]);
    expect(parsed).toEqual({ exact: 1, mpmath: 1 });
    runIn(g.script, ["--counts"]);
    expect(readFileSync(g.counts, "utf8")).toBe(text);
  }, SPAWN_MS);
  it("a value is exact when it is an int or a Fraction, element by element; one float element makes the row mpmath, a Label too; only source: oracle rows count", () => {
    const g = goldenCopy(
      row("t-int", "factorial(5)", '"120"', "oracle", "="),
      row("t-frac", "F(1,8)", '"0.125"', "oracle", "="),
      row("t-list-exact", "[F(1,2), 3]", '["0.5", "3"]'),
      row("t-list-mixed", "[F(1,2), sqrt(2)]", '["0.5", "1.41421356237"]'),
      row("t-float", "pi", '"3.14159265359"', "oracle", "≈"),
      row("t-label", "S('true') if pi > 3 else S('false')", '"true"'),
      row("t-derived", "F(1,4)", '"0.25"', "derived", "="),
    );
    const r = runIn(g.script, ["--counts"]);
    expect(r.out).not.toMatch(/PROBLEM/);
    expect(JSON.parse(readFileSync(g.counts, "utf8"))).toEqual({ exact: 3, mpmath: 3 });
  }, SPAWN_MS);
  it("on the tree, exact + mpmath is the number of source: oracle rows", () => {
    const g = goldenCopy();
    const r = runIn(g.script, ["--counts"]);
    expect(r.code).toBe(0);
    const c = JSON.parse(readFileSync(g.counts, "utf8")) as { exact: number; mpmath: number };
    let n = 0;
    for (const f of readdirSync(g.dir)) if (f.endsWith(".yaml")) n += readFileSync(join(g.dir, f), "utf8").split("\n").filter((l) => /^\s*- \{.*source: "oracle"/.test(l)).length;
    expect(c.exact + c.mpmath).toBe(n);
  }, TREE_MS);
  it("a row added without --counts leaves plain oracle.py at exit 0: the file's age is no PROBLEM", () => {
    const g = goldenCopy(row("t-a", "F(1,4)", '"0.25"', "oracle", "="));
    runIn(g.script, ["--counts"]);
    const before = readFileSync(g.counts, "utf8");
    writeFileSync(join(g.dir, "home.yaml"), `cases:\n  - ${row("t-a", "F(1,4)", '"0.25"', "oracle", "=")}\n  - ${row("t-b", "pi", '"3.14159265359"', "oracle", "≈")}\n`);
    const r = runIn(g.script, []);
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/PROBLEM/);
    expect(readFileSync(g.counts, "utf8")).toBe(before);
  }, SPAWN_MS);
});

describe("the gate's oraclecheck stage", () => {
  it("runs when a tests/golden file or oracle.py changed", () => {
    expect(touchesOracle(["tests/golden/precision.yaml"])).toBe(true);
    expect(touchesOracle(["tests/golden/oracle.py"])).toBe(true);
    expect(touchesOracle(["app/src/foo.ts", "docs/backlog.md"])).toBe(false);
  });
  it("shows the first three PROBLEM lines", () => {
    const out = ["noise", "PROBLEM a 1: x", "PROBLEM a 2: y", "PROBLEM a 3: z", "PROBLEM a 4: w"].join("\n");
    expect(problemLines(out)).toEqual(["PROBLEM a 1: x", "PROBLEM a 2: y", "PROBLEM a 3: z"]);
  });
});
