// SPDX-License-Identifier: GPL-3.0-or-later
// A132: the pipeline's rates from .coord/log.md, on a small fixture log; every figure is worked out by hand below.
import { describe, expect, it } from "vitest";
import { parseLog, render, TOO_FEW, stats } from "./pipeline-stats.ts";

const LOG = `- 09:00 PROBLEM (for morning): a line that is no run's: pipeline #99 R1: NOT MERGED (a story)
- 10:00 [A] pipeline #1 R1 (ron, sonnet, effort high) on p1/ron-a: started; PW_PORT 5201; bundle /x/spec.md
- 10:01 [A] pipeline #1 R1: integ taken after a wait of 100 s
- 10:02 [A] pipeline #1 R1: host-cpu taken after a wait of 50 s
- 10:10 [A] pipeline #1 R1: checks passed (round 0)
- 10:10 [A] pipeline #1 R1: audit APPROVED (round 0)
- 10:11 [A] pipeline #1 R1: MERGED aaaaaaa (audited aaaaaaa)
- 11:00 [A] pipeline #2 R2 (ron, sonnet) on p1/ron-b: started; PW_PORT 5202; bundle /x/spec.md
- 11:01 [A] pipeline #2 R2: pre-flight failed (round 0): ## docs failed (full log: /x/pre.log): lines: too long
- 11:02 [A] pipeline #2 R2: fix round 1 done, bbbbbbb
- 11:03 [A] pipeline #2 R2: integ taken after a wait of 20 s
- 11:04 [A] pipeline #2 R2: host-cpu taken after a wait of 30 s
- 11:05 [A] pipeline #2 R2: host-cpu held by opus for 600 s; waited 601 s so far
- 11:06 [A] pipeline #2 R2: host-cpu held by pipeline-3 for 400 s; waited 10 s so far
- 11:10 [A] pipeline #2 R2: checks failed (round 1): ## e2e failed (full log: /x/c.log): 1 failing: t
    x.spec.ts › t
- 11:10 [A] pipeline #2 R2: audit FIX (round 1): 1. a finding
- 11:11 [A] pipeline #2 R2: fix round 2 done, ccccccc
- 11:20 [A] pipeline #2 R2: checks passed (round 2)
- 11:20 [A] pipeline #2 R2: audit APPROVED (round 2)
- 11:21 [A] pipeline #2 R2: MERGED ddddddd (audited ddddddd)
- 12:00 [B] pipeline #3 G3 (gorge, opus, effort high) on p1/gorge-c: started; PW_PORT 5203; bundle /x/spec.md
- 12:01 [B] pipeline #3 G3: integ taken after a wait of 7 s
- 12:10 [B] pipeline #3 G3: checks failed (round 0): ## vitest failed (full log: /x/v0.log): 1 failing: a
- 12:10 [B] pipeline #3 G3: audit APPROVED (round 0)
- 12:11 [B] pipeline #3 G3: fix round 1 done, eeeeeee
- 12:20 [B] pipeline #3 G3: checks failed (round 1): ## vitest failed (full log: /x/v1.log): 1 failing: a
- 12:20 [B] pipeline #3 G3: audit FIX (round 1): 1. a finding
- 12:21 [B] pipeline #3 G3: fix round 2 done, fffffff
- 12:30 [B] pipeline #3 G3: checks failed (round 2): ## golden failed (full log: /x/g.log): FAIL steps: x
- 12:30 [B] pipeline #3 G3: audit APPROVED (round 2)
- 12:31 [B] pipeline #3 G3: NOT MERGED after two fix rounds; branch p1/gorge-c kept at fffffff
- 13:00 [B] pipeline #4 G4 (gorge, sonnet) on p1/gorge-d: started; PW_PORT 5204; bundle /x/spec.md
- 13:05 [B] pipeline #4 G4: NOT MERGED (merge conflict); branch p1/gorge-d kept
- 14:00 [A] pipeline #5 A5 (annabell, sonnet) on p1/annabell-e: started; PW_PORT 5205; bundle /x/spec.md
- 14:01 [A] pipeline #5 A5: in the queue (round 0)
- 14:10 [A] pipeline #6 R9: NOT MERGED (no package file for R9)
- 15:00 [A] pipeline #7 R7 (ron, opus, effort high) on p1/ron-f: started; PW_PORT 5207; bundle /x/spec.md
- 15:01 [A] pipeline #7 R7: checks failed (round 0): checks failed: red-first (every new test passes on phase-1)
- 15:02 [A] pipeline #7 R7: fix round 1 done, 1111111
- 15:10 [A] pipeline #7 R7: checks passed (round 1)
- 15:10 [A] pipeline #7 R7: audit APPROVED (round 1)
- 15:11 [A] pipeline #7 R7: MERGED 2222222 (audited 2222222)
- 15:20 [A] pipeline #7 R7: integ taken after a wait of 1 s
`;

// Finished: 1, 2, 3, 4, 7 (5 has no outcome; 6 has no start line).
// Not merged: 3, 4 (2 of 5 = 40.0 %). Merged with no fix round: run 1. Fix rounds: 0 + 2 + 2 + 0 + 1 = 5 (1.00 a run).
// Audit FIX: run 2 once, run 3 once = 2 (0.40 a run). Runs with an e2e failure: run 2. Not merged, last audit APPROVED: run 3.
// Failures per check: docs 1 (run 2, pre-flight), e2e 1 (run 2), vitest 2 (run 3), golden 1 (run 3), red-first 1 (run 7).
describe("parseLog", () => {
  const p = parseLog(LOG);
  it("reads the runs, the refusals and the unfinished", () => {
    expect(p.runs.map((r) => r.n)).toEqual([1, 2, 3, 4, 5, 7]);
    expect(p.runs.filter((r) => r.outcome === null).map((r) => r.n)).toEqual([5]);
    expect(p.refusals.map((r) => [r.n, r.id, r.why])).toEqual([[6, "R9", "no package file for R9"]]);
    expect(p.runs.find((r) => r.n === 3)).toMatchObject({ id: "G3", agent: "gorge", model: "opus", lane: "B", outcome: "not-merged", fixRounds: 2, auditFix: 1, lastAudit: "APPROVED" });
    expect(p.runs.find((r) => r.n === 2)).toMatchObject({ agent: "ron", model: "sonnet", outcome: "merged", fixRounds: 2, auditFix: 1, e2e: true, lastAudit: "APPROVED" });
    expect(p.runs.find((r) => r.n === 7)!.fails).toEqual(["red-first"]);
  });
});

describe("stats", () => {
  it("one band over the whole range, by hand", () => {
    const r = stats(parseLog(LOG), {});
    expect(r.bands).toHaveLength(1);
    const b = r.bands[0]!;
    expect(b.label).toBe("#1–7");
    expect(b.rows.map((x) => `${x.kind} ${x.name}`)).toEqual(["all all", "agent gorge", "agent ron", "model opus", "model sonnet"]);
    const row = (kind: string, name: string) => b.rows.find((x) => x.kind === kind && x.name === name)!;
    expect(row("all", "all")).toMatchObject({ runs: 5, notMerged: 2, firstPass: 1, fixRounds: 5, auditFix: 2, e2eRuns: 1, approvedNotMerged: 1, fails: { docs: 1, e2e: 1, vitest: 2, golden: 1, "red-first": 1 } });
    expect(row("agent", "ron")).toMatchObject({ runs: 3, notMerged: 0, firstPass: 1, fixRounds: 3, auditFix: 1, e2eRuns: 1, approvedNotMerged: 0 });
    expect(row("agent", "gorge")).toMatchObject({ runs: 2, notMerged: 2, firstPass: 0, fixRounds: 2, auditFix: 1, e2eRuns: 0, approvedNotMerged: 1 });
    expect(row("model", "sonnet")).toMatchObject({ runs: 3, notMerged: 1, firstPass: 1, fixRounds: 2, auditFix: 1 });
    expect(row("model", "opus")).toMatchObject({ runs: 2, notMerged: 1, firstPass: 0, fixRounds: 3, auditFix: 1 });
    expect(r.unfinished.map((x) => x.n)).toEqual([5]);
    expect(r.refusals.map((x) => x.n)).toEqual([6]);
  });

  it("the lock waits per lane, by hand", () => {
    const b = stats(parseLog(LOG), {}).bands[0]!;
    // lane A: integ 100 + 20 + 1 = 121 s in 3; host-cpu 50 + 30 = 80 s in 2; held by a pass (opus) 600 s in 1, by a run (pipeline-3) 400 s in 1
    expect(b.locks.find((l) => l.lane === "A")).toEqual({ lane: "A", integ: { n: 3, s: 121 }, hostCpu: { n: 2, s: 80 }, heldByPass: { n: 1, s: 600 }, heldByRun: { n: 1, s: 400 } });
    expect(b.locks.find((l) => l.lane === "B")).toEqual({ lane: "B", integ: { n: 1, s: 7 }, hostCpu: { n: 0, s: 0 }, heldByPass: { n: 0, s: 0 }, heldByRun: { n: 0, s: 0 } });
  });

  it("--from and --to cut by run number, --band cuts into bands of that many numbers", () => {
    const one = stats(parseLog(LOG), { from: 2, to: 3 }).bands[0]!;
    expect(one.label).toBe("#2–3");
    expect(one.rows[0]).toMatchObject({ runs: 2, notMerged: 1, fixRounds: 4 });
    const r = stats(parseLog(LOG), { band: 5 });
    expect(r.bands.map((b) => [b.label, b.rows[0]!.runs])).toEqual([["#0–4", 4], ["#5–9", 1]]);
    expect(r.unfinished.map((x) => x.n)).toEqual([5]);
    // a band that holds only a refusal is still reported
    expect(stats(parseLog(LOG), { from: 6, to: 6 }).refusals.map((x) => x.n)).toEqual([6]);
  });
});

describe("render", () => {
  it("prints the rates, the too-few line, the unfinished and the refusals", () => {
    const out = render(stats(parseLog(LOG), {}));
    expect(out).toContain("#1–7");
    expect(out).toMatch(/all\s+5\s+2 \(40\.0 %\)\s+1\s+1\.00\s+0\.40\s+1\s+1/);
    expect(out).toMatch(/gorge\s+2\s+2 \(100\.0 %\)/);
    expect(out).toContain(`fewer than ${TOO_FEW} runs`);
    expect(out).toContain("unfinished: #5 A5");
    expect(out).toContain("no start line: #6 R9 (no package file for R9)");
    expect(out).toMatch(/A\s+3 \/ 121 s\s+2 \/ 80 s\s+1 \/ 600 s\s+1 \/ 400 s/);
  });
  it("has no too-few line for a band of 50 runs or more", () => {
    let log = "";
    for (let n = 1; n <= 50; n++) log += `- 10:00 pipeline #${n} X${n} (ron, sonnet) on p1/x: started\n- 10:01 pipeline #${n} X${n}: MERGED abc1234\n`;
    expect(render(stats(parseLog(log), {}))).not.toContain("fewer than");
  });
});
