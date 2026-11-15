// SPDX-License-Identifier: GPL-3.0-or-later
// G219f1: the sync queue's port for the Vitest files (queue.test.ts, files.test.ts): the "folder" is a map of file
// texts, the store a map of values. Test code only: nothing in the app imports it.
import type { CheckedAppend, ReadResult } from "../clipboard/folder.ts";
import type { Kv } from "../state/storage.ts";
import type { SyncQueuePort } from "./queue.ts";

/** The store: a map; `frozen` drops every write (a crash: nothing written after it lands). */
export function memKv(): Kv & { data: Map<string, unknown>; frozen: boolean } {
  const data = new Map<string, unknown>();
  const kv = {
    data,
    frozen: false,
    get: async <T>(key: string): Promise<T | undefined> => structuredClone(data.get(key)) as T | undefined,
    set: async (key: string, value: unknown): Promise<void> => {
      if (!kv.frozen) data.set(key, structuredClone(value));
    },
  };
  return kv;
}

export interface FakeFolder {
  /** Each file's text. */
  files: Map<string, string>;
  calls: { file: string; text: string }[];
  /** What the next appends answer; an "appended" one appends. */
  answer: CheckedAppend;
  /** A "cantAppend" whose text lands all the same (a stale size on a cloud provider). */
  lands: boolean;
  /** Runs after a text landed, before appendChecked answers (a crash: freeze the store here). */
  afterAppend: () => void;
  /** Set: what every tail read answers instead of the file's last bytes. */
  tailAnswer: ReadResult | undefined;
  tails: { file: string; n: number }[];
  appendChecked: (file: string, text: string) => Promise<CheckedAppend>;
  tail: (file: string, n: number) => Promise<ReadResult>;
}

export function fakeFolder(): FakeFolder {
  const f: FakeFolder = {
    files: new Map(),
    calls: [],
    answer: "appended",
    lands: false,
    afterAppend: () => {},
    tailAnswer: undefined,
    tails: [],
    appendChecked: async (file, text) => {
      f.calls.push({ file, text });
      if (f.answer === "appended" || (f.answer === "cantAppend" && f.lands)) {
        f.files.set(file, (f.files.get(file) ?? "") + text);
        f.afterAppend();
      }
      return f.answer;
    },
    tail: async (file, n) => {
      f.tails.push({ file, n });
      if (f.tailAnswer !== undefined) return f.tailAnswer;
      const text = f.files.get(file);
      if (text === undefined) return "missing";
      const bytes = new TextEncoder().encode(text);
      return { text: new TextDecoder().decode(bytes.slice(Math.max(0, bytes.length - n))) };
    },
  };
  return f;
}

/** The queue's port on `dir` and `kv`, read at each call (a test may swap `dir.appendChecked`). */
export const fakePort = (dir: FakeFolder, kv: Kv): SyncQueuePort => ({
  appendChecked: (file, text) => dir.appendChecked(file, text),
  tail: (file, n) => dir.tail(file, n),
  kv,
});
