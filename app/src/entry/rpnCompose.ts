// SPDX-License-Identifier: GPL-3.0-or-later
// R251 (mh-D1, mh-D3): an RPN operation is one ordinary row. `compose` builds its LaTeX from `\res` chips of the
// operands, by the key's own template (spec/keyboard.yaml, never copied here, never its `line:` form); `applyOp` hands
// it to Session.submit, or, when an operand carries a unit, to the unit view's evaluation of that line (Home has no
// units, P8), and changes the stack only when that row is done with a chip. One evaluation path: Cancel, the marks, σ
// and the audit are the typed line's. UI-free and lazy, as entry/rpn.ts (R254 wires the keys and the real port).
import { resKey, type Chip, type ChipTable } from "../input/chips.ts";
import type { ActionBody, Layer } from "../keyboard/keyboard.ts";
import type { HistoryItem, Session } from "../state/session.svelte.ts";
import { resChip } from "./macros.ts";
import { arityOf, inputsOfAll, sameIdentity, sharesInput, type RpnLevel, type RpnStack } from "./rpn.ts";

/** The keys and layers whose template has a `#0` or `#@` slot but no stack effect (arity 0), each with its reason; the
 *  spec walk in rpnCompose.test.ts makes every new such key take a side (an arity in rpn.ts, or a line here). */
export const RPN_NOT_UNARY: Readonly<Record<string, string>> = {
  "frac.primary": "a b/c: a template typed into (its empty-line job is the form cycle)",
  "pow.shift": "ⁿ√: the index is a second slot (#?), typed",
  "paren.primary": "( ): a bracket around what is typed",
  "paren.shift": "∥: par() of a list typed into it",
  "d8.shift": "{ }: a list typed into it",
  "d5.shift": "[ ]: a matrix typed into it",
};

/** An operation's row: its line, the chips the line holds, and whether it goes to the unit view (`units`). */
export interface Composed {
  latex: string;
  chips: ChipTable;
  units: boolean;
}

/** Fill the action's template: `#@` and `#0` with `first` (the operand before the key), `#?` with `second`. One pass,
 *  so a shown value that holds `#` is never read as a slot. */
const fill = (t: string, first: string, second = ""): string => t.replace(/#[@0?]/g, (m) => (m === "#?" ? second : first));

/** The line of an operation of arity 2 (A op B) by the key's action: a typed or inserted operator goes between them; a
 *  template with `#@` and `#?` (÷, xʸ) takes A and B in those slots. Else null. */
function binary(a: ActionBody, A: string, B: string): string | null {
  if (a.kind === "type") return `${A}${a.text}${B}`;
  if (a.kind !== "insert") return null;
  const slots = a.latex.match(/#[@0?]/g) ?? [];
  if (slots.length === 0) return `${A}${a.latex}${B}`;
  return slots.length === 2 && slots.includes("#@") && slots.includes("#?") ? fill(a.latex, A, B) : null;
}

/** The line of an operation of arity 1 (op B): the one `#0` or `#@` slot of the key's template, no `#?`. Else null. */
function unary(a: ActionBody, B: string): string | null {
  if (a.kind !== "insert") return null;
  const slots = a.latex.match(/#[@0?]/g) ?? [];
  return slots.length === 1 && slots[0] !== "#?" ? fill(a.latex, B) : null;
}

/**
 * The row of the key's operation on `levels` (level 1 first): A is level 2 and B level 1 (`A op B`), or B alone. Each
 * distinct identity (uid and chip, R250) is one `\res` chip, numbered `res:1`, `res:2` in operand order (A first), so a
 * level and its `dup` are one key, one input. `action` is the key's action in that layer (the 2D form). null: the key
 * takes no levels (arity 0), the stack holds too few, or the action has no form for its arity.
 */
export function compose(levels: readonly RpnLevel[], keyId: string, layer: Layer, action: ActionBody): Composed | null {
  const n = arityOf(keyId, layer);
  if (n === 0 || levels.length < n) return null;
  const ops = levels.slice(0, n).reverse();
  const ids: RpnLevel[] = [];
  const chips: ChipTable = {};
  const chip = (l: RpnLevel): string => {
    let k = ids.findIndex((x) => sameIdentity(x, l)) + 1;
    if (k === 0) k = ids.push(l);
    chips[resKey(k)] = l.chip;
    return resChip(k, l.shown);
  };
  const parts = ops.map(chip);
  const latex = n === 2 ? binary(action, parts[0] as string, parts[1] as string) : unary(action, parts[0] as string);
  return latex === null ? null : { latex, chips, units: ops.some((l) => l.chip.unit !== undefined) };
}

/** What `applyOp` reaches the row and the stack through: Session's own parts, unchanged (R254 supplies the real port). */
export interface ComposePort {
  submit: Session["submit"];
  /** The same line in the unit view (docs/04 4.3; R115): the slot after each chip starts with its unit, a σ chip is
   *  `pasupm(value,σ,key)`. Answers as `submit` does: undefined when refused, else settles when the row is finished. */
  submitUnits(latex: string, chips: ChipTable): ReturnType<Session["submit"]>;
  /** The newest row of the view the operation runs in. */
  newest(): HistoryItem | undefined;
  chipFor: Session["chipFor"];
  /** The row's result as drawn, the LaTeX a tapped result's chip shows (App.svelte insertResult). */
  shownOf(item: HistoryItem): string;
}

/** How an operation ended. Only `done` changed the stack. `none`: the key takes no levels; `depth`: too few levels;
 *  `shared`: two operands rest on a common σ input (counted twice); `busy`: the row was refused; `error`, `cancelled`:
 *  the row's own end; `noChip`: the row is done but gives no chip; `moved`: the stack changed while the row ran. */
export type RpnAnswer = "done" | "none" | "depth" | "shared" | "busy" | "error" | "cancelled" | "noChip" | "moved";

/** Run the key's operation on the stack as one row: the operands leave the stack only when the row is done with a chip,
 *  for one level that rests on all their σ inputs. */
export async function applyOp(stack: RpnStack, port: ComposePort, keyId: string, layer: Layer, action: ActionBody): Promise<RpnAnswer> {
  const n = arityOf(keyId, layer);
  if (n === 0) return "none";
  const ops = stack.operands(n);
  if (!ops) return "depth";
  if (n === 2 && sharesInput(ops[0] as RpnLevel, ops[1] as RpnLevel)) return "shared";
  const c = compose(stack.levels, keyId, layer, action);
  if (!c) return "none";
  const before = port.newest();
  const job = c.units ? port.submitUnits(c.latex, c.chips) : port.submit(c.latex, undefined, c.chips);
  if (!job) return "busy";
  try {
    await job;
  } catch {
    return "error";
  }
  const row = port.newest();
  if (!row || row === before || row.status !== "done") return row && row !== before && row.status === "cancelled" ? "cancelled" : "error";
  const chip: Chip | undefined = port.chipFor(row);
  if (!chip) return "noChip";
  // the operands must still be the top levels, in place (the stack is the user's while the row runs)
  if (!ops.every((l, i) => stack.levels[n - 1 - i] === l)) return "moved";
  stack.applied(n, { uid: row.uid ?? `id-${row.id}`, chip, shown: port.shownOf(row), inputs: inputsOfAll(ops) });
  return "done";
}
