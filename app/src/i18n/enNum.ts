// SPDX-License-Identifier: GPL-3.0-or-later
// R99: why the Num entry of Solve and Function refused a value, and the words the apps' views draw (moved out of en.ts by R145f1;
// the apps' menus, readouts and messages by R53). A table of its own, loaded with the apps' chunks, so the
// start chunk does not carry it (R91's pin, docs/04 section 8.3). English only so far.
export const enNum = {
  "num.notNumber": "Not a number",
  "num.zeroStep": "The step cannot be 0",
  "solve.empty": "Enter an equation in Symb (e.g. X²+Y²=4) to see its unknowns here.",
  "solve.warnTitle": "Substituting the answer back leaves a large residual: check it.",
  "symb.label": "Definitions",
  "symb.toggle": "Show or hide",
  "num.empty": "Switch on a function in Symb to see its table.",
  "plot.empty": "Define a function in Symb to draw it.",
  "plot.loading": "Loading the graph…",
  "plot.label": "Graph",
  // the apps' menus, readouts and messages (moved out of en.ts by R53, to make room in the start chunk)
  "solve.solve": "Solve",
  "solve.polyRoots": "Polynomial roots",
  "solve.noRoot": "No root found from this guess.",
  "solve.badInput": "Cannot solve this",
  "solve.syntax": "An equation does not make sense to the engine.",
  "solve.failed": "The calculation failed.",
  "solve.tooFewUnknowns": "More equations are on than there are unknowns.",
  "why.noFunction": "Define a function first",
  "why.noEquation": "Enter an equation and pick an unknown first",
  "why.oneEquation": "Needs exactly one equation",
  /** R261: Symb's Menu row that empties the selected slot (Undo brings it back), and why it is greyed */
  "slot.clear": "Clear",
  "why.emptySlot": "This one is empty",
  "function.undefined": "undefined",
  "function.nan": "NaN",
  "function.notFunction": "Enter an expression in x, not an equation",
  "num.start": "Start:",
  "num.step": "Step:",
  "num.setStart": "Start value",
  "num.setStep": "Step",
  "plot.defaultWindow": "Default window",
  "fcn.root": "Root",
  "fcn.extremum": "Extremum",
  "fcn.intersection": "Intersection",
  "fcn.intersectionOf": "Intersection of {f} and",
  "fcn.xAxis": "x-axis",
  "fcn.slope": "Slope",
  "fcn.area": "Signed area",
  "fcn.areaFrom": "From x",
  "fcn.areaHint": "Move the trace to the end and press Enter.",
  "fcn.areaRange": "x",
  "fcn.kind": "Kind",
  "fcn.min": "minimum",
  "fcn.max": "maximum",
  "fcn.flat": "flat point",
  "fcn.noResult": "Nothing found near the trace position.",
  "fcn.failed": "The calculation failed.",
} as const;

export type NumKey = keyof typeof enNum;

/** The text of `key`, each `{name}` replaced by its value. */
export const numText = (key: NumKey, vars: Readonly<Record<string, string>> = {}): string =>
  enNum[key].replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
