// SPDX-License-Identifier: GPL-3.0-or-later
// G63, G188: the view sweep's known rows, tests/golden/viewsweep-known.yaml: the gate stage's exact list (seed 20261022). Every check
// fails the stage, `crash` and `hang` included (G188; the point sweep's FAILING_KINDS, G144), so a row of any check is read alike.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { KnownFailure } from "./invariants.ts";

export const VIEW_KNOWN_FILE = "tests/golden/viewsweep-known.yaml";

/** The rows of the known file under `dir` (the repo root). */
export const loadViewKnown = (dir: string): KnownFailure[] => (parse(readFileSync(resolve(dir, VIEW_KNOWN_FILE), "utf8")) as { known?: KnownFailure[] } | null)?.known ?? [];
