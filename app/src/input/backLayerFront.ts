// SPDX-License-Identifier: GPL-3.0-or-later
// R782 (a start-chunk cut, docs/research/start-chunk-cuts.md cut 3): the start chunk's front of Android back's layers
// (input/backLayer.ts, loaded when the browser is idle after the start). A layer opened before the code is in waits for
// it and is pushed then, unless it was released meanwhile (then it never had an entry); layers keep the order they were
// opened in, since the loads settle in order. The units view and the tips import the real module (they are lazy parts).
let code: typeof import("./backLayer.ts") | undefined;

export const loadBackLayer = (): Promise<unknown> => import("./backLayer.ts").then((m) => (code = m), () => undefined);

/** `openLayer` of backLayer.ts: `close` runs when the platform's back pops the layer; the result releases it. */
export function openLayer(close: () => void): () => void {
  if (code) return code.openLayer(close);
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
