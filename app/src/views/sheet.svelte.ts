// SPDX-License-Identifier: GPL-3.0-or-later
// One sheet for every list (docs/05 3.1 with section 7): the model behind Sheet.svelte. Apps, the view menus, the
// Home/CAS Menu, the row actions, the template palette and Find (R4a: a level that searches) use it.
// Plain state, no DOM: the keys reach it through sheetKeys.ts, touch through Sheet.svelte.
import type { MenuItem, SubMenu } from "../apps/types.ts";
import type { IconId } from "./icons.ts";
import type { MatrixGrid } from "./matrixGrid.svelte.ts";
import { lastPicks } from "./picks.ts";
import { sheetKey } from "./sheetKeys.ts";
import type { Key } from "../keyboard/keyboard.ts";

/** Lists with more items than this get the letter filter (docs/05 3.1: "for lists longer than 10 items"). */
export const FILTER_ABOVE = 10;
/** R780: a fixed menu of up to this many rows numbers every row: 1…9 and 0 for rows 1…10, and the two keys after 0 on the pad,
 *  `.` and the space bar, for rows 11 and 12. A longer list (a data list that takes letters) numbers rows 1…10 only. */
export const NUMBERED_MAX = 12;

/** The face of row number `n` (1…12) as the row draws it and a screen reader says it: the digit key's face (0 for 10), then the
 *  faces of the two keys after it. */
export const numberFace = (n: number): string => (n === 11 ? "." : n === 12 ? "␣" : String(n % 10));

/** An item as the sheet shows it: its place in the full list and the number a digit key picks it with. */
export interface Row {
  readonly item: MenuItem;
  /** Index in the level's full list. */
  readonly index: number;
  /** 1…10 (shown as 1…9, 0), 11 and 12 (shown as `.` and `␣`, R780) in a list of at most 12 rows; undefined past the last numbered row. */
  readonly n: number | undefined;
}

/** True when every word start of `label` … one of them starts with `filter` (case-insensitive). */
export function matches(label: string, filter: string): boolean {
  if (filter === "") return true;
  const f = filter.toLowerCase();
  const l = label.toLowerCase();
  if (l.startsWith(f)) return true;
  // a word starts after anything that is not a letter or digit ("Copy as shown", "x-axis", "F1(x)")
  for (let i = 1; i < l.length; i++) if (!/[\p{L}\p{N}]/u.test(l[i - 1] as string) && l.startsWith(f, i)) return true;
  return false;
}

/** The credits sheet's text (R149, views/creditsSheet.ts): a heading, or a paragraph under it. */
export type CreditBlock = { readonly heading: string } | { readonly text: string };
/** R327: the uncertainty sheet's head (views/uncSheet.ts builds it; only its type here, the code stays in its chunk). */
export type UncHead = import("./uncSheet.ts").UncHead;

/** One level of the stack: the root list or a submenu. */
export class Level {
  /** Index of the highlighted item in the full list (-1: none, e.g. the filter matches nothing). */
  highlight = $state(-1);
  filter = $state("");

  /** R281: a state, so a title whose text comes later (the store sheet's value) is drawn when it comes. */
  title = $state("");
  /** Read on every draw, so a menu whose items change while it is open (a result arrives) stays current. */
  private readonly source: () => readonly MenuItem[];
  /** Key of the remembered pick of this level. */
  readonly memo: string;
  /** Letters filter this level (long lists; Find forces it on). */
  readonly filterable: boolean;
  /** Find (R4a): a typed query replaces the items with these hits, in their order, unnumbered (digits type then). */
  readonly search: ((query: string) => readonly MenuItem[]) | undefined;
  private found: { q: string; items: readonly MenuItem[] } | null = null;
  /** Counts the times the hits were dropped (refresh), so a view that shows them draws again. */
  private dropped = $state(0);
  /** A text to read in place of rows (R87, a licence); a function is read on every draw (R174). */
  private readonly textSource: string | (() => string) | undefined;
  get text(): string | undefined {
    const t = this.textSource;
    return typeof t === "function" ? t() : t;
  }
  /** R149: the credits, a list of headings and paragraphs that rolls up (Sheet.svelte); ▲ ▼ page through it like a text. */
  readonly credits: readonly CreditBlock[] | undefined;
  /** R327: the uncertainty sheet's head, drawn in place of the list (UncHead.svelte); R328: with the inputs' rows under it,
   *  which are this level's items, so ▲ ▼ and digits move the highlight over them. */
  readonly unc: UncHead | undefined;
  /** The preview under the list may take several lines. */
  readonly longPreview: boolean;
  /** The load of rows that are not in yet (a lazy submenu, R87), else null: keys wait for it (route.ts, R8). */
  readonly loading: () => Promise<void> | null;
  /** A text level: ▲ ▼ asked for this many pages (signed, cleared by Sheet.svelte, which owns the scroll position). */
  nudge = $state(0);

  /** Reopening starts on the last pick (false: always on the first row, for a sheet whose ◀ ▶ change values). */
  private readonly remember: boolean;
  /** A grid of this many columns (the Tmpl palette, R10): ▲ ▼ ◀ ▶ move in two dimensions, no numbers, no filter.
   *  Undefined: a list. */
  readonly columns: number | undefined;
  /** R725, the Chars sheet: a grid whose cells carry their digit (1-9, 0 the tenth) in the corner; a digit key picks that
   *  cell of the row with the focus, and no cell is picked by the key at its place (pickKey). */
  readonly digits: boolean;
  /** R800, Memory: a digit key moves the highlight to the numbered row instead of picking it (a pick deletes there). */
  readonly digitPick: "highlight" | undefined;
  /** R281: the items marked `cell` are drawn as a grid of this many columns above the list (the store sheet's letters);
   *  ▲ ▼ move a row of the grid, ◀ ▶ one cell, and no row has a number (a digit types into the name). */
  readonly cells: number | undefined;
  /** R281: Enter with letters typed runs this item for them (the store sheet stores the typed name, a new one too). */
  readonly typed: ((name: string) => MenuItem) | undefined;
  /** R281: the line under the list, read on every draw, before the highlighted item's preview. */
  readonly note: (() => string | undefined) | undefined;
  /** R188: a stored matrix's grid in place of rows (SubMenu.grid). */
  readonly grid: MatrixGrid | undefined;

  constructor(title: string, source: () => readonly MenuItem[], memo: string, opts?: SheetOptions) {
    this.title = title;
    this.source = source;
    this.memo = memo;
    this.remember = opts?.remember ?? true;
    this.columns = opts?.columns;
    this.digits = memo === CHARS_SHEET && opts?.columns !== undefined;
    this.digitPick = opts?.digitPick;
    this.cells = opts?.cells;
    this.typed = opts?.typed;
    this.note = opts?.note;
    this.grid = opts?.grid;
    this.search = opts?.search;
    this.textSource = opts?.text;
    this.credits = opts?.credits;
    this.unc = opts?.unc;
    this.longPreview = opts?.longPreview ?? false;
    this.loading = opts?.loading ?? (this.grid ? () => this.grid?.loading() ?? null : () => null);
    this.filterable = this.columns === undefined && (this.search !== undefined || (opts?.filterable ?? source().length > FILTER_ABOVE));
    this.highlight = this.start(opts?.at);
  }

  get items(): readonly MenuItem[] {
    const q = this.filter;
    void this.dropped;
    if (!this.search || q === "") return this.source();
    if (this.found?.q !== q) this.found = { q, items: this.search(q) };
    return this.found.items;
  }

  /** The level shows a query's hits (Find with letters typed): its digits type, so no row has a number (rule M1). */
  get searching(): boolean {
    return this.search !== undefined && this.filter !== "";
  }

  /** The rows on screen. Without a filter every item keeps its place and number (disabled ones too); with one, the
   *  matches are numbered in order. A search's hits are the rows as they come, without numbers. */
  get rows(): Row[] {
    if (this.searching) return this.items.map((item, index) => ({ item, index, n: undefined }));
    const out: Row[] = [];
    this.items.forEach((item, index) => {
      if (!matches(item.label, this.filter)) return;
      const k = out.length + 1;
      out.push({ item, index, n: k <= this.numberCap && this.cells === undefined ? k : undefined });
    });
    return out;
  }

  /** R780: how many rows take a number: all of a fixed list of at most 12 rows, else the first 10. */
  private get numberCap(): number {
    return this.items.length <= NUMBERED_MAX ? NUMBERED_MAX : 10;
  }

  /** R780: how many rows a pad key reaches here (the keypad draws `.` and the space bar live when this is 11 and 12): none in a
   *  grid (its digits pick cells, Chars) or a search's hits, else the numbered rows of a list, matches only once letters are typed. */
  get numbered(): number {
    if (this.columns !== undefined || this.searching || this.cells !== undefined) return 10;
    const n = this.filter === "" ? this.items.length : this.rows.length;
    return Math.min(n, this.numberCap);
  }

  get current(): MenuItem | undefined {
    return this.items[this.highlight];
  }

  /** Where the highlight starts: the item asked for (`at`), else the current value of a list of values, else the last
   *  pick when it can be picked, else the first item that can. */
  private start(at?: string): number {
    const items = this.items;
    const asked = at === undefined ? -1 : items.findIndex((x) => x.id === at && !x.disabled);
    if (asked >= 0) return asked;
    const current = items.findIndex((x) => x.selected === true && !x.disabled);
    if (current >= 0) return current;
    const last = this.remember ? lastPicks.get(this.memo) : undefined;
    const i = last === undefined ? -1 : items.findIndex((x) => x.id === last);
    if (i >= 0 && !items[i]?.disabled) return i;
    return this.firstRow();
  }

  private firstRow(): number {
    const rows = this.rows;
    return (rows.find((r) => !r.item.disabled) ?? rows[0])?.index ?? -1;
  }

  /** ▲ ▼: the next row up or down, round the ends. Disabled rows can be highlighted (their reason is read there).
   *  In a grid: the cell above or below, round the ends of its column. */
  move(by: 1 | -1): void {
    if (this.text !== undefined || this.credits !== undefined) {
      this.nudge += by;
      return;
    }
    if (this.grid) return this.grid.move(by, 0);
    if (this.columns !== undefined) return this.gridMove(by * this.columns, true);
    const rows = this.rows;
    if (rows.length === 0) return;
    const at = rows.findIndex((r) => r.index === this.highlight);
    let next = at < 0 ? (by > 0 ? 0 : rows.length - 1) : (at + by + rows.length) % rows.length;
    // R281: in the letter grid (its cells come first) ▲ ▼ go a row of cells; past the grid's last row ▼ goes on to the
    // list below it (none: round to the column's top), above its first ▲ to the list's end
    const cols = this.cells;
    if (cols !== undefined && at >= 0 && rows[at]?.item.cell) {
      const cells = rows.filter((r) => r.item.cell).length;
      next = at + by * cols;
      if (next < 0) next = rows.length - 1;
      else if (next >= cells) next = cells < rows.length ? cells : at % cols;
    }
    this.highlight = (rows[next] as Row).index;
  }

  /** ◀ ▶ in a level with a letter grid (R281): the row before or after, round the ends. */
  stepRow(by: 1 | -1): void {
    const rows = this.rows;
    if (rows.length === 0) return;
    const at = rows.findIndex((r) => r.index === this.highlight);
    this.highlight = (rows[at < 0 ? 0 : (at + by + rows.length) % rows.length] as Row).index;
  }

  /** ◀ ▶ in a grid: the cell before or after in reading order, round the ends of the grid. */
  step(by: 1 | -1): void {
    this.gridMove(by, false);
  }

  private gridMove(by: number, column: boolean): void {
    const n = this.items.length;
    const cols = this.columns ?? 1;
    if (n === 0) return;
    if (this.highlight < 0) {
      this.highlight = 0;
      return;
    }
    let next = this.highlight + by;
    if (column) {
      // round the ends of the column: from the last row back to the first, and the other way
      const col = this.highlight % cols;
      const last = col + cols * Math.floor((n - 1 - col) / cols);
      if (next < 0) next = last;
      else if (next >= n) next = col;
    } else next = (next + n) % n;
    this.highlight = next;
  }

  /** A search's hits are read again (Memory: a name was deleted). */
  refresh(): void {
    this.found = null;
    this.dropped++;
  }

  /** A letter typed into the filter (false: this level has no filter). */
  type(ch: string): boolean {
    if (!this.filterable) return false;
    this.filter += ch;
    this.highlight = this.firstRow();
    return true;
  }

  /** ⌫: the last filter letter goes (false: nothing to delete). */
  backspace(): boolean {
    if (this.filter === "") return false;
    this.filter = this.filter.slice(0, -1);
    if (this.search || !this.rows.some((r) => r.index === this.highlight)) this.highlight = this.firstRow();
    return true;
  }
}

export interface SheetOptions {
  filterable?: boolean;
  remember?: boolean;
  at?: string;
  /** A grid of this many columns (see Level.columns). */
  columns?: number;
  /** The icon drawn before the title (views/icons.ts; R83: the Menu's view). */
  icon?: IconId;
  /** Find (R4a): letters search with this instead of filtering the labels (see Level.search). */
  search?: (query: string) => readonly MenuItem[];
  /** A text to read in place of rows (see Level.text). */
  text?: string | (() => string);
  /** The credits (see Level.credits). */
  credits?: readonly CreditBlock[];
  /** The uncertainty sheet's head (see Level.unc). */
  unc?: UncHead;
  /** Several lines for the preview (see Level.longPreview). */
  longPreview?: boolean;
  /** R800: a digit key only highlights its row (see Level.digitPick). */
  digitPick?: "highlight";
  /** A letter grid above the list, of this many columns (see Level.cells). */
  cells?: number;
  /** What Enter runs for the letters typed (see Level.typed). */
  typed?: (name: string) => MenuItem;
  /** The line under the list (see Level.note). */
  note?: () => string | undefined;
  /** The rows' load while they are not in (see Level.loading). */
  loading?: () => Promise<void> | null;
  /** A stored matrix's grid in place of rows (see Level.grid). */
  grid?: MatrixGrid;
  /** R145: where the ⚙ in the title row goes, read when it is tapped: Settings as a level of this sheet, or (before its
   *  code is in) a function that opens Mode › Settings. Absent: no ⚙. */
  settings?: () => SubMenu | (() => void);
}

/** What a pick did: opened a submenu or did nothing (the sheet stays), or chose an item to run (the sheet closes). */
export type Picked = { kind: "stay" } | { kind: "run"; item: MenuItem };
const STAY: Picked = { kind: "stay" };

/** R725: the Chars sheet (Shift + Vars): a grid drawn over the view like a list that takes letters, so the keypad's digit keys
 *  stay uncovered, and whose digit keys pick a cell of the row with the focus (Level.digits). */
const CHARS_SHEET = "chars";

export class Sheet {
  /** Names the sheet for the remembered pick: `apps`, `menu:<place>`, `list:<title>`. */
  readonly id: string;
  levels = $state.raw<Level[]>([]);
  /** The list takes letters (a long list, Find later): it stays above the keypad, whose letter keys its query needs.
   *  Every other sheet is drawn over the keypad's maths rows (decisions.md "R21"). Fixed when it opens, but for a matrix
   *  grid (R188): it is drawn over the view, so the keypad stays free and its on-screen arrows move the highlight (over
   *  the keys, R144's tap outside would close the sheet). */
  get letters(): boolean {
    return this.rootLetters || this.level.grid !== undefined;
  }
  private readonly rootLetters: boolean;
  /** The icon before the title, if any. */
  readonly icon: IconId | undefined;
  private readonly settings: SheetOptions["settings"];
  /** R281: the id of the item armed by a first pick (MenuItem.confirm), else null: a second pick of it runs it. */
  armed = $state<string | null>(null);

  constructor(id: string, title: string, items: () => readonly MenuItem[], opts?: SheetOptions) {
    this.id = id;
    this.icon = opts?.icon;
    this.settings = opts?.settings;
    const root = new Level(title, items, id, opts);
    this.levels = [root];
    this.rootLetters = root.filterable || id === CHARS_SHEET;
  }

  get level(): Level {
    return this.levels[this.levels.length - 1] as Level;
  }
  get depth(): number {
    return this.levels.length;
  }
  /** R145: the ⚙ stands in the title row of the root level when the sheet was given Settings. */
  get hasSettings(): boolean {
    return this.settings !== undefined && this.levels.length === 1;
  }
  /** R145: the ⚙ (or an empty ☰): Settings as the next level, or run what opens it (the run item is never drawn: no label). */
  openSettings(): Picked {
    const to = this.hasSettings ? this.settings?.() : undefined;
    if (typeof to === "function") return { kind: "run", item: { id: "", label: "", run: to } };
    if (to) this.push(this.level, "settings", to);
    return STAY;
  }
  /** The title with its path, e.g. `Menu › Intersection of F2(x) and`; the last three levels when deeper (the title
   *  row is one line: `Help and about › Parts › GPL-3.0-or-later`). */
  get path(): string {
    return this.levels.slice(-3).map((l) => l.title).join(" › ");
  }

  /** Digit keys and taps: the row numbered `n` (1…10; 11 and 12 in a list of at most 12 rows, R780) on screen. A grid has no numbers: a digit does nothing there, but in
   *  a grid with `digits` (Chars, R725) it picks the n-th cell of the row with the focus (0 is the tenth). */
  pickNumber(n: number): Picked {
    const grid = this.level;
    if (grid.columns !== undefined) {
      if (!grid.digits || n > grid.columns) return STAY;
      const i = Math.floor(Math.max(grid.highlight, 0) / grid.columns) * grid.columns + n - 1;
      return i < grid.items.length ? this.activate(i) : STAY;
    }
    const row = this.level.rows.find((r) => r.n === n);
    if (row && grid.digitPick === "highlight") {
      grid.highlight = row.index;
      return STAY;
    }
    return row ? this.activate(row.index) : STAY;
  }

  /** A key that picks a grid cell by its place (Shift + 6, R18: 7 8 9 ÷ / 4 5 6 × / 1 2 3). Undefined: no cell of the
   *  open level is picked by this key, so the key does its usual sheet job. */
  pickKey(keyId: string): Picked | undefined {
    if (this.level.columns === undefined || this.level.digits) return undefined;
    const i = this.level.items.findIndex((x) => x.pick?.key === keyId);
    return i < 0 ? undefined : this.activate(i);
  }

  /** A free key pressed while its slots are listed (Settings › Your keys, R4b): the highlight goes to that key's row in
   *  that layer. False when the open level lists no such slot, so the key does its usual sheet job. */
  goKey(keyId: string, layer: string): boolean {
    const i = this.level.items.findIndex((x) => x.slot?.key === keyId && x.slot.layer === layer);
    if (i < 0) return false;
    this.level.highlight = i;
    return true;
  }

  /** R777: does the open level take a tap on this key for a job of its own, before the usual sheet reading (sheetPress): a grid's
   *  cells (R189), a free key's slot it lists (goKey), a key at a grid cell's place (pickKey)? Asked without acting. `layer`: the keypad's. */
  takes(key: Key, layer: string): boolean {
    const l = this.level;
    return !!l.grid || (!!key.user && l.items.some((x) => x.slot?.key === key.id && x.slot.layer === layer)) || (l.columns !== undefined && !l.digits && l.items.some((x) => x.pick?.key === key.id));
  }

  /** R777 (route.ts deadPress): is a tap on this key a dead press here, without acting: ⌫ with nothing typed (R770) in a list that
   *  takes no ⌫ of its own (Find goes back a level, the store sheet's line job) and not a key the level takes (takes)? */
  deadKey(key: Key, layer: string): boolean {
    const l = this.level;
    return this.id !== "find" && this.id !== "store" && !l.loading() && l.filter === "" && sheetKey(key, l.filterable).kind === "backspace" && !this.takes(key, layer);
  }

  /** Enter: the highlighted item. A setting changed in place (`adjust`) is picked as it stands: the sheet closes. */
  enter(): Picked {
    const typed = this.level.typed;
    if (typed && this.level.filter !== "") return { kind: "run", item: typed(this.level.filter) };
    return this.activate(this.level.highlight, true);
  }

  /** Any press but the armed item's second pick (R281): the armed item goes back to its plain state. */
  disarm(): void {
    this.armed = null;
  }

  /** ▶: step the highlighted setting up, else open the highlighted item's submenu (only an item that has one). */
  right(): Picked {
    if (this.level.grid) {
      this.level.grid.move(0, 1);
      return STAY;
    }
    if (this.level.cells !== undefined) {
      this.level.stepRow(1);
      return STAY;
    }
    if (this.level.columns !== undefined) {
      this.level.step(1);
      return STAY;
    }
    const item = this.level.current;
    if (item?.put && !item.disabled) {
      item.put.run();
      return STAY;
    }
    if (item && !item.disabled && item.adjust) {
      item.adjust(1);
      return STAY;
    }
    return item?.submenu ? this.activate(this.level.highlight) : STAY;
  }

  /** ◀ on a setting changed in place: step it down. False when the highlighted item is not one (◀ then goes back). */
  left(): boolean {
    if (this.level.grid) {
      this.level.grid.move(0, -1);
      return true;
    }
    if (this.level.cells !== undefined) {
      this.level.stepRow(-1);
      return true;
    }
    if (this.level.columns !== undefined) {
      this.level.step(-1);
      return true;
    }
    const item = this.level.current;
    if (!item || item.disabled || !item.adjust) return false;
    item.adjust(-1);
    return true;
  }

  /** A tap on a row's ◀ or ▶ button (R21a): step that setting and highlight its row. */
  adjustAt(index: number, by: 1 | -1): void {
    const item = this.level.items[index];
    if (!item || item.disabled || !item.adjust) return;
    this.level.highlight = index;
    item.adjust(by);
  }

  /** A tap on one of a row's value buttons (R86): the value is set and the sheet closes, as a pick of that value. */
  pickOption(index: number, optionId: string): Picked {
    const item = this.level.items[index];
    const option = item?.options?.find((o) => o.id === optionId);
    if (!item || item.disabled || !option || option.disabled) return STAY;
    this.level.highlight = index;
    lastPicks.set(this.level.memo, item.id);
    return { kind: "run", item: { id: option.id, label: option.label, run: () => option.run() } };
  }

  /** R778: the sheet fills the whole screen, the keys under it (a touch view); per open sheet, so closing it resets it. */
  full = $state(false);
  /** R778: this level has no fixed size, so its corner button may fill the screen: a list that takes letters (Find, Vars, Units,
   *  a menu over 10 rows) or the Chars grid. A short list, the Mode levels, Tmpl, the Shift palettes, the store sheet's letters
   *  and a text, a matrix or the credits have none. */
  get fillable(): boolean {
    const l = this.level;
    return l.grid === undefined && l.cells === undefined && l.text === undefined && l.credits === undefined && l.unc === undefined && (l.filterable || l.digits);
  }

  /** ◀ and Esc: back one level; a full sheet goes back to the viewport first. False at the root: the caller closes the sheet. */
  back(): boolean {
    if (this.full) {
      this.full = false;
      return true;
    }
    if (this.levels.length <= 1) return false;
    this.levels = this.levels.slice(0, -1);
    return true;
  }

  /** Pick by index in the full list: a disabled item does nothing, a submenu opens on top, a setting changed in place
   *  steps forward (unless `confirm`: Enter), a switch (`keep`) runs and stays, anything else runs and closes. */
  activate(index: number, confirm = false): Picked {
    const level = this.level;
    const item = level.items[index];
    if (!item || item.disabled) return STAY;
    level.highlight = index;
    lastPicks.set(level.memo, item.id);
    // R281: an item that asks first arms on its first pick; the second pick of it runs it
    const armed = this.armed === item.id;
    this.armed = item.confirm && !armed ? item.id : null;
    if (item.confirm && !armed) return STAY;
    if (!item.submenu && item.adjust && !confirm) {
      item.adjust(1);
      return STAY;
    }
    if (item.keep) {
      item.run?.();
      return STAY;
    }
    if (item.submenu) {
      this.push(level, item.id, item.submenu);
      return STAY;
    }
    return { kind: "run", item };
  }

  /** A submenu on top of `level`, from the item `id`. */
  private push(level: Level, id: string, sub: SubMenu): void {
    const base: SheetOptions = sub.search ? { search: sub.search, remember: false } : { remember: sub.remember ?? true };
    const opts: SheetOptions = { ...base, ...(sub.text === undefined ? {} : { text: sub.text }), ...(sub.longPreview ? { longPreview: true } : {}), ...(sub.loading ? { loading: sub.loading } : {}), ...(sub.at === undefined ? {} : { at: sub.at }), ...(sub.grid ? { grid: sub.grid } : {}), ...(sub.note ? { note: sub.note } : {}) };
    sub.grid?.open(); // R188: the matrix is read (again) each time its grid opens
    this.levels = [...this.levels, new Level(sub.title, () => sub.items, `${level.memo}/${id}`, opts)];
  }
}
