// SPDX-License-Identifier: GPL-3.0-or-later
// The MathLive entry line, driven only by our keyboard. Plain TS. MathLive loads lazily (render/mathlive.svelte.ts):
// keys pressed before it is ready are queued and replayed in order, so the keypad is usable at once. What acts on the
// field itself (its set-up, and how a key changes it) is entry/field.ts, loaded with MathLive (R70f1).
import type { MathfieldElement } from "mathlive";
import { constKey, pruneChips, resKey, type Chip, type ChipTable } from "../input/chips.ts";
import type { ActionBody, Key, Layer } from "../keyboard/keyboard.ts";
import type { AngleUnit } from "../calc/port.ts";
import { mathlive } from "../render/mathlive.svelte.ts";
import type { Where } from "./appValue.ts";
import { ANS_CHIP, constChip, resChip } from "./macros.ts";

/** How an insert goes on the field (R746): as given (false), a result as drawn (true), or an exact result's chip (entry/oneTerm.ts resultOnLine). */
type Term = boolean | Chip;

export class EntryController {
  /** The field once it is up (set by field.ts fieldFor; `field` reads it). */
  mf: MathfieldElement | undefined;
  private host: HTMLElement | undefined;
  /** What waits for the field, in the order made (decisions.md R8): the keys' actions and, as `put`, the inserts (R298). */
  queue: (ActionBody | { kind: "put"; latex: string; term: Term; consts?: ChipTable })[] = [];
  /** How a key acts on the field (entry/field.ts: ⌫ and Del at a template, ᴇ, 10ˣ, a power's base, the stops): loaded with MathLive. */
  private onField: typeof import("./field.ts").runOnField | undefined;
  /** Backspace, Delete and the printable keys of a hardware keyboard (entry/hwkeys.ts, R26b, R31): loaded with MathLive. */
  hwKey: typeof import("./hwkeys.ts").hardwareKey | undefined;
  /** R279: the chain of Select presses that Deselect walks back (entry/grow.ts): loaded with MathLive. */
  private chain: import("./grow.ts").SelectChain | undefined;
  /** R185: the matrices Shift + 5 made on the line, which ▶ and ▼ grow (entry/matgrow.ts; runOnField keeps it up to
   *  date): loaded with MathLive. */
  private grown: import("./matgrow.ts").Grown | undefined;
  /** An insert on the field: R746, a history result as maths or chip, one term (entry/oneTerm.ts); R747, on an app's line a
   *  constant as its value and no chip at all (entry/appValue.ts). Loaded with MathLive. */
  private onLine: typeof import("./field.ts").putText | undefined;
  /** R747: the shell (set by main.ts), which says which line this is: an app's line is stored as text and parsed without the
   *  chip table, so there a constant goes in as its value (entry/appValue.ts). */
  shell?: Where;
  /** R33: the stored names drawn in their colour (entry/namemarks.ts), made with the field. */
  marks: { setNames(names: string[]): void } | undefined;
  /** The user's names (setNames); hwkeys.ts reads them (R198: a typed name of the user's stays the user's). */
  stored: string[] = [];
  /** The line set() put before the field was up (a recall, the kept line); what is typed or inserted meanwhile waits in `queue`. */
  pendingValue: string | undefined;
  /** R34: the line was set or cleared before the field was up, so a line kept from before a kill no longer applies. */
  private keptStale = false;
  /**
   * R34: the line on the field is the user's to store: the kept-line read answered within the 1 s cap (the kept line,
   * if any, went on the field), or the line was typed or set since start.
   */
  touched = false;
  /** The values of the chips on the line (docs/04 3.6); keys as in input/chips.ts. */
  readonly table: ChipTable = {};
  private nextRes = 1;
  /** R57: the decimal comma is on; a hardware `,` or `.` types the decimal mark, and ᴇ reads `{,}` as part of a number. */
  decimalComma = false;
  /** A keypad key pressed from a hardware keyboard (R31): the shell runs it as a tap in that layer; a physical Enter and
   *  Escape are the Enter and Esc keys (R45, R15c2). The hardware hooks' last argument is KeyboardEvent.repeat: a held
   *  key's auto-repeat acts again but is no new press (docs/04 5.2, R70f1). */
  onKey: (id: string, layer: Layer, repeat: boolean) => void = () => {};
  /** A letter typed on a hardware keyboard (R45): the shell's checks first, then the line. */
  onLetter: (ch: string, repeat: boolean) => void = () => {};
  /** A hardware `<`, `>`, `!` or `%` (R107, R131): the palette's insert goes on the line; App.svelte counts it as a press. */
  onSymbol: (latex: string, repeat: boolean) => void = (latex) => this.run({ kind: "insert", latex });
  /** A desktop key the table adds (R131, hwkeys.ts onDesk): `as`, its count name; the key it presses (a keypad key, a
   *  status-line control as a key), or none for the fold. */
  declare onDesk?: (as: string, key: Key | undefined, layer: Layer | undefined, repeat: boolean) => void;
  /** A hardware key that does nothing (R31): the shell's dead-key feedback (a press all the same, R107). */
  onDead: (repeat: boolean) => void = () => {};
  /** A hardware `)` or `|` that leaves its pair (R107f1): the cursor moves, App.svelte counts the press. */
  onPress: (repeat: boolean) => void = () => {};
  /** A system paste on the field (Ctrl+V, Shift+Insert, the context menu; R114): App.svelte runs the Paste key's path on its text. */
  onPaste: (text: string) => void = () => {};
  /** The line was edited other than by a key of the keypad (R154): MathLive typing a character itself, a recalled row, an inserted result. */
  onEdit: () => void = () => {};
  /** The line was emptied (Enter, Esc, an app view): main.ts clears the kept line (R34). */
  onClear: () => void = () => {};

  /** Resolves when the entry line is on the page and the queued keys have been replayed. */
  ready: Promise<void> = Promise.resolve();
  private started = false;
  /** R265: the line is an unchanged recall of a row that reads the angle: the mode that row ran in. Dropped by anything that
   *  edits or clears the line, so the same text typed again by hand is a new entry (not a recall). Read only outside. */
  recalledIn: AngleUnit | null = null;
  /** R255: 1 while the kept line (R34) is being read, 2 once it was read with text. */
  private kept = 0;
  /** R255: true until the field is up with the queued keys on it, or will never come (MathLive did not load). Read only. */
  fieldPending = true;
  private up = (): void => {};
  /** R255: resolves when `fieldPending` turns false (route.ts holds Enter and the keys after it for this). */
  readonly fieldUp = new Promise<void>((r) => (this.up = r));

  /** The page element the field goes into (set by the shell). */
  setHost(host: HTMLElement): void {
    this.host = host;
  }

  /**
   * Start loading MathLive; safe to call once. `kept` is the line kept from before a kill (R34): it goes on the line
   * before the queued keys are replayed, unless the line was set or cleared meanwhile. A store that never answers
   * delays the field by at most a second; its line then stays stored for the next start (`settled`).
   */
  load(kept?: Promise<{ latex: string; chips: ChipTable } | undefined>): Promise<void> {
    if (this.started) return this.ready;
    this.started = true;
    const line = Promise.race([kept, new Promise<null>((resolve) => setTimeout(resolve, 1000, null))]).catch(() => null);
    this.kept = 1;
    void line.then((l) => (this.kept = l?.latex ? 2 : 0));
    this.ready = Promise.all([mathlive.load(), import("./fieldUp.ts"), import("./hwkeys.ts"), line]).then(([m, f, h, l]) => {
      this.onField = f.runOnField;
      this.chain = new f.SelectChain();
      this.grown = new f.Grown();
      this.onLine = f.putText;
      this.hwKey = h.hardwareKey;
      if (l !== null) this.touched = true;
      if (l && !this.keptStale) this.pendingValue = this.adopt(l.latex, l.chips); // (only set() writes pendingValue, and it marks the kept line stale)
      return f.fieldFor(this, m.MathfieldElement, this.host); // (R930: the field's set-up and the replay of the queue are fieldUp.ts's)
    });
    void this.ready.catch(() => {}).then(() => {
      this.fieldPending = false;
      this.up();
    });
    return this.ready;
  }

  /** R33: the names that hold a value (session.userNames); only a single letter is drawn in the stored-name colour. */
  setNames(names: readonly { name: string }[]): void {
    this.marks?.setNames((this.stored = names.map((n) => n.name)));
  }

  /** The field itself (undefined until MathLive has loaded). */
  get field(): MathfieldElement | undefined {
    return this.mf;
  }
  /**
   * R34: the line may be stored on a hide, over the line kept from before a kill. Not while the field loads (its
   * value is still empty, the kept line not on it yet) unless the line was set or cleared meanwhile; and not after the
   * store answered too late for the kept line to go on the field, until the line is typed, set or cleared.
   */
  get settled(): boolean {
    return this.keptStale || (this.mf !== undefined && this.touched);
  }
  get value(): string {
    return this.mf ? this.mf.value : (this.pendingValue ?? "");
  }
  /** R255: the line is empty for the keys with an empty-line job (Ans, a b/c, ▲, Undo, Clear): no text on the field,
   *  and before the field none pending, no key queued and no kept line still to come (R34). */
  get empty(): boolean {
    return this.mf ? !this.mf.value : !this.pendingValue && !this.queue.length && (!this.kept || (this.kept > 1 && this.keptStale));
  }
  /** The chip table of the line: only the chips still on it. */
  get chips(): ChipTable {
    return pruneChips(this.table, this.value);
  }
  clear(): void {
    this.recalledIn = null;
    this.queue = [];
    this.pendingValue = undefined;
    this.keptStale = true;
    this.onClear();
    // The chip table and the counter stay (R16): Shift + Cancel undoes Esc and Enter, and the chips it brings back must
    // still be worth what they were. The `chips` getter only hands out the chips on the line.
    if (this.mf) this.mf.value = "";
  }
  /** R898: the line changes owner (Home ↔ CAS, a name prompt's start and end): its own undo starts afresh from what it
   *  holds. The field's set-up puts the work in (fieldUp.ts, off the start chunk); a field still to come has no history. */
  freshUndo = (): void => {};
  /** Put a previous entry back on the line, with the values of its chips. `recalledIn`: the row reads the angle and ran in this mode (R265). */
  set(latex: string, chips: ChipTable = {}, recalledIn: AngleUnit | null = null): void {
    this.touched = true;
    this.onEdit();
    this.recalledIn = recalledIn;
    latex = this.adopt(latex, chips);
    this.grown?.clear(); // R185: a recalled line's matrix does not grow (the default; a cleared line has none to find)
    if (!this.mf) {
      this.pendingValue = latex;
      this.queue = [];
      this.keptStale = true;
      return;
    }
    this.mf.value = latex;
    this.mf.focus();
    this.mf.executeCommand("moveToMathfieldEnd");
  }
  /** Take a line's chips into the table; returns the line with any renumbered result chips. */
  private adopt(latex: string, chips: ChipTable): string {
    // R16: a result key that already holds another value (an entry an undo can still bring back) is never
    // overwritten: the recalled chip gets a fresh number, in the LaTeX and in the table.
    const top = Math.max(0, ...Object.keys(chips).map((k) => (k.startsWith("res:") ? Number(k.slice(4)) : 0)));
    this.nextRes = Math.max(this.nextRes, top + 1);
    for (const [key, chip] of Object.entries(chips)) {
      const old = this.table[key];
      const same = old && old.value === chip.value && old.exact === chip.exact && old.unc === chip.unc;
      if (old && !same && key.startsWith("res:")) {
        const k = this.nextRes++;
        latex = latex.replaceAll(`\\res{${key.slice(4)}}`, `\\res{${k}}`);
        this.table[resKey(k)] = chip;
      } else this.table[key] = chip;
    }
    return latex;
  }
  /** Insert LaTeX at the cursor. `term` (R746): a history result's drawn LaTeX (true), or an exact result's with its
   *  chip: decided when it goes on the field, by the line there (entry/oneTerm.ts resultOnLine). */
  insert(latex: string, term: Term = false, consts?: ChipTable): void {
    this.touched = true;
    this.recalledIn = null;
    this.onEdit();
    if (!this.mf) return void this.queue.push({ kind: "put", latex, term, ...(consts ? { consts } : {}) }); // R298: in its place among the queued keys
    this.put(latex, term, consts);
  }
  /** A previous entry at the caret, with the values of its chips (R832: a lit input put on a line that has text): the chips are taken
   *  into the table first and renumbered as `set` does, so a `\res{k}` in it never reads another value. */
  insertRecalled(latex: string, chips: ChipTable = {}): void {
    this.insert(this.adopt(latex, chips));
  }
  private put(latex: string, term: Term = false, consts?: ChipTable): void {
    this.onLine?.(this, latex, term, consts);
  }
  /** A history result as a chip (docs/04 2.8): drawn as `shown` (its display LaTeX), worth `chip.value`. `maths` (R746):
   *  its drawing is its exact value, so a fraction, root, power or matrix in it goes on the line as that maths (put). */
  insertResult(shown: string, chip: Chip, maths = false): void {
    if (maths) return this.insert(shown, chip);
    this.insert(this.chip(shown, chip));
  }
  chip(shown: string, chip: Chip): string {
    const k = this.nextRes++;
    this.table[resKey(k)] = chip;
    return resChip(k, shown);
  }
  /** A constant as a chip (Find, docs/04 3.6): `symbol` is LaTeX, the value and uncertainty come with it. */
  insertConst(id: string, symbol: string, chip: Chip): void {
    this.insert(constChip(id, symbol), false, { [constKey(id)]: chip }); // (in the table once the line takes the chip, R747: an app's line does not)
  }
  /** Ans: the view's last result, read when Enter is pressed. */
  insertAns(): void {
    this.insert(ANS_CHIP);
  }
  focus(): void {
    this.mf?.focus();
  }

  /**
   * Run a type / insert / cmd action. Specials belong to the app and are not handled here. (The a b/c key's
   * empty-line cycle is the app's: here it is the stacked fraction. The mixed number is in the Tmpl palette, R10.)
   */
  run(a: ActionBody): void {
    if (a.kind === "special") return;
    this.endSelect();
    if (a.kind === "insert" && a.chip) this.table[a.chip.key] = a.chip.chip; // a constant on a free key (R4b)
    this.touched = true;
    if (!this.mf) {
      this.recalledIn = null;
      this.queue.push(a);
      return;
    }
    const before = this.mf.value;
    this.onField?.(this.mf, a, this.grown, this.decimalComma, this.shell);
    if (this.mf.value !== before) this.recalledIn = null; // (a cursor key leaves the recall as it was)
  }

  /** R279: Select (`grow`) or Deselect on the line (entry/grow.ts); false where the key does nothing. */
  select(grow: boolean): boolean {
    return !!this.mf && !!this.chain?.step(this.mf, grow);
  }
  /** Any other key ends the chain of Select presses (R279; a tap does by changing the selection). */
  endSelect(): void {
    this.chain?.end();
  }
}
