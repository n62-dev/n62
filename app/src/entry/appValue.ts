// SPDX-License-Identifier: GPL-3.0-or-later
// R747: a constant on an app's line (Solve, Function) goes in as its value, never as a `\const` chip: an app stores its
// line as text and parses it without the line's chip table, so a chip there could not be valued (docs/04 3.6). The
// rules are here, loaded with the field (entry/field.ts), so the start chunk holds only the hook that names the line.
import type { ActionBody } from "../keyboard/keyboard.ts";
import { constKey, type ChipTable } from "../input/chips.ts";
import { numText } from "../i18n/enNum.ts";

/** The shell, as far as the line's rules read it (main.ts hands the AppShell over): the open app's view says which line this
 *  is (Symb's expression line, Num's number line); no app: Home and CAS, where chips are welcome. */
export interface Where {
  readonly app: string | null;
  readonly view: string;
  readonly clip?: { say(note: string): void } | undefined;
}
type Kind = "expr" | "num";
const kindOf = (w: Where | undefined): Kind | undefined => (w?.app ? (w.view === "num" ? "num" : "expr") : undefined);
/** Which line this is: an app's expression line, its number line, or (undefined) Home's and CAS's. */
export const lineKind = kindOf;

/** A chip's macro in a line's LaTeX (`\const{..}`, `\res{..}`, `\ans`). */
export const hasChipLatex = (latex: string): boolean => /\\(?:const|res|ans)(?![A-Za-z])/.test(latex);

const DECIMAL = /^([+-]?\d+(?:\.\d+)?)(?:[eE]([+-]?\d+))?$/;

/** A constant's value as an app's line takes it, every digit as the chip holds it. On an expression line one term: with an
 *  exponent it is bracketed (`\left(6.6743\times10^{-11}\right)`), as is a signed one (`\left(-2.5\right)`); on a number line (Num) it is the number as the exponent
 *  key types it (`6.6743\emark-11`), which the line reads as a plain number. A value that is no plain decimal (a user key's
 *  own text) goes in as written, bracketed on an expression line. */
export function constValueLatex(value: string, kind: Kind): string {
  const v = value.trim();
  const m = DECIMAL.exec(v);
  if (!m) return kind === "expr" ? `\\left(${v}\\right)` : v;
  const mant = m[1] as string;
  const exp = m[2] === undefined ? undefined : String(Number(m[2]));
  if (exp === undefined || exp === "0") return kind === "expr" && /^[+-]/.test(mant) ? `\\left(${mant}\\right)` : mant; // a sign is no part of a term: x^{-2.5}, never x^-2.5
  return kind === "num" ? `${mant}\\emark${exp}` : `\\left(${mant}\\times10^{${exp}}\\right)`;
}

let told = false;
/** The note, once: a constant went on an app's line as its value. */
function tell(w: Where | undefined): void {
  if (!told) w?.clip?.say(numText("app.constValue"));
  told = true;
}

/** What an app's line takes of `latex`: each `\const{id}{symbol}` as the value `table` holds for it, and nothing else of a
 *  chip's kind (a `\const` the table has no value for, `\res`, `\ans`): then undefined. Home and CAS: `latex` as it is. */
export function appText(latex: string, w: Where | undefined, table: ChipTable): string | undefined {
  const kind = kindOf(w);
  if (!kind) return latex;
  let out = "";
  let i = 0;
  let valued = false;
  for (let j = latex.indexOf("\\const{"); j >= 0; j = latex.indexOf("\\const{", i)) {
    const chip = table[constKey(latex.slice(j + 7, latex.indexOf("}", j)))];
    let k = latex.indexOf("}", j) + 1; // the symbol's group follows, braces in it paired
    let depth = 0;
    do depth += latex[k] === "{" ? 1 : latex[k] === "}" ? -1 : 0;
    while (depth > 0 && ++k < latex.length);
    if (!chip || latex[latex.indexOf("}", j) + 1] !== "{") return undefined;
    out += latex.slice(i, j) + constValueLatex(chip.value, kind);
    i = k + 1;
    valued = true;
  }
  out += latex.slice(i);
  if (hasChipLatex(out)) return undefined;
  if (valued) tell(w); // (only for a line that goes in: a refused one says nothing and keeps the note)
  return out;
}

/** A key's action on an app's line: a constant on a free key (R4b) types its value, any other chip is refused (undefined). */
export function appAction(a: ActionBody, w: Where | undefined): ActionBody | undefined {
  const kind = kindOf(w);
  if (!kind || a.kind !== "insert") return a;
  if (a.chip) {
    tell(w);
    return { kind: "insert", latex: constValueLatex(a.chip.chip.value, kind) };
  }
  return hasChipLatex(a.latex) ? undefined : a;
}
