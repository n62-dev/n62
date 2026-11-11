// SPDX-License-Identifier: GPL-3.0-or-later
// A21: the Find index is built from find/factors.yaml with no qalc build (QALC_OUT unset), and its bytes are the ones
// the qalc build gave before (hash pinned from phase-1 at bf54f3d). Needs the Giac and libqalculate tarballs (names and
// titles come from the XML in the latter); skipped without them unless FIND_INDEX=required.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { explicitProblems } from "../../../tools/find-index/units-items.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const giac = join(process.env.N62_DL_DIR ?? join(repo, "engine/giac/_downloads"), "giac_2.1.0-1.tar.gz"); // G77: the pin (build-wasm.sh)
const qalc = join(process.env.N62_QALC_DL_DIR ?? join(repo, "engine/qalc/_downloads"), "libqalculate-5.13.1.tar.gz");
const have = existsSync(giac) && existsSync(qalc);
const required = process.env.FIND_INDEX === "required";

const INDEX_SHA256 = "b7ee6258a562b23694325146ffdca13a17d08d2002e90c69b63cc45c6f0a6ccc"; // G230: `where` on the 25 functions a key or palette cell inserts (before it 1a27c672…); G161: VA, kVA, MVA, var, kvar, Mvar (before it fa87cda8…); G155: the sem row (before it ccd54489…); G111: 167 more Giac entries left out (graphics, graphs, strings, debugger); before them G80's f9602d6b…, the G67 bytes 9807d9e1…

describe("factors.yaml", () => {
  it("exists", () => {
    expect(existsSync(join(repo, "find/factors.yaml"))).toBe(true);
  });
  it("G321: a bare id is the metric or international unit, a US measure carries _US (find/units.yaml explicit)", () => {
    const read = (f: string): Record<string, unknown> => parse(readFileSync(join(repo, f), "utf8")) as Record<string, unknown>;
    const units = read("find/factors.yaml")["units"] as Record<string, { si?: string }>;
    const rule = read("find/units.yaml")["explicit"] as { suffix: string; except: string[] };
    expect(rule.suffix).toBe("_US");
    expect(rule.except).toEqual(["bbl"]);
    expect(explicitProblems(units, rule)).toEqual([]);
    // the rule reads the factor: the US gallon, the dry bushel, mpg and the 100 lb hundredweight are caught under any id
    const probe = { a: { si: "473176473/125000000000" }, b: { si: "220244188543/6250000000000" }, c: { si: "48000000000/112903" }, d: { si: "45359237/1000000" }, e: { si: "454609/100000000" }, bbl: { si: "9936705933/62500000000" } };
    expect(explicitProblems(probe, rule)).toEqual(["a (473176473/125000000000)", "b (220244188543/6250000000000)", "c (48000000000/112903)", "d (45359237/1000000)"]);
  });
  it.skipIf(!have && !required)("builds the Find index byte for byte without the qalc build", { timeout: 120_000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "factors-"));
    try {
      const out = join(dir, "find-index.json");
      const env = { ...process.env };
      delete env.QALC_OUT;
      execFileSync("node", [join(repo, "tools/find-index/generate.mjs"), "--out", out], { env, stdio: "pipe" });
      expect(createHash("sha256").update(readFileSync(out)).digest("hex")).toBe(INDEX_SHA256);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
