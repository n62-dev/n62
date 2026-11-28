// SPDX-License-Identifier: GPL-3.0-or-later
// The calculator session: current view, modifier keys, settings and the history of both views.
// Plain logic on Svelte 5 runes; the engine comes in through the Calc port.
import { CalcFailure, type AngleUnit, type Calc, type CalcSettings, type ConstTable, type NumberFormat, type StoredRead, type UncTerm, type UserName } from "../calc/port.ts";
import { ANS_KEY, pruneChips, validChips, type Chip, type ChipTable } from "../input/chips.ts";
import { parseFailText } from "../input/errors.ts";
import { loadEntry } from "../input/parser.ts";
import { t } from "../i18n/index.ts";
import { type ComplexValue, type MarkInfo } from "../engine/format.ts";
import type { GroupSep } from "../render/home.ts";
import {
  DEFAULT_FMT_CYCLE,
  isFmtMode,
  isFormStep,
  markFor,
  normalizeCycle,
  renderNumeric,
  commaResult,
  type FmtMode,
  type DisplayContext,
  type Drawn,
  type FormStep,
  type Polar,
  type Rational,
  type ResultFacts,
  modeOf,
} from "./displayMode.ts";
import { defaultLook, validLook, type Look } from "../theme/look.ts";
import { idbKv, type Kv } from "./storage.ts";
import { Taps } from "./tapsFront.svelte.ts";
import type { UseCounter, UseKey } from "./uses.svelte.ts";
import { commaInput } from "../entry/commaInput.ts";
import { chipOf, HISTORY_LIMIT, rowUid, withUnit } from "./results.ts";
import { itemsOr, prefetchItems } from "./itemLoad.ts";
import { targetRow } from "./pickRows.ts";
import { onTidy } from "./tidyLoad.ts";
import { storedReader } from "./storedLoad.ts";
export { loadTidy } from "./tidyLoad.ts";
import type { Copies, RemovedKind, RemovedRows } from "./removedRows.ts";
import type { UnitRow } from "../units/types.ts";
import { takeLeft } from "../units/kept.ts";
import type { WordSetting } from "./wordSetting.ts";
import { isBarSlot, type BarSlot } from "../apps/registry.ts";

export type View = "home" | "cas";
type FormKey = "cycleFormat" | "cycleForm";
export type EntryMode = "textbook" | "line" | "rpn"; // R253: rpn is kept, no key reads it yet (R343)

/** Key vibration (off by default). Strength 0..100 %, duration in ms; the web build can only set the duration. */
export interface HapticsSettings {
  on: boolean;
  strength: number;
  ms: number;
  /** The optional key click at each press (A66), apart from the vibration: it sounds with the vibration off too. */
  click: boolean;
}
export const HAPTIC_MS_RANGE = { min: 5, max: 100 } as const;

/** The decimal mark (R57, docs/05 3.4): the point, or the comma (typed `{,}`, drawn `,`; `;` separates arguments). */
export type DecimalMark = "point" | "comma";
/** R40, Settings › Numbers › Uncertainty: the digits past a constant's σ are muted, and a tap on the row shows σ (`sigma`,
 *  the default) or nothing (`muted`); R884: `round`, the value drawn to σ's last digit, σ on tap. */
export type UncertaintyView = "sigma" | "muted" | "round";
/** R124, Settings › Numbers › Marks: marks in --muted, a ⚠ in colour, or that with its reason line (the default). */
export type MarkStyle = "muted" | "colour" | "reason";
export interface Settings extends CalcSettings {
  entry: EntryMode;
  decimalMark: DecimalMark;
  /** Notations the Format key (fmt) cycles through, in canonical order. */
  fmtCycle: FmtMode[];
  /** Decimals of the Fixed mode. */
  fixDecimals: number;
  uncertainty: UncertaintyView;
  marks: MarkStyle;
  groupSep: GroupSep; // R125, Settings › Numbers › Digit groups: the drawn groups' separator (Copy has none)
  haptics: HapticsSettings;
  /** Settings › Appearance (R50e): family, brightness, High contrast, Plain keys. */
  look: Look;
  /** R782: the bar's second place beside Home: CAS, or an app (a second tap on it chooses; views/StatusLine.svelte). */
  barSlot: BarSlot;
}
/** The stored settings' version (docs/04 6.2): 1 = no field (digits ≤ 15, formats std/sci/eng), 2 = digits ≤ 30, pfx,
 *  3 = `look` (R50e), 4 = the decimal mark (R57), 5 = the bar's second place `barSlot` (R782). Raising it raises DATA_VERSION too (storage.ts SETTINGS_SINCE, R94). */
export const SETTINGS_SCHEMA = 5;
/** Most significant digits the setting allows (docs/04 2.5). */
export const MAX_DIGITS = 30;
export const defaultSettings: Settings = {
  digits: 12,
  angle: "rad",
  format: "std",
  entry: "textbook",
  decimalMark: "point",
  fmtCycle: [...DEFAULT_FMT_CYCLE],
  fixDecimals: 4,
  uncertainty: "sigma",
  marks: "reason",
  groupSep: "thin", // R125
  haptics: { on: false, strength: 50, ms: 15, click: false },
  look: defaultLook(),
  barSlot: "cas",
};

/** "note" is a line the app says itself (G19's safe start): text only, no entry and no result, and never stored. */
export type ItemStatus = "pending" | "done" | "error" | "cancelled" | "note";
/** G642: what Ans was when a row read it, frozen with the row (owner, 2026-11-20, H3): the chip Ans resolved to at Enter,
 *  the source row's result LaTeX as the screen drew it then (`shown`, in its format and digits) and that row's uid
 *  (`from`, G211). Never in the chip table: a recall resolves Ans again. A row stored before G642 has only `value` and
 *  `exact` (drawn with the word Ans, R836); the store drops a `shown` over FULL_LIMIT (storedItem.ts). */
export interface AnsSnapshot extends Chip {
  shown?: string;
  from?: string;
}

export interface HistoryItem {
  id: number;
  view: View;
  /** The entry as MathLive LaTeX (drawn in 2D, and put back on the entry line when tapped). */
  latex: string;
  status: ItemStatus;
  /** The result, as LaTeX for the 2D renderer (empty unless status is done). */
  resultLatex: string;
  /** Plain text of the result or the error message. */
  text: string;
  approximate: boolean;
  /** Home: the numeric result, formatted on demand so a settings change re-formats the whole history. */
  value?: ComplexValue;
  /** What the engine knows about the result's accuracy: the mark, and which digits are drawn (docs/04 2.4). */
  facts?: ResultFacts;
  /** An exact rational result (Fraction and Mixed fraction modes). */
  rational?: Rational;
  /** r∡θ, filled the first time the Format key shows this complex result in polar form. */
  polar?: Polar;
  /** The mode the Format key chose for this result only; undefined: the global setting (Home) or the exact form (CAS). */
  fmt?: FmtMode;
  /** The form the a b/c key chose for this result only (R10); drawn instead of `fmt` until the Format key is pressed. */
  form?: FormStep;
  /** The values of the chips in `latex` (docs/04 3.6), so a recalled entry needs no engine or index. Ans is not kept here
   *  (a recall resolves it again); `ans` keeps what it was. */
  chips?: ChipTable;
  /** The value a \res chip of this result carries (docs/04 2.8): the exact text, or its confirmed decimal (R65). */
  full?: string;
  /** `full` is the exact value (a fraction, an exact expression), not rounded digits. */
  fullExact?: boolean;
  /** CAS in DEG: the text drawn, when `full` (the radian text of chips and Ans) differs from it; Copy gives this one. */
  drawn?: string;
  /** An inexact chip went into the input, so the result is never marked "=" (docs/04 2.4, decisions M4-4). */
  inexactInput?: boolean;
  /** CAS: the stored values the input read, each with the view that stored it (F28); absent when there is none. */
  uses?: UsedValue[];
  /** G212, Home: the stored values the input read, as a CAS row's `uses` (the session line's `defs`); never drawn. */
  defsUsed?: UsedValue[];
  /** G274, Home: each uncertain input's share of σ² (HomeResult.uncTerms); never drawn yet, read back unchecked. */
  uncTerms?: UncTerm[];
  /** G213f1, G642: Ans as it was at Enter, when the input read it (AnsSnapshot); each stored name read with its value ([] none). */
  ans?: AnsSnapshot;
  reads?: StoredRead[];
  /** G67: the input changed one of the engine's settings, which was put back (a line under the result says so). */
  settingReset?: true;
  /** R63: a unit-view result (units/row.ts): its request, Quantity summary and chip. Read back unchecked (see UnitRow). */
  units?: UnitRow;
  /** R63: a unit result's chip (Ans too) went into the input, or R902 the line kept unit slots (left with Esc); Home has no units: a line under the result says so (G782: not for a ratio unit's, entered as its pure number). */
  unitDropped?: true;
  /** G211: the row's identity across runs (never `id`, results.ts rowUid); its job's Giac text, angle, digits, word (R194); `at`: finished. */
  uid?: string;
  giac?: string;
  angle?: AngleUnit;
  /** R265: this row is a recall of one typed in the other angle mode, run unchanged in `angle`: the mode it was typed in (a note says so). */
  typedIn?: AngleUnit;
  /** R265: the row's input reads the angle (its Giac text holds the degree factor, set where the row's job is kept, resultItem.ts): the tag and the recall note are for these rows only. */
  readsAngle?: true;
  digits?: number;
  word?: WordSetting;
  at?: number;
  startedAt: number;
}

export interface UsedValue {
  name: string;
  preview: string;
  view: View;
}

/** R98: the Undo copy's code (removedRows.ts) is out of the start chunk: main.ts fetches it when idle, and the first
 *  Clear or Delete, or a start that finds a stored copy, waits for it. A failed load is tried again by the next one. */
let removedCode: typeof import("./removedRows.ts") | undefined;
/** R40: the σ line's and the muted digits' code: the tidy chunk, once it is in (main.ts loads it when idle, and each
 *  job beside it; a failed load is tried again by the next job). Until then a row draws every digit plain. */
let sigmaCode = $state.raw<typeof import("../render/tidy.ts")>();
onTidy((m) => (sigmaCode = m));
/** R135: the Format and a b/c keys' code (cycleForms.ts), out of the start chunk the same way. */
let formsCode = $state.raw<typeof import("./cycleForms.ts")>(); // R192: a base form is drawn by it, once in
export const loadForms = (): Promise<typeof import("./cycleForms.ts") | undefined> =>
  import("./cycleForms.ts").then((m) => (formsCode = m), () => undefined);
export const loadRemoved = (): Promise<typeof import("./removedRows.ts") | undefined> =>
  import("./removedRows.ts").then((m) => (removedCode = m), () => undefined);

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(n)));
const clampDigits = (n: number): number => Math.min(MAX_DIGITS, Math.max(1, Math.round(n)));

/** The haptics settings from a stored or merged record: a missing number is the default's, the rest is clamped. */
function hapticsOf(h: Partial<HapticsSettings>): HapticsSettings {
  const d = defaultSettings.haptics;
  return {
    on: h.on === true,
    strength: clamp(typeof h.strength === "number" ? h.strength : d.strength, 0, 100),
    ms: clamp(typeof h.ms === "number" ? h.ms : d.ms, HAPTIC_MS_RANGE.min, HAPTIC_MS_RANGE.max),
    click: h.click === true,
  };
}

/**
 * The settings from what was stored (docs/04 6.2): field by field, so a wrong or missing field keeps its default.
 * `schema` absent is version 1 (digits ≤ 15, formats std/sci/eng); version 2 allows digits ≤ 30 and `pfx`; version 3
 * adds `look`, version 4 `decimalMark`. Every older value stays valid and a missing mark is the point, so the
 * migration only has to write the data back with the new schema. A newer schema (a downgrade) is `newer`, never
 * `migrated`: what this version knows is read, and the record is not written over (R94).
 * `firstLook` is the look of a start with nothing stored (Android: Dark; High contrast when the system asks for it).
 */
export function migrateSettings(saved: unknown, firstLook: Look = defaultSettings.look): { settings: Settings; migrated: boolean; newer: boolean } {
  const s = structuredClone(defaultSettings);
  s.look = { ...firstLook };
  const x = (saved && typeof saved === "object" ? saved : {}) as Partial<Record<keyof Settings | "schema", unknown>>;
  /** The stored `k` when it is one of `ok`; anything else keeps the default (R884: one rule for these fields). */
  const one = <K extends keyof Settings>(k: K, ...ok: Settings[K][]): void => {
    if (ok.includes(x[k] as Settings[K])) s[k] = x[k] as Settings[K];
  };
  one("angle", "rad", "deg");
  one("format", "std", "sci", "eng", "pfx");
  one("entry", "textbook", "line", "rpn");
  one("decimalMark", "point", "comma");
  one("uncertainty", "muted", "round"); // R40, R884: else sigma
  one("marks", "muted", "colour"); // R124: else ⚠ + reason
  one("groupSep", "apos", "comma"); // R125: else the thin space
  if (typeof x["digits"] === "number" && Number.isFinite(x["digits"])) s.digits = clampDigits(x["digits"]);
  if (Array.isArray(x["fmtCycle"])) s.fmtCycle = normalizeCycle(x["fmtCycle"].filter(isFmtMode));
  if (typeof x["fixDecimals"] === "number" && Number.isFinite(x["fixDecimals"])) s.fixDecimals = clamp(x["fixDecimals"], 0, 12);
  s.haptics = hapticsOf((x["haptics"] ?? {}) as Partial<HapticsSettings>); // (no record, or one from before A66: the defaults, click off)
  s.look = validLook(x["look"], firstLook);
  if (isBarSlot(x["barSlot"])) s.barSlot = x["barSlot"]; // R782: an id this build does not know (an older or newer build) is CAS
  const newer = typeof x["schema"] === "number" && x["schema"] > SETTINGS_SCHEMA;
  return { settings: s, migrated: !newer && x["schema"] !== SETTINGS_SCHEMA, newer };
}

/** The look of a first start: Dark in the Android app, System in the PWA; High contrast when the phone asks for more (R50e). */
function firstLook(): Look {
  const w = globalThis as { Capacitor?: { isNativePlatform?: () => boolean }; matchMedia?: (q: string) => { matches: boolean } };
  return defaultLook(w.Capacitor?.isNativePlatform?.() === true, w.matchMedia?.("(prefers-contrast: more)").matches === true);
}

export class Session {
  view = $state<View>("home");
  shift = $state(false);
  alpha = $state(false);
  /** Alpha lock (L3): alpha stays on after each key; capsLock keeps shift on too (shift + alpha: lower case, P4). */
  alphaLock = $state(false);
  capsLock = $state(false);
  /** Shift lock (a second tap on Shift, R726, or a flick up on it, R9): shift stays on after each key until Shift is tapped or flicked again. */
  shiftLock = $state(false);
  /** The press counts (R9, R70, R127), shown in Settings; R320: a front that queues them until the counter's chunk is in. */
  readonly taps: Taps;
  /** The use counters by key (uses.svelte.ts, its own chunk), once uses() loaded them: `uses` results mode's (R53), `bar-uses` the bar's (R722). */
  useCounters = $state.raw<Partial<Record<UseKey, UseCounter>>>({});
  private usesLoad: Partial<Record<UseKey, Promise<UseCounter>>> = {};
  settings = $state<Settings>(structuredClone(defaultSettings));
  home = $state<HistoryItem[]>([]);
  cas = $state<HistoryItem[]>([]);
  /** Set when the engine is starting or failed to start. */
  engineState = $state<"starting" | "ready" | "failed">("starting");
  /** R284: why the engine failed to start, from the port's CalcFailure kind (G318, G315; never its text); unset until it has. */
  engineFailure = $state<"load" | "memory" | "crash">();
  /** The user's variables and functions, the stored ones included (Vars, Find's live items; docs/04 3.4, 6.2). */
  userNames = $state<UserName[]>([]);

  private nextId = 1;
  /** The engine port; Memory's purge (find/names.svelte.ts forget) runs through it too. */
  readonly calc: Calc;
  /** Settles once the stored names were first read (or the engine failed): a parse waits for it, so a function from
   *  before a relaunch is a call from the first Enter on (R56). */
  private readonly namesRead: Promise<void>;

  private readonly kv: Kv;
  /** Put a look on the page (main.ts: theme/lookApply.ts); called when it changes and once the settings are read. */
  onLook: ((look: Look) => void) | undefined;
  /** Home ↔ CAS, called before the switch (main.ts: the entry line's undo starts afresh, R898). */
  onView: (() => void) | undefined;
  /** 0 = write the history at once (tests); the app sets a delay so Enter does not wait for the store. */
  saveDelayMs = 0;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  /** R106: the stored history has been read and merged in. Until then nothing writes `history`: the lists in memory
   *  hold only what was typed since launch, so a write (a hide or close before the read, docs/04 6.2) would drop the
   *  stored rows. A save asked for meanwhile is kept pending and runs once the read is in. R860: History's empty state waits for it. */
  #read = $state(false);
  get historyRead(): boolean { return this.#read; }
  private savePending = false;
  /** R94: the stored settings are from a newer schema. They are read and kept in memory, never written. */
  private settingsNewer = false;

  uses(key: UseKey = "uses"): Promise<UseCounter> {
    const add = (c: UseCounter): UseCounter => ((this.useCounters = { ...this.useCounters, [key]: c }), c);
    return (this.usesLoad[key] ??= import("./uses.svelte.ts").then((m) => add(new m.UseCounter(this.kv, undefined, key))));
  }

  constructor(calc: Calc, kv: Kv = idbKv) {
    this.kv = kv;
    this.calc = calc;
    this.taps = new Taps(kv);
    this.namesRead = calc.ready().then(
      (info) => {
        if (info?.safeStart) this.note(t("engine.safeStart"));
        this.engineState = "ready";
        return this.refreshNames();
      },
      (e: unknown) => {
        const kind = e instanceof CalcFailure ? e.kind : "engine"; // G315: the port's kind, never engine/types.ts
        this.engineFailure = kind === "load" || kind === "memory" ? kind : "crash";
        this.engineState = "failed";
      },
    );
  }

  /** Says something once as a history line, in both views (the definitions are shared, and the open view may still be
   *  restoring). Notes are not stored: the saved history keeps finished entries only. */
  note(text: string, views: readonly View[] = ["home", "cas"]): void {
    for (const view of views) {
      (view === "home" ? this.home : this.cas).push({
        id: this.nextId++,
        view,
        latex: "",
        status: "note",
        resultLatex: "",
        text,
        approximate: false,
        startedAt: performance.now(),
      });
    }
  }

  /** R272: a dropped row says so once per install, in the view that dropped it (state/dropNote.ts, a lazy chunk, decides). */
  private noteDrop(view: View, gone: HistoryItem[]): void {
    void import("./dropNote.ts").then((m) => m.noteFirstDrop(this.kv, gone, (text) => this.note(text, [view])), () => undefined);
  }

  /** Reads the user's names again from the engine's definitions log (after a job that may have changed it). */
  async refreshNames(): Promise<void> {
    try {
      this.userNames = await this.calc.names();
    } catch {
      /* the engine restarts on its own; the next job refreshes the list */
    }
  }

  get items(): HistoryItem[] {
    return this.view === "home" ? this.home : this.cas;
  }
  get busy(): boolean { return this.pending !== undefined; } // (R860: one test for a running row, the pending getter's)
  get pending(): HistoryItem | undefined {
    return [...this.home, ...this.cas].find((i) => i.status === "pending");
  }

  // ---- modifiers: one tap arms Shift or Alpha for one key, a second tap locks it, a third ends it (R726). Alpha twice locks
  // capitals; shift, alpha, alpha lower case. While Alpha is armed or locked, Shift is one-shot and flips the case of the next
  // letter (a second Shift tap there does not lock). Lock flicks (P7 point 3, R9): up on Shift locks shift, down on Alpha
  // locks capitals, up on Alpha lower case. One lock at a time: a lock flick replaces the other lock, and the same flick
  // again (or a tap on that key) unlocks. A tap on the bar's ⇧/α sign ends any of them (releaseModifiers).
  toggleShift(): void {
    if (this.shiftLock) this.shiftLock = this.shift = false; // (Alpha is left as it is: a Shift tap while it is on flips one letter's case)
    else if (this.shift && !this.alpha) this.shiftLock = true;
    else this.shift = !this.shift;
  }
  /** Flick up on Shift. */
  flickShiftLock(): void {
    const on = !this.shiftLock;
    this.releaseModifiers();
    this.shiftLock = this.shift = on;
  }
  /** Flick down (capitals) or up (lower case) on Alpha. */
  flickAlphaLock(lower: boolean): void {
    const on = !(this.alphaLock && this.capsLock === lower);
    this.releaseModifiers();
    this.capsLock = this.shift = on && lower;
    this.alphaLock = this.alpha = on;
  }
  /** Every lock and every armed layer off (a lock flick's first step; R700: Android back; R726: a tap on the bar's ⇧/α sign). */
  releaseModifiers(): void {
    this.shiftLock = this.alphaLock = this.capsLock = this.alpha = this.shift = false;
  }
  toggleAlpha(): void {
    if (this.alphaLock) this.releaseModifiers(); // (no shift lock is on beside an Alpha lock: one lock at a time)
    else if (this.alpha) {
      this.alphaLock = true;
      this.capsLock = this.shift;
      this.shiftLock = false; // one lock at a time (a shift lock made this a lower-case lock)
    } else this.alpha = true;
  }
  clearModifiers(): void {
    this.shift = this.shiftLock || this.capsLock; // (a caps lock is only ever on with the Alpha lock)
    this.alpha = this.alphaLock;
  }

  toggleView(): void {
    this.setView(this.view === "home" ? "cas" : "home");
  }
  setView(v: View): void {
    if (v !== this.view) this.onView?.(); // R898: the shared line's undo stops at the switch
    this.view = v;
    this.saveView();
  }

  // ---- settings
  setDigits(n: number): void {
    this.settings.digits = clampDigits(n);
    this.save();
  }
  setAngle(a: AngleUnit): void {
    this.settings.angle = a;
    this.save();
  }
  setFormat(f: NumberFormat): void {
    this.settings.format = f;
    this.save();
  }
  setEntry(m: EntryMode): void {
    this.settings.entry = m;
    this.save();
  }
  setDecimalMark(m: DecimalMark): void {
    this.settings.decimalMark = m;
    this.save();
  }
  /** The comma is the decimal mark (R57): the keys, the parser, the drawn results and Copy read this. */
  get decimalComma(): boolean {
    return this.settings.decimalMark === "comma";
  }
  /** A row's input as drawn and recalled: `;` for its argument commas in comma mode (R100, display only). */
  input(item: HistoryItem): string {
    return this.decimalComma ? commaInput(item.latex) : item.latex;
  }
  // setFmtMode and setFixDecimals, which only the Mode sheet calls, are in modeSets.ts (G792: the start chunk's pin)
  setHaptics(h: Partial<HapticsSettings>): void {
    this.settings.haptics = hapticsOf({ ...this.settings.haptics, ...h });
    this.save();
  }

  // ---- evaluation
  /**
   * Start evaluating the entry in the current view. Returns undefined when there is nothing to do (empty
   * line, or a job is running); otherwise the history item exists at once and the promise settles when
   * the job has finished, failed or been cancelled.
   */
  submit(latex: string, giacOverride?: string, chips: ChipTable = {}, typedIn?: AngleUnit): Promise<void> | undefined {
    if (latex.trim() === "" || this.busy || this.engineState === "failed") return undefined; // (R284: nothing would answer)
    const view = this.view;
    if (this.undoCopy) {
      this.setCopy(view, null); // R98: a new input drops this view's Undo of Clear and Delete (R119: the other view's stays),
      this.saveHistory(); // in the store too at once (a relaunch before a long job ends must not bring it back)
    }
    const list = view === "home" ? this.home : this.cas;
    // Ans is the view's last result now, at Enter (as on the reference), not when the key was pressed.
    const src = targetRow(list);
    const ans = src && this.chipFor(src);
    const usesAns = /\\ans(?![a-zA-Z])/.test(latex);
    const kept = pruneChips(chips, latex);
    const table: ChipTable = ans ? { ...kept, [ANS_KEY]: ans } : kept;
    const id = this.nextId++;
    const dropped = takeLeft(latex) && view === "home"; // R902: the line the unit view left with slots, unchanged (units/kept.ts)
    list.push({
      id,
      uid: rowUid(id), // G211
      view,
      latex,
      status: "pending",
      resultLatex: "",
      text: "",
      approximate: false,
      ...(Object.keys(kept).length ? { chips: kept } : {}),
      ...(typedIn ? { typedIn } : {}), // R265 (the caller passes it only when it differs from the mode on show)
      // G213f1, G642: not in `chips` (a recall resolves Ans again); the source row's result as the screen draws it now (the
      // store drops a `shown` over FULL_LIMIT, storedItem.ts) and its uid
      ...(usesAns && ans && src ? { ans: { ...ans, shown: this.display(src, true).latex, from: src.uid } } : {}),
      ...(dropped ? { unitDropped: true as const } : {}), // R902
      startedAt: performance.now(),
    });
    // Read and write through the proxy in the list from here on.
    const live = list[list.length - 1] as HistoryItem;
    if (list.length > HISTORY_LIMIT) this.noteDrop(view, list.splice(0, list.length - HISTORY_LIMIT));
    if (!ans && this.hasResult(view) && usesAns) {
      // A finished result with no chip value (a symbolic text over 2 kB, R44): say why, not "no result yet"
      live.status = "error";
      live.text = t("error.ansTooLong");
      live.at = Date.now();
      this.saveHistory();
      return Promise.resolve();
    }
    return this.finish(live, view, latex, table, giacOverride).finally(() => {
      live.at = Date.now(); // G211: when it finished
      this.saveHistory();
      if (live.status === "done") void this.refreshNames();
    });
  }

  /** The chip a finished result gives when it is tapped or picked (docs/04 2.8); undefined: insert it as drawn. R63: a
   *  unit row's is R61's, kept with the row and read back unchecked, so checked here as a stored chip is. */
  chipFor(item: HistoryItem): Chip | undefined {
    return item.units ? validChips({ "res:0": item.units.chip })?.["res:0"] : chipOf(item);
  }
  /** A fresh row id (units/row.ts adds a unit row to Home's list). */
  newId(): number {
    return this.nextId++;
  }
  /** Whether the view has a finished result (Ans-first inserts \\ans then, R44). */
  hasResult(view: View = this.view): boolean {
    const list = view === "home" ? this.home : this.cas;
    return !!targetRow(list);
  }
  /** The last finished result of a view, as Ans. */
  lastChip(view: View = this.view): Chip | undefined {
    const list = view === "home" ? this.home : this.cas;
    const item = targetRow(list);
    return item && this.chipFor(item);
  }

  private async finish(live: HistoryItem, view: View, latex: string, chips: ChipTable, giacOverride?: string): Promise<void> {
    let giac: string;
    let defines: string | undefined;
    let named: ChipTable | undefined;
    let consts: ConstTable | undefined;
    const items = prefetchItems(); // R155f2: loaded beside the parser, and awaited before the engine is sent anything
    try {
      if (giacOverride !== undefined) giac = giacOverride;
      else {
        const [entry] = await Promise.all([loadEntry().catch(() => null), this.namesRead]); // (a failed load: the next Enter imports again, R263)
        if (live.status !== "pending") return; // Cancel came while the parser chunk or the names were loading
        if (!entry) return void ((live.status = "error"), (live.text = t("error.engine"))); // R263, G183: our own line, as for the item chunk
        // R56, R258: the user's names (Home and CAS share them) make their functions calls and spell out their values.
        // R65: Home sends a chip that is not exact by name. A power keeps Giac's principal root here, as in CAS (R66)
        const p = entry.giacOfEntry(latex, view, { chips, names: this.userNames });
        giac = p.giac;
        defines = p.defines;
        if (p.inexact) live.inexactInput = true;
        if (p.unitDropped) live.unitDropped = true; // R63: a chip's unit (Ans's too) dropped; G782: a ratio's never is, its chip is its pure number
        named = p.named; // (G211: its facts are read in the item chunk, resultItem.ts chipFactsOf)
        consts = p.consts; // R40: G26's uncDigits (and σ) come back for them
      }
    } catch (e) {
      live.status = "error";
      live.text = parseFailText(e);
      return;
    }
    let m: Awaited<typeof items>;
    try {
      m = await itemsOr(items); // a chunk that will not load (a tab open across a redeploy) stops the job here, before Giac defines or stores anything
    } catch {
      if (live.status === "pending") {
        live.status = "error";
        live.text = t("error.engine"); // G183: our own line, never a JS error's text
      }
      return;
    }
    if (live.status !== "pending") return;
    await m.runJob(this, live, view, giac, defines, named, consts); // R930: the engine call and the result, in the item chunk (state/jobRun.ts)
  }

  /** Stop the running job. History and variables survive; the engine restarts underneath. */
  async cancel(): Promise<boolean> {
    const p = this.pending;
    if (!p) return false;
    p.status = "cancelled";
    this.saveHistory();
    await this.calc.cancel();
    return true;
  }

  /** What the history shows for a finished item: Home numbers follow the current digits and format, or the mode
   *  the Format key chose for that item; a CAS result changes only when the Format key has chosen a mode. `grouped`: the
   *  screen's row, and Copy as shown's text (R884: under "Rounded to σ" a value with σ drawn rounded to it). */
  display(item: HistoryItem, grouped = false): Drawn {
    const shown = item.view === "home" || item.fmt !== undefined || item.form !== undefined || item.facts !== undefined;
    if (item.status === "done" && shown) {
      const r = (formsCode?.drawnIn ?? renderNumeric)(item, modeOf(item, this.settings), this.displayContext(), grouped); // R192: a base form, lazy
      // R63: a unit row draws ± σ and its unit, set apart, after the number; its text has them too (Copy as shown)
      // R885: with the σ rule's code in, its σ drawn in the value's form takes the stored one's place (sigmaForm.ts withSigma)
      if (r) return item.units ? (sigmaCode?.withSigma ?? withUnit)(r, item.units, this.decimalComma ? commaResult : undefined) : r;
    }
    // (R57) what the engine wrote, with the decimal comma, is drawn as the numbers above
    if (item.status === "done" && this.decimalComma) return { text: commaResult(item.text, false), latex: commaResult(item.resultLatex, true) };
    return { text: item.text, latex: item.resultLatex };
  }

  /** R40: the σ line a tap on the row shows (Settings › Numbers › Uncertainty), in the row's notation; null: none;
   *  undefined: its code is not in yet (sigmaCode). */
  sigma(item: HistoryItem): string | null | undefined {
    return sigmaCode?.sigmaOf(item, this.settings);
  }
  /** R124: the reason line under a ⚠ row (Settings › Numbers › Marks, "⚠ + reason"), R36's words; null: none; "" until
   *  its code (the tidy chunk, as R40's σ line) is in: the row keeps the line's place, so nothing moves when the text comes. */
  reason(item: HistoryItem): string | null {
    const m = this.settings.marks === "reason" ? this.mark(item) : null;
    // R886: a unit row whose σ has ⚠ has the line too, on a row of any mark (whyLine.ts reasonLine); until the code is in
    // only a ⚠ row keeps its place
    return m ? (sigmaCode ? sigmaCode.reason(item, m, this.settings.digits) : m.mark === "⚠" ? "" : null) : null;
  }
  /** The mark before a finished result (docs/04 2.4), for the form it is drawn in; null: a non-number, or none known. */
  mark(item: HistoryItem): MarkInfo | null {
    if (item.status !== "done") return null;
    return (formsCode?.baseMark ?? markFor)(item, modeOf(item, this.settings), this.displayContext()); // R192: a base form's, lazy
  }

  /** `mute` (R40), `groupSep` (R125): the muted digits' code once in, the separator; only the screen's row uses them.
   *  `sigma` (R885): a unit row's σ drawing rule, once in (the row and Copy as shown). */
  displayContext(): DisplayContext {
    const s = this.settings;
    return { format: s.format, digits: s.digits, fixDecimals: s.fixDecimals, angle: s.angle, ...(this.decimalComma ? { decimalComma: true } : {}), groupSep: s.groupSep, mute: sigmaCode?.muter, sigma: sigmaCode?.sigmaRow, round: s.uncertainty === "round" };
  }

  /** The row the Format key (cycleFormat) or the a b/c key on an empty line (cycleForm, R10; cycleForms.ts) takes: the picked
   *  row `at`, else the open view's newest finished result (R775, Copy's rule). Undefined when the press would change nothing
   *  (R777, G785; route.ts deadPress asks it): no such row, or, once the forms code is in, no step that draws otherwise. */
  formRow(key: FormKey, at?: number | null): HistoryItem | undefined {
    const item = targetRow(this.items, this.items[at ?? -1]);
    return item && !formsCode?.formDead(this, item, key) ? item : undefined;
  }
  /** The Format or the a b/c key on formRow's row, taken at the press before any await, and only when nothing runs: a later
   *  row must not take the act (R135f1). The code loaded: no await, the act is done before the next key. True when the
   *  display changed (R871: Fmt's text to say instead, when Say the format is on); `dead` is called when nothing did (G785: the
   *  code was not in at the press, so deadPress could not know). */
  async formKey(key: FormKey, at?: number | null, dead?: () => void): Promise<boolean | string> {
    const item = this.formRow(key, at);
    if (!item || this.busy) return false; // (deadPress gave the dead press)
    const m = formsCode ?? (await loadForms());
    return (m && (await m[key](this, this.calc, item))) || (dead?.(), false);
  }

  /** Delete one row of the open view (R11). A running row is not deleted: Cancel stops it first. Undo brings it back (R98).
   *  Resolves false when nothing was deleted (a running row, a row already gone, the Undo code that would not load). */
  removeItem(item: HistoryItem): Promise<boolean> {
    const found = this.items.find((i) => i.id === item.id);
    if (!found || found.status === "pending") return Promise.resolve(false);
    return this.takeRows("delete", (i) => i.id === item.id);
  }

  /** Clear history (R98): the finished, error and note rows go; a running row stays with its Cancel, so Esc still stops
   *  it and Enter is still refused while it runs. Undo brings the rows back; a Clear that finds nothing drops that copy. */
  clearHistory(): Promise<boolean> {
    return this.takeRows("clear", (i) => i.status !== "pending");
  }

  /** What the last Clear or Delete took in each view, one level per view, until that view's next Enter (R98, R119). */
  private copies = $state.raw<Copies>({ home: null, cas: null });
  /** The open view's copy (History draws its note). */
  get undoCopy(): RemovedRows | null {
    return this.copies[this.view];
  }
  private setCopy(view: View, c: RemovedRows | null): void {
    this.copies = { ...this.copies, [view]: c };
  }
  /** The rows are picked at the press (by id), so a row the stored history's read or an Enter adds while the code loads
   *  stays. Resolves false when the code did not load: nothing is taken without its Undo, and a note in the view says so. */
  private async takeRows(kind: RemovedKind, take: (i: HistoryItem) => boolean): Promise<boolean> {
    const [view, list] = [this.view, this.items];
    const ids = new Set(list.filter(take).map((i) => i.id));
    const m = removedCode ?? (await loadRemoved()); // (loaded: no await, the act is done before the next key)
    if (!m) {
      this.note(t("history.notRemoved"), [view]);
      return false;
    }
    const rows = m.takeOut(list, (i) => ids.has(i.id));
    this.setCopy(view, rows.length ? { view, kind, rows } : null);
    this.saveHistory(); // the list and the copy in one write
    return true;
  }
  /** Undo on an empty line, or a tap on the note (R98): the rows the open view's last Clear or Delete took go back in
   *  their places. False: no copy for this view (the line's own undo then runs, P13). */
  undoRemoved(): boolean {
    const c = this.undoCopy;
    if (!c || !removedCode) return false;
    removedCode.putBack(this.items, c.rows);
    this.setCopy(this.view, null);
    this.saveHistory();
    return true;
  }

  // ---- persistence (IndexedDB; a failure shows only in Settings › Data, R96)
  async restore(): Promise<void> {
    await this.restoreSettings();
    await this.restoreHistory();
  }
  /** Settings and the open view: small, read at launch. */
  async restoreSettings(): Promise<void> {
    const saved = await this.kv.get<unknown>("settings");
    const { settings, migrated, newer } = migrateSettings(saved, firstLook());
    if (newer && !this.settingsNewer) {
      this.settingsNewer = true;
      this.note(t("settings.newer"));
    }
    if (saved) Object.assign(this.settings, settings);
    else this.settings.look = settings.look;
    // docs/04 6.2: write the settings back as the newest schema. A start with nothing stored writes its look too, so
    // High contrast from `prefers-contrast: more` is only the first start's default (R50e).
    if (saved ? migrated : true) this.save();
    this.onLook?.($state.snapshot(this.settings.look));
    const view = await this.kv.get<View>("view");
    if (view === "home" || view === "cas") this.view = view;
  }
  /** Entry LaTeX, result LaTeX and the Home numeric value of finished entries; nothing that needs the engine. */
  saveHistory(): void {
    if (!this.#read) {
      // Writing now would overwrite the stored history with only the entries typed since launch.
      this.savePending = true;
      return;
    }
    if (this.saveDelayMs > 0) {
      // Snapshotting and storing up to HISTORY_LIMIT entries costs ~100 ms on a tablet: not on the Enter path.
      this.saveTimer ??= setTimeout(() => this.flushHistory(), this.saveDelayMs);
      return;
    }
    this.flushHistory();
  }
  /** Write the history now (also called when the page is hidden); before the stored history was read, only mark the
   *  save pending (R106). */
  flushHistory(): void {
    if (this.saveTimer !== undefined) clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    if (!this.#read) {
      this.savePending = true;
      return;
    }
    const keep = (xs: HistoryItem[]): HistoryItem[] =>
      $state.snapshot(xs).filter((i) => i.status === "done" || i.status === "error").slice(-HISTORY_LIMIT);
    const undo = removedCode?.storedCopies($state.snapshot(this.copies) as Copies);
    void this.kv.set("history", { home: keep(this.home), cas: keep(this.cas), ...(undo ? { undo } : {}) });
  }
  /** The stored history (up to HISTORY_LIMIT entries per view); the app reads it after the keypad is drawn. */
  async restoreHistory(): Promise<void> {
    // A read that never settles leaves the history unread: nothing then writes over the stored rows; so does a stored rows'
    // reader that will not load (R264: a lazy chunk, fetched beside the read). A read that fails reads as nothing stored
    // here, and the store drops every write of `history` for the session (R93, storage.ts).
    const reader = storedReader();
    const hist = await this.kv.get<{ home?: HistoryItem[]; cas?: HistoryItem[]; undo?: unknown }>("history");
    if (hist) {
      const r = await reader;
      if (!r) return;
      // Entries typed before the store answered stay after the restored ones.
      // Fresh ids: entries typed before the store answered already use the low numbers (ids key the list).
      const next = (): number => this.nextId++;
      const { home, cas, gained } = r.restoredLists(hist, next); // (G211: `gained`, a row given its uid now, is written back below)
      this.home.splice(0, 0, ...home);
      this.cas.splice(0, 0, ...cas);
      // A Clear or Delete before the read kept places in the list without the stored rows, now in front (a copy means its code is in)
      if (removedCode) this.copies = removedCode.front(this.copies, home.length, cas.length);
      // R98: the stored Undo copies (one per view, R119), unless an Enter or a Clear before the read (or meanwhile) changed the history
      const m = hist.undo && !this.savePending ? await loadRemoved() : undefined;
      if (m && !this.savePending) this.copies = m.withStored(this.copies, hist.undo, (i) => r.restoredItem(i, next()), HISTORY_LIMIT);
      if (gained) this.savePending = true;
    }
    this.#read = true;
    if (this.savePending) {
      this.savePending = false;
      this.saveHistory();
    }
  }
  /** Write the settings; never over a newer schema's record (R94: an older build would drop the fields it does not know). */
  save(): void {
    if (this.settingsNewer) return;
    void this.kv.set("settings", { schema: SETTINGS_SCHEMA, ...$state.snapshot(this.settings) });
  }
  saveView(): void {
    void this.kv.set("view", this.view);
  }
}
