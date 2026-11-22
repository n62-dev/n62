// SPDX-License-Identifier: GPL-3.0-or-later
// R703 (F383): the bar's text under the Android WebView's text zoom. The bar keeps its 28 px and its controls their widths
// (docs/03 rule 9, R782: nothing moves under the finger); the text inside them shrinks to fit, the format and digits chip
// first (it is the one control whose width follows its text), then each fixed control's own text. Without a zoom nothing is
// written: the CSS sizes fit (fontscale.spec.ts).
import { cut, textZoom } from "../keyboard/zoomFit.ts";

/** Smallest drawn size (px) of the bar's text; below it the text is ellipsed (its control keeps its name for the screen reader). */
export const MIN_BAR_PX = 8;

/** The fixed controls and the text in each that shrinks (a control and its text may be one element). */
const FIXED: [box: string, text: string][] = [
  [".nm", ""],
  [".tile.math", ""],
  [".place", ".caret"],
  [".chip.angle", ".mark"],
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
  const z = textZoom(bar.ownerDocument);
  if (z === 1) return;
  // two rounds each: a part that does not scale with the text (a chip's padding, the tile beside ▾) leaves it a little wide
  for (let round = 0; round < 2; round++) {
    // the chip: the bar's overflow and its own height come out of its text
    if (chip && bar.clientWidth > 0) {
      const extra = bar.scrollWidth - bar.clientWidth;
      const f = Math.min(extra > 0.5 && chip.scrollWidth > 0 ? 1 - (extra + 1) / chip.scrollWidth : 1, 1 / over(chip));
      if (f < 1) shrink(chip, f, z);
    }
    const reads = pairs.map((p) => ({ ...p, o: over(p.box) }));
    for (const r of reads) if (r.o > 1.01) shrink(r.text, 1 / r.o, z);
  }
}
