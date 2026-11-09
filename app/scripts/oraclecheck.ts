// SPDX-License-Identifier: GPL-3.0-or-later
// G200 (F197): the gate's oracle stage: when a tests/golden/* file or oracle.py changed, run `oracle.py` (every expect value and mark).

/** Whether the diff touches the oracle's inputs: any file under tests/golden/ (the case files, oracle.py, g2.yaml). */
export function touchesOracle(changed: string[]): boolean {
  return changed.some((f) => f.startsWith("tests/golden/") && !f.startsWith("tests/golden/.venv/"));
}

/** The first `n` PROBLEM lines of oracle.py's output (what a failing stage shows). */
export function problemLines(out: string, n = 3): string[] {
  return out.split("\n").filter((l) => l.startsWith("PROBLEM")).slice(0, n);
}
