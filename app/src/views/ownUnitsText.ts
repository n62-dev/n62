// SPDX-License-Identifier: GPL-3.0-or-later
// R201: the "Made of" line of the sheet that makes your own unit (Settings › Your keys › Your units), as text. What the entry
// line holds is MathLive's LaTeX (`kg\cdot m`, `\frac{m}{s^{2}}`): `unitFrom` turns it into plain text, `readOf` reads that
// text as a unit slot of Find ids with the unit view's own symbol reading (units/slot.ts readSymbol: km, kWh, psi; exact,
// as cased), and `ofText` writes a slot back as text. The grammar: factors with `*` or a space between, `^n` for a power
// (an integer, `-` allowed), one `/` to start what is below the ÷ (m/s^2, kg*m/s*s is kg·m ÷ (s·s)); `1/s` is s⁻¹. Plain
// TS, loaded with the sheet (ownUnitsSheet.svelte.ts), never in the start chunk.
import { readSymbol, type SlotCatalogue } from "../units/slot.ts";
import type { UnitSlot, UnitToken } from "../units/types.ts";

/** The entry line's LaTeX as the plain text `readOf` reads: a fraction is `a/b`, a dot or cross is `*`, a power is `^n`. */
export function unitFrom(latex: string): string {
  // (the dot first, a fraction's text would run into it; powers before the fractions: their parts then hold no braces)
  let s = latex.replace(/\\(?:cdot|times|ast)(?![A-Za-z])/g, "*").replace(/\^\{([^{}]*)\}/g, "^$1");
  for (let i = 0; i < 4; i++) s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2");
  return s
    .replace(/\\(?:text|mathrm|operatorname|mathit)\{([^}]*)\}/g, "$1")
    .replace(/\\mu(?![A-Za-z])/g, "u")
    .replace(/\\[ ,:;!]|~/g, " ")
    .replace(/\\([A-Za-z]+)/g, "$1")
    .replace(/[{}\\]/g, "")
    .replace(/\s+/g, " ")
    .replace(/ ?([*/]) ?/g, "$1")
    .trim();
}

export type OfRead = { ok: true; of: UnitSlot } | { ok: false; empty: true } | { ok: false; empty?: false; unit: string };

const isInt = (s: string): boolean => {
  const d = s.startsWith("-") ? s.slice(1) : s;
  return d.length > 0 && d.length < 4 && [...d].every((c) => c >= "0" && c <= "9");
};

/** How one symbol is read: readSymbol on the catalogue (G402: Find's query reads it case-folded after that). */
type Read = (sym: string) => ReturnType<typeof readSymbol>;

/** One side of the ÷: its factors as tokens, or the text that is no unit. */
function side(text: string, read: Read): UnitToken[] | string {
  const out: UnitToken[] = [];
  for (const word of text.split(/[*\s]+/).filter((w) => w !== "")) {
    const [sym = "", pow, ...more] = word.split("^");
    if (more.length > 0 || (pow !== undefined && (!isInt(pow) || Number(pow) === 0))) return word;
    const u = read(sym);
    if (!u) return sym;
    out.push({ ...(u.prefix !== undefined ? { prefix: u.prefix } : {}), unit: u.unit, ...(pow !== undefined && Number(pow) !== 1 ? { power: String(Number(pow)) } : {}) });
  }
  return out;
}

/** The text as a slot, or the first word that is no unit of Find's (or that nothing was typed). */
export function readOf(text: string, cat: SlotCatalogue, read: Read = (sym) => readSymbol(cat, sym)): OfRead {
  const [top = "", ...rest] = text.split("/");
  const up = side(top.trim() === "1" ? "" : top, read);
  if (typeof up === "string") return { ok: false, unit: up };
  const down = side(rest.join(" "), read);
  if (typeof down === "string") return { ok: false, unit: down };
  if (up.length === 0) {
    if (down.length === 0) return { ok: false, empty: true };
    // 1/s: no ÷ to hold, the powers turn
    return { ok: true, of: { tokens: down.map((t) => ({ ...t, power: String(-Number(t.power ?? "1")) })) } };
  }
  return { ok: true, of: down.length === 0 ? { tokens: up } : { tokens: [...up, ...down], per: up.length } };
}

const tokenText = (t: UnitToken): string => `${t.prefix ?? ""}${t.unit}${t.power !== undefined && t.power !== "1" ? `^${t.power}` : ""}`;

/** A slot as the text `readOf` reads back (the ids of Find: km is `k` and `m`; `m/s^2`). */
export function ofText(of: UnitSlot): string {
  const per = of.per ?? of.tokens.length;
  const top = of.tokens.slice(0, per).map(tokenText).join("*");
  const down = of.tokens.slice(per).map(tokenText).join("*");
  return down === "" ? top : `${top}/${down}`;
}
