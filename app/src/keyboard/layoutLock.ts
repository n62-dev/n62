// SPDX-License-Identifier: GPL-3.0-or-later
// R291, the layout lock (docs/06 section 3b): what spec/layout-lock.yaml pins and how a test compares it with the layout as
// the code builds it. Not imported by the app: only layoutLock.test.ts reads it.
//
// A lock is a set of sections, each a map slot → value, plus the owner's moves:
//   layers:   `<key id>.<layer>` → `<kind> <name>` for every live key layer (`reserved` for a cell blank on purpose)
//   <list>:   a numbered list's digit → the id of its fixed row (a palette: `row,col` → the cell's id)
// A live pinned line is never edited or deleted. A reserved line may turn into a live one (the fill), and a line may be
// appended after a list's last fixed row. Everything else is a move: a line under `moves:` with the owner's decision.
import { execFileSync } from "node:child_process";
import { parse } from "yaml";
import type { ActionBody, Key, Keyboard, Layer, Palette } from "./keyboard.ts";

export const RESERVED = "reserved";
export type Section = Readonly<Record<string, string>>;
export type Pins = Readonly<Record<string, Section>>;
/** One owner-approved change to a pinned line: `entry` is `<section>/<slot>`, `to` is `reserved` for a removal. */
export interface Move {
  readonly entry: string;
  readonly from: string;
  readonly to: string;
  readonly version: string;
  readonly decision: string;
}
export interface Lock {
  readonly pins: Pins;
  readonly moves: readonly Move[];
}

const LAYERS: readonly Layer[] = ["primary", "shift", "alpha"];

/** An action as one line: its kind and name (`special menu`, `type 7`, `insert \sin…`), the one-line form after ` | line `. */
export function actionLine(a: ActionBody & { readonly line?: ActionBody }): string {
  const body = (b: ActionBody): string => `${b.kind} ${b.kind === "type" ? b.text : b.kind === "insert" ? b.latex : b.name}`;
  return a.line ? `${body(a)} | line ${body(a.line)}` : body(a);
}

/** The live layers of the keys, `<id>.<layer>` → action line. A layer made dead on purpose (`special none`) is not live. */
export function layerPins(kb: Keyboard): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of kb.keys as readonly Key[]) {
    for (const layer of LAYERS) {
      const a = k.actions[layer];
      if (a === undefined || (a.kind === "special" && a.name === "none")) continue;
      out[`${k.id}.${layer}`] = actionLine(a);
    }
  }
  return out;
}

/** A palette's cells, `row,col` → id, in reading order. */
export function paletteSlots(p: Palette): Record<string, string> {
  return Object.fromEntries(p.items.map((i) => [`${i.row},${i.col}`, i.id]));
}

/** A numbered list's rows, `1…n` → id. */
export function listSlots(ids: readonly string[]): Record<string, string> {
  return Object.fromEntries(ids.map((id, i) => [String(i + 1), id]));
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads a lock file; throws with the place of a malformed line. Keys and values are read as strings. */
export function parseLock(text: string, where = "layout-lock.yaml"): Lock {
  const doc: unknown = parse(text);
  if (!isObj(doc) || doc["schema"] !== 1) throw new Error(`${where}: schema must be 1`);
  const pins: Record<string, Record<string, string>> = {};
  for (const [name, v] of Object.entries(doc)) {
    if (name === "schema" || name === "moves") continue;
    if (!isObj(v)) throw new Error(`${where}: section '${name}' must be a mapping`);
    pins[name] = Object.fromEntries(Object.entries(v).map(([slot, val]) => [slot, String(val)]));
  }
  const moves: Move[] = [];
  const list = doc["moves"] ?? [];
  if (!Array.isArray(list)) throw new Error(`${where}: 'moves' must be a list`);
  for (const m of list as unknown[]) {
    if (!isObj(m)) throw new Error(`${where}: a move must be a mapping`);
    const f = (k: string): string => {
      const v = m[k];
      if (v === undefined || v === null || String(v) === "") throw new Error(`${where}: a move needs '${k}'`);
      return String(v);
    };
    moves.push({ entry: f("entry"), from: f("from"), to: f("to"), version: f("version"), decision: f("decision") });
  }
  return { pins, moves };
}

/** Whether a line of decisions.md opens with the bold title `decision` as a whole: after the two asterisks the title ends
 *  at `**` or `:**` or at the space before an opening bracket, never partway through a word. */
function isTitle(line: string, decision: string): boolean {
  const open = `**${decision}`;
  for (let i = line.indexOf(open); i >= 0; i = line.indexOf(open, i + 1)) {
    const rest = line.slice(i + open.length);
    if (rest.startsWith("**") || rest.startsWith(":**") || rest.startsWith(" (")) return true;
  }
  return false;
}

/** Whether a line of decisions.md is a heading that is `decision` as a whole: the text after the hashes and one space is
 *  the decision, or the decision, a space and an opening bracket. */
function isHeading(line: string, decision: string): boolean {
  const m = /^#+ (.*)$/.exec(line);
  return m !== null && ((m[1] as string) === decision || (m[1] as string).startsWith(`${decision} (`));
}

/** The lock's lines with its moves applied, in order. Problems: a move that does not fit the line it moves, or whose
 *  decision is not an entry of decisions.md. */
export function applyMoves(lock: Lock, decisions: string): { pins: Pins; problems: string[] } {
  const pins: Record<string, Record<string, string>> = Object.fromEntries(Object.entries(lock.pins).map(([k, v]) => [k, { ...v }]));
  const problems: string[] = [];
  for (const m of lock.moves) {
    const cut = m.entry.indexOf("/");
    const section = cut < 0 ? undefined : pins[m.entry.slice(0, cut)];
    const slot = m.entry.slice(cut + 1);
    const now = section?.[slot];
    if (section === undefined || now === undefined) problems.push(`move ${m.entry}: no such line in the lock`);
    else if (now !== m.from) problems.push(`move ${m.entry}: the line is "${now}", the move says "${m.from}"`);
    else section[slot] = m.to;
    if (!/^v?\d+\.\d+/.test(m.version)) problems.push(`move ${m.entry}: version "${m.version}" is no version`);
    const known = decisions.split("\n").some((l) => isTitle(l, m.decision) || isHeading(l, m.decision));
    if (!known) problems.push(`move ${m.entry}: decisions.md has no entry titled "${m.decision}"`);
  }
  return { pins, problems };
}

/** The lock against the layout as built: what is pinned must be there, in its place; what is live must be pinned. */
export function compareLayout(actual: Pins, lock: Lock, decisions: string): string[] {
  const { pins, problems } = applyMoves(lock, decisions);
  for (const name of new Set([...Object.keys(pins), ...Object.keys(actual)])) {
    const want = pins[name] ?? {};
    const have = actual[name] ?? {};
    for (const [slot, value] of Object.entries(want)) {
      const now = have[slot];
      if (value === RESERVED) {
        if (now !== undefined) problems.push(`${name}/${slot}: reserved in the lock but live ("${now}"): record the fill in the lock`);
        continue;
      }
      if (now === value) continue;
      // where a list row went (its id is unique; many layers share an action, so a layer gets no hint)
      const elsewhere = name === "layers" ? undefined : Object.entries(have).find(([, v]) => v === value)?.[0];
      if (now === undefined) problems.push(`${name}/${slot}: pinned "${value}" is gone${elsewhere ? ` (it has moved to ${elsewhere})` : ""}`);
      else problems.push(`${name}/${slot}: pinned "${value}", now "${now}"${elsewhere ? ` ("${value}" is at ${elsewhere})` : ""}`);
    }
    for (const [slot, now] of Object.entries(have)) if (want[slot] === undefined) problems.push(`${name}/${slot}: "${now}" is live but not in the lock`);
  }
  return problems;
}

/** The lock against the last release's: a live line pinned there stays as pinned, its moves stay as recorded (a
 *  reserved line may have turned live, lines may have been appended). */
export function compareToRelease(tag: string, released: Lock, now: Lock): string[] {
  const problems: string[] = [];
  for (const [name, section] of Object.entries(released.pins)) {
    for (const [slot, value] of Object.entries(section)) {
      if (value === RESERVED) continue;
      const here = now.pins[name]?.[slot];
      if (here !== value) problems.push(`${name}/${slot}: pinned "${value}" in ${tag}, ${here === undefined ? "missing" : `edited to "${here}"`} now`);
    }
  }
  released.moves.forEach((m, i) => {
    if (JSON.stringify(now.moves[i]) !== JSON.stringify(m)) problems.push(`move ${i + 1} (${m.entry}) of ${tag} is changed or missing`);
  });
  return problems;
}

/** The lock of the newest `v*` tag that holds it, by `git show`; null without git or such a tag. */
export function releaseLock(root: string, path: string): { tag: string; lock: Lock } | null {
  const git = (...args: string[]): string => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] });
  try {
    for (const tag of git("tag", "--list", "v*", "--sort=-v:refname").split("\n").filter(Boolean)) {
      try {
        return { tag, lock: parseLock(git("show", `${tag}:${path}`), `${tag}:${path}`) };
      } catch {
        // this tag has no lock (or an unreadable one): try the one before
      }
    }
  } catch {
    // no git here
  }
  return null;
}
