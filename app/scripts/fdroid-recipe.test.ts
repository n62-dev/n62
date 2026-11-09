// SPDX-License-Identifier: GPL-3.0-or-later
// A60: the F-Droid recipe's own build proves find/factors.yaml (decisions.md P22).
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The `prebuild` lines of the recipe's first build, comments and indentation stripped. */
function prebuild(): string[] {
  const lines = readFileSync(join(repo, "fdroid/dev.n62.calc.yml"), "utf8").split("\n");
  const start = lines.findIndex((l) => /^\s+prebuild:\s*$/.test(l));
  expect(start).toBeGreaterThan(-1);
  const out: string[] = [];
  for (const l of lines.slice(start + 1)) {
    const m = /^\s+-\s+(.*\S)\s*$/.exec(l);
    if (m) out.push(m[1] as string);
    else if (!/^\s*#/.test(l)) break;
  }
  return out;
}

/** The `sudo` lines of the recipe's first build, same shape as prebuild(). */
function sudo(): string[] {
  const lines = readFileSync(join(repo, "fdroid/dev.n62.calc.yml"), "utf8").split("\n");
  const start = lines.findIndex((l) => /^\s+sudo:\s*$/.test(l));
  expect(start).toBeGreaterThan(-1);
  const out: string[] = [];
  for (const l of lines.slice(start + 1)) {
    const m = /^\s+-\s+(.*\S)\s*$/.exec(l);
    if (m) out.push(m[1] as string);
    else if (!/^\s*#/.test(l)) break;
  }
  return out;
}

/** The release build's pin (build-wasm-release.sh), the one value the recipe must repeat. */
function pinnedEmscripten(): string {
  const m = /^EMSCRIPTEN_PKG_VERSION="([^"]+)"/m.exec(readFileSync(join(repo, "engine/giac/build-wasm-release.sh"), "utf8"));
  expect(m, "no EMSCRIPTEN_PKG_VERSION in build-wasm-release.sh").not.toBeNull();
  return (m as RegExpExecArray)[1] as string;
}

describe("F-Droid recipe pins the release Emscripten (A96)", () => {
  const pin = pinnedEmscripten();

  it("installs emscripten=<pin> and exports EMSCRIPTEN_PKG_VERSION=<pin> before the engine build", () => {
    expect(sudo().some((s) => /^apt-get install\b/.test(s) && s.split(/\s+/).includes(`emscripten=${pin}`))).toBe(true);
    const steps = prebuild();
    const exp = steps.findIndex((s) => s === `export EMSCRIPTEN_PKG_VERSION=${pin}`);
    const build = steps.findIndex((s) => /^engine\/giac\/build-wasm\.sh$/.test(s));
    expect(exp, "no export EMSCRIPTEN_PKG_VERSION in prebuild").toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(exp);
  });
});

describe("build-wasm.sh with EMSDK_DIR=system checks the compiler version (A96)", () => {
  const pin = pinnedEmscripten();
  /** Runs `build-wasm.sh nosuch` (the stage fails only after the compiler check) with a fake emcc printing `ver`. */
  function run(ver: string, pkg: string | undefined) {
    const dir = mkdtempSync(join(tmpdir(), "n62-a96-"));
    try {
      const bin = join(dir, "bin");
      spawnSync("mkdir", ["-p", bin]);
      writeFileSync(join(bin, "emcc"), `#!/bin/sh\necho "emcc (Emscripten gcc/clang-like replacement) ${ver} (deadbeef)"\n`);
      chmodSync(join(bin, "emcc"), 0o755);
      const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`, EMSDK_DIR: "system", N62_DL_DIR: join(dir, "dl"), GIAC_BUILD_DIR: join(dir, "b"), GIAC_BUILD_OUT: join(dir, "o") };
      delete env.EMSCRIPTEN_PKG_VERSION;
      if (pkg !== undefined) env.EMSCRIPTEN_PKG_VERSION = pkg;
      const r = spawnSync("bash", [join(repo, "engine/giac/build-wasm.sh"), "nosuch"], { env, encoding: "utf8" });
      let downloaded = false;
      try { downloaded = readdirSync(join(dir, "dl")).length > 0; } catch { /* no cache dir: nothing fetched */ }
      return { status: r.status, err: r.stderr, downloaded };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("a different emcc version exits non-zero at once, naming both versions", () => {
    const r = run("3.1.50", pin);
    expect(r.status).not.toBe(0);
    expect(r.err).toContain("3.1.50");
    expect(r.err).toContain("3.1.69");
    expect(r.err).not.toContain("nosuch");
    expect(r.downloaded).toBe(false);
  });

  it("the matching upstream version passes the check (the next stage, nosuch, then fails)", () => {
    const r = run("3.1.69", pin);
    expect(r.err).toContain("using system emcc 3.1.69");
    expect(r.err).toContain("nosuch");
  });
});

describe("F-Droid recipe checks find/factors.yaml (A60)", () => {
  const steps = prebuild();
  const at = (re: RegExp): number => steps.findIndex((s) => re.test(s));

  it("runs refresh-factors.mjs after the qalc build and npm ci, before npm run index", () => {
    const qalc = at(/^engine\/qalc\/build-wasm\.sh dev$/);
    const ci = at(/^npm ci$/);
    const refresh = at(/refresh-factors\.mjs/);
    const index = at(/^npm run index$/);
    expect(qalc).toBeGreaterThan(-1);
    expect(ci).toBeGreaterThan(-1);
    expect(index).toBeGreaterThan(-1);
    expect(refresh, "no refresh-factors.mjs step in prebuild").toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(qalc);
    expect(refresh).toBeGreaterThan(ci);
    expect(refresh).toBeLessThan(index);
  });

  it("the step is a plain `node` call of the script (a difference exits 1 and fails the build)", () => {
    expect(steps[at(/refresh-factors\.mjs/)]).toMatch(/^node \.\.\/tools\/find-index\/refresh-factors\.mjs$/);
  });
});
