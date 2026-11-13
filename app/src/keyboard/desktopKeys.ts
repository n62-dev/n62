// SPDX-License-Identifier: GPL-3.0-or-later
// R131: the desktop keys, spec/keyboard.yaml `desktop:`. Each key and layer of the keypad names the hardware key that
// presses it (a typed character, a chord such as Alt+S, or a KeyboardEvent.key name such as F1), or why it has none;
// `actions:` name the keys of the status line's controls and of results mode. entry/hwkeys.ts acts on the map, and
// Settings › Help and about lists it (views/aboutItems.ts). Its own lazy chunk (`keyboard.yaml?desktop`), loaded with
// MathLive: nothing here is in the start chunk.
import raw from "../../../spec/keyboard.yaml?desktop";
import type { Layer } from "./keyboard.ts";

export const LAYERS = ["primary", "shift", "alpha"] as const satisfies readonly Layer[];
/** What a desktop key presses: a keypad key in a layer, or an action no key holds. */
export type DeskTarget = { readonly key: string; readonly layer: Layer } | { readonly action: string };
/** One key and layer (or action) of the table: its desktop keys, or why it has none. */
export interface DeskEntry {
  readonly target: DeskTarget;
  readonly names: readonly string[];
  readonly why?: string;
}
export interface DesktopMap {
  readonly entries: readonly DeskEntry[];
  /** Each desktop key's target. */
  readonly byName: ReadonlyMap<string, DeskTarget>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const where = (t: DeskTarget): string => ("action" in t ? `actions.${t.action}` : `keys.${t.key}.${t.layer}`);

function names(v: unknown, at: string): { names: string[]; why?: string } {
  if (typeof v === "string" && v !== "") return { names: [v] };
  if (Array.isArray(v) && v.length > 0 && v.every((n) => typeof n === "string" && n !== "")) return { names: v as string[] };
  if (isObj(v) && typeof v["why"] === "string" && v["why"] !== "") return { names: [], why: v["why"] };
  throw new Error(`keyboard.yaml desktop.${at}: a key name, a list of them, or { why: … }`);
}

/** Read the `desktop:` section; throws on a malformed entry or on two that share a desktop key. */
export function readDesktop(doc: unknown): DesktopMap {
  if (!isObj(doc) || !isObj(doc["keys"]) || !isObj(doc["actions"])) throw new Error("keyboard.yaml desktop: needs 'keys' and 'actions'");
  const entries: DeskEntry[] = [];
  for (const [key, layers] of Object.entries(doc["keys"])) {
    if (!isObj(layers)) throw new Error(`keyboard.yaml desktop.keys.${key}: a mapping of layers`);
    for (const [layer, v] of Object.entries(layers)) {
      if (!(LAYERS as readonly string[]).includes(layer)) throw new Error(`keyboard.yaml desktop.keys.${key}: no layer '${layer}'`);
      entries.push({ target: { key, layer: layer as Layer }, ...names(v, `keys.${key}.${layer}`) });
    }
  }
  for (const [action, v] of Object.entries(doc["actions"])) entries.push({ target: { action }, ...names(v, `actions.${action}`) });
  const byName = new Map<string, DeskTarget>();
  for (const e of entries)
    for (const n of e.names) {
      const was = byName.get(n);
      if (was) throw new Error(`keyboard.yaml desktop: ${n} is both ${where(was)} and ${where(e.target)}; no two share a desktop key`);
      byName.set(n, e.target);
    }
  return { entries, byName };
}

/** The shipped table (in dev and tests the import is the whole file; in the build, `desktop` alone). */
export const desktop: DesktopMap = readDesktop((raw as { desktop?: unknown }).desktop);

/** The base of an Alt or Ctrl chord: a digit by its place (Alt + Shift + 1 is `!` on most layouts), a letter by the
 *  layout's letter, else by its place (a Mac's Option gives another character: Option + S is ß). */
function chordBase(ev: Pick<KeyboardEvent, "key" | "code">): string | undefined {
  const k = ev.key;
  if (k.length > 1 && k !== "Dead" && k !== "Unidentified") return k; // a named key: Alt+ArrowUp, Alt+Shift+Backspace
  const digit = /^Digit(\d)$/.exec(ev.code);
  if (digit) return digit[1];
  if (/^[a-z]$/i.test(k)) return k.toUpperCase();
  return /^Key([A-Z])$/.exec(ev.code)?.[1];
}

/** A keydown's name as the table writes it: a typed character (`Space` for the space bar), `Ctrl+…` (Cmd on a Mac) or
 *  `Alt+…` with `Shift+` when held, else the key's name with `Shift+` when held (Shift+Enter, F1). Undefined for Ctrl
 *  and Alt together (Windows' AltGr; the caller leaves AltGr's characters as typed). */
export function chordOf(ev: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): string | undefined {
  const ctrl = ev.ctrlKey || ev.metaKey;
  if (ctrl && ev.altKey) return undefined;
  if (ctrl || ev.altKey) {
    const base = chordBase(ev);
    return base === undefined ? undefined : `${ctrl ? "Ctrl" : "Alt"}+${ev.shiftKey ? "Shift+" : ""}${base}`;
  }
  if (ev.key.length === 1) return ev.key === " " ? "Space" : ev.key;
  return `${ev.shiftKey ? "Shift+" : ""}${ev.key}`;
}
