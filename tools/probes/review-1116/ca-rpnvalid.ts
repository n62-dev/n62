// SPDX-License-Identifier: GPL-3.0-or-later
// ca hunter probe (night review 2026-11-16): the backup's `rpn` validator (state/backup.ts levelOk, VALIDATORS.rpn)
// against the reader the start runs (entry/rpnStore.ts readStack). backup.ts says its validators are "the check the app
// runs when it reads that key at start, made strict, so that a row or a field the start would drop is a fault (a restore
// never loses data silently)". Prints, per stored value, whether the restore check passes it and how many levels the
// start keeps of it.
// backup.ts cannot load under tsx (it imports keyboard.ts, which imports spec/keyboard.yaml through a Vite plugin), so
// the probe reads backup.ts's own source and runs its isObject, text and levelOk definitions and the rpn rule's body as
// written there (no copy kept here).
//   env -C <review>/app npx tsx <this file>
import { readFileSync } from "node:fs";
import { readStack } from "../../../app/src/entry/rpnStore.ts";
import { memKv } from "../../../app/src/sync/fakeFolder.ts";

const src = readFileSync(new URL("../../../app/src/state/backup.ts", import.meta.url), "utf8");
const grab = (re: RegExp): string => {
  const m = re.exec(src);
  if (!m) throw new Error(`not found in backup.ts: ${re}`);
  // strip the TypeScript annotations so the text runs as JavaScript
  return m[0].replace(/\): boolean =>/g, ") =>").replace(/\(([a-z]): unknown\)(: [a-z]+ is Record<string, unknown>)?/g, "($1)");
};
const defs = [grab(/^const isObject = [^\n]*/m), grab(/^const text = [^\n]*/m), grab(/^const levelOk = [\s\S]*?;\n/m)].join("\n");
const rule = /\n {2}rpn: \(v\) => ([^\n]*?), \/\/ R252/.exec(src)?.[1];
if (!rule) throw new Error("rpn rule not found");
const rpnOk = new Function("v", `${defs}\nreturn ${rule};`) as (v: unknown) => boolean;

const good = { uid: "u1", chip: { value: "2", exact: true }, shown: "2", inputs: [] as string[] };
const cases: [string, unknown][] = [
  ["control: one good level", { levels: [good] }],
  ["control: an empty uid (both refuse)", { levels: [{ ...good, uid: "" }] }],
  ["a chip without exact", { levels: [{ ...good, chip: { value: "2" } }] }],
  ["a chip whose value is a number", { levels: [{ ...good, chip: { value: 2, exact: true } }] }],
  ["an exact chip with a σ", { levels: [{ ...good, chip: { value: "2", exact: true, unc: "0.1" } }] }],
  ["an input key that is not ours", { levels: [{ ...good, inputs: ["bogus"] }] }],
  ["201 good levels (RPN_DEPTH 200)", { levels: Array.from({ length: 201 }, (_, i) => ({ ...good, uid: `u${i}` })) }],
];
async function main(): Promise<void> {
  console.log(`rpn rule: ${rule}`);
  for (const [name, v] of cases) {
    const kv = memKv();
    await kv.set("rpn", v);
    const kept = (await readStack(kv)).length;
    const stored = (v as { levels: unknown[] }).levels.length;
    const pass = rpnOk(v) === true;
    console.log(`${pass && kept < stored ? "LOSS" : "ok  "}  restore check ${pass ? "passes" : "refuses"}, start keeps ${kept} of ${stored}: ${name}`);
  }
}
void main();
