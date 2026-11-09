// SPDX-License-Identifier: GPL-3.0-or-later
// A93: the facts library (tools/trust/facts.mts) reads the golden files and the patch table; `npm run trust:check` / `trust:refresh`
// keep README.md's "Why trust it" section and tests/golden/README.md's table equal to them. Everything runs on a temp copy of
// the data with fresh READMEs: no test reads the live READMEs of the top level or of tests/golden.
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ANSWER_FILES, MARK_BEGIN, MARK_END, OTHER_FILES, goldenFacts, patchFacts, trapTable, trustFacts, trustSentences,
} from "../../tools/trust/facts.mts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let tmp = "";

const STALE_GOLDEN_README = `# Golden cases

| File | Cases | What |
|---|---|---|
| \`home.yaml\` | 485 | x |
| \`precision.yaml\` | 1079 (6 \`pending\`) | x |
| \`solve.yaml\` | 1 | x |
| \`function.yaml\` | 1 | x |
| \`bench.yaml\` | 1 | x |
| \`units.yaml\` | 186 | x |
| \`parser.yaml\` | 1 | x |
| \`oracle-counts.json\` | \`{ "exact": 1, "mpmath": 1 }\` | x |
| \`g2.yaml\` | 71 items | x |
`;
const FRESH_README = `# N62\n\n## What it does\n\n- x\n\n## Why trust it\n\n${MARK_BEGIN}\n\nold\n\n${MARK_END}\n\n## Coming next\n`;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "n62-trust-"));
  for (const d of ["tests/golden", "engine/giac/patches", "tools", "app"]) mkdirSync(join(tmp, d), { recursive: true });
  for (const f of readdirSync(join(repo, "tests/golden"))) {
    if (/\.(yaml|json)$/.test(f)) copyFileSync(join(repo, "tests/golden", f), join(tmp, "tests/golden", f));
  }
  for (const f of readdirSync(join(repo, "engine/giac/patches"))) {
    copyFileSync(join(repo, "engine/giac/patches", f), join(tmp, "engine/giac/patches", f));
  }
  cpSync(join(repo, "tools/trust"), join(tmp, "tools/trust"), { recursive: true });
  copyFileSync(join(repo, "app/package.json"), join(tmp, "app/package.json"));
  symlinkSync(join(repo, "app/node_modules"), join(tmp, "app/node_modules"));
  writeFileSync(join(tmp, "README.md"), FRESH_README);
  writeFileSync(join(tmp, "tests/golden/README.md"), STALE_GOLDEN_README);
  // oracle.py is not run here (no Python): make the counts file add up, as a refresh would have.
  const g = goldenFacts(tmp);
  writeFileSync(join(tmp, "tests/golden/oracle-counts.json"), JSON.stringify({ exact: g.exact, mpmath: g.computed - g.exact }, null, 2) + "\n");
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const trust = (cmd: "check" | "refresh"): { status: number | null; err: string } => {
  const r = spawnSync("npm", ["run", "--silent", `trust:${cmd}`], {
    cwd: join(tmp, "app"), encoding: "utf8", env: { ...process.env, TRUST_SKIP_ORACLE: "1" },
  });
  return { status: r.status, err: r.stderr };
};

/** The rows of a golden file by the line shape oracle.py uses (one flow mapping per line), not by the YAML parser. */
function lineCounts(file: string): { rows: number; pending: number; computed: number; crossChecked: number } {
  const lines = readFileSync(join(tmp, "tests/golden", file), "utf8").split("\n").filter((l) => /^ {2}- \{ id: /.test(l));
  const computed = lines.filter((l) => /, source: "oracle"[ ,}]/.test(l));
  return {
    rows: lines.length,
    pending: lines.filter((l) => /, status: "pending"[ ,}]/.test(l)).length,
    computed: computed.length,
    crossChecked: lines.filter((l) => /, oracle: "/.test(l) && !computed.includes(l)).length,
  };
}

describe("goldenFacts", () => {
  it("counts the rows, the open cases and the sources the way the lines read", () => {
    const g = goldenFacts(tmp);
    const by = ANSWER_FILES.map((f) => lineCounts(f));
    const sum = (k: "rows" | "pending" | "computed" | "crossChecked"): number => by.reduce((a, c) => a + c[k], 0);
    expect(g.answers).toBe(sum("rows"));
    expect(g.open).toBe(sum("pending"));
    expect(g.computed).toBe(sum("computed"));
    expect(g.crossChecked).toBe(sum("crossChecked"));
    expect(g.handOrGuard).toBe(g.answers - g.computed - g.crossChecked);
    for (const f of [...ANSWER_FILES, ...OTHER_FILES]) {
      expect(g.files[f]?.rows, f).toBe(lineCounts(f).rows);
      expect(g.files[f]?.pending, f).toBe(lineCounts(f).pending);
    }
  });

  it("takes mpmath and exact from oracle-counts.json", () => {
    const counts = JSON.parse(readFileSync(join(tmp, "tests/golden/oracle-counts.json"), "utf8")) as { exact: number; mpmath: number };
    const g = goldenFacts(tmp);
    expect(g.exact).toBe(counts.exact);
    expect(g.mpmath).toBe(counts.mpmath);
    expect(g.mpmath + g.exact).toBe(g.computed);
  });

  it("finds the rows of the trap table", () => {
    const ids = Object.keys(goldenFacts(tmp).traps).sort();
    expect(ids).toEqual(["g39-int-1/x-pv", "trust-cos-12", "trust-limit-12", "trust-ramanujan-30", "trust-rump-12"]);
  });
});

describe("patchFacts", () => {
  it("has a row in a fixed form for every patch file, and the columns add up", () => {
    const p = patchFacts(tmp);
    expect(p.problems).toEqual([]);
    expect(p.files.length).toBeGreaterThan(30);
    expect(p.rows.map((r) => r.patch)).toEqual(p.files);
    expect(p.total).toBe(p.files.length);
    expect(p.sent).toBe(p.reported + p.applied + p.waiting);
    expect(p.sent + p.notSent).toBe(p.total);
  });

  it("reports a patch without a row and a value outside the fixed forms", () => {
    const dir = mkdtempSync(join(tmpdir(), "n62-trust-patches-"));
    try {
      mkdirSync(join(dir, "engine/giac/patches"), { recursive: true });
      writeFileSync(join(dir, "engine/giac/patches/0001-a.patch"), "x");
      writeFileSync(join(dir, "engine/giac/patches/0002-b.patch"), "x");
      writeFileSync(join(dir, "engine/giac/patches/README.md"), "| Patch | Why | Status | Upstream |\n|---|---|---|---|\n| `0001-a.patch` | w | sent soon | G1 |\n");
      const p = patchFacts(dir);
      expect(p.problems.some((m) => m.includes("0002-b.patch: no row"))).toBe(true);
      expect(p.problems.some((m) => m.includes('Status "sent soon"'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the sentences and the trap table", () => {
  it("name the facts and nothing else", () => {
    const f = trustFacts(tmp);
    const s = trustSentences(f);
    const g = f.golden, p = f.patches;
    const n = (x: number): string => x.toLocaleString("en-US");
    expect(s).toContain(`${n(g.answers)} recorded answers, ${n(g.open)} of them open cases. ${n(g.computed)} expected values are computed independently of Giac (${n(g.mpmath)} by mpmath, ${n(g.exact)} by exact arithmetic); ${n(g.crossChecked)} more are hand-derived or reference values cross-checked by machine; the other ${n(g.handOrGuard)} are hand-derived expected results or behaviour guards.`);
    expect(s).toContain(`${n(p.total)} Giac patches. ${n(p.sent)} sent to the author: he wrote that ${n(p.reported)} should be integrated and applied ${n(p.applied)} in his 7 Nov source, with differences being resolved; ${n(p.waiting)} more wait for his answer; ${n(p.notSent)} not sent.`);
    expect(s).toContain("When the engine, the parser or the units change, the golden gate re-runs the answers; when a golden file changes, the oracle recomputes the expected values.");
    expect(s).not.toMatch(/2,700|proof|every merge/);
  });

  it("follows the Status column", () => {
    const f = trustFacts(tmp);
    const moved = { ...f, patches: { ...f.patches, waiting: f.patches.waiting + 1, sent: f.patches.sent + 1, total: f.patches.total + 1 } };
    expect(trustSentences(moved)).toContain(`${f.patches.waiting + 1} more wait for his answer`);
  });

  it("reads the traps from the golden rows", () => {
    const t = trapTable(trustFacts(tmp)).split("\n");
    expect(t[0]).toBe("| Trap | N62 | True value | Ordinary IEEE double |");
    expect(t).toContain("| Rump's expression at (77617, 33096) | ≈ -0.827396059947 | -54767/66192 | about ±1.18E21; the sign depends on evaluation order |");
    expect(t).toContain("| `1-cos(10⁻⁸)` (RAD) | ≈ 5E-17 | 4.99999999999999995833E-17 | 0 |");
    expect(t).toContain("| `(1+10⁻¹⁶)^(10¹⁶)` | ≈ 2.71828182846 | 2.71828182845904509945 | 1 |");
    expect(t).toContain("| `e^(π√163)` at 30 digits | ≈ 262537412640768743.999999999999 | 262537412640768743.99999999999925 | 2.6253741264076826E17 |");
    expect(t).toContain('| `∫ 1/x dx` from -1 to 1 | refused: "The integral does not converge" | diverges | n/a |');
  });
});

describe("npm run trust:check and trust:refresh", () => {
  it("is red on stale READMEs, green after a refresh, red after a golden row, a patch without a row", { timeout: 120_000 }, () => {
    expect(trust("check").status).toBe(1);
    const first = trust("refresh");
    expect(first.err).toBe("");
    expect(first.status).toBe(0);
    expect(trust("check").status).toBe(0);

    const readme = readFileSync(join(tmp, "README.md"), "utf8");
    expect(readme).toContain(trustSentences(trustFacts(tmp)));
    expect(readme).toContain(trapTable(trustFacts(tmp)));
    expect(readFileSync(join(tmp, "tests/golden/README.md"), "utf8")).toContain(`| \`home.yaml\` | ${goldenFacts(tmp).files["home.yaml"]?.rows} |`);

    appendFileSync(join(tmp, "tests/golden/precision.yaml"), `  - { id: "a93-extra", input: "1+1", expect: "2", mark: "=", source: "derived" }\n`);
    expect(trust("check").status).toBe(1);
    expect(trust("refresh").status).toBe(0);
    expect(trust("check").status).toBe(0);

    writeFileSync(join(tmp, "engine/giac/patches/9999-extra.patch"), "x");
    expect(trust("check").status).toBe(1);
    expect(trust("refresh").status).toBe(1);
    const table = join(tmp, "engine/giac/patches/README.md");
    const rows = readFileSync(table, "utf8").split("\n");
    rows.splice(rows.findIndex((l) => l.startsWith("| `0037-")) + 1, 0, "| `9999-extra.patch` | w | not sent | A93 test |");
    writeFileSync(table, rows.join("\n"));
    expect(trust("refresh").status).toBe(0);
    expect(trust("check").status).toBe(0);
  });

  it("is red when the oracle counts do not add up to the computed rows", () => {
    const file = join(tmp, "tests/golden/oracle-counts.json");
    const g = goldenFacts(tmp);
    writeFileSync(file, JSON.stringify({ exact: g.exact, mpmath: g.mpmath + 1 }));
    const r = trust("check");
    expect(r.status).toBe(1);
    expect(r.err).toContain("oracle-counts.json");
  });
});
