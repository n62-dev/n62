// SPDX-License-Identifier: GPL-3.0-or-later
// R870: Help in the unit view (units/open.ts, `unitPad.other`): a sheet "Help: <the slot as slotText writes it>" over the view, R838's
// path. A slot with units: a row per factor, R869's card value line of its Find item (views/helpCard.ts: "km · kilometre: 1 km =
// 1000 m", with "exact" or ≈), a prefixed pair Find does not hold (the reading marks it rare) as the prefix's row and the unit's row;
// last the whole slot in SI, the exact product of the factors with their powers (BigInt, π carried; no engine call), "1 km/h = 5/18
// m/s" with ≈ 12 digits, or "exact" when the decimal ends within 30 digits; an offset unit alone (°C) gives R869's offset line. A
// prefix armed alone: its row only. An empty slot: the units tip (the empty end slot: its reading's line first). Each row only informs.
// A chunk of its own, loaded by the first Help in the view.
import type { AppShell } from "../apps/shell.svelte.ts";
import type { MenuItem } from "../apps/types.ts";
import type { FindItem } from "../find/types.ts";
import { helpText as t } from "../i18n/enHelp.ts";
import { unitText } from "../i18n/enUnits.ts";
import { approx, exactDecimal, exactText, itemSymbol, one, prefixValue, unitValue, withPi } from "../views/helpCard.ts";
import { slotDim, slotText } from "./build.ts";
import { siUnit } from "./dims.ts";
import type { FactorTable } from "./factors.ts";
import { exactFactor, isPair, type Exact, type SlotCatalogue } from "./slot.ts";
import type { UnitSlot, UnitToken } from "./types.ts";

/** What Help reads of the slot (units/slot.ts SlotModel). */
export interface SlotState {
  readonly slot: UnitSlot;
  readonly armed: { prefix?: string; sqrt: boolean };
  readonly empty: boolean;
}

/** The index and the view's tables: Find's items by id (the rows), the slot catalogue (a pair Find holds) and the factor table; the
 *  units tip (`tips.units`, read by the caller from the tips' chunk, views/tipsHost.ts, where i18n/enTips.ts stays: in a second chunk
 *  it would split off and its name join the start chunk's preload list), needed only for an empty slot. */
export interface HelpSource {
  byId: ReadonlyMap<string, FindItem>;
  cat: SlotCatalogue;
  table: FactorTable;
  tip?: string;
}

/** The slot has nothing in it to explain: Help shows the units tip. */
export const wantsTip = (m: SlotState): boolean => !m.slot.tokens.length && m.armed.prefix === undefined;

/** The sheet: its title, and its rows or (an empty slot) its text. */
export interface SlotHelp {
  title: string;
  items: MenuItem[];
  text?: string;
}

const ONE: Exact = { n: 1n, d: 1n, pi: 0 };
const mul = (a: Exact, b: Exact): Exact => ({ n: a.n * b.n, d: a.d * b.d, pi: a.pi + b.pi });
const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

/** The integer q-th root of v ≥ 0 when it is exact, else undefined. */
function root(v: bigint, q: number): bigint | undefined {
  if (q === 1 || v < 2n) return v;
  const Q = BigInt(q);
  let x = 1n << BigInt(Math.ceil(v.toString(2).length / q)); // ≥ the root
  for (;;) {
    const y = ((Q - 1n) * x + v / x ** (Q - 1n)) / Q; // Newton, from above
    if (y >= x) break;
    x = y;
  }
  return x ** Q === v ? x : undefined;
}

/** x to the power p/q, exactly; undefined when the root is no fraction (√ of a factor that is no square). */
function power(x: Exact, text: string): Exact | undefined {
  const [ps, qs = "1"] = text.split("/");
  let p = Number(ps);
  const q = Number(qs);
  if (!Number.isInteger(p) || !Number.isInteger(q) || q < 1) return undefined;
  const g = gcd(x.n, x.d);
  let r: Exact = { n: x.n / g, d: x.d / g, pi: x.pi };
  if (q > 1) {
    const [n, d] = [root(r.n, q), root(r.d, q)];
    if (n === undefined || d === undefined || r.pi % q !== 0) return undefined;
    r = { n, d, pi: r.pi / q };
  }
  if (p < 0) [r, p] = [{ n: r.d, d: r.n, pi: -r.pi }, -p];
  let out = ONE;
  for (let i = 0; i < p; i++) out = mul(out, r);
  return out;
}

/** A unit's factor to SI: its `si`, the scale alone for °C and °F (as an interval, the way the evaluator reads it beside another unit). */
function unitFactor(si: string | undefined): Exact | undefined {
  if (si === undefined) return undefined;
  return exactFactor(si.split("+")[0] as string); // (as build.ts tokenGiac reads it: "1+5463/20" is K = 1·x + 5463/20)
}

/** A token's factor with its prefix and its power (negated below the ÷). */
function tokenFactor(t: UnitToken, below: boolean, table: FactorTable): Exact | undefined {
  let x = unitFactor(table.units.get(t.unit)?.si);
  if (x && t.prefix !== undefined) {
    const p = table.prefixes.get(t.prefix)?.si;
    const px = p === undefined ? undefined : exactFactor(p);
    x = px ? mul(x, px) : undefined;
  }
  const pw = t.power ?? "1";
  return x && power(x, below ? (pw.startsWith("-") ? pw.slice(1) : `-${pw}`) : pw);
}

/** The symbol and the first other name, as R869's names line starts ("km · kilometre"); no other name: the slot's words ("kg · kilogram"). */
function names(it: FindItem, words: string | undefined): string {
  const sym = itemSymbol(it);
  const other = it.names.find((n) => n !== sym && !n.includes("_")) ?? (words !== sym ? words : undefined);
  return other ? `${sym} · ${other}` : sym;
}

/** A unit's or a prefix's row: its names and its card value line, the line's hint kept; no item in Find: the id alone. */
function row(id: string, it: FindItem | undefined, words: string | undefined): MenuItem {
  if (!it) return { id, label: words ?? id, keep: true };
  const value = it.kind === "pfx" ? prefixValue(it) : unitValue(it, itemSymbol(it));
  const label = value ? t("unit.row", { names: names(it, words), value: value.label }) : names(it, words);
  return { id, label, keep: true, ...(value?.hint ? { hint: value.hint } : {}) };
}

/** The whole slot in SI: "1 km/h = 5/18 m/s" with "≈ 0.277777777778 m/s", or "exact"; undefined when a factor has no exact size. */
function total(slot: UnitSlot, title: string, src: HelpSource): MenuItem | undefined {
  const per = slot.per ?? slot.tokens.length;
  let x: Exact | undefined = ONE;
  slot.tokens.forEach((tk, i) => {
    const f = x && tokenFactor(tk, i >= per, src.table);
    x = f && x ? mul(x, f) : undefined;
  });
  if (!x) return undefined;
  const v: Exact = x;
  const si = siUnit(slotDim(slot, src.table)).text;
  const lhs = `${one(title)} = `;
  const out = (label: string, hint: string): MenuItem => ({ id: "total", label: label.trim(), hint: hint.trim(), keep: true });
  if (v.pi === 0) {
    const exact = exactDecimal(v.n, v.d);
    if (exact !== undefined) return out(`${lhs}${exact} ${si}`, t("card.exact"));
    const g = gcd(v.n, v.d);
    return out(`${lhs}${v.n / g}/${v.d / g} ${si}`, `≈ ${approx(v.n, v.d)} ${si}`);
  }
  const w = withPi(v);
  return out(`${lhs}${exactText(v)} ${si}`, `≈ ${approx(w.n, w.d)} ${si}`);
}

/** R870: the help of the active slot `m` (`end`: it is the end slot, "→ should be"). */
export function slotHelp(m: SlotState, end: boolean, src: HelpSource): SlotHelp {
  const { byId, cat, table } = src;
  const slot = m.slot;
  const armed = m.armed.prefix;
  const pfx = (id: string, rowId: string): MenuItem => row(rowId, byId.get(`pfx:${id}`), cat.prefixes.get(id)?.words);
  if (!slot.tokens.length) {
    if (armed !== undefined) return { title: t("title", { name: table.prefixes.get(armed)?.symbol ?? armed }), items: [pfx(armed, "armed")] };
    const tip = src.tip ?? "";
    return { title: t("title", { name: t("unit.empty") }), items: [], text: end && m.empty ? `${unitText("units.read.endEmpty")}\n\n${tip}` : tip };
  }
  const title = slotText(slot, table);
  const items: MenuItem[] = [];
  slot.tokens.forEach((tk, i) => {
    const unit = (id: string): MenuItem => row(`f${i}`, byId.get(`unit:${id}`), cat.units.get(id)?.words);
    if (tk.prefix === undefined) return void items.push(unit(tk.unit));
    const pair = cat.units.get(tk.prefix + tk.unit);
    // a pair Find holds is its own unit (km); one it does not (Ms, the reading marks it) is the prefix's row and the unit's
    if (pair && isPair(pair, cat.prefixes.get(tk.prefix), cat.units.get(tk.unit))) items.push(unit(tk.prefix + tk.unit));
    else items.push(pfx(tk.prefix, `p${i}`), unit(tk.unit));
  });
  if (armed !== undefined) items.push(pfx(armed, "armed"));
  // an offset unit alone (°C): its own line is the slot in SI
  const only = slot.tokens.length === 1 ? slot.tokens[0] : undefined;
  const offset = only && only.prefix === undefined && only.power === undefined && table.units.get(only.unit)?.si?.includes("+");
  const whole = offset ? offsetLine(byId.get(`unit:${only.unit}`)) : total(slot, title, src);
  if (whole) items.push(whole);
  return { title: t("title", { name: title }), items };
}

/** R869's offset line of °C or °F as the slot's last row. */
function offsetLine(it: FindItem | undefined): MenuItem | undefined {
  const v = it && unitValue(it, itemSymbol(it));
  return v && { ...v, id: "total" };
}

/** Open the help of the view's active slot over it (R838's path: a sheet the keys go to; Esc, Back, × or a second Help close it). */
export function showSlotHelp(shell: AppShell, help: SlotHelp): void {
  shell.showMenu(help.title, help.items, { remember: false, helpCloses: true, ...(help.text !== undefined ? { text: help.text } : {}) });
}
