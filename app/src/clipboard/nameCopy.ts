// SPDX-License-Identifier: GPL-3.0-or-later
// R815: a stored name's full value as Copy writes it (docs/04 2.6): what a tap, Enter or a hold on a Memory row, a hold on a Vars row and
// the Copy key copy. A variable is read back through the engine as Home reads it (every confirmed digit up to P, a list as `{…}`, a
// complex as `a+b*i`; its facts are the stored ones, so a float keeps only the digits that were confirmed) and written by the history's
// own copyFull; a name stored from the unit view keeps its σ and unit after the number (`v ± σ unit`, as that row copies). A function is
// its definition (`f(x)=x^2+1`). Loaded on the first copy (the clipboard code's chunk), never at start.
import { decimalFromString, toText } from "../engine/format.ts";
import { sigmaAlone } from "../render/sigmaForm.ts";
import { commaResult, drawnFormat } from "../state/displayMode.ts";
import { homeItem } from "../state/resultItem.ts";
import type { Session } from "../state/session.svelte.ts";
import { copyFull, copyNames, type CopySource, type NameSeen, type TextOptions } from "./text.ts";

/** A copy: the text, what the notice shows of the value as drawn (`shown`: the digits the sheet draws) and whether the text holds a
 *  name written as its letter (Paste refuses it, G784f1). */
export interface NameCopy {
  text: string;
  shown: string;
  named: boolean;
}

/** `f(x):=x^2+1` as `f(x)=x^2+1`: the definition as it reads, the stand-ins as their letters. A command without `:=` is copied as it is. */
export function definitionText(cmd: string): string {
  const i = cmd.indexOf(":=");
  const text = i < 0 ? cmd : `${cmd.slice(0, i)}=${cmd.slice(i + 2)}`;
  return copyNames(text).text;
}

/** The name `name` of the session as text, or undefined when it holds nothing to copy (not stored any more, an error on reading it). */
export async function nameCopy(session: Session, name: string, o: TextOptions): Promise<NameCopy | undefined> {
  const entry = (await session.calc.engine?.definitions())?.find((e) => e.kind !== "other" && e.name === name);
  if (!entry) return undefined;
  if (entry.kind === "fn") {
    const text = entry.cmds[0] === undefined ? undefined : definitionText(entry.cmds[0]);
    return text ? { text, shown: text, named: false } : undefined;
  }
  if (entry.kind !== "var") return undefined;
  const r = await session.calc.home(name, session.settings);
  if (!r.ok) return undefined;
  // a name stored from the unit view: σ and unit after the value, as the unit row's copy has them (the σ in the facts it was stored with)
  const unit = entry.unit?.text;
  const sv = unit === undefined || entry.facts?.uncSigma === undefined ? null : decimalFromString(entry.facts.uncSigma);
  const drawn = sv && sigmaAlone(sv, drawnFormat({}, undefined, session.settings));
  const sigma = drawn ? (o.decimalComma ? commaResult(toText(drawn), false) : toText(drawn)) : null; // (2 digits, the form the unit view's row draws σ in)
  const units = unit === undefined ? undefined : { text: `${sigma === null ? "" : ` ± ${sigma}`} ${unit}` };
  const src: CopySource = { latex: name, status: "done", text: r.display, ...homeItem(r, false), ...(units ? { units } : {}) };
  const seen: NameSeen = { name: false };
  const text = copyFull(src, o, seen);
  return text === undefined || text === "" ? undefined : { text, shown: r.display, named: seen.name };
}
