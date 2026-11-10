// SPDX-License-Identifier: GPL-3.0-or-later
// A60: the F-Droid recipe's own build proves find/factors.yaml (decisions.md P22).
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The lines of one list key (`prebuild`, `build`, `sudo`) of the recipe's first build, comments and indentation stripped. */
function list(key: string): string[] {
  const lines = readFileSync(join(repo, "fdroid/dev.n62.calc.yml"), "utf8").split("\n");
  const start = lines.findIndex((l) => new RegExp(`^\\s+${key}:\\s*$`).test(l));
  expect(start, `no ${key}: block in the recipe`).toBeGreaterThan(-1);
  const out: string[] = [];
  for (const l of lines.slice(start + 1)) {
    const m = /^\s+-\s+(.*\S)\s*$/.exec(l);
    if (m) out.push(m[1] as string);
    else if (!/^\s*#/.test(l)) break;
  }
  return out;
}
const prebuild = (): string[] => list("prebuild");
const build = (): string[] => list("build");
const sudo = (): string[] => list("sudo");

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
    const steps = build();
    const exp = steps.findIndex((s) => s === `export EMSCRIPTEN_PKG_VERSION=${pin}`);
    const eng = steps.findIndex((s) => /^engine\/giac\/build-wasm\.sh$/.test(s));
    expect(exp, "no export EMSCRIPTEN_PKG_VERSION in build").toBeGreaterThan(-1);
    expect(eng).toBeGreaterThan(exp);
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
  const steps = build();
  const at = (re: RegExp): number => steps.findIndex((s) => re.test(s));

  it("runs refresh-factors.mjs after the qalc build and npm ci, before npm run index", () => {
    const qalc = at(/^engine\/qalc\/build-wasm\.sh dev$/);
    const ci = prebuild().findIndex((s) => /^npm ci$/.test(s));
    const refresh = at(/refresh-factors\.mjs/);
    const index = at(/^npm run index$/);
    expect(qalc).toBeGreaterThan(-1);
    expect(ci).toBeGreaterThan(-1);
    expect(index).toBeGreaterThan(-1);
    expect(refresh, "no refresh-factors.mjs step in build").toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(qalc);
    expect(ci, "npm ci stays in prebuild").toBeGreaterThan(-1);
    expect(refresh).toBeLessThan(index);
  });

  it("the step is a plain `node` call of the script (a difference exits 1 and fails the build)", () => {
    expect(steps[at(/refresh-factors\.mjs/)]).toMatch(/^node \.\.\/tools\/find-index\/refresh-factors\.mjs$/);
  });
});

describe("F-Droid recipe builds outside prebuild (A97)", () => {
  const pre = prebuild();
  const bld = build();
  const at = (steps: string[], re: RegExp): number => steps.findIndex((s) => re.test(s));

  it("prebuild builds nothing: no engine build without --fetch-only, no npm run build, no cap sync, no index", () => {
    for (const s of pre) {
      if (/build-wasm\.sh/.test(s)) expect(s, `prebuild builds: ${s}`).toMatch(/ --fetch-only$/);
      expect(s).not.toMatch(/npm run build|cap sync|npm run index|refresh-factors/);
    }
    expect(at(pre, /^engine\/giac\/build-wasm\.sh --fetch-only$/)).toBeGreaterThan(-1);
    expect(at(pre, /^engine\/qalc\/build-wasm\.sh dev --fetch-only$/)).toBeGreaterThan(at(pre, /^engine\/giac\/build-wasm\.sh --fetch-only$/));
    expect(at(pre, /^npm ci$/)).toBeGreaterThan(-1);
  });

  it("a build: block holds the builds in today's order", () => {
    const order = [
      /^cd \.\.\/\.\.$/, /^export EMSDK_DIR=system$/, /^engine\/giac\/build-wasm\.sh$/, /^engine\/qalc\/build-wasm\.sh dev$/, /^cd app$/,
      /refresh-factors\.mjs$/, /^npm run index$/, /npm run build$/, /^npx cap sync android$/,
    ];
    let last = -1;
    for (const re of order) {
      const i = at(bld, re);
      expect(i, `build: has no step ${re}`).toBeGreaterThan(last);
      last = i;
    }
  });

  it("the downloads sit outside the source tree, the same folder in prebuild and build (the scanned tree holds nothing downloaded)", () => {
    const dl = (steps: string[], v: string): string | undefined => steps.map((s) => new RegExp(`^export ${v}=(\\S+)$`).exec(s)?.[1]).find(Boolean);
    for (const v of ["N62_DL_DIR", "N62_QALC_DL_DIR"]) {
      expect(dl(pre, v), `prebuild exports ${v}`).toMatch(/^\/tmp\//);
      expect(dl(bld, v)).toBe(dl(pre, v));
    }
  });

  it("scandelete is exactly app/node_modules/ and scanignore keeps the tarball cap sync unpacks (A97f1: the scan flags 7 files there; cap sync needs the one)", () => {
    expect(list("scandelete")).toEqual(["app/node_modules/"]);
    expect(list("scanignore")).toContain("app/node_modules/@capacitor/cli/assets/capacitor-cordova-android-plugins.tar.gz");
    expect(readFileSync(join(repo, "android/capacitor.settings.gradle"), "utf8")).toContain("node_modules");
  });

  it("the fields stand in the order fdroid rewritemeta writes: sudo, gradle, prebuild, scanignore, scandelete, build", () => {
    const keys = readFileSync(join(repo, "fdroid/dev.n62.calc.yml"), "utf8").split("\n")
      .map((l) => /^ {4}(\w+):/.exec(l)?.[1])
      .filter((k): k is string => k !== undefined && ["sudo", "gradle", "prebuild", "scanignore", "scandelete", "build"].includes(k));
    expect(keys).toEqual(["sudo", "gradle", "prebuild", "scanignore", "scandelete", "build"]);
  });
});

describe("--fetch-only compiles nothing (A97)", () => {
  /** Runs a build script with fake curl/sha256sum (every download "succeeds") and fake compilers that log their calls. */
  function run(script: string, args: string[], emsdkSystem: boolean) {
    const dir = mkdtempSync(join(tmpdir(), "n62-a97-"));
    try {
      const bin = join(dir, "bin");
      spawnSync("mkdir", ["-p", bin]);
      const calls = join(dir, "calls.log");
      const fake = (name: string, body: string): void => {
        writeFileSync(join(bin, name), `#!/bin/bash\n${body}\n`);
        chmodSync(join(bin, name), 0o755);
      };
      for (const t of ["make", "emcc", "em++", "emconfigure", "emmake", "gcc", "g++", "patch", "tar", "xz"]) fake(t, `echo "${t} $*" >> "${calls}"; echo "emcc 3.1.69"`);
      // reads its input as the real one does: a fake that exits first leaves the script's `echo … | sha256sum -c -` a
      // SIGPIPE (141), which pipefail turns into "SHA-256 mismatch" whenever echo runs late (a loaded machine, run 891)
      fake("sha256sum", '[[ $# -eq 0 || " $* " == *" - "* ]] && cat >/dev/null; exit 0');
      // the .dsc must name the pin; any other download is a dummy file
      fake("curl", `out=""; url=""; while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift;; http*) url="$1";; esac; shift; done
case "$url" in *.dsc) printf 'Checksums-Sha256:\\n cdec29897d6a55f9e53f82285ffd85cd82bcaba0bd90a494f710be002bd73f57 1 giac_2.1.0-1.tar.gz\\n' > "$out";; *) echo x > "$out";; esac
echo "curl $url" >> "${calls}"`);
      const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`, N62_DL_DIR: join(dir, "dl"), N62_QALC_DL_DIR: join(dir, "qdl"),
        GIAC_BUILD_DIR: join(dir, "b"), GIAC_BUILD_OUT: join(dir, "o"), QALC_WORK: join(dir, "w"), NO_LOCK: "1", EMSDK_DIR: emsdkSystem ? "system" : join(dir, "no-emsdk") };
      delete env.EMSCRIPTEN_PKG_VERSION;
      const r = spawnSync("bash", [join(repo, script), ...args], { env, encoding: "utf8", timeout: 60000 });
      let log = "";
      try { log = readFileSync(calls, "utf8"); } catch { /* nothing ran */ }
      const made = (d: string): string[] => { try { return readdirSync(d); } catch { return []; } };
      return { status: r.status, err: r.stderr, log, built: [...made(join(dir, "b")), ...made(join(dir, "o")), ...made(join(dir, "w"))] };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const compilers = /^(make|emcc|em\+\+|emconfigure|emmake|gcc|g\+\+|patch|tar|xz) /m;

  it("giac: downloads, then stops: no compiler, make, unpack or patch, no build tree, no emsdk needed", () => {
    const r = run("engine/giac/build-wasm.sh", ["--fetch-only"], false);
    expect(r.status, r.err).toBe(0);
    expect(r.log).toContain("curl ");
    expect(r.log).not.toMatch(compilers);
    expect(r.built).toEqual([]);
  });

  it("qalc: downloads, then stops, in dev mode, the lock never taken", () => {
    const r = run("engine/qalc/build-wasm.sh", ["dev", "--fetch-only"], false);
    expect(r.status, r.err).toBe(0);
    expect(r.log).toContain("curl ");
    expect(r.log).not.toMatch(compilers);
    expect(r.built).toEqual([]);
  });

  it("control: without the option the same harness sees the compiler called", () => {
    const r = run("engine/giac/build-wasm.sh", [], true);
    expect(r.log).toMatch(compilers);
  });
});

describe("fdroid/SUBMIT.md (A98)", () => {
  const recipe = readFileSync(join(repo, "fdroid/dev.n62.calc.yml"), "utf8");
  const text = (): string => readFileSync(join(repo, "fdroid/SUBMIT.md"), "utf8");

  it("names the application id and the recipe's file, both read from the recipe", () => {
    const id = /^# DRAFT .*\((metadata\/([\w.]+)\.yml)\)/m.exec(recipe);
    expect(id, "the recipe's header names metadata/<id>.yml").not.toBeNull();
    const [, metadata, appId] = id as RegExpExecArray;
    expect(readFileSync(join(repo, `fdroid/${appId}.yml`), "utf8")).toBe(recipe);
    expect(text()).toContain(appId as string);
    expect(text()).toContain(metadata as string);
    expect(text()).toContain(`fdroid/${appId}.yml`);
  });

  it("names the tag the recipe builds, the size limit and the CI job that builds first", () => {
    const tag = /^\s+commit:\s*(\S+)\s*$/m.exec(recipe)?.[1];
    expect(tag).toMatch(/^v\d/);
    expect(text()).toContain(tag as string);
    expect(text()).toMatch(/30 MB/);
    expect(text()).toContain("fdroid build");
  });
});

describe("F-Droid recipe asks for Reproducible Builds (A138)", () => {
  const recipe = readFileSync(join(repo, "fdroid/dev.n62.calc.yml"), "utf8");
  const field = (k: string): string | undefined => new RegExp(`^${k}:[ \\t]*(\\S+)[ \\t]*$`, "m").exec(recipe)?.[1];

  it("AllowedAPKSigningKeys is the release certificate's SHA-256: lowercase hex, no colons", () => {
    const cert = readFileSync(join(repo, "android/release-cert.sha256"), "utf8").trim();
    expect(cert).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i);
    const key = field("AllowedAPKSigningKeys");
    expect(key, "no AllowedAPKSigningKeys in the recipe").toBeDefined();
    expect(key).toBe(cert.replaceAll(":", "").toLowerCase());
  });

  it("Binaries is the release APK under the SourceCode repository: releases/download/v%v/n62-%v.apk", () => {
    const source = field("SourceCode");
    expect(source, "no SourceCode in the recipe").toBeDefined();
    expect(field("Binaries"), "no Binaries in the recipe").toBe(`${source as string}/releases/download/v%v/n62-%v.apk`);
  });
});
