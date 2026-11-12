// SPDX-License-Identifier: GPL-3.0-or-later
// G311: the parser's names for letters (input/parseTables.ts re-exports them for the parser, input/ -> engine/ being the
// allowed direction): the library reader (library.ts) takes the stand-ins among them as the user's names. R260f1: with
// the Greek names in Unicode's order and typedName, which render/home.ts draws with and library.ts writes descriptions
// with (engine/ imports nothing from render/). No imports; the start chunk holds it through render/home.ts, so the
// parser's map of commands to these names (GREEK) is input/parseTables.ts's, read off GREEK_NAMES in the parser's chunk.

/** The Greek variable names as Giac prints them (the values of input/parseTables.ts GREEK), in Unicode's order (R260):
 *  the small letters (α U+03B1 … ω), then the capitals (Α U+0391 … Ω), `-` for a letter that is no variable (ο, π, ς,
 *  υ, …): a name's place gives its letter. */
export const GREEK_NAMES: readonly string[] = ("alpha beta_ gamma_ delta epsilon_ zeta eta theta iota kappa lambda mu nu xi - - rho - sigma tau - phi chi psi omega " +
  "- - Gamma_ Delta - - - Theta - - Lambda - - - - - - - Sigma - - Phi_ - Psi_ Omega").split(" ");

/**
 * R67 (decisions R58b): a typed letter is always a name. Giac reads `e` as exp(1) and `i` as √−1 (`e:=3` is refused,
 * `sum(i^2,i,1,3)` an error), so the letters e and i go in as the stand-ins `e_` and `i_`, drawn as the letters again
 * (render/tidy.ts). The constants come from the eˣ key (\exponentialE) and Shift + 2 (\imaginaryI).
 */
export const LETTER_NAMES: Readonly<Record<string, string>> = { e: "e_", i: "i_" };

/** G311: whether `name` is one of the parser's stand-ins (`beta_`, `e_`, …): the user's name, though it ends in `_`. */
export function isStandIn(name: string): boolean {
  return name.endsWith("_") && (GREEK_NAMES.includes(name) || Object.values(LETTER_NAMES).includes(name));
}

/** R260 (vr-2): a stored name as the user typed it, for the text that names it (Vars, the unit note, the uses line, a
 *  library's descriptions): a Greek name as its letter (`beta_` β, `Omega` Ω), the letter stand-ins `e_`, `i_`
 *  (LETTER_NAMES, R67) as e, i; any other name as stored. */
export function typedName(name: string): string {
  const k = GREEK_NAMES.indexOf(name);
  return name === "e_" || name === "i_" ? name[0]! : k < 0 ? name : String.fromCharCode(k < 25 ? 945 + k : 888 + k);
}
