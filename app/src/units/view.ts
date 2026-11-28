// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: the unit view's state (docs/04 4.3, docs/archive/r9-unit-pad.md 2.1–2.8). The formula is read-only, with a
// slot after every number and, after → Check (R349), the end slot (input/unitFormula.ts); each slot is R24a's SlotModel,
// fed by the pad's presses (units/pad.ts emits them). Enter goes to the next slot and evaluates in the last, a flick up on Enter
// evaluates at once, ◀ ▶ move between slots. A slot reaches the field only through `write` (setPromptValue, units/
// open.ts), never through the entry line. Plain TS (no runes): a change calls `host.changed()`. Evaluation: the parser's units mode (R28) on the formula, the slots' tokens,
// then Calc.units(). Loaded with the unit view.
import type { ChipTable } from "../input/chips.ts";
import { chipSlot } from "../input/chipUnit.ts";
import { unitText } from "../i18n/enUnits.ts";
import { END, constLabels, slotFormula, unitRequest, type SlotFormula } from "../input/unitFormula.ts";
import type { Alternative } from "./alternatives.ts";
import type { PadEmit } from "./pad.ts";
import { shownOf, type Shown, type UnitFormat } from "./result.ts";
import type { CellLeg } from "./userCells.svelte.ts";
import { SlotModel, type PadAction, type Reading, type SlotCatalogue } from "./slot.ts";
import type { Quantity, UnitError, UnitRequest, UnitSlot } from "./types.ts";
import { leaveLine } from "./kept.ts"; // R902: the line left with slots, for Home's note

export { shownOf, type Shown } from "./result.ts";

/** What the view needs from the page: the field, the engine, Find and the dead-key feedback. */
export interface ViewHost {
  /** Write a slot's LaTeX into its prompt (the field's setPromptValue). */
  write(id: string, latex: string): void;
  evaluate(req: UnitRequest): Promise<Quantity | UnitError>;
  /** Math: Find on units; a pick comes back through `apply`. `into`: an empty user cell was pressed (R24d), the pick sets it.
   *  `dim`: R62's "More…", only the units of that dimension. */
  find(into?: { key: string; leg: CellLeg }, dim?: string): void;
  /** R62: the format Home shows numbers in (the digits setting); R120: with the decimal mark and the screen's groups. */
  format(): UnitFormat;
  /** R62: the row of units the result can be shown in (units/alternatives.ts); none when it cannot be built. */
  alternatives(q: Quantity, req: UnitRequest): Promise<readonly Alternative[]>;
  /** R62: a tap on a chip: the unit last used for the dimension (`units.targets`). */
  remember(dim: string, slot: UnitSlot): Promise<void>;
  dead(): void;
  /** The active slot, the reading or what is shown changed: draw them (units/panel.ts). */
  changed(): void;
  /** R349: the end slot went on or off: the field's value becomes `latex` with the prompts `ids` locked (the slots are
   *  then written again through `write`). */
  reset?(latex: string, ids: readonly string[]): void;
  /** R258: the session's stored values (latex-to-giac.ts userValuesOf), read at each request. */
  values?(): ReadonlySet<string>;
  /** R929: a constant's own unit as the result shows it (J·s for `planck`), drawn muted after its chip; none for a pure number. */
  constUnit?(id: string): string | undefined;
  /** R63: a result is in (as shown: the unit a tapped chip names): it becomes Home's history row of this visit. */
  result?(q: Quantity): void;
}

/** The active slot's look: drawn inline, since a class does not reach into the field's shadow root. */
const ACTIVE = "background:var(--pick);border-radius:4px";

/** R807: the slot model's marks (slot.ts `latex`: \class) drawn in the field's shadow root, which no stylesheet of the page reaches
 *  (units/open.ts appends this one): an armed prefix or √ as the armed keys are (--key-on), a pair outside Find's list in the warning
 *  colour as the reading marks it, an empty denominator's □ muted. Theme tokens only. */
export const SLOT_MARKS =
  ".pas-armed{background:var(--key-on);color:var(--on-key-on)}.pas-rare{color:var(--warn)}.pas-empty{color:var(--muted)}" +
  ".pas-caret{border-left:1.5px solid var(--text)}";

/** R807: the active slot's caret, a thin bar the height of a letter (`pas-caret`, in SLOT_MARKS). It is drawn only here, never in
 *  `SlotModel.latex`, which the history row, Copy and Share read. */
const CARET = "\\class{pas-caret}{\\vphantom{m}}";

/** The slots a line keeps (docs/04 4.3 "The way back": the units key shows them again), by the line's LaTeX. */
const kept = new Map<string, Readonly<Record<string, UnitSlot>>>();

/** R92: the line's text changed by a chip put on it from the units menu (a chip adds no slot, so the slot ids keep their
 *  order): the slots `from` kept go with the new text. */
export function carry(from: string, to: string): void {
  const s = kept.get(from);
  if (s && from !== to) kept.set(to, s);
}

export class UnitView {
  readonly line: string;
  /** R349: the formula and the ids without the end slot, then with it. */
  readonly #forms: readonly [SlotFormula, SlotFormula];
  readonly #ids: readonly [readonly string[], readonly string[]];
  /** R349: the end slot is on (→ Check, a pick that writes it, a row or a kept line that has one). */
  #checking: boolean;
  readonly #models = new Map<string, SlotModel>();
  readonly #cat: SlotCatalogue;
  readonly #chips: ChipTable;
  readonly #host: ViewHost;
  #active = 0;
  #reading: Reading = { text: "", parts: [], marked: false };
  #shown: Shown = { kind: "none" };
  #run = 0;
  #row = -1;
  /** R62: "More…" opened Find on the end slot: "asked" until a pick comes (the view stays as it was, R118), then
   *  "picking": the pick replaced the end slot, and the press that completes it evaluates. */
  #more: false | "asked" | "picking" = false;
  /** R62: the chip last tapped: while the end slot is still its slot, the result reads the unit as the chip did ("ton", "cal"). */
  #picked: Alternative | undefined;
  #fit: number | undefined;
  /** R838: what the result shown was drawn from (the engine's answer, its row and the format as JSON), for a redraw with no request. */
  #result: [Quantity | UnitError, readonly Alternative[], string] | undefined;

  /** R62: how many of the row's chips fit (the panel measures); undefined: all. A smaller number moves a focus on a hidden chip to "More…". */
  get fit(): number | undefined {
    return this.#fit;
  }
  set fit(n: number | undefined) {
    this.#fit = n;
    if (this.#row > this.chips) this.#row = this.chips;
  }

  /** The active slot, an index into `ids`. */
  get active(): number {
    return this.#active;
  }
  set active(n: number) {
    this.#active = n;
    this.#host.changed();
  }
  get reading(): Reading {
    return this.#reading;
  }
  set reading(r: Reading) {
    this.#reading = r;
    this.#host.changed();
  }
  get shown(): Shown {
    return this.#shown;
  }
  set shown(s: Shown) {
    this.#shown = s;
    this.#row = -1;
    this.#fit = undefined;
    this.#host.changed();
  }
  /** R62: the focused chip of the alternatives row (0 … chips, the last being "More…"), or -1: the row is not entered. */
  get row(): number {
    return this.#row;
  }
  /** The chips on screen, "More…" not counted. */
  get chips(): number {
    const s = this.#shown;
    return s.kind === "result" && s.dimension !== "" ? Math.min(s.alts.length, this.#fit ?? s.alts.length) : 0;
  }

  /** `seed`: the slots to start with (a picked unit row's, R63); else the ones this line kept. A slot after a result
   *  chip that neither fills starts with the chip's unit (R63, r17 section 2), which the user can change. */
  constructor(catalogue: SlotCatalogue, line: string, chips: ChipTable, host: ViewHost, seed?: Readonly<Record<string, UnitSlot>>) {
    this.line = line;
    const on = slotFormula(line, true);
    this.#forms = [slotFormula(line, false), on];
    this.#ids = [on.slots, [...on.slots, END]];
    this.#cat = catalogue;
    this.#chips = chips;
    this.#host = host;
    const from = seed ?? kept.get(line);
    // R349: on for a row or a line kept with an end slot (every row saved before R349 restores as a check), and for a
    // formula with no number (no slot to evaluate in but the end slot)
    this.#checking = from?.[END] !== undefined || !this.canCheck;
    const after = on.chips ?? {};
    for (const id of this.#ids[1]) {
      let m: SlotModel;
      try {
        const key = after[id];
        m = new SlotModel(catalogue, from?.[id] ?? (key !== undefined ? chipSlot(chips[key]) : undefined));
      } catch {
        m = new SlotModel(catalogue); // (a kept slot the catalogue no longer reads: empty)
      }
      this.#models.set(id, m);
    }
  }

  /** The formula as the field shows it: with the end slot's prompt while it is on. */
  get formula(): SlotFormula {
    return this.#forms[this.#checking ? 1 : 0];
  }
  /** R929: the field's value: the formula with each constant's own unit after its chip (never in `formula`, the request's). */
  get fieldLatex(): string {
    const unit = this.#host.constUnit;
    return unit ? constLabels(this.formula.latex, (id) => unit.call(this.#host, id)) : this.formula.latex;
  }
  /** The slots' ids, then the end slot's while it is on. */
  get ids(): readonly string[] {
    return this.#ids[this.#checking ? 1 : 0];
  }
  /** R349: the end slot is on. */
  get checking(): boolean {
    return this.#checking;
  }
  /** R349: the end slot can be taken off (the formula has a number slot to evaluate in). */
  get canCheck(): boolean {
    return this.#forms[0].slots.length > 0;
  }

  /** R349: → Check (on: the end slot comes, active and empty; from a slot that cannot be left its refusal shows) and
   *  ✕ Check (off: the end slot goes; a result of a request without it stays). */
  setChecking(on: boolean): void {
    if (on === this.#checking) return;
    if (!on && !this.canCheck) return this.#host.dead();
    if (this.#row >= 0) this.up();
    if (on && !this.#leavable()) return;
    this.#setEnd(on);
    this.#read();
  }

  /** The end slot on (empty, active) or off: the field's value is set again and every slot drawn (setPromptValue only).
   *  A request that changes (a filled end slot goes) drops what is shown and a running evaluation. */
  #setEnd(on: boolean): void {
    const end = this.#models.get(END) as SlotModel;
    if (!end.empty) {
      this.#run++;
      this.#picked = undefined;
      this.shown = { kind: "none" };
    }
    this.#more = false;
    this.#models.set(END, new SlotModel(this.#cat));
    this.#checking = on;
    this.#host.reset?.(this.fieldLatex, this.ids);
    this.#active = on ? this.ids.length - 1 : Math.min(this.#active, this.ids.length - 1);
    for (const id of this.ids) this.#draw(id);
    this.#host.changed();
  }

  /** The field is up: draw every slot once. */
  start(): void {
    for (const id of this.ids) this.#draw(id);
    this.#read();
  }

  get activeId(): string {
    return this.ids[this.active] as string;
  }

  /** A slot's model (tests and the e2e read its tokens). */
  model(id: string): SlotModel | undefined {
    return this.#models.get(id);
  }

  /** A pad press (units/pad.ts emits it). R313: Enter, evaluate and × end a letter run first (a slot press ends it in
   *  the slot model). */
  apply(e: PadEmit): void {
    if ((e.do === "next" || e.do === "evaluate" || e.do === "times") && !this.endRun()) return;
    switch (e.do) {
      case "find":
        return this.#host.find(e.into);
      case "next":
        return void this.next();
      case "evaluate":
        this.#more = false;
        return void this.evaluate();
      case "times":
        return; // units in a row multiply: × changes nothing
      default: {
        // A slot press (a pick from Find too): an evaluation still running answers for the slots it was asked with,
        // so its result is dropped (R24cf1).
        if (this.#more === "asked") this.#more = false; // (Find of More… closed without a pick: an ordinary press)
        const m = this.#models.get(this.activeId) as SlotModel;
        const r = m.apply(e);
        if (r.ok && r.back) return this.#back(); // (nothing changed: a running evaluation still answers)
        this.#run++;
        this.#picked = undefined;
        if (!r.ok) {
          this.shown = { kind: "message", text: r.message };
          return this.#host.dead();
        }
        this.shown = { kind: "none" };
        this.#draw(this.activeId);
        this.#read();
        if (this.#more === "picking" && this.activeId === END && m.check().ok) void this.evaluate();
      }
    }
  }

  /** R313: a letter typed on a hardware keyboard (units/typed.ts): it starts or extends the active slot's letter run,
   *  read as a unit at every letter, so the slot and the reading follow it. */
  letter(ch: string): void {
    this.#retype((m) => m.type(ch));
  }

  /** R313: ⌫ in a letter run takes its last letter; false: no run is open (⌫ goes the pad's way). */
  untype(): boolean {
    if (!this.typing) return false;
    this.#retype((m) => m.untype());
    return true;
  }

  /** R313: the active slot has a letter run open. */
  get typing(): boolean {
    return (this.#models.get(this.activeId) as SlotModel).typing;
  }

  /** R313: a key other than a letter ends the active slot's letter run; false: its letters are no unit, which the
   *  message names (the key is dead). */
  endRun(): boolean {
    const r = (this.#models.get(this.activeId) as SlotModel).endRun();
    if (r.ok) return true;
    this.shown = { kind: "message", text: r.message };
    this.#host.dead();
    return false;
  }

  /** R313: Esc ends a letter run that reads as a unit and drops one that reads as none (the slot as before it), then
   *  leaves as ever. */
  dropRun(): void {
    if (this.typing) this.#retype((m) => m.dropRun());
  }

  /** A change to the active slot that is no pad press (R313's letters): an evaluation still running is dropped. */
  #retype(f: (m: SlotModel) => void): void {
    this.#run++;
    this.#picked = undefined;
    f(this.#models.get(this.activeId) as SlotModel);
    this.shown = { kind: "none" };
    this.#draw(this.activeId);
    this.#read();
  }

  /** Enter: on a chip of the row, pick it; else the next slot; in the last (the end slot while it is on), evaluate. */
  next(): Promise<void> {
    if (this.#row >= 0) return this.pick(this.#row);
    this.#more = false;
    if (this.active === this.ids.length - 1) return this.evaluate();
    this.#move(1);
    return Promise.resolve();
  }

  /** ◀ (-1) and ▶ (+1): the slot before or after; none there is a dead key. */
  move(by: -1 | 1): void {
    if (this.#row >= 0) {
      const to = this.#row + by;
      if (to < 0 || to > this.chips) return this.#host.dead();
      this.#row = to;
      return this.#host.changed();
    }
    if (this.active + by < 0 || this.active + by >= this.ids.length) return this.#host.dead();
    this.#move(by);
  }

  /** ▼: from a result with a row into it (the first chip); anywhere else a dead key. */
  down(): void {
    if (this.#row >= 0 || this.#shown.kind !== "result" || this.#shown.dimension === "") return this.#host.dead();
    this.#row = 0;
    this.#host.changed();
  }

  /** ▲: out of the row; anywhere else a dead key. */
  up(): void {
    if (this.#row < 0) return this.#host.dead();
    this.#row = -1;
    this.#host.changed();
  }

  /** Esc in the row leaves it (true); otherwise nothing is taken (false) and the caller leaves the view. */
  escape(): boolean {
    if (this.#row < 0) return false;
    this.#row = -1;
    this.#host.changed();
    return true;
  }

  /** A chip of the row (or "More…", the one after the last): its unit is written into the end slot (setPromptValue), the
   *  dimension remembers it (`units.targets`) and the request runs again. */
  async pick(i: number): Promise<void> {
    const s = this.#shown;
    if (s.kind !== "result") return;
    const alt = s.alts[i];
    if (!alt || i >= this.chips) return this.more(s.dimension);
    return this.#use(alt, s.dimension);
  }

  /** R92's Tools › the SI form: a chip of the shown result's row, whether it fits on screen or not. */
  pickAlt(alt: Alternative): Promise<void> {
    const s = this.#shown;
    return s.kind === "result" && s.alts.includes(alt) ? this.#use(alt, s.dimension) : Promise.resolve();
  }

  async #use(alt: Alternative, dimension: string): Promise<void> {
    const was = this.activeId;
    let m: SlotModel;
    try {
      m = new SlotModel(this.#cat, alt.slot);
    } catch {
      return this.#host.dead(); // (a unit the catalogue does not read)
    }
    if (!this.#checking) this.#setEnd(true); // R349: a chip writes the end slot, which comes with it
    this.#more = false;
    this.#picked = alt;
    this.#models.set(END, m);
    this.active = this.ids.length - 1;
    this.#draw(was);
    this.#draw(END);
    this.#read();
    await this.#host.remember(dimension, alt.slot).catch(() => undefined);
    await this.evaluate();
  }

  /** R92's Tools › the end slot: it becomes the active slot, turned on first (R349; from a slot that cannot be left,
   *  its refusal shows). */
  toEnd(): void {
    if (!this.#checking) return this.setChecking(true);
    const end = this.ids.length - 1;
    if (this.#row >= 0) this.up();
    if (this.active === end || !this.#leavable()) return;
    const was = this.activeId;
    this.active = end;
    this.#draw(was);
    this.#draw(END);
    this.#read();
  }

  /** "More…": Find opens on this dimension's units. The view stays as it is (the result, the end slot) until a unit is
   *  picked (`pickMore`), so Find closed without a pick leaves it as it was (R118). */
  more(dimension: string): void {
    this.#more = "asked";
    this.#host.find(undefined, dimension);
  }

  /** A pick from More…'s Find: its first press replaces the end slot, which becomes the active one; the press that
   *  completes the slot evaluates. */
  pickMore(a: PadAction): void {
    if (this.#more === "asked") {
      const was = this.activeId;
      if (!this.#checking) this.#setEnd(true); // R349: the pick goes into the end slot, which comes with it
      this.#models.set(END, new SlotModel(this.#cat));
      this.#row = -1;
      this.active = this.ids.length - 1;
      this.#draw(was);
      this.#draw(END);
      this.#more = "picking";
    }
    this.apply(a);
  }

  /** ⌫ on an empty slot: to the slot before, whose next ⌫ removes its last token; on the first slot a dead key. R349:
   *  on the empty end slot it takes the end slot off (✕ Check). */
  #back(): void {
    if (this.activeId === END && this.canCheck) return this.setChecking(false);
    if (this.active === 0) return this.#host.dead();
    this.#move(-1);
  }

  /** R801: a tap on a slot makes it the active slot, as ◀ ▶ would reach it (the same refusal when the active slot cannot
   *  be left); a tap on the active slot, or on an id that is no slot, changes nothing. */
  goTo(id: string): void {
    const to = this.ids.indexOf(id);
    if (to < 0 || to === this.active) return;
    if (this.#row >= 0) this.up();
    this.#go(to);
  }

  /** R853: ← (-1) and → (+1) beside → Check: the slot before or after, as a tap on it (`goTo`); none there is a dead
   *  press, and from the chip row they leave it first. */
  step(by: -1 | 1): void {
    const to = this.ids[this.active + by];
    if (to === undefined) return this.#host.dead();
    this.goTo(to);
  }

  #move(by: -1 | 1): void {
    this.#go(this.active + by);
  }

  /** The active slot becomes slot `to` (an index into `ids`), both slots drawn and the reading follows. */
  #go(to: number): void {
    if (!this.#leavable()) return;
    const was = this.activeId;
    this.active = to;
    this.#draw(was);
    this.#draw(this.activeId);
    this.#read();
  }

  /** A slot with a prefix or √ alone, or a ÷ with nothing after it, cannot be left: its refusal shows. */
  #leavable(): boolean {
    const m = this.#models.get(this.activeId) as SlotModel;
    const r = m.check();
    if (r.ok) return m.endRun().ok; // (R313: a run that reads as a unit ends with its slot)
    this.shown = { kind: "message", text: r.message };
    this.#host.dead();
    return false;
  }

  /** The request for Calc.units(): the formula with the filled slots only (an empty slot means no unit), parsed in
   *  units mode. Throws the parser's error. */
  request(): UnitRequest {
    return unitRequest(this.formula, (id) => {
      const m = this.#models.get(id) as SlotModel;
      return m.empty ? undefined : m.slot;
    }, this.#chips, this.#host.values?.());
  }

  /** Evaluate from any slot: every slot must be complete. */
  async evaluate(): Promise<void> {
    this.#more = false; // (the evaluation More… started has begun)
    for (const id of this.ids) {
      const r = (this.#models.get(id) as SlotModel).check();
      if (!r.ok) {
        this.shown = { kind: "message", text: r.message };
        return this.#host.dead();
      }
    }
    let req: UnitRequest;
    try {
      req = this.request();
    } catch (e) {
      this.shown = { kind: "message", text: e instanceof Error ? e.message : String(e) };
      return;
    }
    const run = ++this.#run;
    this.shown = { kind: "working" };
    try {
      const got = await this.#host.evaluate(req);
      const alts = "error" in got ? [] : await this.#host.alternatives(got, req).catch(() => []);
      // the chip's own text is the unit (the index's symbol for ton is s_ton)
      const p = this.#picked;
      const q = !("error" in got) && p && got.shownSlot && JSON.stringify(got.shownSlot) === JSON.stringify(p.slot) ? { ...got, unit: p.text } : got;
      if (run !== this.#run) return;
      const f = this.#host.format();
      this.shown = shownOf(q, f, alts);
      this.#result = [q, alts, JSON.stringify(f)];
      if (!("error" in q)) this.#host.result?.(q);
    } catch (e) {
      if (run === this.#run) this.shown = { kind: "message", text: unitText("units.engine") };
    }
  }

  /** R838: a setting the result is only drawn with changed (the format, the decimal mark, the digit groups; Settings or Mode
   *  over the view; a digits change asks again, units/open.ts): the result shown is drawn again from the engine's answer, with no new request, and a focused chip
   *  stays focused (the caller draws the panel). Nothing when no result is shown or its format is unchanged. */
  redraw(): void {
    const r = this.#result;
    const f = this.#host.format();
    const s = JSON.stringify(f);
    const row = this.#row;
    if (this.#shown.kind !== "result" || !r || s === r[2]) return;
    r[2] = s;
    this.shown = shownOf(r[0], f, r[1]);
    this.#row = Math.min(row, this.chips);
  }

  /** Esc: the line keeps its slots. */
  keep(): void {
    const slots = this.filled();
    const any = Object.keys(slots).length > 0;
    if (any) kept.set(this.line, slots);
    else kept.delete(this.line);
    leaveLine(any ? this.line : undefined); // R902: the note on this line's Enter, while it stands unchanged
  }

  /** The complete, filled slots and end slot by prompt id. */
  filled(): Record<string, UnitSlot> {
    const slots: Record<string, UnitSlot> = {};
    for (const id of this.ids) {
      const m = this.#models.get(id) as SlotModel;
      if (!m.empty && m.check().ok) slots[id] = m.slot;
    }
    return slots;
  }

  /** R63: the request as a history row draws it: each filled slot's unit after its number, then → and the end slot's;
   *  an empty slot (no unit) is left out. */
  drawn(): string {
    let latex = this.formula.latex;
    for (const id of this.ids) {
      const m = this.#models.get(id) as SlotModel;
      const body = m.empty || !m.check().ok ? "" : `\\,${m.latex}`;
      latex = latex.replace(id === END ? `\\to\\placeholder[${END}]{}` : `\\placeholder[${id}]{}`, () => (id === END && body ? `\\to${body}` : body));
    }
    return latex;
  }

  #draw(id: string): void {
    const m = this.#models.get(id) as SlotModel;
    // R807: the active slot draws its caret, an empty one the caret before its □
    this.#host.write(id, id === this.activeId ? `\\htmlStyle{${ACTIVE}}{${m.latexWith(CARET)}}` : m.empty ? "" : m.latex);
  }

  #read(): void {
    const m = this.#models.get(this.activeId) as SlotModel;
    // R352: an empty end slot says what it does (a bare → □ shows nothing else)
    if (this.activeId === END && m.empty) {
      const text = unitText("units.read.endEmpty");
      this.reading = { text, parts: [{ text, marked: false }], marked: false };
      return;
    }
    this.reading = m.reading;
  }
}
