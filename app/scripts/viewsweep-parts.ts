// SPDX-License-Identifier: GPL-3.0-or-later
// G188: the nightly view sweep in pieces, as the point sweep's (G167, sweep-parts.ts): `--part i/n` runs the i-th of n slices of the
// expressions in a fresh engine (each piece under `tools/devlock.sh slice`, at most 10 minutes) and writes its result to
// <dir>/viewsweep-part-<seed>-<count>-<i>of<n>.json; `--join` reads all n and prints the run's findings and summary line.
// A fault that builds up over one engine's calls (G94) shows only within a piece: the report says how many calls each engine made.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ViewSweepResult } from "../../tools/probes/sweep/viewrun.ts";

export interface ViewPartFile extends ViewSweepResult {
  seed: number;
  count: number;
  part: number;
  of: number;
  secs: number;
}

export const viewPartName = (seed: number, count: number, i: number, n: number): string => `viewsweep-part-${seed}-${count}-${i}of${n}.json`;

export function writeViewPart(dir: string, f: ViewPartFile): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, viewPartName(f.seed, f.count, f.part, f.of));
  writeFileSync(path, JSON.stringify(f));
  return path;
}

/** Every part of one seed and count (one n: the largest set written), or what is missing. */
export function readViewParts(dir: string, seed: number, count: number): { ok: true; files: ViewPartFile[] } | { ok: false; message: string } {
  const re = new RegExp(`^viewsweep-part-${seed}-${count}-(\\d+)of(\\d+)\\.json$`);
  const byN = new Map<number, Map<number, string>>();
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    const m = re.exec(f);
    if (!m) continue;
    const n = Number(m[2]);
    byN.set(n, (byN.get(n) ?? new Map<number, string>()).set(Number(m[1]), f));
  }
  if (byN.size === 0) return { ok: false, message: `no part files of seed ${seed}, count ${count} in ${dir}` };
  const n = Math.max(...byN.keys());
  const got = byN.get(n)!;
  const missing = Array.from({ length: n }, (_, k) => k + 1).filter((i) => !got.has(i));
  if (missing.length) return { ok: false, message: `seed ${seed}, count ${count}: parts ${missing.map((i) => `${i}/${n}`).join(", ")} missing in ${dir}` };
  return { ok: true, files: [...got.entries()].sort((a, b) => a[0] - b[0]).map(([, f]) => JSON.parse(readFileSync(join(dir, f), "utf8")) as ViewPartFile) };
}

/** The parts as one run: their findings in order, counts summed, the largest heap; `secs` is the sum of the pieces. */
export function joinViewParts(files: readonly ViewPartFile[]): ViewSweepResult & { secs: number } {
  return {
    failures: files.flatMap((f) => f.failures),
    compared: files.reduce((s, f) => s + f.compared, 0),
    cases: files.reduce((s, f) => s + f.cases, 0),
    restarts: files.reduce((s, f) => s + f.restarts, 0),
    maxHeap: Math.max(0, ...files.map((f) => f.maxHeap)),
    calls: files.reduce((s, f) => s + f.calls, 0),
    secs: files.reduce((s, f) => s + f.secs, 0),
  };
}
