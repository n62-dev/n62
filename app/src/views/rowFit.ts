// SPDX-License-Identifier: GPL-3.0-or-later
// R703 (F383): a sheet row's text under the Android WebView's text zoom. A row's label shares its line with the row's number,
// value and value buttons (Mode's `STD SCI ENG PFX`), which do not shrink, so at font scale 2.0 the label was cut to "Nu…".
// The row keeps its height and its 44 px targets; its texts shrink together until the label fits, down to the floor, and
// below it the label is ellipsed as before (its row keeps the whole name for the screen reader). Without a zoom nothing is
// written: a long name in a list ends in … by design (Find).
import { cut, textZoom } from "../keyboard/fit.ts";

/** Smallest drawn size (px) of a row's label, and of its other texts. */
export const MIN_LABEL_PX = 12;
export const MIN_ROW_TEXT_PX = 9;

const PARTS = ".label, .n, .opt, .value, .note";

export function fitRows(list: HTMLElement): void {
  const rows = [...list.querySelectorAll<HTMLElement>(".row")].map((row) => ({
    label: row.querySelector<HTMLElement>(".label"),
    parts: [...row.querySelectorAll<HTMLElement>(PARTS)],
  }));
  for (const r of rows)
    for (const el of r.parts)
      if (el.style.fontSize || el.hasAttribute("data-cut")) {
        el.style.fontSize = "";
        cut(el, false);
      }
  const z = textZoom(list.ownerDocument);
  if (z === 1) return;
  // three rounds of read all, write all: what the label lacks comes out of all the row's texts at once, in proportion to their
  // widths (a value button's padding and the row's gaps do not shrink, so a round leaves it a little short)
  for (let round = 0; round < 3; round++) {
    const reads = rows.flatMap((r) => {
      if (!r.label || r.label.clientWidth === 0) return [];
      const lack = r.label.scrollWidth - r.label.clientWidth;
      if (lack <= 1) return [];
      const sizes = r.parts.map((el) => ({ el, px: parseFloat(getComputedStyle(el).fontSize) }));
      const total = r.parts.reduce((w, el) => w + el.scrollWidth, 0);
      return [{ label: r.label, sizes, f: total > 0 ? Math.max(0, 1 - (lack + 1) / total) : 0 }];
    });
    if (reads.length === 0) return;
    for (const { label, sizes, f } of reads)
      for (const { el, px } of sizes) {
        const floor = el === label ? MIN_LABEL_PX : MIN_ROW_TEXT_PX;
        const next = Math.max(floor, Math.floor(px * f * 10) / 10);
        el.style.fontSize = `${next / z}px`;
      }
  }
  // what still does not fit at the floor is ellipsed (the label's own CSS ends it in …); mark it, as the keys' are
  for (const r of rows) if (r.label && r.label.scrollWidth > r.label.clientWidth + 1) r.label.toggleAttribute("data-cut", true);
}
