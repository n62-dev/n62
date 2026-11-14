// SPDX-License-Identifier: GPL-3.0-or-later
// R313 (night review 2026-11-14, the owner's answer 1; decisions.md P14): on a hardware keyboard, letters typed into a
// unit slot read as a unit, the way Find reads an exact symbol (units/slot.ts readSymbol): `km`, `psi`, `kWh`, with `*`
// and `/` between factors and `^2` for a power, as the pad builds them. The touch pad keeps P14's cells. This is the
// unit view's own first look at a hardware key (units/open.ts), before the keypad's path (entry/hwkeys.ts unitViewKey),
// and only with no sheet open (Find takes letters into its query, R303): a letter starts or extends the active slot's
// letter run (shown and read at every letter), ⌫ takes the run's last letter, Esc drops the run and leaves as ever, `^`
// and the digit after it (2, 3, 4, or -1) are the power, and any other key ends the run first: a run that reads as no
// unit refuses the key, and the message names its letters. A chord is never taken here. Loaded with the unit view.
import type { PadEmit } from "./pad.ts";
import { isLetters } from "./slot.ts";

/** What the typing needs of the view (units/view.ts UnitView). */
export interface TypedView {
  readonly typing: boolean;
  letter(ch: string): void;
  untype(): boolean;
  endRun(): boolean;
  dropRun(): void;
  apply(e: PadEmit): void;
}

/** The digits after `^` and the pad's power they press (² ³ ⁴, as the pad's ops cells). */
const POWERS: Readonly<Record<string, 2 | 3 | 4>> = { "2": 2, "3": 3, "4": 4 };
/** Keys that type nothing: they leave the run and a `^` as they are. */
const BARE = new Set(["Shift", "Control", "Alt", "AltGraph", "Meta", "CapsLock", "Tab"]);

export class HwTyping {
  readonly #view: TypedView;
  /** `^` was typed (and then `-`): the next digit is the power. */
  #caret: "" | "^" | "^-" = "";

  constructor(view: TypedView) {
    this.#view = view;
  }

  /** A keydown on the unit view with no sheet open: true when the typing took it (the caller stops it); false: the key
   *  goes the keypad's way (a letter run that reads as a unit has ended then). */
  key(ev: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "isComposing">): boolean {
    const k = ev.key;
    if (ev.isComposing || BARE.has(k) || ev.ctrlKey || ev.metaKey || ev.altKey) return false;
    const v = this.#view;
    const caret = this.#caret;
    this.#caret = "";
    if (caret === "^" && k === "-") this.#caret = "^-";
    else if (caret === "^" && POWERS[k] !== undefined) v.apply({ do: "power", n: POWERS[k] });
    else if (caret === "^-" && k === "1") v.apply({ do: "power", n: -1 });
    else if (caret && k === "Backspace") return true; // (the `^` taken back)
    else if (k.length === 1 && isLetters(k)) v.letter(k);
    else if (v.typing && k === "Backspace") v.untype();
    else if (v.typing && k === "Escape") {
      v.dropRun();
      return false;
    } else if (v.typing && !v.endRun()) return true;
    else if (k === "^") this.#caret = "^";
    else return false;
    return true;
  }
}
