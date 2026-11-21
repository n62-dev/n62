// SPDX-License-Identifier: GPL-3.0-or-later
// R782 (a start-chunk cut, docs/research/start-chunk-cuts.md cut 3): the start chunk's front of Android back's layers
// (input/backLayer.ts, loaded when the browser is idle after the start). A layer opened before the code is in waits for
// it and is pushed then, unless it was released meanwhile (then it never had an entry); layers keep the order they were
// opened in, since they wait on one load. The units view and the tips import the real module (they are lazy parts).
// Back pressed before the code is in would leave the app (nothing is pushed to pop), so the first layer opened before it
// puts one guard entry on the history at once. A back before the load pops that guard and closes the newest waiting
// layer (as the real one would), and a guard again goes under the layers still waiting. When the code arrives it takes
// the guard over (backLayer.ts adoptGuard): the first layer pushed replaces it, and with every waiting layer released
// meanwhile it goes back with one history.go(-1) of backLayer's own, so back with nothing open still leaves the app.
interface Waiting {
  readonly close: () => void;
  release?: () => void;
}
let code: typeof import("./backLayer.ts") | undefined;
let guarded = false;
let loading: Promise<unknown> | undefined;
const waiting: Waiting[] = [];

function guard(): void {
  if (guarded) return;
  try {
    history.pushState(null, "");
    guarded = true;
    if (typeof window !== "undefined") window.addEventListener("popstate", onEarlyPop, { once: true });
  } catch {
    // no history here (a sandboxed frame): back just leaves
  }
}

/** Back before the code is in: the guard is gone; the newest waiting layer closes, and the ones left get a guard again. */
function onEarlyPop(): void {
  guarded = false;
  waiting.pop()?.close();
  if (waiting.length > 0) guard();
}

/** One load for every caller (so the layers waiting on it are pushed in the order they were opened); a failed one is tried again by the next call. */
export const loadBackLayer = (): Promise<unknown> =>
  (loading ??= import("./backLayer.ts").then(
    (m) => {
      code = m;
      if (typeof window !== "undefined") window.removeEventListener("popstate", onEarlyPop);
      if (guarded) m.adoptGuard();
      guarded = false;
      for (const w of waiting.splice(0)) w.release = m.openLayer(w.close);
    },
    () => (loading = undefined),
  ));

/** `openLayer` of backLayer.ts: `close` runs when the platform's back pops the layer; the result releases it. */
export function openLayer(close: () => void): () => void {
  if (code) return code.openLayer(close);
  guard();
  const w: Waiting = { close };
  waiting.push(w);
  void loadBackLayer();
  return () => {
    const i = waiting.indexOf(w);
    if (i >= 0) waiting.splice(i, 1);
    w.release?.();
  };
}
