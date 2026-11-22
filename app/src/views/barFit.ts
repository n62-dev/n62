// SPDX-License-Identifier: GPL-3.0-or-later
// R703 (F383): the bar's text under the Android WebView's text zoom. The bar keeps its 28 px and its controls their widths
// (docs/03 rule 9, R782: nothing moves under the finger); the text inside them shrinks to fit, the format and digits chip
// first (it is the one control whose width follows its text), then each fixed control's own text. A place tab's name is never
// shrunk or cut: where it does not fit, the tab shows its glyph only, its box unchanged (owner, 2026-11-22, R856). Without a
// zoom nothing is written: the CSS sizes fit (fontscale.spec.ts).
import { textZoom } from "../keyboard/fit.ts";

/** A text that does not fit at its floor ends in … (`data-cut`, a rule this chunk adds once), inside its box; its whole text
 *  stays in the DOM for the screen reader. `false` takes it back. */
export function cut(el: HTMLElement, on: boolean): void {
  el.toggleAttribute("data-cut", on);
  const doc = el.ownerDocument;
  if (on && !doc.getElementById("n62-cut")) {
    const style = doc.createElement("style");
    style.id = "n62-cut";
    style.textContent = "[data-cut]{max-width:100%;overflow:hidden;text-overflow:ellipsis}";
    doc.head.append(style);
  }
}

/** Smallest drawn size (px) of the bar's text; below it the text is ellipsed (its control keeps its name for the screen reader). */
export const MIN_BAR_PX = 8;
/** A text passes its box when its extent is over this many times the box (half a pixel in the bar's 28); the fit's rounds. */
const SLACK = 1.005;
const ROUNDS = 4;

/** The fixed controls and the text in each that shrinks (a control and its text may be one element). */
const FIXED: [box: string, text: string][] = [
  [".tile.math", ""],
  [".place", ".caret"],
  [".modes .angle", ""],
  [".menubtn", ""],
  ["button.mod", ""],
];

const size = (el: HTMLElement): number => parseFloat(getComputedStyle(el).fontSize);
/** How far a box's content passes it (1: it fits): the drawn extent of what it holds (a range: a centred overflow passes both
 *  edges, which scrollWidth counts only one of) against its inner box. */
function over(box: HTMLElement): number {
  if (box.clientWidth === 0 || box.clientHeight === 0) return 1;
  const range = box.ownerDocument.createRange();
  range.selectNodeContents(box);
  const r = range.getBoundingClientRect();
  return Math.max(r.width / box.clientWidth, r.height / box.clientHeight, 1);
}

/** Shrink `text` by `f` (a drawn size, through the zoom), down to the floor; ellipsed below it. */
function shrink(text: HTMLElement, f: number, z: number): void {
  const next = Math.floor(size(text) * f * 10) / 10;
  text.style.fontSize = `${Math.max(MIN_BAR_PX, next) / z}px`;
  if (next < MIN_BAR_PX) cut(text, true);
}

export function fitBar(bar: HTMLElement): void {
  const chip = bar.querySelector<HTMLElement>("[data-testid='chip-format']");
  const pairs = FIXED.flatMap(([b, t]) =>
    [...bar.querySelectorAll<HTMLElement>(b)].map((box) => ({ box, text: t ? box.querySelector<HTMLElement>(t) : box })),
  ).filter((p): p is { box: HTMLElement; text: HTMLElement } => p.text !== null);
  for (const el of [chip, ...pairs.map((p) => p.text)])
    if (el?.style.fontSize) {
      el.style.fontSize = "";
      cut(el, false);
    }
  const names = [...bar.querySelectorAll<HTMLElement>(".ptab .nm")];
  for (const nm of names) nm.hidden = false;
  const z = textZoom(bar.ownerDocument);
  if (z === 1) return;
  // R856: a tab whose name does not fit shows its glyph only (the name stays its aria-label), never a shrunk name or "Ho…"
  const wide = names.filter((nm) => nm.scrollWidth > nm.clientWidth + 0.5);
  for (const nm of wide) nm.hidden = true;
  // rounds until nothing passes its box (R703f1: two rounds at 1 % left ☰ and π 0.4 px over at 2.0): a part that does not scale
  // with the text (a chip's padding, the tile beside ▾) leaves it a little wide, each round reads it again
  for (let round = 0; round < ROUNDS; round++) {
    let moved = false;
    // the chip: the bar's overflow and its own height come out of its text
    if (chip && bar.clientWidth > 0) {
      const extra = bar.scrollWidth - bar.clientWidth;
      const f = Math.min(extra > 0.5 && chip.scrollWidth > 0 ? 1 - (extra + 1) / chip.scrollWidth : 1, 1 / over(chip));
      if (f < 1) {
        shrink(chip, f, z);
        moved = true;
      }
    }
    const reads = pairs.map((p) => ({ ...p, o: over(p.box) }));
    for (const r of reads)
      if (r.o > SLACK) {
        shrink(r.text, 0.995 / r.o, z);
        moved = true;
      }
    if (!moved) return;
  }
  // R703f1: what still passes its box sits at a floor, ours or the WebView's own minimum font size (8 CSS px before the zoom, so
  // 16 px drawn at font scale 2.0: a size written under it is drawn at it): it ends in …
  if (chip && over(chip) > SLACK) cut(chip, true);
  for (const p of pairs) if (over(p.box) > SLACK) cut(p.text, true);
}
