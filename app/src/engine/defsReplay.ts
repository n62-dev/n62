// SPDX-License-Identifier: GPL-3.0-or-later
// G314: the definitions replay of host.ts (docs/04 6.2): our definitions loaded on first use, the user's functions that
// wait until an input names them (G83), and the log's entries replayed into a fresh Giac in batches (G29). Worker side
// only; EngineHost holds the state and passes it in. Only erasable TypeScript syntax, so Node runs this file directly.
import type { GatedGiac } from "./ctxGate.ts";
import { replayOrder, type DefEntry } from "./defs.ts";
import { eseriesDefinition } from "./eseries.ts";
import { balanced, parsePrinted, wordsOf } from "./giacPrint.ts";
import { definitionsUsedBy, ENGINE_DEFINITIONS, WORKER_DEFINITION_NAMES } from "./homeEval.ts";
import { namesPart, tableOf, type StoredName } from "./stateRead.ts";
import { WORD_DEFINITIONS } from "./wordOps.ts";
import { wordDefinitions } from "./wordSettings.ts";

/** Commands per Giac call in a replay (G29; tools/probes/replay-cost.mjs: 10–50 are as fast, 200 in one call is not). */
export const REPLAY_BATCH = 25;

/** G83: inputs that list or clear the user's names: every pending function is loaded first. */
const LOAD_ALL: ReadonlySet<string> = new Set(["VARS", "expr", "rm_all_vars", "restart", "restart_vars", "rm_a_z"]);

/** What the replay reads and changes of EngineHost's state (the maps are the host's own; the getters read fields the
 *  host replaces). */
export interface ReplayState {
  readonly giac: GatedGiac["giac"];
  /** Our definitions already loaded into this Giac instance (ENGINE_DEFINITIONS, loaded on first use). */
  readonly loaded: Set<string>;
  /** G83: the user's functions restore() has not given to Giac yet, by name; loaded on first use (need). */
  readonly pending: Map<string, DefEntry>;
  byName(): ReadonlyMap<string, DefEntry>;
  stored(): Map<string, StoredName>;
  /** R194: the word size and sign the word ops are defined for (wordOps.ts). */
  word(): { bits: number; signed: number };
  /** G67: the Digits of the current mode. */
  modeDigits(): number;
}

export class DefsReplay {
  private readonly s: ReplayState;

  constructor(state: ReplayState) {
    this.s = state;
  }

  /** Loads the definitions `text` mentions that are not loaded yet: the user's pending functions (G83) and ours.
   *  Called before every input reaches Giac. */
  need(text: string): void {
    if (this.s.pending.size) this.loadPending(text);
    this.needOurs(text);
  }

  /** Our definitions (ENGINE_DEFINITIONS, eseries) that `text` mentions and that are not loaded yet. */
  needOurs(text: string): void {
    const { giac, loaded } = this.s;
    for (const name of definitionsUsedBy(text)) {
      if (loaded.has(name)) continue;
      const word = this.s.word();
      giac.eval(name in WORD_DEFINITIONS ? wordDefinitions(word.bits, word.signed)[name]! : (ENGINE_DEFINITIONS[name] ?? eseriesDefinition()));
      for (const n of name in ENGINE_DEFINITIONS ? [name] : WORKER_DEFINITION_NAMES) loaded.add(n); // eseries + helper
    }
  }

  /**
   * G83 (docs/04 6.2): every pending function whose name is a word in `text`, and, transitively, every pending function
   * named in such a body or in the stored value of a name the text reads (`S:=(g(x))` reads g), goes to Giac in one
   * batch. A text that lists or clears the names (VARS, expr, rm_all_vars, restart, restart_vars, rm_a_z) loads them all.
   */
  private loadPending(text: string): void {
    const { giac, pending } = this.s;
    const byName = this.s.byName();
    const queue = wordsOf(text).some((w) => LOAD_ALL.has(w)) ? [...pending.keys()] : wordsOf(text);
    const seen = new Set<string>();
    const todo: DefEntry[] = [];
    while (queue.length) {
      const n = queue.pop()!;
      if (seen.has(n)) continue;
      seen.add(n);
      const e = pending.get(n) ?? byName.get(n);
      if (!e || e.kind === "assume") continue;
      if (pending.has(n)) todo.push(e);
      for (const c of e.cmds) for (const w of wordsOf(c)) if (!seen.has(w)) queue.push(w);
    }
    if (!todo.length) return;
    for (const e of todo) {
      pending.delete(e.name);
      this.needOurs(e.cmds[0]!);
    }
    for (let k = 0; k < todo.length; k += REPLAY_BATCH) {
      const part = todo.slice(k, k + REPLAY_BATCH);
      this.runBatch(part.map((e) => e.cmds[0]!), part.map((e) => e.name));
    }
    // The stored table learns the loaded names as Giac prints them, so the input's state part does not count them as
    // its stores (G65's changesOf would log them as vars with the input's facts).
    // G104: their entries only
    const node = parsePrinted(giac.eval(namesPart(this.s.modeDigits(), todo.map((e) => e.name))));
    const table = node ? tableOf(node) : null;
    const stored = this.s.stored();
    if (table) for (const e of todo) { const t = table.get(e.name); if (t) stored.set(e.name, t); }
    // the `// Success` notes and any error of the load are not the input's
    giac.clearMessages();
  }

  /**
   * G29: plain commands (`a:=1;b:=2;`) in one Giac call. One that printed an error or returned one is run again one
   * command at a time (values and functions can be set twice), so one bad entry never takes the others down (G19).
   */
  private runBatch(batch: readonly string[], names: readonly string[]): void {
    const { giac } = this.s;
    if (!batch.length) return;
    giac.clearMessages();
    const out = giac.eval(batch.join(";") + ";");
    // Any message or error result: a syntax error, or a reserved name that aborts the rest of the batch (`pi:=3`).
    if (batch.length > 1 && (/error|reserved word|not allowed/i.test(giac.messages()) || /^GIAC_ERROR/.test(out))) {
      // Errors only: a warning (`declared as global`) is no reason to run twice. The names are purged first, so a
      // rerun sees them as free again, as in the first run (G3: S:=(K*x+1) must not meet a K set by the aborted run).
      for (const n of names) giac.eval(`purge(${n})`);
      for (const c of batch) giac.eval(c);
    }
  }

  /** restore()'s replay of `entries` (a fresh engine: at init, or the stored log on first launch), before the host's
   *  log records them. Symbolic values first, while every name in them is still free (defs.ts). */
  replay(entries: readonly DefEntry[]): void {
    const { giac, pending } = this.s;
    const byName = this.s.byName();
    // G83: a function (one balanced command) waits in `pending` until an input names it (need). One whose name Giac
    // already holds is replayed now: a loaded body that calls it would otherwise meet the old definition.
    const plain = (e: DefEntry): boolean => (e.kind === "var" || e.kind === "fn") && e.cmds.length === 1 && balanced(e.cmds[0]!, "typed");
    for (const e of entries) {
      if (e.kind !== "other") pending.delete(e.name);
      if (e.kind === "fn" && plain(e) && !byName.has(e.name)) pending.set(e.name, e);
    }
    // G29: values go to Giac REPLAY_BATCH at a time (`a:=1;b:=2;`), which halves the per-call cost. Assumptions and
    // inputs kept as typed go alone.
    let batch: string[] = [];
    let names: string[] = [];
    const flush = (): void => {
      this.runBatch(batch, names);
      batch = [];
      names = [];
    };
    for (const e of replayOrder(entries)) {
      if (pending.get(e.name) === e) continue;
      // A replayed command may use one of ours, or a pending function (G83). A symbolic value is set while every
      // name in it is still free (G3), so it loads only ours.
      for (const c of e.cmds) {
        if (e.early) this.needOurs(c);
        else this.need(c);
      }
      if (plain(e)) {
        batch.push(e.cmds[0]!);
        names.push(e.name);
        if (batch.length >= REPLAY_BATCH) flush();
      } else {
        flush();
        for (const c of e.cmds) giac.eval(c);
      }
    }
    flush();
  }
}
