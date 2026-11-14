// SPDX-License-Identifier: GPL-3.0-or-later
// R194 (docs/04 5.4, 6.2): the word size and sign as the session keeps them: one record under the key `word`
// (wordSetting.ts), read lazily and set from Settings › Numbers › Word. Out of the start chunk (R91's pin): EngineCalc
// takes the settings of every engine request from it (the defaults too, so they stay out of the start chunk), and the
// base forms' code (cycleForms.ts, whose chunk carries this module) reads it when it draws.
// Same pattern as the unit pad's cells (units/userCells.svelte.ts): a class on a Kv, and the app's session of it.
import type { CalcSettings } from "../calc/port.ts";
import { defaultHomeSettings } from "../engine/homeDefaults.ts";
import { defaultCasSettings, type CasSettings, type HomeSettings } from "../engine/types.ts";
import { idbKv, type Kv } from "./storage.ts";
import { validWord, WORD_KEY, type WordSetting } from "./wordSetting.ts";

export class WordStore {
  /** The word the user set; undefined until a row set it (64 bits, unsigned: the engine gets nothing). */
  private current = $state<WordSetting | undefined>();
  private readonly kv: Kv;
  private restoring: Promise<void> | undefined;
  /** A set ran: a read that finishes after it assigns nothing. */
  private wasSet = false;

  constructor(kv: Kv) {
    this.kv = kv;
  }

  get value(): WordSetting | undefined {
    return this.current;
  }

  /** Read the stored record (once); a record that is not whole is as none. */
  restore(): Promise<void> {
    this.restoring ??= this.kv.get<unknown>(WORD_KEY).then((v) => {
      if (!this.wasSet) this.current = validWord(v);
    });
    return this.restoring;
  }

  /** Set the word (Settings › Numbers › Word); a read still running does not undo it. */
  set(w: WordSetting): void {
    this.restoring ??= Promise.resolve();
    this.wasSet = true;
    this.current = w;
    void this.kv.set(WORD_KEY, w);
  }

  /** Home's settings for an engine request: the defaults, the digits and angle, and the word once it was set (after the
   *  read), else none (the engine's own word: 64 bits, unsigned). */
  home(s: CalcSettings): HomeSettings {
    return this.withWord({ ...defaultHomeSettings, digits: s.digits, angle: s.angle });
  }

  /** CAS's settings for an engine request, as `home` gives Home's. */
  cas(s: CalcSettings): CasSettings {
    return this.withWord({ ...defaultCasSettings, digits: s.digits, angle: s.angle });
  }

  private withWord<T extends object>(base: T): T {
    return this.current ? { ...base, word: this.current.bits, signed: this.current.signed } : base;
  }
}

/** The session's word, on the app's store. */
export const wordStore = new WordStore(idbKv);
