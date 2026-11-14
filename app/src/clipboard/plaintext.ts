// SPDX-License-Identifier: GPL-3.0-or-later
// An entry's LaTeX as plain text (R134): what a shared session and the why line write for people. Its own module so the
// why line (in the tidy chunk) does not pull the copy code of text.ts with it.

/** A fraction part or exponent: bare when it is one token, else in brackets. */
const group = (s: string): string => (/^-?[\w.]+$/.test(s) ? s : `(${s})`);

/** The LaTeX commands an entry may hold that are one character or word in plain text: the Greek letters (the Symbols
 *  palette's and the constants' and units' symbols) and its other cells (spec/keyboard.yaml `symbols:`, text.test.ts
 *  checks that every insert is here), π, the arrows. A command not in the table is left as it is. */
const COMMANDS: Readonly<Record<string, string>> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ",
  iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
  phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω", hbar: "ħ",
  infty: "∞", degree: "°", prime: "′", doubleprime: "″", AA: "Å", to: " → ", rightarrow: " → ",
  leq: " ≤ ", le: " ≤ ", geq: " ≥ ", ge: " ≥ ", neq: " ≠ ", ne: " ≠ ", approx: " ≈ ", equiv: " ≡ ", measuredangle: "∡", emark: "E",
  // the function names (MathLive writes `\sin`, `\log_{16}`): the name without its backslash
  ...Object.fromEntries(
    "sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh coth log ln lg exp min max gcd lcm det dim arg sum prod lim"
      .split(" ")
      .map((n) => [n, n]),
  ),
};

/** The command names the table holds (for the test that the Symbols palette is covered). */
export const PLAIN_COMMANDS: readonly string[] = Object.keys(COMMANDS);

/** The `{…}` group that starts at `s[i]` (a `{`): its content and the index after its `}`; undefined if it never closes. */
function group1(s: string, i: number): { body: string; end: number } | undefined {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") j++; // an escaped brace (`\{`) is no group
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return { body: s.slice(i + 1, j), end: j + 1 };
  }
  return undefined;
}

/** Every `\name{…}…{…}` with `argc` brace groups (the groups may hold braces), in order: where it starts and ends in `s`
 *  and the groups' text. A macro whose groups do not close is not listed. */
export function macroCalls(s: string, name: string, argc: number): { start: number; end: number; args: string[] }[] {
  const out: { start: number; end: number; args: string[] }[] = [];
  const head = new RegExp(`\\\\${name}(?![A-Za-z])`, "g");
  for (let m = head.exec(s); m; m = head.exec(s)) {
    const args: string[] = [];
    let at = m.index + m[0].length;
    while (args.length < argc && s[at] === "{") {
      const g = group1(s, at);
      if (!g) break;
      args.push(g.body);
      at = g.end;
    }
    if (args.length === argc) {
      out.push({ start: m.index, end: at, args });
      head.lastIndex = at;
    }
  }
  return out;
}

/** `\name{a}{b}` (and the like) written as its argument number `keep` (through `wrap`); repeated, so a wrapper inside a wrapper goes too. */
function unwrap(s: string, name: string, argc: number, keep: number, wrap = (body: string): string => body): string {
  let out = s;
  for (let n = 0; n < 8; n++) {
    const calls = macroCalls(out, name, argc);
    if (!calls.length) break;
    for (const c of calls.reverse()) out = out.slice(0, c.start) + wrap(c.args[keep] ?? "") + out.slice(c.end);
  }
  return out;
}

/** A template's `_` or `^` argument at `s[i]`: a brace group or one character; undefined when there is none. */
function scriptArg(s: string, i: number, mark: "_" | "^"): { body: string; end: number } | undefined {
  if (s[i] !== mark) return undefined;
  if (s[i + 1] === "{") {
    const g = group1(s, i + 1);
    return g && { body: g.body, end: g.end };
  }
  return /\w/.test(s[i + 1] ?? "") ? { body: s[i + 1] as string, end: i + 2 } : undefined;
}

/** `\sum_{k=1}^{10}`, `\prod_{…}^{…}` and `\lim_{x\to0}` as `sum(k=1..10) `, `prod(…) `, `lim(x→0) ` (R199, F180); a limit
 *  without its subscript is left for the function names. The bounds stay LaTeX for the rules after it. */
function bigOperators(s: string): string {
  let out = "";
  let at = 0;
  const head = /\\(sum|prod|lim)(?![A-Za-z])/g;
  for (let m = head.exec(s); m; m = head.exec(s)) {
    const lo = scriptArg(s, head.lastIndex, "_");
    if (!lo) continue;
    const hi = scriptArg(s, lo.end, "^");
    const name = m[1] as string;
    const low = lo.body.replace(/\\(?:to|rightarrow)(?![A-Za-z])/g, "→");
    const call = name === "lim" || !hi ? `${name}(${low}) ` : `${name}(${low}..${group(hi.body)}) `;
    const end = name === "lim" || !hi ? lo.end : hi.end;
    out += s.slice(at, m.index) + call;
    at = end;
    head.lastIndex = end;
  }
  return out + s.slice(at);
}

/** `\sqrt[n]{x}` as `root(n, x)`; the index is LaTeX still. */
function nthRoots(s: string): string {
  let out = "";
  let at = 0;
  const head = /\\sqrt\[([^\]{}]*)\]/g;
  for (let m = head.exec(s); m; m = head.exec(s)) {
    const i = head.lastIndex;
    const g = s[i] === "{" ? group1(s, i) : /\w/.test(s[i] ?? "") ? { body: s[i] as string, end: i + 1 } : undefined;
    if (!g) continue;
    out += `${s.slice(at, m.index)}root(${m[1]}, ${g.body})`;
    at = g.end;
    head.lastIndex = g.end;
  }
  return out + s.slice(at);
}

/** An entry as plain text for a shared session: the LaTeX as typed (the parser's output is for the engine, not for people).
 *  Wrappers and chips first (a chip's symbol is LaTeX too), then the commands, then `\mathrm`, so `\to\mathrm{m}` is
 *  read as `\to` and `m`, never `\tom`. */
export function entryText(latex: string): string {
  let s = latex.replace(/\\(?:left|right)(?![A-Za-z])/g, "");
  s = s.replace(/(\d)\\tfrac(?![A-Za-z])/g, "$1 \\tfrac"); // the mixed number: `2\tfrac12` is "2 1/2", not "21/2"
  s = nthRoots(bigOperators(unwrap(unwrap(s, "mathbin", 1, 0), "mathrel", 1, 0)));
  s = unwrap(unwrap(s, "class", 2, 1), "htmlStyle", 2, 1);
  s = unwrap(unwrap(unwrap(unwrap(s, "const", 2, 1), "res", 2, 1), "unit", 2, 1), "pfx", 2, 1);
  s = s.replace(/\\([_&%])/g, "$1").replace(/\\([A-Za-z]+)/g, (m, name: string) => COMMANDS[name] ?? m);
  // \mathrm after the commands (so `\to\mathrm{m}` is not `\tom`); a symbol like `deg^{2}` holds braces
  s = unwrap(unwrap(s, "mathrm", 1, 0), "operatorname", 1, 0);
  s = s.replace(/\\(?:t|d)?frac(?!\{)(\w)(\w)/g, "\\frac{$1}{$2}"); // MathLive writes \frac13 for 1/3
  // the groups with no brace inside, innermost first: repeated, so `\frac{\mathrm{M}m^{2}}{s}` gets its exponent first
  for (let n = 0; n < 6; n++) {
    const was = s;
    s = s
      .replace(/\\(?:t|d)?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_m, a: string, b: string) => `${group(a)}/${group(b)}`)
      .replace(/\\sqrt\{([^{}]*)\}/g, "sqrt($1)")
      .replace(/\^\{([^{}]*)\}/g, (_m, a: string) => `^${group(a)}`)
      .replace(/_\{([^{}]*)\}/g, "_$1");
    if (s === was) break;
  }
  return s
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\div/g, "÷")
    .replace(/\\imaginaryI/g, "i")
    .replace(/\\exponentialE/g, "e")
    .replace(/\\blacktriangleright/g, "▶")
    .replace(/\\pm(?![A-Za-z])/g, "±")
    .replace(/\\[,;:! ]/g, " ")
    .replace(/\\ans(?![A-Za-z])/g, "Ans")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** G232: LaTeX for a `.tex` file: N62's own and KaTeX's macros are not LaTeX. `\class` and `\htmlStyle` (the unit label, PFX,
 *  the muted digits, a rare pair) keep only their body; each chip keeps the symbol it draws (its second argument; a
 *  constant's upright, as the field draws it); `\ans` is `\mathrm{Ans}`, and `\exponentialE`, `\imaginaryI`, `\emark` and
 *  `\blacktriangleright` are their plain forms. */
export function exportLatex(latex: string): string {
  let s = unwrap(unwrap(latex, "class", 2, 1), "htmlStyle", 2, 1);
  s = unwrap(unwrap(unwrap(s, "res", 2, 1), "unit", 2, 1), "pfx", 2, 1);
  return unwrap(s, "const", 2, 1, (b) => `\\mathrm{${b}}`)
    .replace(/\\ans(?![A-Za-z])/g, "\\mathrm{Ans}")
    .replace(/\\exponentialE(?![A-Za-z])/g, "\\mathrm{e}")
    .replace(/\\imaginaryI(?![A-Za-z])/g, "\\mathrm{i}")
    .replace(/\\emark(?![A-Za-z])/g, "\\mathrm{E}")
    .replace(/\\blacktriangleright(?![A-Za-z])/g, "\\rightarrow");
}
