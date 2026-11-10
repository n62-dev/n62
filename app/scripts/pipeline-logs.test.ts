// SPDX-License-Identifier: GPL-3.0-or-later
// The failing-file logic of scripts/pipeline.sh, on a real coloured vitest log of run 15 (2026-10-18).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { countMismatch, failedItems, FLAKE_CAP, failNames, flakeLines, isTiming, NAMES_CHARS, NAMES_MAX, onlyTiming, rerunnable } from "./pipeline-logs.ts";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../../tests/fixtures/pipeline");
const colour = readFileSync(join(dir, "vitest-find-timing.log"), "utf8");
const files = (log: string) => [...new Set(failedItems("vitest", log).map((i) => i.file))];

describe("vitest log", () => {
  it("finds the Find timing test through the colour codes", () => {
    expect(colour).toContain("\u001b[");
    expect(files(colour)).toEqual(["src/find/queries.test.ts"]);
    expect(onlyTiming("vitest", colour)).toBe(true);
    // today's grep, for the record: it never matched
    expect(/^ *(FAIL|❯) +[^ ]+\.test\.ts/m.test(colour)).toBe(false);
  });
  it("gets both files when another one fails too, and then it is not timing", () => {
    const log = `${colour}\n\u001b[41m\u001b[1m FAIL \u001b[22m\u001b[49m src/other.test.ts\u001b[2m > \u001b[22mthing works\n`;
    expect(files(log)).toEqual(["src/find/queries.test.ts", "src/other.test.ts"]);
    expect(onlyTiming("vitest", log)).toBe(false);
  });
  it("a suite that fails on import is found, and the count guard refuses a miss", () => {
    const find = " FAIL  src/find/queries.test.ts > Find index > takes well under 16 ms per key\n";
    const suite = " FAIL  src/x.test.ts [ src/x.test.ts ]\nError: Cannot find module './y'\n Test Files  2 failed | 52 passed (54)\n";
    expect(files(find + suite)).toEqual(["src/find/queries.test.ts", "src/x.test.ts"]);
    expect(onlyTiming("vitest", find + suite)).toBe(false);
    // an unseen failure: the summary says 2 files, only 1 was found
    expect(onlyTiming("vitest", `${find} Test Files  2 failed | 52 passed (54)\n`)).toBe(false);
  });
  it("is not timing for another failure in the Find file", () => {
    expect(isTiming("vitest", { file: "src/find/queries.test.ts", title: "Find index > finds pi" })).toBe(false);
  });
});

describe("timing tests of runs 150 and 152", () => {
  const fail = (f: string, t: string) => ` FAIL  src/engine/${f} > ${t}\n`;
  const novalue = fail("novalue.test.ts", "G78 on the real engine > evaluates only the parts that can make an infinity, and none when they would take too long (timing case)");
  const acos = fail("homeDeadline.test.ts", "Home's deadline (real Giac) > acos(120^(5/2+5)) answers: Giac's im() of its exact result looped past the interrupt");
  it("the novalue timing case and the Home acos deadline are timing", () => {
    expect(onlyTiming("vitest", novalue)).toBe(true);
    expect(onlyTiming("vitest", acos)).toBe(true);
    expect(onlyTiming("vitest", novalue + acos + " Test Files  2 failed | 52 passed (54)\n")).toBe(true);
  });
  it("the G83 library restore and first call is timing; another test in library.test.ts is not", () => {
    const lib = (t: string) => ` FAIL  src/engine/library.test.ts > 200 library programs, defined on first use (G83, real Giac) > ${t}\n`;
    expect(onlyTiming("vitest", lib("restore() of the 200 takes under 50 ms in Node, and a first call at most 10 ms more than after an eager replay (median of 7)"))).toBe(true);
    expect(onlyTiming("vitest", lib("a unit request for 2 m and a root analysis of x^2-2 leave every program pending (G83f1: their keys and JSON load nothing)"))).toBe(false);
  });
  it("F106: the G102 interrupted-call test is timing; another flags.test.ts test is not", () => {
    const fl = (t: string) => ` FAIL  src/engine/flags.test.ts > Giac's settings (real Giac) > ${t}\n`;
    expect(onlyTiming("vitest", fl("G102: a Digits set right after an interrupted call is set (ctx_set clears ctrl_c, G75: one call, no retry), and adjacent sets are one"))).toBe(true);
    expect(onlyTiming("vitest", fl("G102: after each of G67's leak inputs the settings are back through giac_ctx_set, and no getter list is sent as text"))).toBe(false);
  });

  it("FLAKES 1: the five wall-clock tests of 2026-10-26 are timing; their neighbours are not", () => {
    const t = (file: string, title: string) => isTiming("vitest", { file, title });
    expect(t("src/engine/converge.test.ts", "G39 on the real engine > Home and CAS refuse 3*int(1/x,x,-1,1)+1")).toBe(true);
    expect(t("src/engine/converge.test.ts", "G39 on the real engine > Home and CAS refuse int(1/x,x,-1,1)")).toBe(false);
    expect(t("src/engine/host.test.ts", "EngineHost (real Giac) > switching CAS -> Home restores Home's 300 ms budget")).toBe(true);
    expect(t("src/engine/host.test.ts", "EngineHost (real Giac) > CAS keeps its own Ans; Home's Ans is unaffected")).toBe(false);
    expect(t("src/engine/valueKind.test.ts", "G103: a value's kind from bridge-3 (F73) > an Integer_too_large_for_display print is an integer: 10^1000000+7 is exact, shown from its digits, with no such text as its exact form")).toBe(true);
    expect(t("src/input/fuzz.test.ts", "parser fuzz > 20000 random token strings parse or fail with SerializeError, quickly")).toBe(true);
    expect(isTiming("e2e", { file: "working.spec.ts", title: "a job shows Working… and Cancel only after 150 ms, and its row keeps the result's height" })).toBe(true);
    expect(isTiming("e2e", { file: "working.spec.ts", title: "the Cancel key stops a job" })).toBe(false);
  });
  it("another failure in the same files is not timing", () => {
    expect(isTiming("vitest", { file: "src/engine/novalue.test.ts", title: "G78 on the real engine > keeps 1/0 undefined" })).toBe(false);
    expect(isTiming("vitest", { file: "src/engine/homeDeadline.test.ts", title: "Home's deadline (real Giac) > sin(1) answers" })).toBe(false);
    expect(onlyTiming("vitest", novalue + fail("homeDeadline.test.ts", "Home's deadline (real Giac) > factor(x^4-1) answers"))).toBe(false);
  });
  it("e2e: Esc before Working… shows is timing, the Cancel test is not", () => {
    const l = "  2) [chromium-phone] › test/working.spec.ts:61:1 › Esc stops a job before Working… shows ──────────\n";
    expect(onlyTiming("e2e", l)).toBe(true);
    expect(onlyTiming("e2e", l + "  3) [chromium-phone] › test/working.spec.ts:90:1 › the Cancel key stops a job ──────────\n")).toBe(false);
  });
  // G153f1: round 2 of run 480 (load), a g58 case that only missed its budgetMs, from the case line above the stage line
  const g58 = "  precision g58-factorial-1e6-30: took 2119 ms > budgetMs 2000; got error: Stopped: it took too long, expect 8.26393168833124006237664610317E5565708\n";
  const precision = (n: number, m: number, lines: string) => `  precision g137-acosh-cosh-3sqrt-neg-pi-12: pending (got -i, expect -0.965823754463*i)\n${lines}FAIL precision: ${n}/${m} active match; 6 pending; 642 marks checked\n`;
  it("golden: a g58 case that only missed its budgetMs is timing, by case", () => {
    expect(failedItems("golden", precision(868, 869, g58))).toEqual([
      { file: "precision", title: "g58-factorial-1e6-30: took 2119 ms > budgetMs 2000; got error: Stopped: it took too long, expect 8.26393168833124006237664610317E5565708" },
    ]);
    expect(onlyTiming("golden", precision(868, 869, g58))).toBe(true);
    expect(onlyTiming("golden", precision(99, 100, "  precision g58-factorial-1e6-12: took 2100 ms > budgetMs 2000\n"))).toBe(true);
  });
  it("golden: a g58 value or mark mismatch, another case, or a count that does not match is not timing", () => {
    const wrong = "  precision g58-factorial-1e6-30: got 8.26393168833124006237664610316E5565708, expect 8.26393168833124006237664610317E5565708\n";
    expect(onlyTiming("golden", precision(868, 869, wrong))).toBe(false);
    expect(onlyTiming("golden", precision(868, 869, "  precision g58-factorial-1e6-30: took 2119 ms > budgetMs 2000; mark ⚠, expect ≈\n"))).toBe(false);
    expect(onlyTiming("golden", precision(868, 869, "  precision g58-factorial-1e6-30: took 2119 ms > budgetMs 2000; got 8.3E5565708, expect 8.26393168833124006237664610317E5565708\n"))).toBe(false);
    expect(onlyTiming("golden", precision(868, 869, "  precision prec-3-UTPN-30: took 2119 ms > budgetMs 2000\n"))).toBe(false);
    expect(onlyTiming("golden", precision(867, 869, g58 + wrong.replace("1e6-30", "1e6-12")))).toBe(false);
    expect(onlyTiming("golden", precision(867, 869, g58))).toBe(false);
    expect(onlyTiming("golden", precision(868, 869, ""))).toBe(false);
    expect(onlyTiming("golden", precision(868, 869, g58) + "FAIL home: 12/13 match\n")).toBe(false);
  });
});

describe("golden and e2e logs", () => {
  const units = (n: number, p95: string) => `PASS x: 3/3\nFAIL units: ${n}/116 match (value, mark), rounds 5; desktop warm median 2.02 ms, p95 ${p95} ms (≤ 5), max 11 ms\n`;
  it("a golden failure only on the units p95 bar is timing", () => {
    expect(failedItems("golden", units(116, "6.16"))).toHaveLength(1);
    expect(onlyTiming("golden", units(116, "6.16"))).toBe(true);
    expect(onlyTiming("golden", units(115, "6.16"))).toBe(false);
    expect(onlyTiming("golden", "PASS units: 116/116 match\n")).toBe(false);
  });
  const inv = (fresh: number, now: number, secs: string) => `FAIL invariants: 304 inputs, 244 (a) RAD/DEG, 60 (b) 12/30 digits, 40 (c) copy and paste, 12 (d) store; 2 known failures, ${fresh} new, ${now} now passing; ${secs} s (< 60)\n`;
  it("G154f1: a golden invariants failure only on its 60 s limit is timing; a new or now-passing case is not", () => {
    expect(failedItems("golden", inv(0, 0, "71.9"))).toHaveLength(1);
    expect(onlyTiming("golden", inv(0, 0, "71.9"))).toBe(true);
    expect(onlyTiming("golden", inv(1, 0, "71.9"))).toBe(false);
    expect(onlyTiming("golden", inv(0, 1, "71.9"))).toBe(false);
    expect(onlyTiming("golden", inv(1, 0, "42.8"))).toBe(false);
    expect(onlyTiming("golden", inv(0, 0, "71.9") + "FAIL home: 12/13 match\n")).toBe(false);
  });
  it("e2e: the copy poll and the solve reload are timing, others are not", () => {
    const l = (f: string, t: string) => `  1) [chromium-phone] › test/${f}:89:1 › ${t} ────────────\n`;
    expect(onlyTiming("e2e", l("copy.spec.ts", "copy → paste gives the value back (P5)"))).toBe(true);
    expect(onlyTiming("e2e", l("solve.spec.ts", "equations and values are stored"))).toBe(true);
    expect(onlyTiming("e2e", l("working.spec.ts", "the Cancel key stops a job"))).toBe(false);
  });
  it("e2e: a count that differs from Playwright's own summary is a mismatch, never timing", () => {
    const one = "  1) [chromium-phone] › test/copy.spec.ts:89:1 › copy → paste gives the value back (P5) ────────────\n";
    expect(countMismatch("e2e", `${one}\n  1 failed\n  300 passed\n`)).toBeNull();
    expect(onlyTiming("e2e", `${one}\n  1 failed\n`)).toBe(true);
    expect(countMismatch("e2e", `${one}\n  3 failed\n`)).toMatch(/parsed 1.*3 failed/);
    expect(onlyTiming("e2e", `${one}\n  3 failed\n`)).toBe(false);
  });
});

// A51: golden `steps` and `flags` failed at load about 10 and passed alone at load 1.7 (pass 16, 2026-10-30). The load-only
// items, from three runs at load 20-30 beside a quiet one (stage and item, never a whole stage):
//   steps: precision/prec-g44f2f1-chisquare_icdf-1-0.95-12 (Home's 300 ms budget ends the agreement run) and
//          precision/prec-G23-sin-1e2000 (the digit the doubling reached before the same budget); each is a finding of the
//          real clock against the 8× fast one, printed on its own line above the stage line
//   flags: patch-canary.ts and canaries.mjs (which runs it): 40 gunzips of the Giac tarball, 100 s of CPU, against spawnSync's
//          120 s timeout
describe("golden steps and flags under load (A51)", () => {
  const canary = "PASS step-budget-test: 6 runs interrupted at 506 checks (budget 500, clock ×1 and ×8); with ckbudget 0 the 0.2 s clock interrupts";
  const known = "  steps known (HOME_DEADLINE_MS): precision g58-factorial-1e6-12 [display] input factorial(10^6): desktop \"8.26E5565708\", device \"error: Stopped: it took too long\"\n";
  const finding = (id: string, kind = "mark") => `  steps precision ${id} [${kind}] input chisquare_icdf(1,0.95): desktop "≈", device "⚠"\n`;
  // G153f1: the real stage line since G137f1 (run 480, round 1) ends in ", 5 pending", with a "steps pending:" line above it
  const pending = "  steps pending: precision g149-deg-sqrt-asinh-asin-3.7-12 [mark] input sqrt(asinh((asin(3.7)/pasdeg))): desktop \"⚠\", device \"≈\"\n";
  const steps = (n: number, lines: string, head = canary) => `${known}${pending}${lines}FAIL steps: ${head} | 1425 cases, clock ×1 and ×8: ${n} new findings, 2 known, 5 pending\n`;
  it("G153f1: round 1's two findings, as printed, are timing; another case id is not", () => {
    const sin = "  steps precision prec-G23-sin-1e2000 [display] input sin(pasdeg*(10^2000)): desktop \"-0.7\", device \"-0.8\"\n";
    const chi = "  steps precision prec-g44f2f1-chisquare_icdf-1-0.95-12 [mark] input chisquare_icdf(1,0.95): desktop \"≈\", device \"⚠\"\n";
    expect(failedItems("golden", steps(2, sin + chi))).toEqual([
      { file: "steps", title: "precision/prec-G23-sin-1e2000" },
      { file: "steps", title: "precision/prec-g44f2f1-chisquare_icdf-1-0.95-12" },
    ]);
    expect(onlyTiming("golden", steps(2, sin + chi))).toBe(true);
    expect(onlyTiming("golden", steps(2, sin + chi.replace("prec-g44f2f1-chisquare_icdf-1-0.95-12", "prec-g44f2f1-chisquare_icdf-1-0.95-30")))).toBe(false);
  });
  it("steps: a finding of the two load-only cases is timing, by case", () => {
    const one = steps(1, finding("prec-g44f2f1-chisquare_icdf-1-0.95-12"));
    expect(failedItems("golden", one)).toEqual([{ file: "steps", title: "precision/prec-g44f2f1-chisquare_icdf-1-0.95-12" }]);
    expect(onlyTiming("golden", one)).toBe(true);
    expect(onlyTiming("golden", steps(1, finding("prec-G23-sin-1e2000", "display")))).toBe(true);
    expect(onlyTiming("golden", steps(2, finding("prec-G23-sin-1e2000", "display") + finding("prec-g44f2f1-chisquare_icdf-1-0.95-12")))).toBe(true);
  });
  it("steps: any other case, a mix, a failed canary or a count that does not match is not timing", () => {
    expect(onlyTiming("golden", steps(1, finding("prec-3-UTPN-30")))).toBe(false);
    expect(onlyTiming("golden", steps(2, finding("prec-G23-sin-1e2000", "display") + finding("prec-3-UTPN-30")))).toBe(false);
    expect(onlyTiming("golden", steps(1, finding("prec-G23-sin-1e2000", "display"), "FAIL step-budget-test 1 | the count differs between runs"))).toBe(false);
    expect(onlyTiming("golden", steps(2, finding("prec-G23-sin-1e2000", "display")))).toBe(false);
    expect(onlyTiming("golden", steps(1, ""))).toBe(false);
  });
  const ok = "PASS: 78 context fields | PASS tanh-test: 4 complex tanh values match mpmath";
  const timedOut = (f: string) => `FAIL ${f}: timed out after 120 s`;
  const flags = (...segments: string[]) => `FAIL flags: ${segments.join(" | ")}\nPASS regress: ok\n`;
  it("flags: the tarball canaries that ran out of the spawn timeout are timing, by sub-test", () => {
    const both = flags(ok, timedOut("patch-canary.ts"), timedOut("canaries.mjs"), "PASS fetch-test: 4 fetches");
    expect(failedItems("golden", both)).toEqual([
      { file: "flags", title: "patch-canary.ts: timed out after 120 s" },
      { file: "flags", title: "canaries.mjs: timed out after 120 s" },
    ]);
    expect(onlyTiming("golden", both)).toBe(true);
    expect(onlyTiming("golden", flags(ok, timedOut("canaries.mjs")))).toBe(true);
  });
  it("flags: a wrong value in the same stage, or another sub-test out of time, is not timing", () => {
    const wrong = "FAIL tanh-test.ts: FAIL tanh-test 1 | tanh(1+i) at 30 digits: got 0.8 expect 0.9";
    expect(onlyTiming("golden", flags(ok, timedOut("patch-canary.ts"), wrong))).toBe(false);
    expect(onlyTiming("golden", flags(ok, wrong))).toBe(false);
    expect(onlyTiming("golden", flags(ok, timedOut("tanh-test.ts")))).toBe(false);
    expect(onlyTiming("golden", flags(ok, "FAIL canaries.mjs: FLIPPED 1 of 19 workaround canaries"))).toBe(false);
    expect(onlyTiming("golden", flags(ok))).toBe(false);
  });
  it("a timing item next to a real failure of another stage stays a real failure", () => {
    expect(onlyTiming("golden", flags(ok, timedOut("canaries.mjs")) + "FAIL home: 12/13 match\n")).toBe(false);
  });
});

// A129: an e2e failure the branch cannot have written gets one rerun before a fix round (R165, R159f2, R149 lost rounds to tests they did not touch)
describe("rerunnable e2e failures (A129)", () => {
  const fail = (i: number, spec: string, title: string) => `  ${i}) [chromium-phone] › test/${spec}:12:1 › ${title} ────────────\n`;
  const log = (n: number, summary = n) => `${Array.from({ length: n }, (_, i) => fail(i + 1, `s${i}.spec.ts`, `case ${i}`)).join("\n")}\n  ${summary} failed\n  300 passed\n`;
  const other = ["app/src/views/Foo.svelte", "app/test/other.spec.ts", "docs/backlog.md"];
  it("one to five failures in specs the branch did not change are rerunnable", () => {
    expect(FLAKE_CAP).toBe(5);
    expect(rerunnable("e2e", log(1), other)).toBe(true);
    expect(rerunnable("e2e", log(5), [])).toBe(true);
  });
  it("a failure in a spec the branch changed, or any of several, gets no rerun", () => {
    expect(rerunnable("e2e", log(1), ["app/test/s0.spec.ts"])).toBe(false);
    expect(rerunnable("e2e", log(3), ["app/test/s2.spec.ts"])).toBe(false);
    expect(rerunnable("e2e", fail(1, "sub/x.spec.ts", "t") + "\n  1 failed\n", ["app/test/sub/x.spec.ts"])).toBe(false);
  });
  it("more failures than the cap, none parsed, or a count mismatch get no rerun", () => {
    expect(rerunnable("e2e", log(6), [])).toBe(false);
    expect(rerunnable("e2e", "Error: Timed out waiting 60000 ms from config.webServer\n", [])).toBe(false);
    expect(rerunnable("e2e", "", [])).toBe(false);
    expect(rerunnable("e2e", log(1, 3), [])).toBe(false);
    expect(rerunnable("e2e", `${log(1)}  4 interrupted\n  200 did not run\n`, [])).toBe(false);
  });
  it("a changed shared test helper, fixture or config gets no rerun; a changed spec of another test does not matter", () => {
    expect(rerunnable("e2e", log(1), ["app/test/helpers.ts"])).toBe(false);
    expect(rerunnable("e2e", log(1), ["app/test/gallery/index.html", "app/test/x.spec.ts"])).toBe(false);
    expect(rerunnable("e2e", log(1), ["app/playwright.config.ts"])).toBe(false);
  });
  it("only e2e is rerun this way", () => {
    expect(rerunnable("vitest", " FAIL  src/a.test.ts > one\n Test Files  1 failed (1)\n", [])).toBe(false);
  });
  it("the log lines: one per failing test, cut to 200 characters, a test of two projects once", () => {
    const l = fail(1, "copy.spec.ts", "copy → paste") + fail(2, "copy.spec.ts", "copy → paste").replace("phone", "tablet") + fail(3, "a.spec.ts", "x".repeat(300));
    const lines = flakeLines("e2e", l);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("copy.spec.ts › copy → paste");
    expect(lines[1]).toHaveLength(200);
    expect(lines[1]!.startsWith("a.spec.ts › xxx")).toBe(true);
  });
});

describe("the failing tests of the log line (A130)", () => {
  const pw = (i: number, title: string) => `  ${i}) [chromium-phone] › test/showcase.spec.ts:64:5 › ${title} ────────────\n`;
  it("an e2e log: N failing and the first title, then every test once (a skipped line with × is none)", () => {
    const l = `  -  1 [chromium-phone] › test/showcase.spec.ts:64:5 › E 72.25 kg × g₀\n${pw(1, "first")}${pw(2, "second")}  2 failed\n  1 skipped\n`;
    expect(failNames("e2e", l)).toEqual({ head: "2 failing: first", list: "showcase.spec.ts › first; showcase.spec.ts › second" });
  });
  it("a vitest log gives the same", () => {
    const l = " FAIL  src/a.test.ts > suite > one\n FAIL  src/b.test.ts > two\n FAIL  src/c.test.ts [ src/c.test.ts ]\n Test Files  3 failed (3)\n";
    expect(failNames("vitest", l)).toEqual({ head: "3 failing: suite > one", list: "src/a.test.ts › suite > one; src/b.test.ts › two; src/c.test.ts" });
  });
  it("after a failed rerun the log holds both runs: one entry per file and title", () => {
    const l = `${pw(1, "a")}${pw(2, "b")}  2 failed\n${pw(1, "a")}  1 failed\n`;
    expect(failNames("e2e", l)).toEqual({ head: "2 failing: a", list: "showcase.spec.ts › a; showcase.spec.ts › b" });
  });
  it("golden: the head is the first FAIL stage line, not a PASS line with ×", () => {
    const l = "PASS steps: PASS step-budget-test: … clock ×1 and ×8\nFAIL invariants: 3 known failures, 0 new, 0 now passing; 87.9 s (< 60)\nFAIL interrupt: timed out\nGOLDEN GATE FAILED\n";
    const r = failNames("golden", l);
    expect(r?.head).toBe("FAIL invariants: 3 known failures, 0 new, 0 now passing; 87.9 s (< 60)");
    expect(r?.list).toBe("invariants › 3 known failures, 0 new, 0 now passing; 87.9 s (< 60); interrupt › timed out");
  });
  it("no parsed item: none", () => {
    expect(failNames("e2e", "Error: Timed out waiting for the web server\n")).toBeNull();
    expect(failNames("golden", "GOLDEN GATE FAILED\n")).toBeNull();
    expect(failNames("vitest", "")).toBeNull();
  });
  it("at most 40 tests and 2000 characters, then (and <k> more)", () => {
    const many = Array.from({ length: 45 }, (_, i) => pw(i + 1, `t${i}`)).join("");
    const r = failNames("e2e", many)!;
    expect(NAMES_MAX).toBe(40);
    expect(r.head).toBe("45 failing: t0");
    expect(r.list.endsWith("; showcase.spec.ts › t39 (and 5 more)")).toBe(true);
    const long = Array.from({ length: 20 }, (_, i) => pw(i + 1, `${i}`.padEnd(190, "x"))).join("");
    const c = failNames("e2e", long)!;
    expect(c.list.replace(/ \(and \d+ more\)$/, "").length).toBeLessThanOrEqual(NAMES_CHARS);
    expect(c.list).toMatch(/\(and \d+ more\)$/);
  });
});
