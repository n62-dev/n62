// SPDX-License-Identifier: GPL-3.0-or-later
// Copy as Python: Python's own words (keyword.kwlist), shared by the translator (clipboard/python.ts: never a name it
// binds) and the unit table (clipboard/pyUnits.ts: never an attribute, `ureg.in` is a SyntaxError). scripts/pyunits-check.ts
// checks the list against the venv's Python. Lazy: reached only through clipboard/python.ts.

/** Python's keywords: no name or attribute may be one. */
export const KEYWORDS: ReadonlySet<string> = new Set(
  ("False None True and as assert async await break class continue def del elif else except finally for from global if " +
    "import in is lambda nonlocal not or pass raise return try while with yield").split(" "),
);
