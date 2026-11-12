// SPDX-License-Identifier: GPL-3.0-or-later
// R263: the one form of a lazy chunk's door. A load that succeeded is kept (the same promise on every later call, one
// import); a load that failed is forgotten, so the next call runs a new import(). A kept rejection would stay for good
// once the one reload of state/chunkReload.ts is spent: only a manual reload would recover.
export function lazyOnce<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | undefined;
  return () =>
    (p ??= load().catch((e: unknown) => {
      p = undefined;
      throw e;
    }));
}
