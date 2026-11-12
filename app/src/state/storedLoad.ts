// SPDX-License-Identifier: GPL-3.0-or-later
// R264: the stored rows' reader (state/storedItem.ts) runs only in the history's start read (and on the stored Undo copy
// read with it), so it is a lazy chunk, fetched beside that read, as the item chunk is beside a job (state/itemLoad.ts).
type Stored = typeof import("./storedItem.ts");
let chunk: Promise<Stored> | undefined;
const load = (): Promise<Stored> =>
  (chunk ??= import("./storedItem.ts").then(
    (m) => m,
    (e: unknown) => {
      chunk = undefined;
      throw e;
    },
  ));
/** The reader of a stored row, with one more try if the first load failed (a tab open across a redeploy: the old hashed
 *  file is gone); undefined when neither loads. Never rejects. */
export const storedReader = (): Promise<Stored["restoredItem"] | undefined> =>
  load()
    .catch(load)
    .then((m) => m.restoredItem, () => undefined);
