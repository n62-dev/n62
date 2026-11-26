// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: the unit view's panel in the entry line's place (docs/04 4.3): the read-only formula with its slots (the
// field, made by units/open.ts), a refusal or the result as Calc.units() returns it (R62: the value line, σ, the note and
// the alternatives row, units/result.ts), and last one row: the reading of the active slot in words, then → Check (R349:
// the end slot on and off; R790: directly above the keys, so what is above it never moves it; R852: the reading beside it;
// R853: ← and → before it step one slot).
// Plain DOM over the view's state (a change calls `draw`).
// Loaded with the unit view.
import "./panel.css";
import { unitText, type UnitMessageKey } from "../i18n/enUnits.ts";
import type { UnitShown } from "./result.ts";
import type { UnitView } from "./view.ts";
import type { MarkStyle } from "../state/session.svelte.ts";

function el(tag: string, cls: string, testid?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  if (testid) e.dataset["testid"] = testid;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** `b` runs `run` on a tap. R159: the pick is made when the finger lifts on the button it went down on (as the keypad's
 *  keys are), not on the click the browser makes from it: under load Chromium now and then gave a chip or More…
 *  pointerdown, touchstart, pointerup and touchend and no click, and the tap was lost. A click that follows a pointer
 *  (detail > 0) is that same press; one without (a keyboard or a screen reader activating the button) picks itself.
 *  R159f2: `picked` is set only where pointerup picked. A touch that lands just beside the button (a finger's radius) is
 *  not on it at pointerup, so nothing is picked and the browser's click, which lands on the button, picks instead. */
function tapped(b: HTMLElement, run: () => void): HTMLElement {
  b.tabIndex = -1;
  let down = false;
  let picked = false;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault(); // the view keeps the focus (hardware keys)
    down = e.isPrimary && e.button === 0;
    picked = false;
  });
  b.addEventListener("pointercancel", () => (down = false));
  b.addEventListener("pointerup", (e) => {
    const was = down;
    down = false;
    if (!was || e.button !== 0) return;
    const at = document.elementFromPoint(e.clientX, e.clientY); // (a touch is captured by its first target: the finger may have left it)
    if (at === b || b.contains(at)) {
      picked = true;
      run();
    }
  });
  // R159f1: the click the browser still makes after the pick would land on what the pick opened (a tap on More… sent its
  // click to the Find sheet just drawn); a cancelled touchend makes no click. Only after a pick: a near miss keeps its click.
  b.addEventListener("touchend", (e) => {
    if (picked && e.cancelable) e.preventDefault();
    picked = false;
  });
  b.addEventListener("click", (e) => {
    const again = picked;
    picked = false;
    if (e.detail === 0 || !again) run();
  });
  return b;
}

/** The value line, σ's lines, the note and the alternatives row of a result (`docs/mockups/unit-result.html` at `b1c44ee4`). */
function resultRows(s: UnitShown, v: UnitView, fit: (row: HTMLElement) => void, store?: () => void): HTMLElement[] {
  const r = el("div", "result", "unit-result");
  r.dataset["text"] = s.display;
  r.dataset["unit"] = s.unit;
  const mark = el("span", "mark", "unit-mark", s.markText);
  mark.dataset["mark"] = s.mark;
  const value = el("span", "value");
  if (s.sigma) {
    value.append(s.sigma.head);
    if (s.warn) value.append(el("span", "warn", "unit-warn", "⚠"));
    value.append(s.sigma.tail);
  } else {
    value.append(s.text);
    if (s.warn) value.append(el("span", "warn", "unit-warn", "⚠"));
  }
  r.append(mark, value);
  if (s.unit) r.append(el("span", "unit", "unit-unit", s.unit));
  if (s.dim) r.append(el("span", "dim", "unit-dim", s.dim));
  // R353: Store ▶ beside the result (the key's job: the result's chip into "Store in")
  if (store) r.append(tapped(el("button", "store", "unit-store", unitText("units.store.button")), store));
  const out = [r];
  if (s.sub) {
    const sub = el("div", "sub", "unit-sub", s.subMuted ? undefined : s.sub);
    // R883: the value's digits past σ in R40's muted span, as Home's row draws them
    if (s.subMuted) sub.append(s.subMuted[0], el("span", "unc", "", s.subMuted[1]), s.subMuted[2]);
    out.push(sub);
  }
  if (s.why) out.push(el("div", "why", "unit-why", s.why));
  if (s.note) out.push(el("div", "note", "unit-note", s.note));
  if (s.names) out.push(el("div", "note", "unit-names", s.names));
  if (s.dimension !== "") {
    const row = el("div", "alts", "unit-alts");
    row.setAttribute("role", "toolbar");
    row.setAttribute("aria-label", unitText("units.result.alts"));
    const chip = (text: string, i: number, testid: string, cls: string): HTMLElement => {
      const b = el("button", `alt ${cls}`, testid, text);
      b.dataset["i"] = `${i}`;
      return tapped(b, () => void v.pick(i));
    };
    s.alts.forEach((a, i) => row.append(chip(a.text, i, "unit-alt", "")));
    const more = chip(unitText("units.result.more"), s.alts.length, "unit-more", "more");
    more.setAttribute("aria-label", unitText("units.result.moreLabel"));
    row.append(more);
    out.push(row);
    queueMicrotask(() => fit(row));
  }
  return out;
}

/** R353: what the panel's Store ▶ button runs, and the reason a press of it (or of the key) was refused, shown under
 *  the result or the message while they stand. */
export interface PanelStore {
  run(): void;
  said(): string | undefined;
}

export interface Panel {
  /** The panel (it holds the focus: tabindex -1, nothing editable in it). */
  readonly element: HTMLElement;
  /** Where the field goes. */
  readonly formula: HTMLElement;
  /** Draw the view's state again. */
  draw(): void;
}

/** The panel for `view`, not yet on the page. `marks` (R124): Settings › Numbers › Marks, which panel.css follows. */
export function makePanel(view: () => UnitView | undefined, marks: () => MarkStyle = () => "reason", store?: PanelStore): Panel {
  const element = el("div", "unitview", "unit-view");
  element.tabIndex = -1;
  const formula = el("div", "formula");
  // R349: → Check puts the end slot on (active, empty), ✕ Check takes it off; hidden where it cannot go (no number slot)
  const check = tapped(el("button", "check", "unit-check"), () => view()?.setChecking(!view()?.checking));
  // R853: ← and → step one whole slot, as a tap on it (R801); dim and dead at the ends (the focus comes back to the view
  // as after any tap, units/open.ts)
  const step = (by: -1 | 1, testid: string, face: UnitMessageKey, label: UnitMessageKey): HTMLElement => {
    const b = tapped(el("button", "step", testid, unitText(face)), () => view()?.step(by));
    b.setAttribute("aria-label", unitText(label));
    return b;
  };
  const prev = step(-1, "unit-prev", "units.step.prev", "units.step.prevLabel");
  const next = step(1, "unit-next", "units.step.next", "units.step.nextLabel");
  const reading = el("div", "reading", "unit-reading");
  const below = el("div", "below");
  const said = el("div", "said", "unit-store-note");
  said.setAttribute("role", "alert");
  said.hidden = true;
  // R790: the panel grows upward from the keys, so → Check last keeps one height whatever the reading, message or result hold;
  // R852: the reading beside it in that row (it wraps upward), and no height for what is not shown
  const last = el("div", "last");
  last.append(reading, prev, next, check);
  element.append(formula, below, said, last);
  /** Hide the chips that do not fit beside "More…" (at least as many as the view can use) and tell the view how many fit. */
  const fitRow = (row: HTMLElement): void => {
    const v = view();
    const chips = [...row.querySelectorAll<HTMLElement>(".alt:not(.more)")];
    const more = row.querySelector<HTMLElement>(".more");
    if (!v || !more) return;
    let n = chips.length;
    if (row.isConnected && row.clientWidth > 0) {
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      let used = more.offsetWidth;
      n = 0;
      for (const c of chips) {
        if (used + gap + c.offsetWidth > row.clientWidth) break;
        used += gap + c.offsetWidth;
        n++;
      }
      v.fit = n;
    }
    chips.forEach((c, i) => {
      c.hidden = i >= n;
      c.toggleAttribute("data-focus", v.row === i);
    });
    more.toggleAttribute("data-focus", v.row === n);
    row.dataset["fit"] = `${n}`;
  };
  /** The state `below` was built from: a draw with the same state (▼, ▲, a new width) keeps its elements and refits the
   *  row, since a chip replaced under a finger drops its tap (G153 fix round 1: a tap on the knot chip did nothing). */
  let built: UnitView["shown"] | undefined;
  const draw = (): void => {
    const v = view();
    if (!v) return;
    element.dataset["slot"] = v.activeId;
    element.dataset["marks"] = marks();
    check.hidden = !v.canCheck;
    check.textContent = unitText(v.checking ? "units.check.off" : "units.check.on");
    check.setAttribute("aria-label", unitText(v.checking ? "units.check.offLabel" : "units.check.onLabel"));
    check.setAttribute("aria-pressed", `${v.checking}`);
    prev.setAttribute("aria-disabled", `${v.active === 0}`);
    next.setAttribute("aria-disabled", `${v.active === v.ids.length - 1}`);
    reading.replaceChildren(...v.reading.parts.flatMap((p, i) => [...(i ? [" "] : []), el("span", p.marked ? "rare" : "", undefined, p.text)])); // (R852: a flex box draws no " ": panel.css's gap)
    const why = store?.said();
    said.hidden = why === undefined;
    said.textContent = why ?? "";
    const s = v.shown;
    if (s === built) {
      const row = below.querySelector<HTMLElement>(".alts");
      if (row) fitRow(row);
      return;
    }
    built = s;
    const out: HTMLElement[] = [];
    if (s.kind === "message") {
      const m = el("div", "message", "unit-message", s.text);
      m.setAttribute("role", "alert");
      out.push(m);
    } else if (s.kind === "working") out.push(el("div", "working", "unit-working", unitText("units.view.working")));
    else if (s.kind === "result") out.push(...resultRows(s, v, fitRow, store?.run));
    below.replaceChildren(...out);
  };
  // a new width changes how many chips fit (the first callback is the size at the start: the draws measure it themselves)
  let width = -1;
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(() => {
      const was = width;
      width = element.clientWidth;
      if (was >= 0 && width !== was) draw();
    }).observe(element);
  return { element, formula, draw };
}
