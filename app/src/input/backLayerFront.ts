// SPDX-License-Identifier: GPL-3.0-or-later
// R782 (a start-chunk cut, docs/research/start-chunk-cuts.md cut 3): the start chunk's front of Android back's layers
// (input/backLayer.ts, loaded when the browser is idle after the start). A layer opened before the code is in waits for
// it and is pushed then, unless it was released meanwhile (then it never had an entry); layers keep the order they were
// opened in, since they wait on one load. The units view and the tips import the real module (they are lazy parts).
// Back pressed before the code is in would leave the app (nothing is pushed to pop), so the first layer opened before it
// puts one guard entry on the history at once; the real layers are pushed on top of it when the code arrives.
let code: typeof import("./backLayer.ts") | undefined;
let guarded = false;
let loading: Promise<unknown> | undefined;

/** One load for every caller (so the layers waiting on it are pushed in the order they were opened); a failed one is tried again by the next call. */
export const loadBackLayer = (): Promise<unknown> =>
  (loading ??= import("./backLayer.ts").then(
    (m) => (code = m),
    () => (loading = undefined),
  ));

/** `openLayer` of backLayer.ts: `close` runs when the platform's back pops the layer; the result releases it. */
export function openLayer(close: () => void): () => void {
  if (code) return code.openLayer(close);
  if (!guarded)
    try {
      history.pushState(null, "");
      guarded = true;
    } catch {
      // no history here (a sandboxed frame): back just leaves
    }
  let off = false;
  let release: (() => void) | undefined;
  void loadBackLayer().then(() => {
    if (!off) release = code?.openLayer(close);
  });
  return () => {
    off = true;
    release?.();
  };
}
