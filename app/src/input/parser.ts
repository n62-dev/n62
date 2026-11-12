// SPDX-License-Identifier: GPL-3.0-or-later
// The parser (parse.ts, emit.ts, chip-giac.ts, latex-to-giac.ts) is its own chunk, loaded together with MathLive
// (decisions M4-3): it is needed only at Enter, and nothing typed reaches Enter before MathLive is there. This is the
// only door into it from the start chunk. The Function and Solve apps, which are lazy chunks themselves, import the
// parser files directly.
import { lazyOnce } from "../lazyOnce.ts";

/** The LaTeX → Giac converter, loaded on the first call; the same promise afterwards (a failed load is tried again, R263). */
export const loadParser = lazyOnce(() => import("./latex-to-giac.ts"));

/** The per-view entry step (entry.ts, G98), in the same chunk as the parser. */
export const loadEntry = lazyOnce(() => import("./entry.ts"));
