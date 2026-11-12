// SPDX-License-Identifier: GPL-3.0-or-later
// G311: the parser's names for letters (input/parseTables.ts re-exports them for the parser, input/ -> engine/ being the
// allowed direction): the library reader (library.ts) takes the stand-ins among them as the user's names. No imports;
// the start chunk reads it through the parser.

/**
 * Greek letters are variable names (R18), never units (μ, Ω) or Giac's own names. Giac reads most of them as plain
 * names, but some are taken: `epsilon` is a setting (it evaluates to 1e-12), `Gamma` is the Gamma function and cannot
 * be stored, `beta`, `gamma` stay clear of the Beta and Euler names, and `Phi`, `Psi` are reserved (`Psi:=3` is
 * refused, R18f1). Those get a trailing `_`, which Giac's latex()
 * draws as the letter and a stray `_` (render/tidy.ts removes it). One letter is one name: \epsilon and \varepsilon,
 * \phi and \varphi, \theta and \vartheta are the same variable.
 */
export const GREEK: Readonly<Record<string, string>> = {
  alpha: "alpha", beta: "beta_", gamma: "gamma_", delta: "delta", epsilon: "epsilon_", varepsilon: "epsilon_",
  zeta: "zeta", eta: "eta", theta: "theta", vartheta: "theta", iota: "iota", kappa: "kappa", lambda: "lambda",
  mu: "mu", nu: "nu", xi: "xi", rho: "rho", sigma: "sigma", tau: "tau", phi: "phi", varphi: "phi", chi: "chi",
  psi: "psi", omega: "omega", Gamma: "Gamma_", Delta: "Delta", Theta: "Theta", Lambda: "Lambda", Sigma: "Sigma",
  Phi: "Phi_", Psi: "Psi_", Omega: "Omega",
};
/**
 * R67 (decisions R58b): a typed letter is always a name. Giac reads `e` as exp(1) and `i` as √−1 (`e:=3` is refused,
 * `sum(i^2,i,1,3)` an error), so the letters e and i go in as the stand-ins `e_` and `i_`, drawn as the letters again
 * (render/tidy.ts). The constants come from the eˣ key (\exponentialE) and Shift + 2 (\imaginaryI).
 */
export const LETTER_NAMES: Readonly<Record<string, string>> = { e: "e_", i: "i_" };

/** G311: whether `name` is one of the parser's stand-ins (`beta_`, `e_`, …): the user's name, though it ends in `_`. */
export function isStandIn(name: string): boolean {
  return name.endsWith("_") && (Object.values(GREEK).includes(name) || Object.values(LETTER_NAMES).includes(name));
}
