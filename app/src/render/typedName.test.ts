// SPDX-License-Identifier: GPL-3.0-or-later
// R260 (night review 2026-11-09, vr-2): a stored name as the user typed it, never the engine's stand-in (beta_, e_):
// render/home.ts typedName, the one function the readers of a name use (Vars, the unit note, the uses line).
import { describe, expect, it } from "vitest";
import { GREEK, LETTER_NAMES } from "../engine/standIns.ts";
import { typedName } from "./home.ts";

describe("typedName: the Giac name as typed (R260)", () => {
  it.each([
    ["beta_", "β"],
    ["gamma_", "γ"],
    ["epsilon_", "ε"],
    ["Gamma_", "Γ"],
    ["Phi_", "Φ"],
    ["Psi_", "Ψ"],
    ["alpha", "α"],
    ["sigma", "σ"],
    ["omega", "ω"],
    ["Omega", "Ω"],
    ["phi", "φ"],
    ["e_", "e"],
    ["i_", "i"],
    ["A", "A"],
    ["rate", "rate"],
    ["x_1", "x_1"],
    ["beam_w", "beam_w"],
    ["e", "e"],
    ["beta", "beta"],
  ])("%s → %s", (giac, typed) => {
    expect(typedName(giac)).toBe(typed);
  });

  it("every stand-in of the parser's tables reads back as the letter its key types (derived from GREEK, LETTER_NAMES)", () => {
    for (const [letter, name] of Object.entries(LETTER_NAMES)) expect(typedName(name)).toBe(letter);
    // the Unicode Greek letters by name (U+0391 Α … U+03C9 ω); \varepsilon, \varphi, \vartheta share their letter's name
    const LETTERS: Record<string, string> = {
      alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", iota: "ι", kappa: "κ",
      lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
      Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
    };
    for (const [cmd, name] of Object.entries(GREEK)) expect(typedName(name), cmd).toBe(LETTERS[cmd.replace(/^var/, "")]);
  });
});
