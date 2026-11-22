// SPDX-License-Identifier: GPL-3.0-or-later
// Keypad text never gets cut and never overlaps (docs/05 3.7, U0): every face and legend marked `data-fit` is
// shrunk until it fits its key. One rule for all keys and layers; no per-key sizes.

/** Smallest size (px, as drawn) a face or legend may shrink to. Text that still does not fit at this size is ellipsed (R703),
 *  its whole text kept in the DOM for the screen reader; at the font scales Android offers no key reaches it. */
export const MIN_FACE_PX = 9;
export const MIN_LEGEND_PX = 8;

/** A legend's font is at most this many times its line's height: the design's own largest ratio (11 px in the 10 px line of a short screen). */
const LEGEND_MAX_EM = 1.1;

/**
 * Fit the faces and legends of every key under `pad`. A face and each legend may use the key's width minus its side
 * padding, and (R41, the Android font scale) its own line: a face the room between the two legend lines of a key, a
 * legend its line's height, so a larger system font never makes a face rise into a legend or a legend overlap its face.
 * Passes, so the browser lays out as seldom as it can: reset with the faces shrunk to nothing and measure the room,
 * reset and measure the text, write. Every size is measured as drawn and written through the text zoom (R703); under a
 * zoom, a text the ▾ mark or the font's hinting keeps too wide is measured again and shrunk once more, and a text that
 * does not fit at the floor is ellipsed (`data-cut`), and the bar is fitted too: zoomFit.ts, loaded then.
 */
export function fitLegends(pad: HTMLElement): void {
  const keys = [...pad.querySelectorAll<HTMLElement>(".key")];
  const items: { el: HTMLElement; legend: boolean; key: HTMLElement; base: number }[] = [];
  for (const key of keys)
    for (const el of key.querySelectorAll<HTMLElement>("[data-fit]")) {
      const legend = el.dataset["fit"] === "legend";
      el.style.fontSize = legend ? "" : "1px"; // a face of 1 px leaves the key at its own height
      items.push({ el, legend, key, base: 0 });
    }
  // measure the room: the key's height less its padding and its legend lines is the face's line
  const lineH = new Map<HTMLElement, number>();
  for (const key of keys) {
    const cs = getComputedStyle(key);
    let room = key.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const legends = [...key.querySelectorAll<HTMLElement>("[data-fit='legend']")];
    for (const el of legends) {
      const h = el.getBoundingClientRect().height;
      room -= h;
      lineH.set(el, h * LEGEND_MAX_EM);
    }
    for (const el of key.querySelectorAll<HTMLElement>("[data-fit='face']")) lineH.set(el, room);
  }
  for (const it of items) if (!it.legend) it.el.style.fontSize = "";
  // measure the text (as drawn: under a text zoom the computed size is the zoomed one)
  const natural = new Map<HTMLElement, number>();
  const cap = new Map<HTMLElement, number>();
  for (const it of items) {
    const cs = getComputedStyle(it.el);
    it.base = parseFloat(cs.fontSize);
    if (it.legend) cap.set(it.el, lineH.get(it.el) ?? 0);
    else {
      // the face's line is its font size times the line-height ratio (1.1, or 1 in a letter row of a short screen)
      const ratio = parseFloat(cs.lineHeight) / it.base;
      cap.set(it.el, (lineH.get(it.el) ?? 0) / (ratio > 0 ? ratio : 1.2));
    }
    // an element is as wide as its text here (white-space: nowrap, a flex or grid item): scrollWidth is its content width
    natural.set(it.el, it.el.scrollWidth);
  }
  const avail = new Map<HTMLElement, number>();
  for (const key of keys) {
    const cs = getComputedStyle(key);
    const inner = key.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    // each legend has its own line (the shift function above the face, the letter below it): the key's whole width
    // R143: the menu mark ▾ hangs after the text out of the flow (scrollWidth counts it): on a maths key (the rows with a letter
    // line) it may use 6 px of the key's side padding, so the mark does not shrink the text; a narrow cluster key (Help's
    // "Settings") has no room to spare: text and mark fit its width together
    const lettered = key.dataset["letters"];
    for (const el of key.querySelectorAll<HTMLElement>("[data-fit]")) avail.set(el, inner + (lettered && el.dataset["opens"] ? 6 : 0));
  }
  // the text zoom (zoomFit.ts textZoom: the body's CSS size is 16 px; 1 in a browser)
  const z = parseFloat(getComputedStyle(document.body).fontSize) / 16;
  // write
  for (const it of items) {
    const w = natural.get(it.el) ?? 0;
    const room = avail.get(it.el) ?? 0;
    const line = cap.get(it.el) ?? 0;
    let size = it.base;
    // scrollWidth is an integer (the text's true width rounded, up to half a pixel off): shrunk against the room less 1 px, the
    // text at the new size is not wider than the room (R148f1: Help's "Settings" was 48 px in 47 at 11 px)
    if (w > 0 && w > room) size = Math.min(size, (it.base * (room - 1)) / w);
    if (line > 0) size = Math.min(size, line);
    size = Math.floor(size * 10) / 10;
    if (size >= it.base) continue;
    const floor = it.legend ? MIN_LEGEND_PX : MIN_FACE_PX;
    size = Math.max(floor, size);
    it.el.style.fontSize = `${size / z}px`;
  }
  if (z !== 1) void import("./zoomFit.ts").then((m) => m.refit(pad, z));
}
