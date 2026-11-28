// SPDX-License-Identifier: GPL-3.0-or-later
// The engine side of the protocol: one Giac instance, synchronous calls. Runs inside the Web
// Worker (giac.worker.ts) and, for tests and the golden runner, directly in Node. Knows nothing
// about the UI. Only erasable TypeScript syntax, so Node runs this file directly.
import type { GiacBridge, GiacParse, GiacValue } from "./bridge.ts";
import type { Request, Response } from "./protocol.ts";
import type { AnalysisRequest, AnalysisResult, CasResult, CasSettings, HomeResult, HomeSettings, SolveOutcome, SolveRequest, StoredRead, TableRequest } from "./types.ts";
import {
  ENGINE_DEFINITIONS,
  WORKER_DEFINITION_NAMES,
  floatsAsEvalf,
  homeEval,
  homeSetupCommands,
  angleCommand,
  pasdegCommand,
  safePrecision,
  toExactLiterals,
} from "./homeEval.ts";
import { askedLiterals } from "./asked.ts";
import { resolveAngle } from "./angleMigration.ts";
import { mayCombineLists, mayPowerMatrix, nonSquarePower, type Bodies, type KnownBody } from "./nonsquare.ts";
import { mayApproxRange } from "./novalue.ts";
import { mayListAsArguments } from "./listargs.ts";
import { callsIn } from "./converge.ts";
import { enEngine } from "../i18n/enEngine.ts";
import { parseText } from "../i18n/enParser.ts";
import { wordDefinitions, wordOfSettings } from "./wordSettings.ts";
import { dropAngleFactor, PASDEG } from "./angles.ts";
import { DOUBLE_DIGITS, hasFloat, valuePrecision, withDigits } from "./numeric.ts";
import { notBuiltin } from "./names.ts";
import { callsOf, holdsList, isError, isName, leadingName, namesIn, parsePrinted, typedFromPrinted, wholeCall, wordsOf } from "./giacPrint.ts";
import { restsOnDecision } from "./decisions.ts";
import { assignmentIn, clearingCall, formIn, formOf, functionTarget, mayStore, NOT_HERE_HEADS, programStores, scratchBack, STATE_HEADS, STRING_HEADS, writesScratch, writesThrough, type InputForm, type ProgramStores } from "./stores.ts";
import { fnFacts, inherited, nameFacts, readsFacts, storedFacts, storeFacts, type FactsHost } from "./facts.ts";
import { changedPart, changesOf, isOurs, namesOf, readsFrom, statePart, tableOf, type InputReads, type StoredName } from "./stateRead.ts";
import { applyDefChanges, keyOf, PREVIEW_MAX, type DefChange, type DefEntry, type NameFacts, type StoredMark } from "./defs.ts";
import { aloneFacts, resultFacts, sideShown, storedMark } from "./storedMark.ts";
import { SOLVE_HARD_TIMEOUT_S, solveRequest, unknownsOf } from "./solve.ts";
import { analyze, table } from "./analysis.ts";
import { UNIT_DEFINITIONS, unitEval, withNames } from "../units/evaluate.ts";
import { constUncDigits, inexactConstsIn, withConstValues, type ConstTable } from "./constUnc.ts";
import { CHIP_PREFIX, CONST_PREFIX, EQ_DIFF, EQ_INEXACT_FLAG } from "./ourNames.ts";
import { chipCommand, chipNameFacts, chipSigma, chipsIn, literalChip, withChipValues, type ChipFactsTable } from "./chipFacts.ts";
import { nameSigma, nameSigmaInputs, namesChanged, sigmaThrough, unitNamesOf, unitOfStore, withNameFacts, withSigmaLost } from "./nameSigma.ts";
import type { Quantity, UnitError, UnitJob } from "../units/types.ts";
import { contextDiff, hostContext, isFlagName, namesFlag, namesUnreadFlag } from "./flags.ts";
import { contextOf, gated, type GatedGiac } from "./ctxGate.ts";
import { aboutsOf, leakPart, namesAssuming, putBack, selfHolding, setsAssumption } from "./assumed.ts";
import { readMatrices, type MatrixRead } from "./matrixRead.ts";
import { readPlotValues, type PlotValue } from "./plotValues.ts";
import { exportText, importText } from "./library.ts";
import { DefsReplay } from "./defsReplay.ts";
import { casAnswer, casDecide, casErrorAnswer, casRefusals, type CasError, type CasRun } from "./casSteps.ts";
import { deadEngine, startDead } from "./dead.ts";

export { REPLAY_BATCH } from "./defsReplay.ts";

/** G65: what the call after an input found: the names it read and stored (stateRead.ts), and Giac's settings. */
export interface AfterInput {
  reads: InputReads;
  /** The table after the input (when the state was read) and the names that changed or went. */
  table: Map<string, StoredName> | null;
  changes: { changed: string[]; removed: string[] } | null;
  /** G104: the names VARS() listed that the table leaves out (ours, a name that holds itself), when the state was read. */
  skipped: Set<string> | null;
  /** A setting differed from the host's and was put back. */
  flagsChanged: boolean;
  /** …and the user's text set it (the result says it was not kept, G67). */
  reset: boolean;
  /** G93: the log's names Giac no longer holds (a command cleared them: restart(0), rm_a_z, …), when VARS() was read. */
  lost: string[];
}

/** G97: what Giac's pow prints for a base that is a list but not a square matrix (gen.cc:6881). */
const AMBIGUOUS_POWER = /\^ is ambiguous on non square matrices/;
/** G806: patch 0071's warning (rank or det decided a pivot of a float matrix within the rounding of its entries). */
const ROUNDED_PIVOT = /pivot of this float matrix was decided within the rounding/;

const NO_READS: InputReads = { names: [], targets: [], fn: false };

/** G104: the state heads whose names are the tree's targets (a name they remove is gone from VARS() too). */
const PURGE_HEADS: ReadonlySet<string> = new Set(["purge", "DelVar", "del", "unassign"]);


/** What the host needs from a loaded Giac module (engine/giac/wasm/api.cc). */
export interface GiacApi {
  eval(input: string): string;
  /** giac_set_pow_limit: returns the previous limit. */
  setPowLimit(limit: number): number;
  /** Text Giac printed (Emscripten `print`) since the last clearMessages(). Parse errors arrive here. */
  messages(): string;
  clearMessages(): void;
}

export interface LoadedGiac {
  giac: GiacApi;
  /** G85's structured bridge (bridge.ts); the loader fails with NO_BRIDGE on an engine without it (G99). */
  bridge: GiacBridge;
  /** Fetch + compile + instantiate, measured by the loader. */
  instantiateMs: number;
}

export type GiacLoader = (baseUrl: string) => Promise<LoadedGiac>;

/** Read by Giac's EMCC hooks (gen.cc, maple.cc): no "=decimal" suffix on fractions, no WebGL 3D.
 *  Must be set before the module is instantiated. */
export function setGiacHostGlobals(): void {
  (globalThis as Record<string, unknown>).UI = {
    add_evalf: 0,
    js_bigint: 0,
    disable3d: -1,
    Datestart: Date.now(),
  };
}

/** Collects what the Emscripten module prints, for GiacApi.messages(). */
export function messageBuffer(): { print: (s: string) => void; messages: () => string; clear: () => void } {
  let buf: string[] = [];
  return {
    print: (s) => {
      if (buf.length < 50) buf.push(s);
    },
    messages: () => buf.join("\n"),
    clear: () => {
      buf = [];
    },
  };
}

/** Commands that put Giac into CAS mode (D3). Home's are homeSetupCommands() in homeEval.ts. */
export function casSetupCommands(s: CasSettings): string[] {
  return [
    angleCommand(s.angle),
    `Digits:=${Math.trunc(s.digits)}`,
    `timeout ${Math.min(Math.max(s.hardTimeoutS, 0.001), 1439).toFixed(3)}`,
    "ckevery 10",
    // G82: Home's step budget off; the CAS view waits on its clock (a person waits on it, it chooses no path).
    "ckbudget 0",
  ];
}

/** Giac reports a parse error by printing "syntax error" and returning `undef`. */
class GiacSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GiacSyntaxError";
  }
}

/** Names in a printed value that are not user names (a value with only these in it does not depend on the order of the
 *  replay). */
const CONSTANT_NAMES: ReadonlySet<string> = new Set(["i", "pi", "e", "infinity", "inf", "undef", "euler_gamma", "true", "false"]);


/** Engine state and the synchronous operations on it. One per Giac instance. */
export class EngineHost implements FactsHost {
  private modeKey = "";
  /** G93: the angle of the current mode (pasdeg's value), radians before any mode (the constructor's). */
  private modeAngle: "rad" | "deg" = "rad";
  /** G67: the Digits the current mode set (Giac's own 12 before any mode), which the settings check expects. */
  private modeDigits = 12;
  /** Read by facts.ts (FactsHost), as are byName, chipFacts and stored. */
  readonly giac: GatedGiac["giac"];
  /** G99: Giac's tree of an input (bridge-2) gives the names it reads and binds. */
  private readonly bridge: GiacBridge;
  /** The current input's tree, parsed once per Enter (usesOf and after share it). */
  private parsed: { text: string; tree: GiacParse } | null = null;
  /** `giac.eval` that throws GiacSyntaxError instead of quietly returning `undef` (which would
   *  otherwise leave the previous answer in place and show it again). */
  private readonly strict: { eval(input: string): string; value(text: string, precisions: readonly number[], tree?: boolean): GiacValue; ambiguousPower(): boolean; roundedPivot(): boolean; digits(d: number): void };
  /** G97: `giac.eval` that reads Giac's messages after each eval for ambiguousPower(), and throws nothing (Num's
   *  cells, where a syntax error is a cell's own error). Without it a power's shape walk would run on every cell. */
  private readonly watched: { eval(input: string): string; value(text: string, precisions: readonly number[], tree?: boolean): GiacValue; ambiguousPower(): boolean; roundedPivot(): boolean; digits(d: number): void };

  /** Our definitions already loaded into this Giac instance (ENGINE_DEFINITIONS, loaded on first use). */
  private readonly loaded = new Set<string>();
  /** R194: the word size and sign the word ops were last defined for (wordOps.ts). */
  private word = wordOfSettings({});
  /** UNIT_DEFINITIONS are loaded (the first units request). */
  private unitsLoaded = false;

  /** This engine's copy of the definitions log (defs.ts): what the user's names hold, and the mark facts of the
   *  variables that hold floats (decisions M4-7). */
  private log: DefEntry[] = [];
  byName = new Map<string, DefEntry>();
  /** G49: the chips the current Home input holds by name (`pasr_<k>`), with the facts they lend (as a stored float's). */
  readonly chipFacts = new Map<string, NameFacts>();
  /** G225f2: the chips of the current Home input whose value is a list (isList). */
  private readonly listChips = new Set<string>();
  /** G65: Giac's stored user names, read after every input that may store and after restore() (stateRead.ts). */
  stored = new Map<string, StoredName>();
  /** G104: the names Giac's VARS() listed at the last state read that `stored` leaves out (ours, an assumed name). */
  private skipped = new Set<string>();
  /** G65: the call after the current input, once it ran (home() and cas() make it when the run did not). */
  private post: AfterInput | null = null;
  /** G92: a Giac text of this input named a command that may leave an assumption (assumed.ts namesAssuming). */
  private assumeRisk = false;
  /** G92: the about() each logged assumption had at the last read, by name. */
  private abouts = new Map<string, string>();

  /** G83: the user's functions restore() has not given to Giac yet, by name; loaded on first use (need). */
  private pending = new Map<string, DefEntry>();
  /** G314: the definitions replay (defsReplay.ts) over this host's state. */
  private readonly defs: DefsReplay;

  /** Loads the definitions `text` mentions that are not loaded yet: the user's pending functions (G83) and ours.
   *  Called before every input reaches Giac. */
  need(text: string): void {
    this.defs.need(text);
  }

  constructor(raw: GiacApi, rawBridge: GiacBridge) {
    // G102: Digits through bridge-1, a set waiting until the next Giac call (ctxGate.ts)
    // G92: a text that names a command that may leave an assumption and a name that is not ours (the host's own
    // simplify of a numeric slot, provedRational's `simplify(pasX)`, assumes no user name)
    const { giac, bridge } = gated(raw, rawBridge, (text) => {
      if (this.assumeRisk || !namesAssuming(text)) return;
      // the text the hook hears is Giac input, typed
      this.assumeRisk = namesIn(text, "typed").some((n) => !CONSTANT_NAMES.has(n) && !isOurs(n));
    });
    this.giac = giac;
    this.bridge = bridge;
    this.defs = new DefsReplay({ giac, loaded: this.loaded, pending: this.pending, byName: () => this.byName, stored: () => this.stored, word: () => this.word, modeDigits: () => this.modeDigits });
    // R64, G46: Giac in radians, and pasdeg (our parser's degree factor) set before any input: the units, raw eval and
    // replay paths have no mode setup of their own
    giac.eval(angleCommand("rad"));
    let [ambiguous, rounded] = [false, false]; // G806: rounded, patch 0071's warning
    let msg = "";
    // Giac's messages of one call (an eval, or G103's bridge-3 value)
    const heard = <T>(call: () => T): T => {
      giac.clearMessages();
      const out = call();
      msg = giac.messages();
      ambiguous = AMBIGUOUS_POWER.test(msg);
      rounded = ROUNDED_PIVOT.test(msg);
      return out;
    };
    const read = (input: string): string => heard(() => giac.eval(input));
    const value = (text: string, precisions: readonly number[], tree?: boolean): GiacValue => heard(() => bridge.value(text, precisions, tree));
    const syntax = (failed: boolean): void => {
      if (failed && /syntax error/.test(msg)) throw new GiacSyntaxError(msg.trim());
    };
    this.strict = {
      eval: (input) => {
        const out = read(input);
        syntax(out === "undef");
        return out;
      },
      value: (text, precisions, tree) => {
        const v = value(text, precisions, tree);
        syntax(v.kind === "error");
        return v;
      },
      ambiguousPower: () => ambiguous,
      roundedPivot: () => rounded,
      digits: giac.digits,
    };
    this.watched = { eval: read, value, ambiguousPower: () => ambiguous, roundedPivot: () => rounded, digits: giac.digits };
  }

  /** Replays definitions (a fresh engine: at init, or the stored log on first launch; defsReplay.ts) and adds them to
   *  the log. Returns the time it took. */
  restore(stored: readonly DefEntry[]): number {
    const t0 = performance.now();
    const entries = this.withoutFlags(this.migrated(stored));
    this.defs.replay(entries);
    this.record(entries.map((e) => ({ set: e })));
    // G67: a replayed body or command may have changed a Giac setting; G65: the table of stored names, in the same call
    const post = this.after("", false, "full");
    this.commit(post);
    this.otherToNames(entries, post);
    return performance.now() - t0;
  }

  /** G67: the entries without a Giac setting (a log stored before G67 holds `approx_mode:=(1)`, `Digits:=(14)`): a named
   *  one goes from the client's log too (a purge in takeMigrated), one kept as typed is only not replayed. */
  private withoutFlags(entries: readonly DefEntry[]): readonly DefEntry[] {
    const flagged = entries.filter((e) => (e.kind === "other" ? e.cmds.some((c) => namesFlag(c, "typed")) : isFlagName(e.name)));
    if (!flagged.length) return entries;
    const names = flagged.filter((e) => e.kind !== "other").map((e) => e.name);
    if (names.length) this.migratedChanges.push({ purge: names });
    return entries.filter((e) => !flagged.includes(e));
  }

  /**
   * G67, G65, G102: after an input, Giac's settings through bridge-1 (`giac_ctx_get`, or the answer of a Digits set
   * still waiting, ctxGate.ts) compared field by field with the host's (flags.ts hostContext); on a difference one
   * `giac_ctx_set` of the whole context, and the mode setup runs again on the next call. An input that names a setting
   * bridge-1 cannot see (timeout, ckevery) gets the mode setup again too. Then the names the input reads, from its tree
   * (G99, bridge-2; `read`: skipped after a syntax error; `shown`: its result's text, see readsOf), and, when `state`,
   * the stored user names, both with the settings back. G104: the entries of the input's candidates (candidatesOf) and
   * of the names new in VARS() are read, every other stays from `stored` (stateRead.ts changedPart); every entry when
   * the candidates are unknown or `state` is "full" (restore; statePart).
   * `reset`: the user's text set one (the input names a setting, or calls a stored function whose definition does; the
   * result says it was not kept). Giac leaks some by itself, put back without a word: a `throw` in a program leaves
   * eval_level at 1 (our refusals in pasmedian, eseries), and `(-32)^(1/5)` leaves epsilon at 1e-60 (probe 2026-10-20).
   */
  private after(input: string, read: boolean, state: boolean | "full", shown?: string): AfterInput {
    if (namesUnreadFlag(input, "typed")) this.modeKey = "";
    const want = hostContext(this.modeDigits);
    const flagsChanged = contextDiff(this.bridge.ctxGet(), want).length > 0;
    if (flagsChanged) {
      contextOf(this.bridge.ctxSet(want));
      this.modeKey = "";
    }
    // G99: the names come from Giac's tree; parsed only when they can matter (mayLend)
    const reads = read && (state || this.mayLend(input)) ? this.readsOf(input, shown) : NO_READS;
    const typed = new Set(namesIn(input, "typed"));
    // G104: a name the text names is read again too (the table holds a `pas` name the text names, isOurs)
    const cands = state === true ? this.candidatesOf(input) : null;
    const known = cands ? [...this.stored.keys(), ...this.skipped].filter((n) => !cands.has(n) && !typed.has(n)) : [];
    // G92: the log's assumptions, read with the state (their about()), or alone after a text that may leave one
    // (an input that sets one: the names it assumes too, which the log learns after this call)
    const keep = setsAssumption(input) || this.callsDefining(input, setsAssumption, true);
    const logged = [...this.byName.values()].filter((e) => e.kind === "assume").map((e) => e.name);
    const assumed = keep ? [...new Set([...logged, ...this.assumedBy(input)])] : logged;
    const risky = this.assumeRisk || this.callsDefining(input, namesAssuming, true);
    // G174: Giac's own names (gbasis's lastgb, lastv) go before the state is read; a logged one goes back to its entry
    if (state === true && writesScratch(input, (n) => this.keptOf(n))) this.giac.eval(scratchBack(typed, (n) => this.byName.get(n)));
    let stateNode = state ? parsePrinted(this.giac.eval(cands ? changedPart(this.modeDigits, known, assumed) : statePart(this.modeDigits, assumed))) : null;
    const leakNode = stateNode ?? (risky ? parsePrinted(this.giac.eval(leakPart([...this.stored.keys(), ...this.skipped], assumed))) : null);
    const purged = leakNode ? this.assumptionsBack(input, leakNode, assumed, typed, keep) : [];
    this.assumeRisk = false;
    // G93: VARS() (either read) lacks pasdeg: a command cleared every name, ours too; lacks a logged name: the state is
    // read in full in this Enter (G92's read alone has no table), and the log follows Giac
    let lost: string[] = [];
    if (leakNode && input !== "") {
      const held = new Set(namesOf(leakNode));
      if (!held.has(PASDEG)) this.oursGone();
      lost = [...this.byName.keys()].filter((n) => !held.has(n) && !this.pending.has(n));
      if (!held.has(PASDEG)) lost.push(...this.pending.keys());
      if (lost.length && !stateNode) stateNode = parsePrinted(this.giac.eval(statePart(this.modeDigits)));
    }
    const reset = flagsChanged && (namesFlag(input, "typed") || this.callsDefining(input, (c) => namesFlag(c, "typed")));
    const table = stateNode ? tableOf(stateNode, this.stored) : null;
    const skipped = table && stateNode ? new Set(namesOf(stateNode).filter((n) => !table.has(n) && !purged.includes(n))) : null;
    this.post = { reads, table, changes: table ? changesOf(this.stored, table) : null, skipped, flagsChanged, reset, lost };
    return this.post;
  }

  /** G92: the names `input` and the stored functions it calls name (an input that sets an assumption: about() of each
   *  is read, a name that is not assumed prints itself). */
  private assumedBy(input: string): string[] {
    const fns = wordsOf(input).flatMap((w) => {
      const e = this.byName.get(w);
      return e?.kind === "fn" ? e.cmds : [];
    });
    return [input, ...fns].flatMap((t) => namesIn(t, "typed")).filter((n) => !CONSTANT_NAMES.has(n) && !isOurs(n));
  }

  /** The text names a log entry whose commands `test` holds (G67's reset rule); `fns`: a stored function only (G92: a
   *  logged assumption's own `assume(x<0)` is no function the text calls). */
  private callsDefining(input: string, test: (cmd: string) => boolean, fns = false): boolean {
    return wordsOf(input).some((w) => {
      const e = this.byName.get(w);
      return e !== undefined && (!fns || e.kind === "fn") && e.cmds.some(test);
    });
  }

  /**
   * G92 (assumed.ts): what the input left of Giac's assumptions, put back in one call, silently. A name new since the
   * last read (not ours, not in the log, not stored, not skipped before) that holds only itself is purged; a logged
   * assumption whose about() changed is purged and set again from its entry, unless the input's own targets name it
   * (`purge(x)`, `x:=3`; all of them when they are unknown, `restart`). An input that sets an assumption (its text names
   * assume or additionally, or calls a stored function whose definition does) keeps what it did: its about()s become
   * the ones expected, as does restore()'s replay. Returns the names purged.
   */
  private assumptionsBack(input: string, node: NonNullable<ReturnType<typeof parsePrinted>>, assumed: readonly string[], typed: ReadonlySet<string>, sets: boolean): string[] {
    const abouts = assumed.length ? aboutsOf(node, assumed.length) : [];
    for (const n of this.abouts.keys()) if (!assumed.includes(n)) this.abouts.delete(n);
    // restore() reads with no input: what the log's replay set is the log's
    const keep = input === "" || sets;
    const fresh = keep ? [] : selfHolding(node).filter((n) => !isOurs(n) && !this.byName.has(n) && !this.stored.has(n) && !this.skipped.has(n));
    const moved: string[] = [];
    assumed.forEach((n, k) => {
      const got = abouts?.[k];
      if (got === undefined) return;
      const want = this.abouts.get(n);
      if (keep || want === undefined) this.abouts.set(n, got);
      else if (got !== want) moved.push(n);
    });
    const mine = moved.length ? this.candidatesOf(input) : null;
    const back = mine ? moved.filter((n) => !mine.has(n)) : [];
    for (const n of moved) if (!back.includes(n)) this.abouts.delete(n);
    if (!fresh.length && !back.length) return [];
    const entries = back.map((n) => this.byName.get(n)!);
    this.giac.eval(putBack(fresh, entries));
    if (entries.some((e) => e.cmds.some((c) => namesFlag(c, "typed")))) this.modeKey = "";
    return fresh;
  }

  /**
   * G104: the names whose stored entry `input` may change: the targets of its tree and the kept stores (G100) of the
   * programs its words name, walked through the programs they read. A name it removes is gone from VARS(), a name new
   * there is read as well (after). Null, so every entry is read, when they are unknown: a word that lists or clears the
   * names (LOAD_ALL), a text Giac's parser refused, a state head other than a purge or a head that evaluates a string,
   * in the input or in a program it reaches.
   */
  private candidatesOf(input: string): Set<string> | null {
    const tree = this.treeOf(input);
    const unknown = (h: string): boolean => STRING_HEADS.has(h) || (STATE_HEADS.has(h) && !PURGE_HEADS.has(h));
    // LOAD_ALL's words: VARS (its tree's head or read), expr, rm_all_vars and restart (string and state heads)
    if (!tree.ok || tree.heads.some(unknown) || [...tree.heads, ...tree.reads].includes("VARS")) return null;
    const out = new Set(tree.targets);
    const seen = new Set<string>();
    const queue = [...wordsOf(input), ...tree.reads];
    while (queue.length) {
      const n = queue.pop()!;
      if (seen.has(n)) continue;
      seen.add(n);
      const k = this.keptOf(n);
      if (!k) continue;
      for (const w of k.writes) {
        if (!w.endsWith("(")) out.add(w);
        else if (unknown(w.slice(0, -1))) return null;
      }
      queue.push(...k.calls);
    }
    return out;
  }

  /** G100 (stores.ts): how `input` stores. Its tree decides, parsed only when the text can hold a store (mayStore); a
   *  stored program it names counts by its kept stores, walked through the programs it reads. */
  private formFor(input: string): InputForm {
    return formOf(input, mayStore(input) ? this.treeOf(input) : null, (names) => writesThrough(names, (n) => this.keptOf(n)));
  }

  /** G371: whether `text` (a store's right side) may store, from its own tree; the input's cached tree is kept. */
  private storesIn(text: string): boolean {
    return formOf(text, mayStore(text) ? this.bridge.parse(text) : null, (names) => writesThrough(names, (n) => this.keptOf(n))).stores;
  }

  /** G100: the kept stores of a parsed program text, by text (a restored entry: the stored log keeps none, validDefs). */
  private readonly keptByText = new Map<string, ProgramStores>();

  /**
   * G100: what the program `name` stores when it runs: the stores its log entry keeps (read when it was defined), else
   * read once from its definition (a restored entry) or from the program Giac holds under the name (one a body defined).
   * A value that is no program counts by the tree of its stored text, so a program inside it (`L:=[g]` holds g's
   * program, F81) counts, and goes on through the names in it (`h:=g`). Null for a name the host does not hold.
   */
  private keptOf(name: string): ProgramStores | null {
    const e = this.byName.get(name);
    if (e?.stores) return e.stores;
    if (e?.kind === "fn") return this.keptFrom(e.cmds[0]!);
    const t = this.stored.get(name);
    if (!t) return null;
    const k = this.keptFrom(t.text);
    return t.fn ? k : { writes: k.writes, calls: [...new Set([...k.calls, ...t.names])] };
  }

  /** G101 (nonsquare.ts): the function `name` when its body is known: a program that stores nothing and evaluates no
   *  string, nor do the programs it reads (G100's kept stores), and declares no local (its parameters and the names it
   *  binds come from its tree, bridge-2; nonsquare.ts walks it only when they are its parameters alone). Null: a
   *  stored program whose body is not known; undefined: no stored program. */
  private readonly bodyOf = (name: string): KnownBody | null | undefined => {
    const t = this.stored.get(name);
    if (!t?.fn) return undefined;
    if (writesThrough([name], (n) => this.keptOf(n))) return null;
    const tree = this.treeFrom(t.text);
    return tree.ok && tree.heads[0] === "program" && !tree.heads.includes("local") ? { params: tree.bound, reads: tree.reads, heads: tree.heads, list: t.text.includes("[") } : null;
  };

  /** G101: the stored functions `input` reads (its tree, G99) and their bodies, for nonsquare.ts. */
  private bodiesFor(input: string): Bodies {
    return { reads: () => this.treeOf(input).reads, of: this.bodyOf, writes: () => this.candidatesOf(input), isList: this.isList };
  }

  /** G106, G225f1: a name that holds a list (G109: `list[…]` too), from the stored table's print or the chip's value. */
  private readonly isList = (n: string): boolean => this.listChips.has(n) || holdsList(this.stored.get(n)?.text ?? "");

  /** G100/G101: the tree of a stored text (bridge-2), parsed once per text. */
  private readonly treeByText = new Map<string, GiacParse>();
  private treeFrom(text: string): GiacParse {
    let t = this.treeByText.get(text);
    if (!t) this.treeByText.set(text, (t = this.bridge.parse(text)));
    return t;
  }

  /** G174: refused before Giac runs it: a command N62 cannot serve (NOT_HERE_HEADS, from the tree), or G168's empty call. */
  private refusedFirst(input: string): "notHere" | "unknownFunction" | null {
    if (wordsOf(input).some((w) => NOT_HERE_HEADS.has(w)) && this.treeOf(input).heads.some((h) => NOT_HERE_HEADS.has(h))) return "notHere";
    return this.unknownEmptyCall(input) ? "unknownFunction" : null;
  }

  /** G354: a store into one of Giac's functions (`mean:=5`) that Giac answered with a value, not an error: the target's
   *  value after the run (bridge-3) still is Giac's function, so nothing was stored. Worded as the parser's refusal. */
  private unstored(input: string): string | null {
    const name = mayStore(input) ? functionTarget(input, this.treeOf(input)) : null;
    return name !== null && this.giac.value(name, []).kind === "function" ? parseText("parse.builtInName", { name }) : null;
  }

  /** G174 (F87): restart, restart_vars or rm_all_vars alone (stores.ts clearingCall). Giac's answer lists every name it
   *  cleared, ours and the Ans slot among them (storing it in the slot is a recursive definition), so the command runs
   *  alone; the answer to evaluate is the list of the user's names it cleared (G93's lost, of the call after it). */
  private clearing(input: string, mode: () => void): { post: AfterInput; answer: string } | null {
    if (!clearingCall(input)) return null;
    this.need(input);
    mode();
    this.giac.eval(input);
    const post = this.after(input, false, true);
    return { post, answer: `[${[...post.lost].sort().join(",")}]` };
  }

  /** G168 (F109): the input is `name()` of a name that is neither Giac's, nor stored in this engine, nor one of our
   *  library definitions (Giac drops the empty call: `type(DelAVars())` is identifier), so no value and no refusal would come. */
  private unknownEmptyCall(input: string): boolean {
    const name = leadingName(input.trim());
    if (name === null || wholeCall(input, name, "typed")?.join("") !== "") return false;
    return notBuiltin(this.giac)(name) && !(name in ENGINE_DEFINITIONS) && !WORKER_DEFINITION_NAMES.includes(name) && !this.byName.has(name) && !this.pending.has(name) && !this.stored.has(name) && !this.skipped.has(name);
  }

  private keptFrom(text: string): ProgramStores {
    let k = this.keptByText.get(text);
    if (!k) this.keptByText.set(text, (k = programStores(this.treeFrom(text))));
    return k;
  }

  /** Giac's tree of a text (bridge-2), never evaluated: what a library file's bodies store (library.ts parseLibrary). */
  readonly parse = (text: string): GiacParse => this.bridge.parse(text);

  /** Giac's tree of `input` (bridge-2), parsed once per Enter. */
  private treeOf(input: string): GiacParse {
    if (this.parsed?.text !== input) this.parsed = { text: input, tree: this.bridge.parse(input) };
    return this.parsed.tree;
  }

  /**
   * G99: the names `input` reads, from its tree. A name it binds (diff's x) that its result `shown` still names is read
   * too: the shown value is that result evaluated with the stored x (after x:=3, diff(x^3,x) is 3*x^2, Home shows 27).
   * The result is parsed only when a bound name is one the host holds.
   */
  private readsOf(input: string, shown: string | undefined): InputReads {
    const tree = this.treeOf(input);
    const reads = readsFrom(tree);
    const held = tree.bound.filter((b) => !reads.names.includes(b) && (this.stored.has(b) || this.chipFacts.has(b)));
    if (!held.length || shown === undefined) return reads;
    const named = this.bridge.parse(shown).reads;
    const more = held.filter((b) => named.includes(b));
    return more.length ? { ...reads, names: [...reads.names, ...more] } : reads;
  }

  /** Whether a name `input` reads can lend facts (facts.ts usedBy): a name its tree reads is a word of its text, so an
   *  input without a word that is a chip or a stored name with facts reads none that lends any. */
  private mayLend(input: string): boolean {
    return wordsOf(input).some((w) => this.chipFacts.has(w) || (this.stored.has(w) && nameFacts(this, w, new Set()) !== null));
  }

  /** G93: a command cleared our definitions (restart(0), restart_vars(0); usual.cc:251): they load again on next use
   *  (needOurs, the units on the next units request), and pasdeg is set again now, for the current mode (a raw eval or
   *  the replay has no mode setup; the settings check after the input already put Giac's context back). */
  private oursGone(): void {
    this.loaded.clear();
    this.unitsLoaded = false;
    this.giac.eval(pasdegCommand(this.modeAngle));
  }

  /** G93: the log purges the names the call after the input found gone (post.lost) that it still holds, assume entries
   *  too: the command did what it says, and a relaunch does not bring them back. Added to the input's changes. */
  private followLost(post: AfterInput, defs: DefChange[]): DefChange[] {
    const gone = post.lost.filter((n) => this.byName.has(n) || this.pending.has(n));
    if (!gone.length) return defs;
    for (const n of gone) this.pending.delete(n);
    const change: DefChange = { purge: gone };
    this.record([change]);
    return [...defs, change];
  }

  /** The table the last call read becomes the host's (after the input's facts were taken from the one before). */
  private commit(post: AfterInput): void {
    if (post.table) this.stored = post.table;
    if (post.skipped) this.skipped = post.skipped;
    this.post = null;
  }

  /** F58, for a log stored before G65: an "other" entry (`x:=y:=3`) outlives purge(x), purge(y). After the replay it
   *  becomes var entries for the names the replay set that no entry holds (their names come from the table), and goes
   *  from the log (a purge of `#<cmds>`, defs.ts); passed on through migratedChanges. One that set no new name stays. */
  private otherToNames(entries: readonly DefEntry[], post: AfterInput): void {
    const others = entries.filter((e) => e.kind === "other" && e.cmds.some((c) => this.formFor(c).stores));
    if (!others.length || !post.table) return;
    const base = { preview: "", view: "cas" as const, time: Date.now() };
    const sets: DefChange[] = [];
    for (const name of post.changes?.changed ?? []) {
      if (this.byName.has(name) || isFlagName(name)) continue;
      const snap = this.snapshot(name, 12);
      if (snap) sets.push({ set: { name, kind: "var", cmds: [snap.cmd], ...base, ...(snap.early ? { early: true } : {}) } });
    }
    if (!sets.length) return;
    const changes: DefChange[] = [{ purge: others.map((e) => keyOf(e)) }, ...sets];
    this.record(changes);
    this.migratedChanges.push(...changes);
  }

  /** G46: what the last restore() changed in the entries it was given (flagged values resolved), for the client to
   *  keep and store; taken once. */
  private migratedChanges: DefChange[] = [];
  /** G46: the flagged values whose preview matched neither reading; kept as they were (R14 section 7). */
  unmatched: string[] = [];

  takeMigrated(): DefChange[] {
    const out = this.migratedChanges;
    this.migratedChanges = [];
    return out;
  }

  /** The entries with every flagged value (`migrate: "angle"`, angleMigration.ts) read both ways against its preview. */
  private migrated(entries: readonly DefEntry[]): readonly DefEntry[] {
    if (!entries.some((e) => e.migrate)) return entries;
    const changes: DefChange[] = [];
    const out = entries.map((e) => {
      if (!e.migrate) return e;
      const { migrate: _, ...rest } = e;
      const r = e.cmds.length === 1 ? resolveAngle(this.giac, e.cmds[0]!, e.preview) : null;
      if (!r) this.unmatched.push(e.name);
      const next: DefEntry = r ? { ...rest, cmds: [r.cmd], ...(r.angle ? { angle: r.angle } : {}) } : rest;
      changes.push({ set: next });
      return next;
    });
    this.migratedChanges.push(...changes);
    return out;
  }

  /** G371 (nameSigma.ts withNameFacts): the store's entry with its σ and unit, in this host's log too. */
  private nameFacts(defs: DefChange[], name: string | undefined, unc: Parameters<typeof withNameFacts>[2], unit: Parameters<typeof withNameFacts>[3]): DefChange[] {
    const out = withNameFacts(defs, name, unc, unit);
    if (out !== defs) this.record(out.filter((c) => "set" in c && c.set.name === name));
    return out;
  }

  private record(changes: readonly DefChange[]): void {
    if (!changes.length) return;
    this.log = applyDefChanges(this.log, changes);
    this.byName = new Map(this.log.filter((e) => e.kind !== "other").map((e) => [e.name, e]));
  }

  eval(input: string): { output: string; ok: boolean; engineMs: number; defs: DefChange[] } {
    this.parsed = null;
    this.assumeRisk = false;
    this.need(input);
    const t0 = performance.now();
    const output = this.giac.eval(input);
    const ok = !isError(output);
    let defs: DefChange[] = [];
    if (ok && this.formFor(input).stores) {
      const post = this.after(input, true, true);
      defs = this.followLost(post, this.defsAfter(input, [input], output, null, null, "home", 12, undefined, post));
      this.commit(post);
    } else if (this.assumeRisk || this.callsDefining(input, namesAssuming, true)) {
      const post = this.after(input, false, false);
      defs = this.followLost(post, defs);
      this.commit(post);
    }
    return { output, ok, engineMs: performance.now() - t0, defs };
  }

  /**
   * What an input that may store changed, as entries for the definitions log (defs.ts), recorded in this engine's copy
   * too. G65: the names come from Giac's state (`post`, the call after the input): every name whose stored text changed
   * or appeared, and every name a top-level store sets (its value may print as before: sto(F,pB) over pB:=899450126402),
   * is a variable set again from its value (`snapshot`), or the function `f(x):=…` defines (replayed as `ran`); a name
   * that went, or that `purge(…)` names, is purged. `facts`: what a variable takes (storedFacts' rule), `fn`: what the
   * function takes; `angle`: the mode a variable was stored in (G34), recorded with it when known.
   */
  private defsAfter(input: string, ran: string[], preview: string, facts: NameFacts | null, fn: NameFacts | null, view: "home" | "cas", digits: number, angle: "rad" | "deg" | undefined, post: AfterInput, home?: { r: HomeResult; s: HomeSettings; lent: readonly NameFacts[] }): DefChange[] {
    const base = { preview: dropAngleFactor(preview.trim(), "printed").slice(0, PREVIEW_MAX), view, time: Date.now() };
    const purged = (wholeCall(input, "purge", "typed") ?? []).filter((n) => isName(n, true));
    const gone = [...new Set([...purged, ...(post.changes?.removed ?? [])])];
    const head = callsOf(input.trimStart(), ["assume", "additionally"], "typed")[0];
    const subject = head?.at === 0 ? leadingName(input.trimStart().slice(head.open + 1)) : null;
    // G100: the input's tree (parsed for the state read): the function `f(x):=…` defines, and the stores a program keeps
    const tree = this.treeOf(input);
    const def = formOf(input, tree, () => false).defined;
    const kept = tree.program && tree.top.length === 1 ? programStores(tree) : undefined;
    // G317: the target of a plain store of the whole result (`X ▶ A`, `A:=X`) holds the result; any other name its own value
    const target = tree.top.length === 1 && tree.form === "name" ? tree.top[0] : null;
    // A state that could not be read: the names the parse says it sets.
    const changed = post.table
      ? [...new Set([...(post.changes?.changed ?? []), ...post.reads.targets.filter((n) => post.table!.has(n))])]
      : [...new Set([...post.reads.targets, ...(def ? [def.name] : [])])];
    let changes: DefChange[] = gone.length ? [{ purge: gone }] : [];
    if (head && subject) {
      const name = subject;
      const prev = this.byName.get(name);
      const cmds = head.name === "additionally" && prev?.kind === "assume" ? [...prev.cmds, ...ran] : ran;
      changes.push({ set: { name, kind: "assume", cmds, ...base } });
    }
    for (const name of changed) {
      if (def?.kind === "fn" && def.name === name) {
        changes.push({ set: { name, kind: "fn", cmds: ran, ...(fn ? { facts: fn } : {}), ...(kept ? { stores: kept } : {}), ...base } });
        continue;
      }
      const snap = this.snapshot(name, digits);
      // G328: a name beside the result stores its own facts (Home), the target the result's
      const side = snap && name !== target ? this.side(name, view, home && { s: home.s, float: snap.float, alone: aloneFacts(this, tree, name, home.r, home.lent) }, digits, angle) : null;
      changes.push(
        snap
          ? { set: { name, kind: "var", cmds: [snap.cmd], ...storedFacts(side && side.facts !== undefined ? side.facts : facts, snap.float), ...(kept && def?.name === name ? { stores: kept } : {}), ...base, ...(side ? side.shown : home ? storedMark(home.r, digits) : {}), ...(snap.early ? { early: true } : {}), ...(angle ? { angle } : {}) } }
          : { purge: [name] },
      );
    }
    // G67: a Giac setting is never a user's name, in any form (`approx_mode:=(1)`, `Digits:=(14)`, `purge(epsilon)`), and
    // an input kept as typed that sets one is not kept (the check after the call has put the setting back)
    changes = changes.flatMap((c): DefChange[] => {
      if ("purge" in c) {
        const kept = c.purge.filter((n) => !isFlagName(n));
        return kept.length ? [{ purge: kept }] : [];
      }
      return isFlagName(c.set.name) || (c.set.kind === "other" && namesFlag(input, "typed")) ? [] : [c];
    });
    // G83: a new definition or a purge of a pending name: the old definition never comes back
    for (const c of changes) for (const n of "purge" in c ? c.purge : [c.set.name]) this.pending.delete(n);
    this.record(changes);
    return changes;
  }

  /** G317, G328 (storedMark.ts sideShown): the preview, mark and Home facts of a name set beside the result. The input's tree is kept. */
  private side(name: string, view: "home" | "cas", home: { s: HomeSettings; float: boolean; alone: { lent: NameFacts | null } | null } | undefined, digits: number, angle: "rad" | "deg" | undefined): { shown: { preview: string; mark?: StoredMark }; facts?: NameFacts | null } {
    const parsed = this.parsed;
    const { facts, ...own } = sideShown(this.watched, name, view === "home" && home ? { ...home, bodies: this.bodiesFor(name), logged: this.byName } : null, digits, angle);
    this.parsed = parsed;
    return { shown: { ...own, preview: dropAngleFactor(own.preview, "printed").slice(0, PREVIEW_MAX) }, ...(facts !== undefined ? { facts } : {}) };
  }

  /**
   * A variable's value as a command that sets it again: `B:=(<value>)`, floats as `evalf(<exact>,k)` with the digits
   * they print with (doubles: 14). `early`: the value has names in it, so it must be set before any of them is.
   * Null when the name holds nothing. The command is typed, as every log command is (G105f2: giacPrint.ts typedFromPrinted).
   */
  private snapshot(name: string, digits: number): { cmd: string; float: boolean; early: boolean } | null {
    const t = withDigits(this.giac, DOUBLE_DIGITS, digits, () => this.giac.eval(name)).trim();
    if (t === "" || t === name || isError(t)) return null;
    const float = hasFloat(t);
    const early = namesIn(t, "printed").some((n) => !CONSTANT_NAMES.has(n));
    return { cmd: `${name}:=(${typedFromPrinted(float ? floatsAsEvalf(t) : t)})`, float, early };
  }

  /**
   * `consts` (G26): the constants the input holds by name (`pasc_<id>`) with their values and uncertainties. The
   * values are put in and the input evaluates as without the table; a numeric result from an inexact constant then
   * carries `uncDigits` (constUnc.ts). `chips` (G49): the chips it holds by name (`pasr_<k>`, chipFacts.ts). An exact
   * chip is put in as its value; any other is a Giac variable for this run, and its facts pass on as a stored float's
   * (M4-7). An input kept as typed in the log (`f(x):=…`, `a,b:=…`) gets every chip as its value, since the name
   * would outlive the run. A value stored from an input with an inexact constant or chip keeps `inexact` facts.
   * Without the tables, nothing changes.
   */
  home(typed: string, s: HomeSettings, consts?: ConstTable, chips?: ChipFactsTable): { result: HomeResult; defs: DefChange[] } {
    this.post = null;
    this.parsed = null;
    this.assumeRisk = false;
    // G91: a precision with no name in it (`approx(e,2*10)`) is read as the literal it gives
    const input = askedLiterals(this.giac, typed, () => this.useHomeMode(s));
    const used = this.usesOf(input); // G212: before the input runs (it may store to them), as cas()
    const reads = this.valuesOf(used); // G213f1
    const unitNames = this.unitNamesOf(input); // G392: before the run too (it may store to them)
    const through = this.unitNamesOf(input, true); // G550: the σ names it reaches only through a body
    const cleared = this.clearing(input, () => this.useHomeMode(s));
    const out = cleared ? this.homeRun(cleared.answer, s, false) : this.homeTabled(input, s, consts, chips, reads, through);
    if (out.result.ok) out.result.reads = reads;
    if (used.length && out.result.ok) out.result.uses = used;
    if (unitNames.length && out.result.ok) out.result.unitNames = unitNames;
    // G67, G65: the call after the input, if the run did not make it (an error: a syntax error ran nothing)
    const post = cleared?.post ?? this.post ?? this.after(input, false, out.result.error !== "syntax" && this.formFor(input).stores);
    out.defs = this.followLost(post, out.defs);
    this.commit(post);
    return post.reset ? { ...out, result: { ...out.result, settingReset: true } } : out;
  }

  private homeTabled(input: string, s: HomeSettings, consts?: ConstTable, chips?: ChipFactsTable, reads: readonly StoredRead[] = [], through: readonly string[] = []): { result: HomeResult; defs: DefChange[] } {
    const sigNamed = nameSigmaInputs(reads, this.byName); // G371: the stored names with σ the input reads, σ and value before the run
    if (!consts && !chips && !sigNamed.length && !through.length) return this.homeRun(input, s, false);
    const form = this.formFor(input);
    const asg = form.assignment;
    const stateful = form.stores;
    const held = chips ? chipsIn(input, chips) : [];
    const keep = new Set(stateful && form.defined?.kind !== "var" ? [] : held.filter((k) => !literalChip(chips![k]!)));
    const named = chips ? withChipValues(input, chips, keep) : input;
    // G49f1: the facts an inexact chip or constant lends to a function defined from it (its value is put in).
    const lent: NameFacts[] = [
      ...held.filter((k) => !literalChip(chips![k]!)).map((k) => chipNameFacts(chips![k]!)),
      ...(consts !== undefined && inexactConstsIn(input, consts).length > 0 ? [{ exact: false, reliableDigits: null, inexact: true as const }] : []),
    ];
    const inexactIn = lent.length > 0;
    for (const k of keep) {
      this.giac.eval(chipCommand(k, chips![k]!));
      this.chipFacts.set(`${CHIP_PREFIX}${k}`, chipNameFacts(chips![k]!));
      if (holdsList(chips![k]!.value)) this.listChips.add(`${CHIP_PREFIX}${k}`);
    }
    try {
      const ran = consts ? withConstValues(named, consts) : named;
      const out = this.homeRun(ran, s, inexactIn, lent, formIn(form, ran));
      out.defs = this.nameFacts(out.defs, asg?.name, undefined, asg ? unitOfStore(asg.rhs, chips ?? {}, this.byName) : undefined); // G371: a unit chip's unit
      const chipSig = chipSigma(asg ? (formIn(form, named).assignment?.rhs ?? named) : named, chips ?? {}); // R61: σ chips (G26's body without)
      // G371: a name the run set again is left out (its σ and value were read before it, but a call may have set it
      // first); the store's own target is read before it is set, unless its right side stores (a program call)
      const changed = namesChanged(out.defs);
      const ownTarget = asg && !this.storesIn(asg.rhs) ? asg.name : undefined;
      const sig = nameSigma(chipSig.body, sigNamed.filter((v) => !changed.has(v.stored) || v.stored === ownTarget), through.filter((n) => !changed.has(n))), inputs = [...chipSig.inputs, ...sig.inputs];
      // A setting the input changed was put back after its run: it is not run again (G67).
      if ((!consts && !inputs.length && !sig.through.length) || (stateful && !asg) || this.post?.flagsChanged) return out;
      const n = constUncDigits(this.giac, sig.body, consts ?? {}, out.result, Math.trunc(out.result.digits ?? s.digits), inputs, (m) => this.stored.has(m) || this.skipped.has(m) || this.byName.has(m) || this.pending.has(m) || m === asg?.name || m === form.defined?.name);
      // G550: σ inputs whose σ is not carried make the row ⚠ (nameSigma.ts withSigmaLost), never a bare value
      const lost = n && "lost" in n ? [...inexactConstsIn(sig.body, consts ?? {}).map((id) => CONST_PREFIX + id), ...chipSig.inputs.map((v) => v.key ?? v.name), ...sigNamed.filter((v) => sig.inputs.includes(v.input)).map((v) => v.stored)] : out.result.ok ? sig.through : [];
      if (lost.length || !n || "lost" in n) {
        const o = withSigmaLost(out, lost, asg?.name); // a name it stores is ⚠ when read, in this host's log too
        this.record(o.defs.filter((c) => lost.length > 0 && "set" in c && c.set.name === asg?.name));
        return o;
      }
      const { uncTerms, ...unc } = n; // G274: the terms ride on the result, never in its facts
      return { result: { ...out.result, facts: { ...out.result.facts, ...unc }, ...(uncTerms ? { uncTerms } : {}) }, defs: this.nameFacts(out.defs, asg?.name, unc, undefined) }; // G371: the store keeps σ
    } finally {
      if (keep.size) this.giac.eval(`purge(${[...keep].map((k) => CHIP_PREFIX + k).join(",")})`);
      this.chipFacts.clear();
      this.listChips.clear();
    }
  }

  /** `inexactIn` (G49): the input held a constant or chip that is not exact, so a value it stores is not exact.
   *  `lent` (G49f1): the facts of those chips and constants, for a function defined from them. */
  private homeRun(input: string, s: HomeSettings, inexactIn: boolean, lent: readonly NameFacts[] = [], given?: InputForm): { result: HomeResult; defs: DefChange[] } {
    this.need(input);
    this.useHomeMode(s);
    const t0 = performance.now();
    const first = this.refusedFirst(input);
    if (first) {
      const display = enEngine[`error.${first}`];
      const ms = performance.now() - t0;
      return { result: { ok: false, display, path: "float-error", approximate: false, exactMs: ms, totalMs: ms, error: first, ...safePrecision(display) }, defs: [] };
    }
    let result: HomeResult;
    // G100: a chip's or constant's input brings the form of its typed text (homeTabled), the value cut from this one
    const form = given ?? this.formFor(input);
    try {
      result = homeEval(this.strict, input, s, undefined, form, this.bodiesFor(input), false, this.byName);
    } catch (e) {
      if (!(e instanceof GiacSyntaxError)) throw e;
      const ms = performance.now() - t0;
      return {
        result: { ok: false, display: e.message, path: "float-error", approximate: false, exactMs: ms, totalMs: ms, error: "syntax", ...safePrecision(e.message) },
        defs: [],
      };
    }
    if (!result.ok) return { result: { ...result, error: result.error ?? "engine" }, defs: [] };
    const unstored = this.unstored(input);
    if (unstored) return { result: { ok: false, display: unstored, path: "float-error", approximate: false, exactMs: result.exactMs, totalMs: performance.now() - t0, error: "builtInName", ...safePrecision(unstored) }, defs: [] };
    // M4-7: a value computed from stored floats keeps their marks. An assignment's right side is what ran; a
    // self-reference (B:=B*2) already overwrote B, and other stateful inputs cannot run again, so neither is moved.
    const asg = form.assignment;
    const body = asg ? asg.rhs : input;
    const stateful = form.stores;
    const once = asg ? namesIn(asg.rhs, "typed").includes(asg.name) : stateful;
    const storing = !once && form.once;
    // G65: the call after the input: Giac's settings, the names it read, and the stored names when it may have stored
    const post = this.after(input, true, stateful || storing, result.exact);
    const rerun = !once && !storing && !post.flagsChanged;
    const digits = Math.trunc(s.digits);
    result = inherited(this, result, post.reads, rerun ? toExactLiterals(body) : null, digits, digits);
    let defs: DefChange[] = [];
    if (stateful || storing) {
      // Replay the form that actually ran: exact for the exact paths, floats for the fallbacks.
      const ran =
        result.path === "exact" || result.path === "exact-big"
          ? [toExactLiterals(input)]
          : [`Digits:=${s.workDigits}`, input, `Digits:=${s.digits}`];
      // G49: an inexact input, or a result shown with ⚠ (G38's decision that did not hold), stores a value that is not
      // exact even when it prints as an exact rational. G65: a stored name also takes the facts of what the input read.
      const read = readsFacts(this, post.reads).facts;
      const fn = post.reads.fn;
      const facts = fn ? fnFacts(lent, read) : resultFacts(result);
      const inexact = !fn && facts !== null && (inexactIn || result.facts.warn !== undefined);
      // G48: a symbolic value's facts count only when they say it is not exact (a float in it, a ⚠).
      const own = inexact ? { ...facts, inexact: true as const } : result.value || result.items ? facts : null;
      defs = this.defsAfter(input, ran, result.display, storeFacts(own, lent, read), fn ? facts : null, "home", digits, s.angle, post, { r: result, s, lent }); // S53f1, G317, G328
    }
    return { result, defs };
  }

  /** The stored variables a CAS input reads (F28): the names its tree reads (G99: a bound name is no read) that the log
   *  holds as values. An assignment lists its own target when its right side reads it (`x:=x+1`).
   *  Taken before the input runs, since it may change the log. */
  private usesOf(input: string): NonNullable<CasResult["uses"]> {
    if (!wordsOf(input).some((w) => this.byName.get(w)?.kind === "var")) return [];
    // a store's tree reads its stored side only, as asg.rhs alone; G48: the names any other top-level store sets (a
    // list assignment, f(x):=…, L[k]:=…, v=>a) are not read either
    const tree = this.treeOf(input);
    const set = assignmentIn(input, tree) ? [] : tree.top;
    return tree.reads
      .filter((n) => !set.includes(n))
      .flatMap((n) => {
        const e = this.byName.get(n);
        return e?.kind === "var" ? [{ name: n, preview: e.preview, view: e.view }] : [];
      });
  }

  /** G392: the stored variables with a unit `input` reaches (nameSigma.ts unitNamesOf): from the names its tree reads
   *  (a store's: its stored side; as usesOf), through the names each stored value or body holds (Giac's table, G65), or
   *  for a function restore() has not given to Giac yet (G83) the names its definition's tree reads. Before the run.
   *  G550, `sigma`: the variables with σ it reaches through a body instead (nameSigma.ts sigmaThrough). */
  private unitNamesOf(input: string, sigma = false): string[] {
    if (![...this.byName.values()].some((e) => (sigma ? e.kind === "var" && e.facts?.uncSigma : e.unit)) || !wordsOf(input).some((w) => this.byName.has(w))) return [];
    const tree = this.treeOf(input);
    const set = assignmentIn(input, tree) ? [] : tree.top;
    const namesOf = (n: string): readonly string[] => {
      const held = this.stored.get(n)?.names;
      if (held) return held;
      const p = this.pending.get(n);
      return p ? this.bridge.parse(p.cmds[0]!).reads : [];
    };
    return (sigma ? sigmaThrough : unitNamesOf)(tree.reads.filter((n) => !set.includes(n)), this.byName, namesOf);
  }

  /** G213f1: usesOf's names with Giac's stored text of each and whether it is exact (no facts kept: DefEntry.facts). */
  private valuesOf(used: readonly { name: string }[]): StoredRead[] {
    return used.flatMap(({ name }) => {
      const value = this.stored.get(name)?.text;
      const f = this.byName.get(name)?.facts;
      return value === undefined ? [] : [{ name, value, exact: !f || (f.exact && !f.inexact) }];
    });
  }

  cas(typed: string, s: CasSettings): { result: CasResult; defs: DefChange[] } {
    this.parsed = null;
    this.assumeRisk = false;
    // G91: as in Home
    const input = askedLiterals(this.giac, typed, () => this.useCasMode(s));
    const used = this.usesOf(input);
    const reads = this.valuesOf(used); // G213f1
    this.post = null;
    const cleared = this.clearing(input, () => this.useCasMode(s));
    const out = this.casRun(cleared?.answer ?? input, s);
    if (used.length && out.result.ok) out.result.uses = used;
    if (out.result.ok) out.result.reads = reads;
    // G67, G65: the call after the input, if the run did not make it (an error or a refusal)
    const post = cleared?.post ?? this.post ?? this.after(input, false, out.result.error !== "syntax" && this.formFor(input).stores);
    out.defs = this.followLost(post, out.defs);
    this.commit(post);
    if (post.reset) out.result.settingReset = true;
    return out;
  }

  private casRun(input: string, s: CasSettings): { result: CasResult; defs: DefChange[] } {
    this.need(input);
    this.useCasMode(s);
    const t0 = performance.now();
    const fail = (text: string, error: CasError): { result: CasResult; defs: DefChange[] } => ({
      result: { ok: false, text, latex: "", timedOut: error === "timeout", error, engineMs: performance.now() - t0, facts: { exact: false, reliableDigits: null } },
      defs: [],
    });
    const first = this.refusedFirst(input);
    if (first) return fail(enEngine[`error.${first}`], first);
    // P9 (docs/04 section 2.9): typed decimals are exact rationals, as in Home; approx() gives decimals.
    const exactInput = toExactLiterals(input);
    const test = input.includes(EQ_INEXACT_FLAG);
    if (test) this.giac.eval(`purge(${EQ_INEXACT_FLAG},${EQ_DIFF})`);
    // G39: `a:=sum(cos(k),k,1,inf)` must store nothing when its value is refused, so an assignment whose value holds a
    // definite integral, a series or a limit runs its right-hand side first, is checked, and only then stored.
    // G100: how the input stores, from its tree (stores.ts); the value is cut from the exact text
    const form = this.formFor(input);
    const asg0 = formIn(form, exactInput).assignment;
    // G57: so does one whose value rests on a decision, which may be refused as undecided.
    // G97: and one whose value may be a power of a non-square matrix, which is refused; G106: or a list plus a number;
    // G111: or a call that may read one list as its argument list; G148: or an approx or evalf, refused past the range;
    // G225f1: or lists combined by position, whose sizes may differ. A name that holds a list is read from the stored
    // table (isList), so routing an assignment costs no engine call; G103 can read a value's kind later (docs/04 6.1).
    const guarded =
      asg0 && !form.once && (callsIn(asg0.rhs).length || mayApproxRange(asg0.rhs) || mayPowerMatrix(asg0.rhs) || mayCombineLists(asg0.rhs, this.isList) || mayListAsArguments(asg0.rhs) || restsOnDecision(asg0.rhs, "typed", "", notBuiltin(this.giac))) ? asg0 : null;
    // G38 (docs/04 2.4 rule 2): Giac decides signs, comparisons and floor at Digits, so the evaluation runs at P; the
    // mode's Digits stays the setting, which prints the floats of a non-number.
    const digitsSet = Math.trunc(s.digits);
    const body = guarded ? guarded.rhs : exactInput;
    const run = (e = body): string => withDigits(this.giac, valuePrecision(digitsSet), digitsSet, () => this.strict.eval(`pcasans:=(${e})`));
    let text: string;
    let ambiguous: boolean;
    try {
      text = run();
      ambiguous = this.strict.ambiguousPower();
    } catch (e) {
      if (e instanceof GiacSyntaxError) return fail(e.message, "syntax");
      throw e;
    }
    // A call to a stored function that stores (inc(x):={c:=c+1;c}) must not run again either, assigned or not (form.once).
    const single = form.stores;
    const builtin = notBuiltin(this.giac);
    const userFn = (name: string): boolean => builtin(name) && !(name in ENGINE_DEFINITIONS) && !WORKER_DEFINITION_NAMES.includes(name);
    // G171: an input that ran once too (not a definition); its refused store is purged, so no name keeps Giac's answer
    const onceRun = single && !guarded;
    // G314: the steps are casSteps.ts's; r carries the run and its current answer
    const r: CasRun<AfterInput> = {
      giac: this.giac, watched: this.watched, host: this, byName: () => this.byName, input, s, t0, exactInput, test, form, asg0, guarded, digitsSet, body, run,
      ambiguousPower: this.strict.ambiguousPower, single, onceRun, userFn, text, ambiguous, fail,
      shapes: () => onceRun && form.noValue ? false : nonSquarePower(this.giac, onceRun && asg0 ? asg0.rhs : body, r.text, r.ambiguous, () => false, performance.now() - t0, userFn, this.bodiesFor(input), onceRun, "pcasans"),
      // G65: the call after the input (its checks ran it again; nothing after this does but print the result).
      after: () => this.after(input, true, single, r.text),
      // G49f3: a function defined here keeps the facts of the names its body holds, as in Home (fnFacts).
      defsOf: (post, preview, facts) => {
        if (!single) return [];
        const read = readsFacts(this, post.reads).facts;
        const fn = post.reads.fn ? fnFacts(facts ? [facts] : [], read) : null;
        return this.defsAfter(input, [exactInput], preview, storeFacts(facts, [], read), fn, "cas", Math.trunc(s.digits), s.angle, post);
      },
    };
    if (isError(text)) return casErrorAnswer(r);
    const unstored = this.unstored(input);
    if (unstored) return fail(unstored, "builtInName");
    const decided = casDecide(r);
    const checked = casRefusals(r, decided);
    return "result" in checked ? checked : casAnswer(r, decided, checked);
  }

  solve(req: SolveRequest, s: HomeSettings): SolveOutcome {
    // G83f1: the request's expressions only (its keys and JSON would name a pending function or match LOAD_ALL)
    this.need(expressionsOf(req.kind === "poly" ? [req.equation] : req.equations, req.knowns?.map((k) => k.value)));
    this.useSolveMode(s);
    // G65: no read of the stored names after it: Solve puts back the very values it freed (solve.ts withUnassigned)
    return solveRequest(this.giac, req, s);
  }

  unknowns(equations: string[]): string[] {
    this.need(equations.join(";"));
    return unknownsOf(this.giac, equations);
  }

  analyze(req: AnalysisRequest, s: HomeSettings): AnalysisResult {
    const r = req as Partial<Record<"f" | "g" | "x0" | "lo" | "hi" | "a" | "b", string>>;
    this.need(expressionsOf([r.f, r.g, r.x0, r.lo, r.hi, r.a, r.b]));
    this.useSolveMode(s);
    // G65: it stores only our own pas* names, so the table of stored names stays as it is
    return analyze(this.giac, req, s);
  }

  /** The unit view (G16, docs/04 4.2): in Home's mode, with our unit definitions loaded on the first request; R121: its
   *  tree's stored user names (facts.ts usedBy; no chip) are named. G390: a store is refused first. A syntax error or a timeout is an engine error. */
  units(job: UnitJob, s: HomeSettings): Quantity | UnitError {
    // G390: a store of any depth (sto, =>, purge too) would leave a name holding our dimension symbols: refused before any eval
    if (this.bridge.parse(job.expr).targets.length) return { error: "store" };
    this.need(expressionsOf([job.expr, job.check, job.end]));
    if (!this.unitsLoaded) {
      for (const d of UNIT_DEFINITIONS) this.giac.eval(d);
      this.unitsLoaded = true;
    }
    this.useHomeMode(s);
    try {
      return withNames(unitEval(this.strict, job, s), () => readsFrom(this.bridge.parse(job.expr)).names.filter((n) => this.stored.has(n) && !this.chipFacts.has(n) && !isOurs(n)));
    } catch (e) {
      if (e instanceof GiacSyntaxError) return { error: "engine", detail: e.message };
      throw e;
    }
  }

  /** Num table cells are Home evaluations, in Home mode (same budget per cell). */
  table(req: TableRequest, s: HomeSettings): HomeResult[][] {
    this.need(expressionsOf(req.fns));
    this.useHomeMode(s);
    return table(this.watched, req, s, (cell) => this.formFor(cell));
  }

  /** R188: the names that hold a matrix, with their elements when `cells` (matrixRead.ts; R189 `check`: a store), in Home's mode. */
  matrices(names: readonly string[], s: HomeSettings, cells: boolean | "typed", check?: string): MatrixRead[] {
    this.need([...names, check ?? ""].join("\n"));
    this.useHomeMode(s);
    return readMatrices(this.giac, names, s.digits, cells, check === undefined ? undefined : { store: check, parse: (t) => this.bridge.parse(t) });
  }

  /** R361: by Function definition's Giac text, the names its tree reads (R361f1, G99: not a bound k), less x, constants
   *  and ours, each with kind and a variable's value, σ and unit (plotValues.ts); in Home's mode, the value at P digits. */
  plotValues(texts: readonly string[], s: HomeSettings): PlotValue[][] {
    const names = texts.map((t) => this.treeFrom(t).reads.filter((n) => n !== "x" && !CONSTANT_NAMES.has(n) && !isOurs(n)));
    this.need(names.flat().join("\n"));
    this.useHomeMode(s);
    const read = new Map(readPlotValues(this.giac, names.flat(), this.byName, valuePrecision(s.digits)).map((v) => [v.name, v]));
    return names.map((ns) => ns.flatMap((n) => read.get(n) ?? []));
  }

  private useCasMode(s: CasSettings): void {
    this.useWord(s);
    this.useMode(`cas${JSON.stringify(s)}`, s.digits, s.angle, () => {
      for (const c of casSetupCommands(s)) this.giac.eval(c);
      this.giac.setPowLimit(s.powLimit);
    });
  }

  private useHomeMode(s: HomeSettings): void {
    this.useWord(s);
    this.useMode(`home${JSON.stringify(s)}`, s.digits, s.angle, () => {
      for (const c of homeSetupCommands(s)) this.giac.eval(c);
      this.giac.eval(`Digits:=${Math.trunc(s.digits)}`);
      this.giac.setPowLimit(s.powLimit);
    });
  }

  private useSolveMode(s: HomeSettings): void {
    this.useWord(s);
    this.useMode(`solve${JSON.stringify(s)}`, s.digits, s.angle, () => {
      this.giac.eval(angleCommand(s.angle));
      this.giac.eval(`timeout ${SOLVE_HARD_TIMEOUT_S}`);
      this.giac.eval("ckevery 10");
      this.giac.eval("ckbudget 0"); // G82: Solve keeps its clock
      this.giac.eval(`Digits:=${Math.trunc(s.digits)}`);
      this.giac.setPowLimit(s.powLimit);
    });
  }

  /** R194: the word of the settings for the short forms of wordOps.ts; every request carries it (EngineCalc), absent: 64 bits
   *  unsigned. When it changes the loaded word ops are defined again (a stored function calling shl reads the new word). */
  private useWord(s: { word?: number; signed?: boolean }): void {
    const w = wordOfSettings(s);
    if (w.bits === this.word.bits && w.signed === this.word.signed) return;
    this.word = w;
    for (const [name, def] of Object.entries(wordDefinitions(w.bits, w.signed))) if (this.loaded.has(name)) this.giac.eval(def);
  }

  private useMode(key: string, digits: number, angle: "rad" | "deg", apply: () => void): void {
    if (key === this.modeKey) return;
    apply();
    this.modeKey = key;
    this.modeAngle = angle;
    this.modeDigits = Math.trunc(digits);
  }
}

/** G83f1: the expression strings of a request, for need(): one per line, the absent ones left out. */
function expressionsOf(...lists: (readonly (string | undefined)[] | undefined)[]): string {
  return lists.flatMap((l) => l ?? []).filter((t): t is string => t !== undefined).join("\n");
}

/** Builds the message handler used by the worker: init loads Giac, then requests go to EngineHost. */
export function createRequestHandler(load: GiacLoader, post: (r: Response) => void): (req: Request) => Promise<void> {
  // Calls that arrive while init is still loading the engine wait for it, in arrival order (a Plot
  // view restored at launch asks for the trace before the engine is up).
  let starting: Promise<EngineHost> | null = null;
  return async (req) => {
    try {
      if (req.type === "init") {
        starting = (async () => {
          const loaded = await load(req.baseUrl);
          const t1 = performance.now();
          loaded.giac.eval("0");
          const host = new EngineHost(loaded.giac, loaded.bridge);
          const t2 = performance.now();
          const replayMs = host.restore(req.replay);
          post({ id: req.id, type: "ready", instantiateMs: loaded.instantiateMs, initMs: t2 - t1, replayMs });
          return host;
        })();
        await starting;
        return;
      }
      if (!starting) throw new Error("engine not initialised");
      const host = await starting;
      switch (req.type) {
        case "define":
          post({ id: req.id, type: "defined", replayMs: host.restore(req.defs), defs: host.takeMigrated() });
          break;
        case "eval":
          post({ id: req.id, type: "result", ...host.eval(req.input) });
          break;
        case "home":
          post({ id: req.id, type: "home", ...host.home(req.input, req.settings, req.consts, req.chips) });
          break;
        case "cas":
          post({ id: req.id, type: "cas", ...host.cas(req.input, req.settings) });
          break;
        case "solve":
          post({ id: req.id, type: "solve", result: host.solve(req.req, req.settings) });
          break;
        case "unknowns":
          post({ id: req.id, type: "unknowns", result: host.unknowns(req.equations) });
          break;
        case "analyze":
          post({ id: req.id, type: "analyze", result: host.analyze(req.req, req.settings) });
          break;
        case "table":
          post({ id: req.id, type: "table", result: host.table(req.req, req.settings) });
          break;
        case "matrices":
          post({ id: req.id, type: "matrices", result: host.matrices(req.names, req.settings, req.cells, req.check) });
          break;
        case "units":
          post({ id: req.id, type: "units", result: host.units(req.job, req.settings) });
          break;
        case "plotValues":
          post({ id: req.id, type: "plotValues", result: host.plotValues(req.texts, req.settings) });
          break;
        case "library":
          post({ id: req.id, type: "library", ...importText(host, req.input, req, req.log, req.replace) });
          break;
        case "libraryExport":
          post({ id: req.id, type: "libraryExport", ...exportText(req.log, req) });
          break;
      }
    } catch (e) {
      const dead = req.type === "init" ? startDead(e) : deadEngine(e); // G318: a failed start is classed by when it happened
      post({ id: req.id, type: "fatal", message: e instanceof Error ? e.message : String(e), ...(dead ? { dead } : {}) });
    }
  };
}
