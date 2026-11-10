// SPDX-License-Identifier: GPL-3.0-or-later
// R64 (route R, decisions "S14"): the angle mode lives in the text our parser emits. Every command the user types that
// takes an angle gets its angle times `pasdeg`, and every one that returns an angle gets its result over `pasdeg`;
// the engine host sets `pasdeg` (Giac always runs in radians, G46: π/180 in DEG, 1 in RAD). The emitter (emit.ts) and
// the rewrite of Giac text below (the library import, G46's migration) share these tables. It lives in engine/ (G147: the
// import direction is input/ -> engine/ only); Giac text is read through giacPrint.ts (G105: one string skip, one bracket
// walk, one name pattern).
import { closing, firstNameIn, isNameChar, leadingName, mapNames, mapNumbers, names, opening, type Quoting, stringEnd, topLevelArgs, withoutStrings } from "./giacPrint.ts";
import { PASDEG } from "./pasdeg.ts";

export { PASDEG };

/**
 * Commands that take an angle: the index of that argument, and the number of arguments the form must have (0: any).
 * Audit of the Find index (R64): docs in the R64 report; a command not here and not in ANGLE_OUT needs nothing or is
 * listed there with its reason.
 */
export const ANGLE_IN: Readonly<Record<string, readonly [index: number, arity: number]>> = {
  sin: [0, 1], cos: [0, 1], tan: [0, 1], sec: [0, 1], csc: [0, 1], cot: [0, 1],
  rotation: [1, 0], // rotation(center, angle, object)
  polar_point: [1, 0], // polar_point(r, θ) (R64f2)
  similarity: [2, 0], // similarity(center, ratio, angle, object)
  rectangular_coordinates: [1, 2], // rectangular_coordinates(r, θ); the one-list form: RECT, below (R64f1)
};

/** Commands whose result is an angle (or a list of angles); instfreq is an angle per sample or per unit of time. */
export const ANGLE_OUT: ReadonlySet<string> = new Set([
  "asin", "acos", "atan", "asec", "acsc", "acot", "arg", "atan2", "angle", "instphase", "instfreq",
]);

/**
 * G304: Giac's other spellings of the commands above → the canonical name (tools/probes/g304/aliases.out). The lexer's
 * arcsin, arccos, arctan; misc.cc's arcsec, arccsc, arccot; rpn.cc's uppercase forms, which call the same functions;
 * the lexer's sin, cos and tan followed by U+F005 (a calculator's inverse glyph) for asin, acos, atan. Found by a scan
 * of Giac 2.1.0's source for every name whose evaluator is one of these commands' functions (the G304 report). Giac
 * reads none of tg, arctg, cotan, cosec, acotan, phase, argument, Arg, Sin, Arcsin or ATAN2: they stay out.
 */
export const ANGLE_ALIAS: Readonly<Record<string, string>> = {
  arcsin: "asin", arccos: "acos", arctan: "atan", arcsec: "asec", arccsc: "acsc", arccot: "acot",
  ASIN: "asin", ACOS: "acos", ATAN: "atan", ASEC: "asec", ACSC: "acsc", ACOT: "acot", ARG: "arg",
  SIN: "sin", COS: "cos", TAN: "tan", SEC: "sec", CSC: "csc", COT: "cot",
  "sin\uF005": "asin", "cos\uF005": "acos", "tan\uF005": "atan",
};

/** The canonical name of a command (G304): an alias's, else the name itself. */
export function angleName(name: string): string {
  return Object.hasOwn(ANGLE_ALIAS, name) ? ANGLE_ALIAS[name]! : name;
}

/** ANGLE_IN's entry for a command under any of its spellings (G304). */
export function angleInSpec(name: string): (typeof ANGLE_IN)[string] | undefined {
  const c = angleName(name);
  return Object.hasOwn(ANGLE_IN, c) ? ANGLE_IN[c] : undefined;
}

/** The command returns an angle, under any of its spellings (G304). */
export function returnsAngle(name: string): boolean {
  return ANGLE_OUT.has(angleName(name));
}

/** A typed degree (° and DMS, R10): u° is u*DEGREE, u in the mode's unit (30 in DEG, π/6 in RAD; Giac in radians). */
export const DEGREE = `pi/180/${PASDEG}`;

/**
 * R64f1: polar_coordinates answers [r, θ] for one point and a list of those for a list of points, θ in radians.
 * `POLAR_OUT(polar_coordinates(…))` gives every θ over pasdeg; the shape is read when it is evaluated, since the
 * argument's text (a complex number, a name) does not show it.
 */
export const POLAR = "polar_coordinates";
export const POLAR_OUT = `((pasp_)->when(type(pasp_[0])==vector,map(pasp_,pasq_->[pasq_[0],pasq_[1]/${PASDEG}]),[pasp_[0],pasp_[1]/${PASDEG}]))`;

/**
 * R64f1: rectangular_coordinates of one list, [r, θ] or a list of those: every θ times pasdeg. A literal point
 * `[r,t]` of two numeric literals (`numericLiteral`) takes the factor in its text (`rectArg`); any other argument goes through `RECT_IN(…)`, which reads its
 * shape when evaluated and passes a non-list (a point object) unchanged.
 */
export const RECT = "rectangular_coordinates";
export const RECT_IN =
  `((pasp_)->when(type(pasp_)!=vector,pasp_,when(type(pasp_[0])==vector,map(pasp_,pasq_->[pasq_[0],${PASDEG}*pasq_[1]]),[pasp_[0],${PASDEG}*pasp_[1]])))`;

/** G303f1: POLAR_OUT and RECT_IN as they were written before their bound names took our form (`p_`, `q_`; ourNames.ts
 *  OUR_BOUND). A log or chip kept from then still holds them, so what is drawn and the export drop them as well. */
const WRAPPERS: readonly string[] = [
  POLAR_OUT,
  RECT_IN,
  `((p_)->when(type(p_[0])==vector,map(p_,q_->[q_[0],q_[1]/${PASDEG}]),[p_[0],p_[1]/${PASDEG}]))`,
  `((p_)->when(type(p_)!=vector,p_,when(type(p_[0])==vector,map(p_,q_->[q_[0],${PASDEG}*q_[1]]),[p_[0],${PASDEG}*p_[1]])))`,
];

/**
 * Giac text that is a number by itself: number literals and pi with + - * / ^ and brackets. Only then can the text
 * say an element of [r,t] is a scalar; a name or a call may hold a point (A:=[2,30]), so it goes through RECT_IN.
 */
export function numericLiteral(text: string, q: Quoting): boolean {
  const rest = mapNames(mapNumbers(text, () => "0", q), (n) => (n.name.toLowerCase() === "pi" ? "0" : null), q);
  return /\d/.test(rest) && /^[0\s+\-*/^()]*$/.test(rest);
}

/** The one-list rectangular_coordinates argument with the factor; `point` holds the two elements of a literal [r,t]. */
export function rectArg(arg: string, point?: readonly [r: string, t: string]): string {
  return point ? `[${point[0]},${point[1]}]` : `${RECT_IN}(${arg})`;
}

/** The text of an angle argument with the factor: an atom as `pasdeg*x`, anything else in brackets. */
export function withFactor(arg: string, atom: boolean): string {
  return atom ? `${PASDEG}*${arg}` : `${PASDEG}*(${arg})`;
}

/** The ° factor as R10 wrote it (R64 put `/pasdeg` after it); Giac now always runs in radians, so it is pi/180. */
const OLD_DEGREES = "(pi/180)^angle_radian()";

/** A literal point `[r,t]` (two elements, each a numeric literal): its elements, else undefined. */
function literalPoint(arg: string, q: Quoting): [string, string] | undefined {
  if (!arg.startsWith("[") || closing(arg, 0, q) !== arg.length - 1) return undefined;
  const parts = topLevelArgs(arg.slice(1, -1), q);
  if (parts.length !== 2 || !parts.every((p) => numericLiteral(p, q))) return undefined;
  return [parts[0]!, parts[1]!];
}

/** `text` with every string blanked (same length), so a search outside strings finds the same index. */
function bare(text: string, q: Quoting): string {
  return withoutStrings(text, (x) => " ".repeat(x.length), q);
}

/** R64's form `(pi/180)^angle_radian()/pasdeg` as `pi/180/pasdeg` after a `*`, else `(pi/180)/pasdeg`. */
function newDegrees(text: string, q: Quoting): string {
  const old = `${OLD_DEGREES}/${PASDEG}`;
  const t = bare(text, q);
  let out = "";
  let i = 0;
  for (let k = t.indexOf(old); k >= 0; k = t.indexOf(old, k + 1)) {
    if (k < i || isNameChar(text.charAt(k + old.length))) continue;
    out += text.slice(i, k);
    out += out.endsWith("*") ? DEGREE : `(pi/180)/${PASDEG}`;
    i = k + old.length;
  }
  return out + text.slice(i);
}

/**
 * The emitter's angle rule on Giac text that was written without it (a library file, a stored input from before R64):
 * every command in ANGLE_IN gets its angle times pasdeg, every one in ANGLE_OUT returns `(<call>/pasdeg)`,
 * polar_coordinates and the one-list rectangular_coordinates get POLAR_OUT and RECT_IN, and R10's ° factor
 * `(pi/180)^angle_radian()` becomes DEGREE (bracketed unless it follows a `*`). Text that already holds `pasdeg` gets
 * only R64's ° form brought to DEGREE, so the rewrite never applies twice. Strings are left alone.
 */
export function rewriteAngles(text: string, q: Quoting): string {
  return hasAngleFactor(text, q) ? newDegrees(text, q) : rewrite(glyphNames(text, q), q);
}

/** `text` with each U+F005 spelling outside strings as its canonical name (G304): giacPrint.ts reads ASCII names, so
 *  `sin<U+F005>(x)` is the name sin and a character; the rewrite then meets `asin(x)`. */
function glyphNames(text: string, q: Quoting): string {
  if (!text.includes(GLYPH)) return text;
  let out = "";
  let i = 0;
  for (const { name, at } of names(text, q)) {
    const end = at + name.length;
    if (text.charAt(end) !== GLYPH || !Object.hasOwn(ANGLE_ALIAS, name + GLYPH)) continue;
    out += text.slice(i, at) + angleName(name + GLYPH);
    i = end + 1;
  }
  return out + text.slice(i);
}

/** The character after sin, cos or tan that makes Giac's lexer read asin, acos, atan. */
const GLYPH = "\uF005";

function rewrite(text: string, q: Quoting): string {
  const t = bare(text, q);
  let out = "";
  let i = 0;
  // text up to `to` as it is, but R10's ° factor (outside strings) as DEGREE
  const copy = (to: number): void => {
    for (let k = t.indexOf(OLD_DEGREES, i); k >= 0 && k < to; k = t.indexOf(OLD_DEGREES, i)) {
      out += text.slice(i, k);
      i = k + OLD_DEGREES.length;
      out += out.endsWith("*") && text[i] !== "^" ? DEGREE : `(${DEGREE})`;
    }
    if (to > i) out += text.slice(i, to);
    i = Math.max(i, to);
  };
  for (const { name, at, call, open } of names(text, q)) {
    const inSpec = angleInSpec(name);
    const outs = returnsAngle(name);
    if (at < i || !call || !(inSpec || outs || name === POLAR)) continue;
    const close = closing(text, open, q);
    if (close < 0) continue;
    copy(at);
    const args = topLevelArgs(text.slice(open + 1, close), q).map((a) => rewrite(a, q));
    if (inSpec && args.length > inSpec[0] && (inSpec[1] === 0 || args.length === inSpec[1])) {
      args[inSpec[0]] = withFactor(args[inSpec[0]]!.trim(), false);
    } else if (name === RECT && args.length === 1) {
      const a = args[0]!.trim();
      const p = literalPoint(a, q);
      args[0] = rectArg(a, p && [p[0], withFactor(p[1].trim(), false)]);
    }
    const c = `${text.slice(at, open + 1)}${args.join(",")})`;
    out += outs ? `(${c}/${PASDEG})` : name === POLAR ? `${POLAR_OUT}(${c})` : c;
    i = close + 1;
  }
  copy(text.length);
  return out;
}

const FACTOR: ReadonlySet<string> = new Set([PASDEG]);

/** The text holds the degree factor (as a name, outside strings). */
export function hasAngleFactor(text: string, q: Quoting): boolean {
  return firstNameIn(text, FACTOR, q) !== null;
}

/**
 * What is drawn never shows the factor (R64; S14 R14 §5): Giac text as the user typed it, `sin(x)` for
 * `sin(pasdeg*x)`, `sin(x+1)` for `sin(pasdeg*(x+1))`, `asin(x)` for `asin(x)/pasdeg`, `polar_coordinates(z)` for
 * `POLAR_OUT(polar_coordinates(z))`, `L` for `RECT_IN(L)`. Only for display: a chip, Ans
 * and a stored function keep the factor, so they follow the mode when used again.
 */
export function dropAngleFactor(text: string, q: Quoting): string {
  if (!hasAngleFactor(text, q)) return text;
  let out = "";
  let i = 0;
  const mul = `${PASDEG}*`;
  const div = `/${PASDEG}`;
  const free = (k: number): boolean => !isNameChar(text.charAt(k));
  const bound = (k: number): boolean => !isNameChar(text.charAt(k - 1));
  while (i < text.length) {
    const c = text[i]!;
    if (c === '"') {
      const e = stringEnd(text, i, q);
      const j = e < 0 ? text.length : e + 1;
      out += text.slice(i, j);
      i = j;
      continue;
    }
    const wrapper = WRAPPERS.find((w) => text.startsWith(`${w}(`, i)) ?? "";
    const end = wrapper ? closing(text, i + wrapper.length, q) : -1;
    if (end > 0) {
      out += dropAngleFactor(text.slice(i + wrapper.length + 1, end), q);
      i = end + 1;
      continue;
    }
    if (bound(i) && text.startsWith(mul, i)) {
      const at = i + mul.length;
      const close = text[at] === "(" ? closing(text, at, q) : -1;
      // the whole argument in brackets: the brackets go with the factor (sin(pasdeg*(x+1)) -> sin(x+1))
      if (close > 0 && /[(,]$/.test(out) && /^[),]/.test(text.slice(close + 1))) {
        out += dropAngleFactor(text.slice(at + 1, close), q);
        i = close + 1;
      } else i = at;
      continue;
    }
    if (text.startsWith(div, i) && free(i + div.length)) {
      i += div.length;
      // `(asin(x)/pasdeg)^2`: the grouping bracket was there for the factor only, so it goes too
      // the bracket the `)` closes (`out` is read back over, its strings not looked at, as Giac never prints one here)
      const open = text[i] === ")" ? opening(`${out})`, out.length) : -1;
      const inner = open >= 0 && out.charAt(open) === "(" ? out.slice(open + 1) : "";
      const name = leadingName(inner, false);
      const call = name !== null && inner.startsWith(`${name}(`);
      if (call && !isNameChar(out.charAt(open - 1)) && closing(inner, name.length, q) === inner.length - 1) {
        out = out.slice(0, open) + inner;
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
