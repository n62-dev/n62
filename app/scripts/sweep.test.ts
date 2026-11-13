// SPDX-License-Identifier: GPL-3.0-or-later
// G61: the oracle sweep's judge on fixed inputs with known verdicts (no engine). Oracle strings here are made-up cases for the judge's rules.
import { describe, expect, it } from "vitest";
import { decimalFromString, ZERO_VALUE, type ComplexValue } from "../src/engine/format.ts";
import { judge, parseDec, type Oracle, type Shown } from "../../tools/probes/sweep/judge.ts";
import { generate, PINNED } from "../../tools/probes/sweep/gen.ts";
import { CANCEL_K, childrenOf, EDGE_CLASSES, generateEdges } from "../../tools/probes/sweep/edges.ts";
import { oracleFor, pythonFor, runsOf } from "../../tools/probes/sweep/run.ts";
import { latexToGiac } from "../src/input/latex-to-giac.ts";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mainCheckout = resolve(spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim() || resolve(repo, ".git"), "..");

const num = (re: string, im?: string): ComplexValue => ({ re: decimalFromString(re) ?? ZERO_VALUE, im: im === undefined ? ZERO_VALUE : (decimalFromString(im) ?? ZERO_VALUE) });
const shown = (value: ComplexValue, mark: Shown["mark"], n?: number): Shown => ({ ok: true, display: "x", value, mark, ...(n === undefined ? {} : { n }) });
const val = (re: string, im = "0"): Oracle => ({ kind: "value", re, im });

describe("sweep judge", () => {
  it("accepts an = that holds", () => {
    expect(judge(shown(num("0.25"), "="), val("0.25"), 12).kind).toBe("ok");
    expect(judge(shown(num("3"), "="), val("3.0000000000000000000000000000000000000000000000000000001"), 12).kind).toBe("ok");
  });
  it("rejects an = that does not hold", () => {
    const v = judge(shown(num("0.25"), "="), val("0.2500001"), 12);
    expect(v).toMatchObject({ kind: "wrong", check: "=" });
  });
  it("accepts an ≈ right to the shown digits and rejects one wrong from the 4th digit (F46)", () => {
    expect(judge(shown(num("1.23456789012"), "≈"), val("1.234567890123456"), 12).kind).toBe("ok");
    const v = judge(shown(num("1.2345678901234"), "≈"), val("1.2349876543210987"), 12);
    expect(v).toMatchObject({ kind: "wrong", check: "≈" });
    expect(v.detail).toContain("right to 4 digits");
  });
  it("rejects an ≈ one unit off in the last digit, accepts half a unit", () => {
    expect(judge(shown(num("1.23456789012"), "≈"), val("1.2345678901249"), 12).kind).toBe("ok");
    expect(judge(shown(num("1.23456789012"), "≈"), val("1.2345678901351"), 12).kind).toBe("wrong");
  });
  it("judges ⚠ n against n digits and a bare ⚠ against nothing", () => {
    expect(judge(shown(num("1.23456789012"), "⚠", 6), val("1.23456412"), 12).kind).toBe("ok");
    expect(judge(shown(num("1.23456789012"), "⚠", 6), val("1.2346"), 12)).toMatchObject({ kind: "wrong", check: "⚠n" });
    expect(judge(shown(num("1.23456789012"), "⚠"), val("99"), 12)).toMatchObject({ kind: "ok", detail: "⚠ without a count" });
    expect(judge(shown(num("2", "1e-2043"), "⚠", 0), val("2.1", "0"), 12).kind).toBe("ok");
  });
  it("checks the imaginary part, shown or not", () => {
    expect(judge(shown(num("2", "3"), "≈"), val("2", "3"), 12).kind).toBe("ok");
    expect(judge(shown(num("2", "3"), "≈"), val("2", "3.5"), 12)).toMatchObject({ kind: "wrong", check: "≈" });
    expect(judge(shown(num("2"), "≈"), val("2", "0.5"), 12)).toMatchObject({ kind: "wrong", check: "part" });
    expect(judge(shown(num("2"), "≈"), val("2", "1e-40"), 12).kind).toBe("ok");
    expect(judge(shown(num("2", "3"), "≈"), val("2", "0"), 12)).toMatchObject({ kind: "wrong", check: "part" });
  });
  it("G116: accepts an = whose hidden part is below 10^-50 of the value, rejects one above", () => {
    expect(judge(shown(num("0.75"), "="), val("0.75", "3.5861160021995467e-102"), 30).kind).toBe("ok");
    expect(judge(shown(num("0.75"), "="), val("0.75", "3e-40"), 30)).toMatchObject({ kind: "wrong", check: "part" });
  });
  it("G116: calls a dead engine a crash", () => {
    expect(judge({ ok: false, crash: true, error: "engine", display: "worker error: memory access out of bounds" }, val("1"), 12)).toMatchObject({ kind: "crash", check: "crash" });
  });
  it("refuses a number where the oracle has no value (F8)", () => {
    expect(judge(shown(num("5"), "≈"), { kind: "novalue" }, 12)).toMatchObject({ kind: "novalue" });
    expect(judge({ ok: false, error: "engine", display: "Division by zero" }, { kind: "novalue" }, 12).kind).toBe("refused");
    expect(judge({ ok: true, display: "undef" }, { kind: "novalue" }, 12).kind).toBe("ok");
  });
  it("calls a missed deadline a hang (F44) and a skipped oracle a skip", () => {
    expect(judge({ hang: true }, val("1"), 12)).toMatchObject({ kind: "hang", check: "hang" });
    expect(judge({ hang: true }, { kind: "skip", reason: "unstable" }, 12).kind).toBe("hang");
    expect(judge(shown(num("1"), "≈"), { kind: "skip", reason: "unstable" }, 12).kind).toBe("skip");
  });
  it("reads oracle text", () => {
    expect(parseDec("-1.5e+3")).toEqual({ m: -15n, e: 2 });
    expect(parseDec("nan")).toBeNull();
  });
});

describe("sweep generator", () => {
  it("is deterministic and gives keyboard LaTeX with an mpmath form", () => {
    const a = generate(7, 30);
    expect(generate(7, 30)).toEqual(a);
    expect(generate(8, 30)).not.toEqual(a);
    expect(a).toHaveLength(30);
    for (const c of a) {
      expect(c.latex.length).toBeGreaterThan(0);
      expect(c.mp.length).toBeGreaterThan(0);
    }
  });
});

// G116: the edge generator (tools/probes/sweep/edges.ts) and the gate's trees, which must not move.
describe("sweep edge generator (G116)", () => {
  it("is deterministic for a seed and differs for another", () => {
    const a = generateEdges(11, 60);
    expect(generateEdges(11, 60)).toEqual(a);
    expect(generateEdges(12, 60)).not.toEqual(a);
    expect(a).toHaveLength(60);
  });
  it("holds every leaf class in 2,000 trees of one seed", () => {
    const seen = new Map<string, number>();
    generateEdges(20261028, 2000, seen);
    for (const k of EDGE_CLASSES) expect([k, seen.get(k) ?? 0]).not.toEqual([k, 0]);
  });
  it("gives LaTeX the parser takes, and children for the smallest failing subtree", () => {
    const cs = generateEdges(3, 400);
    for (const c of cs) expect(() => latexToGiac(c.latex), c.latex).not.toThrow();
    const inner = cs.filter((c) => childrenOf(c.latex).length > 0);
    expect(inner.length).toBeGreaterThan(100);
    for (const c of inner) for (const k of childrenOf(c.latex)) expect(c.latex).toContain(k.latex);
  });
  it("gives mpmath texts the sweep oracle evaluates", () => {
    const sample = generateEdges(4, 40).map((c) => ({ latex: c.latex, mp: c.mp, angle: "rad" as const, digits: 12 as const }));
    const out = oracleFor(sample, pythonFor(repo, mainCheckout), resolve(repo, "tools/probes/sweep/oracle.py"));
    expect(out).toHaveLength(sample.length);
    expect(out.filter((o) => o.kind === "value").length).toBeGreaterThan(5);
    for (const o of out) if (o.kind === "skip") expect(o.reason).not.toMatch(/oracle error/);
  }, 120_000);
  it("G162: draws each cancellation family with k from 40 to 300", () => {
    const seen = new Map<string, number>();
    const cs = generateEdges(20261103, 2000, seen);
    for (const f of ["cancel0", "cancel1", "cancel2", "cancel3"]) expect([f, seen.get(f) ?? 0]).not.toEqual([f, 0]);
    const ks: number[] = [];
    for (const c of cs) {
      // (1 − cos 10^-k)·10^(2k): the two exponents belong together
      for (const m of c.latex.matchAll(/\\left\(1-\\cos\\left\(10\^\{-(\d+)\}\\right\)\\right\)\\times 10\^\{(\d+)\}/g)) expect(Number(m[2])).toBe(2 * Number(m[1]));
      for (const m of c.latex.matchAll(/10\^\{-(\d+)\}/g)) if (Number(m[1]) > 15) ks.push(Number(m[1]));
    }
    expect(Math.min(...ks)).toBeGreaterThanOrEqual(CANCEL_K.lo);
    expect(Math.max(...ks)).toBeLessThanOrEqual(CANCEL_K.hi);
    expect(Math.min(...ks)).toBeLessThan(80);
    expect(Math.max(...ks)).toBeGreaterThan(260);
  });
  it("G162: the oracle judges the cancellation families at k = 300 and k = 60 (it gave 1.0 there at 60 to 250 digits)", () => {
    // derived: lim (1+1/n)^(2n) = e², e² = exp(2) by mpmath at 60 digits; (1 − cos h)/h² → 1/2, so the value is 1.5 (the next term, h²/24, is below 10^-100)
    const e2 = "7.38905609893065022723042746057500781318031557055184732408713";
    const p = (k: number): string => `POW(mpf('10'),mpf('${k}'))`;
    const cases = [
      { mp: `POW((mpf('1'))+(${p(-300)}),(mpf('2'))*(${p(300)}))`, want: e2 },
      { mp: `POW(mpf('1.${"0".repeat(299)}1'),(mpf('2'))*(${p(300)}))`, want: e2 },
      { mp: `((mpf('1'))-(COS(${p(-300)})))*(${p(600)})+(mpf('1'))`, want: "1.5" },
      { mp: `((mpf('1'))-(COS(${p(-60)})))*(${p(120)})+(mpf('1'))`, want: "1.5" },
    ];
    const out = oracleFor(
      cases.map((c) => ({ latex: c.mp, mp: c.mp, angle: "rad" as const, digits: 12 as const })),
      pythonFor(repo, mainCheckout),
      resolve(repo, "tools/probes/sweep/oracle.py"),
    );
    out.forEach((o, i) => {
      expect(o.kind, cases[i]!.mp).toBe("value");
      if (o.kind !== "value") return;
      // to 50 digits, the judge's tolerance for an `=` (judge.ts), far past the 12 or 30 of an `≈`
      const d = parseDec(o.re)!;
      const w = parseDec(cases[i]!.want)!;
      const e = Math.min(d.e, w.e);
      const diff = d.m * 10n ** BigInt(d.e - e) - w.m * 10n ** BigInt(w.e - e);
      expect((diff < 0n ? -diff : diff) * 10n ** 50n <= 10n ** BigInt(-e), `${cases[i]!.mp}: ${o.re}`).toBe(true);
      expect(o.im).toBe("0.0");
    });
  }, 60_000);
  it("G307: draws the tiny term as a power of π and of e, and the oracle judges it (it gave 1.0 at 60 to 250 digits)", () => {
    const cs = generateEdges(20261103, 2000).filter((c) => /\\(pi|exponentialE)\^\{-\d+\}/.test(c.latex));
    expect(cs.some((c) => c.latex.includes("\\pi^{-"))).toBe(true);
    expect(cs.some((c) => c.latex.includes("\\exponentialE^{-"))).toBe(true);
    for (const c of cs) expect(() => latexToGiac(c.latex), c.latex).not.toThrow();
    // derived: lim (1+1/n)^n = e and (1-1/n)^(2n) → e^-2, mpmath at 100 digits (e, exp(-2))
    const e = "2.718281828459045235360287471352662497757247093699959574966967627724076630353547594571382178525166427";
    const em2 = "0.1353352832366126918939994949724844034076315459095758814681588726540733741014876899370981224906570488";
    const cases = [
      { mp: "POW((mpf('1'))+(POW(PI,mpf('-400'))),POW(PI,mpf('400')))", want: e },
      { mp: "POW((mpf('1'))-(exp(mpf('-600'))),(mpf('2'))*(exp(mpf('600'))))", want: em2 },
    ];
    const out = oracleFor(cases.map((c) => ({ latex: c.mp, mp: c.mp, angle: "rad" as const, digits: 12 as const })), pythonFor(repo, mainCheckout), resolve(repo, "tools/probes/sweep/oracle.py"));
    out.forEach((o, i) => {
      expect(o.kind, cases[i]!.mp).toBe("value");
      if (o.kind === "value") expect(o.re.slice(0, 52), cases[i]!.mp).toBe(cases[i]!.want.slice(0, 52));
    });
  }, 60_000);
  it("G162: skips a case past the oracle's digit cap with its reason, never judges it at fewer digits", () => {
    const out = oracleFor([{ latex: "x", mp: "((mpf('1'))-(COS(mpf('1e-2000'))))*(mpf('1e4000'))", angle: "rad", digits: 12 }], pythonFor(repo, mainCheckout), resolve(repo, "tools/probes/sweep/oracle.py"));
    expect(out[0]).toMatchObject({ kind: "skip" });
    expect(out[0]!.kind === "skip" ? out[0]!.reason : "").toMatch(/past the oracle's cap/);
  }, 60_000);
  it("G162: the oracle values the drawn cancellation trees (none skipped for digits)", () => {
    const cs = generateEdges(20261103, 400).filter((c) => /10\^\{-([4-9]\d|\d{3})\}|1\.0{39,}1|0\.9{40,}/.test(c.latex)).slice(0, 30);
    expect(cs.length).toBe(30);
    const out = oracleFor(cs.map((c) => ({ latex: c.latex, mp: c.mp, angle: "rad" as const, digits: 12 as const })), pythonFor(repo, mainCheckout), resolve(repo, "tools/probes/sweep/oracle.py"));
    for (const o of out) if (o.kind === "skip") expect(o.reason).not.toMatch(/digits|cap|oracle error/);
    expect(out.filter((o) => o.kind === "value").length).toBeGreaterThan(10);
  }, 120_000);
  it("leaves the gate's trees for seed 20261021 byte-identical (G326 wrote e as \\exponentialE; its control below holds the trees before)", () => {
    const h = (x: unknown): string => createHash("sha256").update(JSON.stringify(x)).digest("hex");
    expect(h(generate(20261021, 1000))).toBe("1452a2fcc5896d979f067fef991adc9dab127ccb81c908545927bdcd25406d39");
    expect(h(runsOf(20261021, 1000))).toBe("df26d42fcff7a461f9eb349d30e2a2c8f5b9f7247e3ae2fad67a9c5d5499ddca");
  });
});

// G326 (F213): since R67 the parser reads the letter e as the name e_, so a tree that wrote e as the letter was no number and never judged.
// The generators write e as the keys insert it (spec/keyboard.yaml, the eˣ key and the constant \exponentialE).
describe("sweep trees write e as the keys do (G326)", () => {
  const sha = (x: unknown): string => createHash("sha256").update(JSON.stringify(x)).digest("hex");
  /** A free name e_ in our parser's Giac text (Home mode); a refused tree has none. */
  const freeE = (latex: string): boolean => {
    try {
      return /\be_\b/.test(latexToGiac(latex));
    } catch {
      return false;
    }
  };
  /** The letter e outside a command name: what the parser reads as e_. */
  const letterE = /(^|[^\\a-zA-Z])e(?![a-zA-Z])/;
  const asLetter = <T extends { latex: string }>(cs: readonly T[]): T[] => cs.map((c) => ({ ...c, latex: c.latex.replaceAll("\\exponentialE", "e") }));
  const gateRuns = runsOf(20261021, 1000);
  const trees = {
    gate: gateRuns,
    view: generate(20261022, 100, { x: true, depth: 2 }),
    casback: generate(20261024, 30, { x: true, depth: 2 }),
    edges: generateEdges(20261028, 2000),
  };
  it("every tree of the gate's, the view sweep's, casback's and the edges' seeds parses without a free e_", () => {
    for (const [name, cs] of Object.entries(trees)) {
      expect([name, cs.filter((c) => freeE(c.latex)).map((c) => c.latex).slice(0, 3)]).toEqual([name, []]);
      expect([name, cs.filter((c) => letterE.test(c.latex)).map((c) => c.latex).slice(0, 3)]).toEqual([name, []]);
    }
  });
  it("writes exp as the eˣ key inserts it and the constant as \\exponentialE", () => {
    const spec = parseYaml(readFileSync(resolve(repo, "spec/keyboard.yaml"), "utf8")) as { keys: { id: string; shift?: { insert?: string } }[] };
    const key = spec.keys.find((k) => k.id === "ln")!.shift!.insert!;
    expect(key).toBe("\\exponentialE^{#0}");
    expect(PINNED[0]!.latex).toBe(key.replace("#0", "1.5ᴇ8"));
    expect(latexToGiac("\\exponentialE")).toBe("exp(1)");
    const all = Object.values(trees).flat();
    expect(all.some((c) => c.latex.includes(key.replace("#0}", "")))).toBe(true);
    expect(all.some((c) => /\\exponentialE(?!\^)/.test(c.latex) && c.mp.includes("E"))).toBe(true);
    // every exp( and every constant E of the mpmath side is an \exponentialE (the constant as a power base too)
    const count = (t: string, re: RegExp): number => [...t.matchAll(re)].length;
    for (const c of all) expect(count(c.latex, /\\exponentialE/g), c.latex).toBe(count(c.mp, /\bexp\(/g) + count(c.mp, /\bE\b/g));
  });
  it("the gate seed's runs that held e (313 of 1187, the 262 nonnumber verdicts among them) now parse as numbers", () => {
    expect(gateRuns).toHaveLength(1187);
    const withE = gateRuns.filter((r) => r.latex.includes("\\exponentialE"));
    expect(withE).toHaveLength(313);
    expect(withE.filter((r) => freeE(r.latex))).toHaveLength(0);
    expect(asLetter(withE).filter((r) => freeE(r.latex))).toHaveLength(313);
  });
  it("control: every other tree is byte-identical; with e written back as the letter the seeds give phase-1's trees", () => {
    expect(sha(asLetter(generate(20261021, 1000)))).toBe("417322a084096c09b9d053acc87d7a8894917157decd3214a92adbb3dd87b5c7");
    expect(sha(asLetter(runsOf(20261021, 1000)))).toBe("83330d8832e56c7f5f990ac3375bae90b13eb3cf4b27bacec094eecbd769cfba");
    expect(sha(asLetter(trees.view))).toBe("96781df693eff0101ca3a363c5885f3e55b93e905488f0ccc3721b10421efce3");
    expect(sha(asLetter(trees.casback))).toBe("4e6a9dc2cb06cefb7b8dda4728114ecabddb07ca791c3feb8f52d351bcdb12b5");
    // G307's fourth cancellation family (π^-2k, e^-2k) moves the edges trees from its first draw; with three families drawn they
    // give G326's 98c31a1d6f5cef7a4f1a13397ad18f19d9cb6858b26fcbe640271dcdbdfae655 again (checked when G307 changed the pin)
    expect(sha(asLetter(trees.edges))).toBe("6635f96d03fe5790dd656d937f17fb111142d0d16d4fb18b7eb7f76d0d743458");
  });
});
