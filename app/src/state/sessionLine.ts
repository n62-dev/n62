// SPDX-License-Identifier: GPL-3.0-or-later
// G210: one result as one JSON line, the session format (v0, a preview: no reader has used it yet). Pure, no runes, a
// type-only import of the session (units/row.ts says why); a lazy module, imported by nothing in the start chunk.
//
// The format (docs/04 2.6): one line per result, UTF-8, each ending in `\n`; appended, never edited. A reader skips a
// torn last line (a crash can leave one), ignores a field it does not know and does not rely on the order of fields; any
// field can be absent or `null`. A repeated `id` that is not `null` (delivery is at least once, G219): the last one wins.
// `gap: n` on a line says n earlier lines were dropped before it (G219). The fields, in the order written:
//   v        0 until a release says the format is kept; from 1 on it rises only when an existing field's meaning changes
//   app      the app's version: `input` and `giac` are N62's own texts (`\res{7}{…}`, `pasr_7`, `pasdeg`, `e_`), read as
//            that version reads them
//   id       the row's uid (G211), the same across runs and store round trips; null for a row without one
//   t        when the line was written, UTC, ISO 8601 ending in `Z`
//   view     `home` or `cas`
//   input    the entry as MathLive LaTeX
//   giac     the Giac text the entry was sent as; null when the row does not keep it
//   chips    each chip key of the row's table (`res:7`, `const:c`): the value it held and whether it was exact.
//            `\res{k}` in `input` and `pasr_<k>` in `giac` name the entry `res:k` of the same line, never another
//            line. Absent without a table. Ans is not kept (resolved at Enter), so a line with `\ans` has no value for it
//   ok       the row finished with a result
//   error    the error's text, when the row ended in one
//   exact    the exact text (Giac's), when the row has one. Like `giac` it is Giac's text and always read in radians,
//            whatever `angle` says: a DEG row `\sin(x)` has `exact` sin(pi*x/180) and `value` sin(x) (G46f1)
//   value    the value as Copy writes it (every confirmed digit up to 40, docs/04 2.6), always with `.`; the number alone
//            (a unit row's σ and unit are in their fields)
//   mark     `=`, `≈` or `⚠`: the mark of the row at its digits, as Copy reads it
//   warn     `unaudited` or `unchecked`: why a ⚠ although the digits agree
//   reliableDigits  the digits the agreement check confirmed; null: none in doubt (absent: the row has no facts)
//   unit, dim, sigma, sigmaWhy  a unit-view row's unit, dimension key, σ (2 digits, in `unit`) and why σ has ⚠
//   angle    `rad` or `deg`, the angle mode the row was worked out in; null when the row does not keep it. It applies
//            to `input` and `value` only, never to `giac` or `exact` (radians)
//   digits   the digits setting of the row; null when the row does not keep it
//   defs     the stored values the input read: name, preview, the view that stored it
import { DECIMAL_KEEP } from "../engine/format.ts";
import { copyFull, copyMark, type CopySource } from "../clipboard/text.ts";
import { markFor, modeOf, type DisplayContext } from "./displayMode.ts";
import type { HistoryItem } from "./session.svelte.ts";

/** The format's version (see the header): 0, a preview. */
export const SESSION_LINE_VERSION = 0;

export interface LineOptions {
  /** When the line is written. */
  t: Date;
  /** The app's version (package.json). */
  app: string;
}

const str = (x: unknown): string | undefined => (typeof x === "string" ? x : undefined);

/** The display settings the row's mark is read at: its own digits and angle; the digits the value is written with
 *  when the row keeps none (the engine's own `facts.digits` comes first in markFor). Format: the row's own, else STD. */
function rowContext(i: HistoryItem): DisplayContext {
  const rd = i.facts?.reliableDigits;
  const own = rd === null || rd === undefined ? DECIMAL_KEEP : Math.max(1, Math.min(rd, DECIMAL_KEEP));
  return { format: "std", digits: i.digits ?? own, fixDecimals: 4, angle: i.angle ?? "rad" };
}

/** The row's mark: Copy's (copyMark) for a number; for a result without one, its facts' (a float in it: ≈ or ⚠), else
 *  `=` for an exact text, `≈` when an inexact chip went in. */
function markOfRow(i: HistoryItem): string {
  const ctx = rowContext(i);
  const m = i.value ? copyMark(i, ctx) : markFor(i, modeOf(i, ctx), ctx);
  if (m) return m.mark;
  return i.inexactInput || i.approximate ? "≈" : "=";
}

/** One result as one line of the session format (v0), without its `\n`; undefined for a row that is no result
 *  (pending, a note). */
export function sessionLine(item: HistoryItem, o: LineOptions): string | undefined {
  if (item.status === "pending" || item.status === "note") return undefined;
  const done = item.status === "done";
  const u = item.units as { unit?: unknown; dim?: unknown; unc?: { text?: unknown; why?: unknown } } | undefined; // read back unchecked
  const chips = item.chips ? Object.fromEntries(Object.entries(item.chips).map(([k, c]) => [k, { value: c.value, exact: c.exact }])) : undefined;
  const src: CopySource = { ...item, units: undefined };
  const line = {
    v: SESSION_LINE_VERSION,
    app: o.app,
    id: item.uid ?? null,
    t: o.t.toISOString(),
    view: item.view,
    input: item.latex,
    giac: item.giac ?? null,
    chips,
    ok: done,
    error: done ? undefined : item.text,
    exact: done && item.fullExact ? item.full : undefined,
    value: done ? copyFull(src) : undefined,
    mark: done ? markOfRow(item) : undefined,
    warn: done ? item.facts?.warn : undefined,
    reliableDigits: done ? item.facts?.reliableDigits : undefined,
    unit: str(u?.unit),
    dim: str(u?.dim),
    sigma: str(u?.unc?.text),
    sigmaWhy: str(u?.unc?.why),
    angle: item.angle ?? null,
    digits: item.digits ?? null,
    defs: item.uses?.length ? item.uses.map((d) => ({ name: d.name, preview: d.preview, view: d.view })) : undefined,
  };
  return JSON.stringify(line);
}
