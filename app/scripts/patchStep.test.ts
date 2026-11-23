// SPDX-License-Identifier: GPL-3.0-or-later
// G787: build-wasm.sh applies every patch at fuzz 0, so a patch whose context has moved (0055 behind 0039's comments) or one
// upstream already has (at a re-pin, 0038 forward-applies on Parisse's 22 Nov tree) stops the build instead of landing in the
// wrong place. The second test applies patches/*.patch in name order to the pinned tarball's files exactly as the build does.
//   N62_DL_DIR: the tarball cache (default engine/giac/_downloads), as tests/engine/patch-canary.ts
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { SOURCES, tarball } from "../../tools/find-index/state.mjs";

const ROOT = new URL("../../", import.meta.url).pathname;
const PATCHES = join(ROOT, "engine/giac/patches");
const BUILD = readFileSync(join(ROOT, "engine/giac/build-wasm.sh"), "utf8");

/** The build's patch command: the `patch ` line of stage_giac. */
function patchLine(): string {
  const body = BUILD.slice(BUILD.indexOf("stage_giac() {"));
  const line = body.split("\n").find((l) => /^\s*patch /.test(l));
  if (!line) throw new Error("build-wasm.sh: stage_giac has no patch line");
  return line.trim();
}

describe("build-wasm.sh's patch step (G787)", () => {
  it("applies with -p1 --forward -F0, the patches in name order", () => {
    const words = patchLine().split(/\s+/);
    expect(words).toContain("-p1");
    expect(words).toContain("--forward");
    expect(words).toContain("-F0");
    expect(BUILD).toMatch(/for p in "\$HERE"\/patches\/\*\.patch; do/);
  });

  const work = mkdtempSync(join(tmpdir(), "n62-patchstep-"));
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  it("applies every patch of patches/ in name order at fuzz 0 to the pinned tarball", { timeout: 120_000 }, () => {
    const files = readdirSync(PATCHES).filter((f) => f.endsWith(".patch")).sort();
    expect(files.length).toBeGreaterThan(50);
    const targets = new Set<string>();
    for (const f of files)
      for (const m of readFileSync(join(PATCHES, f), "utf8").matchAll(/^\+\+\+ b\/(\S+)/gm)) targets.add(`giac-2.1.0/${m[1]}`);
    // one pass over the tarball for every file a patch touches that it holds (a file a patch creates is not in it)
    const listed = spawnSync("tar", ["-tzf", tarball(SOURCES.giac)], { encoding: "utf8", maxBuffer: 1 << 28 });
    expect(listed.status).toBe(0);
    const inTar = new Set(listed.stdout.split("\n"));
    const take = [...targets].filter((t) => inTar.has(t));
    const untar = spawnSync("tar", ["-xzf", tarball(SOURCES.giac), "-C", work, ...take], { encoding: "utf8" });
    expect(untar.status, untar.stderr).toBe(0);
    const src = join(work, "giac-2.1.0");
    const failed: string[] = [];
    for (const f of files) {
      const r = spawnSync("patch", ["-d", src, "-p1", "--forward", "-F0", "-i", join(PATCHES, f)], { encoding: "utf8" });
      if (r.status !== 0) failed.push(`${f}: ${(r.stdout + r.stderr).trim().split("\n").slice(-3).join(" | ")}`);
    }
    expect(failed).toEqual([]);
  });
});
