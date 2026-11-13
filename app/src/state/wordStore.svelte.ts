// SPDX-License-Identifier: GPL-3.0-or-later
// R194 (docs/04 5.4, 6.2): the word size and sign as the session keeps them: one record under the key `word`
// (wordSetting.ts), read lazily and set from Settings › Numbers › Word. Out of the start chunk (R91's pin): the session
// asks for it beside a job (state/resultItem.ts `wordOf`), the base forms' code (cycleForms.ts) reads it when it draws.
// Same pattern as the unit pad's cells (units/userCells.svelte.ts): a class on a Kv, and the app's session of it.
import { idbKv, type Kv } from "./storage.ts";
import { validWord, WORD_KEY, type WordSetting } from "./wordSetting.ts";

export class WordStore {
  /** The word the user set; undefined until a row set it (64 bits, unsigned: the engine gets nothing). */
  private current = $state<WordSetting | undefined>();
  private readonly kv: Kv;
  private restoring: Promise<void> | undefined;

  constructor(kv: Kv) {
    this.kv = kv;
  }

  get value(): WordSetting | undefined {
    return this.current;
  }

  /** Read the stored record (once); a record that is not whole is as none. */
  restore(): Promise<void> {
    this.restoring ??= this.kv.get<unknown>(WORD_KEY).then((v) => {
      this.current = validWord(v);
    });
    return this.restoring;
  }

  /** Set the word (Settings › Numbers › Word); a read still running does not undo it. */
  set(w: WordSetting): void {
    this.restoring ??= Promise.resolve();
    this.current = w;
    void this.kv.set(WORD_KEY, w);
  }

  /** What the engine's settings carry: the word once it was set (after the read), else nothing (its own: 64 unsigned). */
  async forEngine(): Promise<{ word?: number; signed?: boolean }> {
    await this.restore();
    return this.current ? { word: this.current.bits, signed: this.current.signed } : {};
  }
}

/** The session's word, on the app's store. */
export const wordStore = new WordStore(idbKv);
