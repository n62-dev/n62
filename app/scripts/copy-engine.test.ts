// SPDX-License-Identifier: GPL-3.0-or-later
// engine:copy (scripts/copy-engine.mjs): a new build replaces both files, also when one of them keeps its size.
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error: a plain .mjs script, no types
import { copyEngine } from "./copy-engine.mjs";

const dirs: string[] = [];
const dir = (): string => (dirs.push(mkdtempSync(join(tmpdir(), "n62-copy-engine-"))), dirs.at(-1)!);
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A build: giac.mjs and giac.wasm with these texts, made at `when` (seconds since the epoch). */
function build(mjs: string, wasm: string, when: number): string {
  const d = dir();
  for (const [f, text] of [["giac.mjs", mjs], ["giac.wasm", wasm]] as const) {
    writeFileSync(join(d, f), text);
    utimesSync(join(d, f), when, when);
  }
  return d;
}

describe("copyEngine", () => {
  it("a build made before the last copy, whose giac.mjs keeps its size, replaces both files (run 966)", () => {
    const dest = dir();
    // the old build's EM_ASM table sits at 1232588, the new one's at 1232604: same length, other bytes
    const older = build("var ASM_CONSTS={1232588:()=>1}", "wasm-old", 1_000);
    const newer = build("var ASM_CONSTS={1232604:()=>1}", "wasm-new!", 500); // built before the copy below
    expect(copyEngine(older, dest)).toEqual(["giac.mjs", "giac.wasm"]);
    expect(copyEngine(newer, dest)).toEqual(["giac.mjs", "giac.wasm"]);
    expect(readFileSync(join(dest, "giac.mjs"), "utf8")).toBe("var ASM_CONSTS={1232604:()=>1}");
    expect(readFileSync(join(dest, "giac.wasm"), "utf8")).toBe("wasm-new!");
  });

  it("copies nothing when the files are the same", () => {
    const dest = dir();
    const b = build("m", "w", 1_000);
    copyEngine(b, dest);
    expect(copyEngine(b, dest)).toEqual([]);
  });

  it("a missing file is an error that names it", () => {
    const d = dir();
    expect(() => copyEngine(d, dir())).toThrow(/missing .*giac\.mjs/);
  });
});
