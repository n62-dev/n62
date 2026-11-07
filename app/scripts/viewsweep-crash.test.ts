// SPDX-License-Identifier: GPL-3.0-or-later
// G188 (G94): the view sweep survives an engine crash and names it. Before, the sweep ran Giac in its own process, so one wasm trap
// ("RuntimeError: memory access out of bounds", nightly seed 20752, count 300) ended the run with no finding and no summary line.
// A stand-in engine (viewsweep-standin.ts) traps on its n-th call or hangs on one input, in the sweep's worker thread.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { invariantsStage } from "./invariants.ts";
import { loadViewKnown, VIEW_KNOWN_FILE } from "./viewsweep-known.ts";
import { joinViewParts, readViewParts, writeViewPart, type ViewPartFile } from "./viewsweep-parts.ts";
import { defaultHomeSettings } from "../src/engine/homeEval.ts";
import { ViewEngine } from "../../tools/probes/sweep/viewhost.ts";
import { viewSweep } from "../../tools/probes/sweep/viewrun.ts";

const here = dirname(fileURLToPath(import.meta.url));
const standIn = resolve(here, "viewsweep-standin.ts");
const lim = { roots: 2, slopes: 2, areas: 2 };
const scratch = mkdtempSync(resolve(tmpdir(), "g188-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("the view sweep's engine runs in a worker thread (G188)", () => {
  it("a trap on the n-th call is a crash finding naming the expression, and the run goes on in a fresh engine", async () => {
    const r = await viewSweep(7, 6, lim, { logDir: null, host: standIn, hostArg: { trapAt: 40 } });
    const crashes = r.failures.filter((f) => f.check === "crash");
    expect(crashes.length).toBeGreaterThan(1); // the engine trapped again on its 40th call: every engine after a crash is fresh
    expect(r.restarts).toBe(crashes.length);
    for (const c of crashes) {
      expect(c.detail).toMatch(/^RuntimeError: memory access out of bounds; 40 Giac calls on that engine/);
      expect(c.id).toMatch(/^(rad|deg) \S+/);
    }
    // the run reached its end: Solve's residual is asked last, on the last expressions of DEG
    expect(r.cases).toBeGreaterThan(0);
    expect(r.compared).toBeGreaterThan(100);
  }, 60_000);

  it("a call past its deadline is a hang finding and the run goes on", async () => {
    const r = await viewSweep(7, 6, lim, { logDir: null, host: standIn, hostArg: { hangOn: ",x,0,1)" }, deadlineMs: (m) => (m === "home" ? 1000 : 20_000) });
    const hangs = r.failures.filter((f) => f.check === "hang");
    expect(hangs.length).toBeGreaterThan(0);
    expect(hangs.every((h) => /^(rad|deg) area 0\.\.1 /.test(h.id) && /no answer within 1000 ms/.test(h.detail))).toBe(true);
    expect(r.restarts).toBe(hangs.length);
  }, 60_000);

  it("a fresh engine after a crash gets the stored x again (the sweep's context)", async () => {
    const e = new ViewEngine({ logDir: null, host: standIn, hostArg: { trapOn: "boom" }, deadlineMs: () => 5000 });
    try {
      const s = { ...defaultHomeSettings };
      await e.call("home", "x:=2", s);
      e.context = [{ method: "home", args: ["x:=2", s] }];
      const crash = await e.call("home", "boom", s);
      expect(crash).toMatchObject({ ok: false, failed: "crash", calls: 2 });
      const after = await e.call("home", "sin(x)", s);
      expect(after.ok && after.value.result.display).toBe("x=2");
      expect(e.restarts).toBe(1);
    } finally {
      await e.close();
    }
  }, 60_000);

  it("the nightly run ends with its summary line and lists the crash as a crash finding, not a dead run", () => {
    const out = spawnSync(process.execPath, [resolve(here, "viewsweep.ts"), "--nightly", "--seed", "7", "--count", "6"], {
      cwd: resolve(here, ".."),
      encoding: "utf8",
      timeout: 120_000,
      env: { ...process.env, VIEWSWEEP_HOST: standIn, VIEWSWEEP_HOST_ARG: JSON.stringify({ trapAt: 60 }), VIEWSWEEP_LOG_DIR: resolve(scratch, "logs") },
    });
    expect(out.status, out.stderr).toBe(0);
    expect(out.stdout).toMatch(/^FINDING (rad|deg) .* \[crash\]: RuntimeError: memory access out of bounds/m);
    expect(out.stdout).toMatch(/^VIEWSWEEP NIGHTLY: \d+ findings; \d+ expressions \(seed 7\), \d+ comparisons, total [\d.]+ s; [1-9]\d* engine restarts/m);
  }, 130_000);
});

describe("viewsweep-known.yaml (G188)", () => {
  it("a crash row is read like the point sweep's: it hides that crash, and an unlisted crash fails the stage", () => {
    const dir = resolve(scratch, "repo");
    mkdirSync(resolve(dir, dirname(VIEW_KNOWN_FILE)), { recursive: true });
    writeFileSync(resolve(dir, VIEW_KNOWN_FILE), 'known:\n  - { id: "rad home 0.3 \\\\sin\\\\left(x\\\\right)", check: crash, package: G94 }\n');
    const known = loadViewKnown(dir);
    expect(known).toEqual([{ id: "rad home 0.3 \\sin\\left(x\\right)", check: "crash", package: "G94" }]);
    const crash = { id: "rad home 0.3 \\sin\\left(x\\right)", check: "crash", detail: "RuntimeError: memory access out of bounds" };
    expect(invariantsStage([crash], known)).toMatchObject({ ok: true, summary: "1 known failures, 0 new, 0 now passing" });
    expect(invariantsStage([{ ...crash, id: "rad home 1 x" }], known)).toMatchObject({ ok: false });
    expect(invariantsStage([{ ...crash, check: "hang" }], known).ok).toBe(false);
  });
});

describe("the nightly view sweep in pieces (G188)", () => {
  it("--join reads every part of a seed and count, names a missing one, and sums the pieces", () => {
    const dir = resolve(scratch, "parts");
    const base = { seed: 20752, count: 300, of: 2, compared: 10, cases: 3, restarts: 1, maxHeap: 2 ** 27, calls: 5000, secs: 60 };
    const crash = { id: "rad home 1 x", check: "crash", detail: "RuntimeError: memory access out of bounds" };
    writeViewPart(dir, { ...base, part: 2, failures: [crash] } satisfies ViewPartFile);
    expect(readViewParts(dir, 20752, 300)).toEqual({ ok: false, message: `seed 20752, count 300: parts 1/2 missing in ${dir}` });
    writeViewPart(dir, { ...base, part: 1, failures: [], maxHeap: 2 ** 26 });
    const got = readViewParts(dir, 20752, 300);
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(joinViewParts(got.files)).toEqual({ failures: [crash], compared: 20, cases: 6, restarts: 2, maxHeap: 2 ** 27, calls: 10000, secs: 120 });
    expect(readViewParts(dir, 20752, 600)).toMatchObject({ ok: false });
  });
});
