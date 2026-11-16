// SPDX-License-Identifier: GPL-3.0-or-later
// T5: merge the maps of one profile made in parallel on several emulators (each run with its own --out and --roots) into
// the main ui-map.json: the states get new ids after the main map's last one, their screenshots are copied under the new
// names, and every edge (from, to, back, close) is rewritten. A root already in the main map is replaced.
//   node test-device/uiwalk-merge.ts --profile phone --out ../tests/ui-walk <other out dir> [...]
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface State { id: string; key: string; root: string; shot: string; variant?: string; [k: string]: unknown }
interface Edge { from: string; to: string; back?: string; close?: string; [k: string]: unknown }
interface Profile { made: string; viewport: unknown; states: State[]; edges: Edge[] }
type Map_ = { profiles: Record<string, Profile> };

const arg = (n: string): string => {
  const i = process.argv.indexOf(`--${n}`);
  if (i < 0 || process.argv[i + 1] === undefined) throw new Error(`--${n} is needed`);
  return process.argv[i + 1] as string;
};
const PROFILE = arg("profile");
const OUT = resolve(arg("out"));
const others = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !all[i - 1]?.startsWith("--")).map((d) => resolve(d));
const file = join(OUT, "ui-map.json");
const main = JSON.parse(readFileSync(file, "utf8")) as Map_;
// a profile made wholly elsewhere (the tablet's own run) starts empty here
const into: Profile = main.profiles[PROFILE] ?? (main.profiles[PROFILE] = { made: new Date().toISOString(), viewport: null, states: [], edges: [] });
mkdirSync(join(OUT, "shots", PROFILE), { recursive: true });
let n = Math.max(0, ...into.states.map((s) => Number(s.id.slice(1))));
for (const dir of others) {
  const part = (JSON.parse(readFileSync(join(dir, "ui-map.json"), "utf8")) as Map_).profiles[PROFILE];
  if (!part) throw new Error(`no ${PROFILE} in ${dir}`);
  if (into.viewport === null) into.viewport = part.viewport;
  const roots = new Set(part.states.map((s) => s.root));
  const dropped = new Set(into.states.filter((s) => roots.has(s.root)).map((s) => s.id));
  into.states = into.states.filter((s) => !dropped.has(s.id));
  into.edges = into.edges.filter((e) => !dropped.has(e.from));
  const id = new Map<string, string>();
  for (const s of part.states) {
    const nid = `${PROFILE[0]}${String(++n).padStart(3, "0")}`;
    id.set(s.id, nid);
    const ext = s.shot.slice(s.shot.lastIndexOf("."));
    const shot = `shots/${PROFILE}/${nid}${ext}`;
    if (existsSync(join(dir, s.shot))) copyFileSync(join(dir, s.shot), join(OUT, shot));
    into.states.push({ ...s, id: nid, shot, variant: s.variant ? id.get(s.variant) : undefined });
  }
  const re = (x: string | undefined): string | undefined => (x === undefined ? undefined : (id.get(x) ?? x));
  for (const e of part.edges) into.edges.push({ ...e, from: re(e.from) as string, to: re(e.to) as string, back: re(e.back), close: re(e.close) });
  console.log(`${dir}: ${part.states.length} states, ${part.edges.length} edges (roots ${[...roots].join(", ")})`);
}
writeFileSync(file, JSON.stringify(main));
console.log(`${PROFILE}: ${into.states.length} states, ${into.edges.length} edges`);
