// SPDX-License-Identifier: GPL-3.0-or-later
// The unit evaluator, Giac side (P15, docs/04 4.2): runs in the Giac worker beside Home (EngineHost.units), so Cancel
// works as for Home. A UnitJob's text is evaluated exactly with normal(); the result must be one number times one
// product of dimension symbols (each exponent d·∂f/∂d / f is then a number), else the dimensions of its terms are
// named; with an end slot the quotient must be a pure number. The number gets Home's facts (numeric.ts: exact, or the
// agreement check), so markOf() marks it as Home. Synchronous, UI-free. Only erasable TypeScript syntax.
import { FULL_EXACT_MAX, HOME_DEADLINE_MS, resultFromFacts, toExactLiterals, userFunctions, type HomeResult, type HomeSettings } from "../engine/homeEval.ts";
import { callsIn, refusalOf } from "../engine/converge.ts";
import { lostNumber, throughInfinity } from "../engine/novalue.ts";
import { exactFacts, floatFacts, hasFloat, rationalValue, valuePrecision, type ElementFacts, type Giac } from "../engine/numeric.ts";
import { callsOf, isError, isNameChar, mapNames, names, splitList, topLevelArgs } from "../engine/giacPrint.ts";
import { PASDEG } from "../engine/angles.ts";
import { decimalToString, roundSignificant } from "../engine/format.ts";
import { BASES, dimKeyOf, dimensionText, isExponent, parseDimKey, siSlot, siUnit } from "./dims.ts";
import { isUnitError, type Quantity, type Uncertainty, type UncVar, type UnitError, type UnitJob, type UnitNote, type UnitSlot } from "./types.ts";
import { worseFacts } from "./sigmaFacts.ts";
import { shownWithUncertainty, uncertaintyText } from "./uncertainty.ts";

const S = `[${BASES.map((b) => b.symbol).join(",")}]`;
const ANY_DIM = BASES.map((b) => `has(pasy_,${b.symbol})`).join(" or ");
const ONES = `[${BASES.map(() => "1").join(",")}]`;
/** G40: the inverse functions that give an angle (the parser's ANGLE_OUT puts `/pasdeg` after each, R64). */
const INVERSES = ["atan2", "asin", "acos", "atan", "asec", "acsc", "acot"] as const;
/** G310: functions of a pure number, whose first argument the check reads (a zero of a length too: exp(0 m) is refused). */
const PURE_FNS = ["exp", "ln", "log10", "logb", "sinh", "cosh", "tanh", "asinh", "acosh", "atanh", "sec", "csc", "cot", "floor", "ceil", "round", "trunc", "frac", "fPart", "iPart", "Gamma", "erf", "erfc", "surd"] as const;
/** sin, cos and tan take a pure number or an angle (P15). */
const TRIG_FNS = ["sin", "cos", "tan"] as const;
/** G310: the rad dimension alone, as pasuq's exponents. */
const RAD = `[${BASES.map((b) => (b.symbol === "pasdimA" ? "1" : "0")).join(",")}]`;
const ZERO = `[${BASES.map(() => "0").join(",")}]`;
/** G159: the heads of a condition pasujk reads as one comparison; the tests Giac's evaluation decides on a free name;
 *  every head that makes a truth value or picks a case (a side holding one is not read: kind 3). */
const CMP = "['<','<=','>','>=','==','=']";
const EQS = "['==','=','!=']";
const BOOL = "['<','<=','>','>=','==','=','!=','and','or','not','xor','piecewise','when']";

/**
 * Our Giac definitions for the unit view, loaded once per engine on the first units request:
 * - every dimension symbol is positive, so √(4 m²) is 2 m and not 2·|m|;
 * - pasuq(f): [0, exponents, number] for one term; [1, the terms' exponents] for a sum of terms; [2, pasumx(f)] for
 *   anything else (a function of a quantity with units: also a term whose number part still holds a dimension symbol,
 *   as floor(3/2·m) or Giac's irem of two lengths); [3] when sin, cos or tan met a unit (pasubad); [4] for an exact 0; [5] for Giac's infinity or undef (a division by 0);
 * - pasuh(y): whether y holds a dimension symbol;
 * - pasue(f,s): the exponents d·∂f/∂d / f of f, 0 without a diff for a dimension symbol f does not hold (G310: the diff
 *   by an absent symbol cost up to 2 ms on a piecewise); with s = 1 the first exponent that is not a number ends the
 *   reading (the rest 0): f is then not one term. pasuq skips expand() when f has no + at all (it can make no sum),
 *   and tests f == 0 only when f is not symbolic (after normal() a 0 is the integer 0; == on a max() cost 0.6 ms);
 * - pasua(x): the argument of sin, cos and tan, in radians (Giac runs in radians in every mode, G46): an angle (the
 *   rad dimension once, its value in rad) as it is; a pure number in the angle mode, as Home does (G15 default), so
 *   times pasdeg (π/180 in DEG); anything else gives the free symbol pasubad, which pasuq finds;
 * - pasuz(x): the argument of an inverse (G40), a pure number (an angle or a unit gives pasubad); pasuasin and the
 *   others give an angle: the rad dimension once, the value in rad, in either mode (the parser's `/pasdeg` is taken off
 *   by withAngles); pasuatan2(y,x) takes two quantities of one dimension;
 * - pasup(m): 10^m, as a whole number for an integer m, else exp(m·ln 10), which pasuq reads (it cannot read the
 *   algebraic number 10^(3/20)): the ratio of a level given in dB, bel or dBm;
 * - pasul(e): the exact value of a level (a logarithm), the shorter of normal() and simplify() ("-30", not
 *   "-10*ln(1000)/ln(10)"; "20*ln(2)/ln(10)", not simplify's longer form);
 * - pasun(f,g): the number of f in the unit g (the agreement check runs it again at higher precision);
 * - pasuo(a,b) (G41): σ from its first-order part a and second-order part b (both in the result's dimension squared):
 *   [pasuq's answer for σ, the share |b|/(a+b)]; σ² = a + b when that is above 0, else a with the share 2 (first order
 *   fails). pasuq reads σ² and σ is its square root (pasuq on a square root of sums of sin and cos costs 10 ms);
 * - pasusg(e,t,a,s) (G41): 1 when a real point where e (f's derivative in t) is not defined lies within a ± 2s, else 0;
 * - pasujl(e,q) (G143): the step functions in e, as a flat list [kind, argument, …]: kind 0 jumps where the argument is an
 *   integer (floor, ceil, trunc, iPart, frac, fPart; Giac writes ceil, trunc, round and frac with floor and sign), 2 at
 *   an integer + ½ (round), 1 at 0 (sign, Heaviside); G159: each condition of piecewise and when is one comparison read
 *   by pasujk. q = 1 reads e as typed (quote): only the conditions with ==, = or != (Giac's evaluation makes `v==3`
 *   false and `v!=3` true, so the evaluated e has lost them), no step function;
 * - pasujc(x,H): 1 when a node of x has a head in H;
 * - pasumx(x) (G310): 1 when a + node of x has two terms whose dimensions it reads (numbers) and that differ;
 * - pasucg(x,ok) (G310, the check text only): pasubad when pasuq reads x as one term whose exponents are not in ok,
 *   as [2] with pasumx's 1 (a sum of different dimensions inside a function it cannot read), or as a sum with
 *   pasumx's 1 or a term it reads whose exponents are not in ok; x itself when it is 0 or undefined; else the free
 *   symbol pasuw, a pure number the outer function's check reads at once (reading the argument again there cost up to
 *   60 ms). pasucz(x) allows a pure number, pasuca(x) also one rad. The check text calls each function of PURE_FNS as
 *   pasucf(pasucz(first argument), the others), a free function Giac leaves alone (round(pasuw,1) is its error);
 *   pasucsin and the others are pasucf of pasuca, the inverses pasucf of pasucz times rad, pasucatan2(y,x) the rad
 *   dimension when y/x passes pasucz (no atan2 of symbols: Giac's "User interrupt"), else pasubad;
 * - pasujk(c) (G159): a condition c of kind 1 at 0 of lhs − rhs when it is one comparison (<, <=, >, >=, ==, =) of
 *   sides that hold none, else kind 3 with c's names (and, or, not, !=, a nested comparison, a bare name): a jump
 *   wherever c holds the input (a number or true/false has no name, so no jump);
 * - pasujr(c,q,t,a,s) (G143): 1 when the argument q of a step function of kind c takes a jump value for some t in
 *   a ± 2s: q's range there is read from the ends and the real zeros of q′ that solve() gives inside (a singular point
 *   of q′ inside, an answer solve() cannot give as a list, or a value that is not a real number: 1); kind 3: 1 when q
 *   holds t;
 * - pasuu(g,v,x,u,w,Q) (G41): g's σ for the inputs v at the values x with the standard uncertainties u (lists; w the
 *   equations v=x; Q is g as typed, unevaluated, G159): pasuo's
 *   [σ, share] and 2 when an input's x ± 2u reaches a jump of a step function in g (G143), else 1 when it reaches a
 *   singular point of ∂g/∂v (the other inputs at their values, the dimension symbols 1), else 0. Each derivative is
 *   taken once.
 */
export const UNIT_DEFINITIONS: readonly string[] = [
  ...BASES.map((b) => `assume(${b.symbol}>0)`),
  `pasuh(pasy_):=${ANY_DIM}`,
  `pasue(pasf_,pass_):={local pasr_,pask_,pase_; pasr_:=[]; for (pask_:=0;pask_<${BASES.length};pask_++) { pase_:=0; if (has(pasf_,${S}[pask_])) { pase_:=normal(${S}[pask_]*diff(pasf_,${S}[pask_])/pasf_); } ` +
    `pasr_:=append(pasr_,pase_); if (pass_ and lvar(pase_)!=[]) { return concat(pasr_,seq(0,${BASES.length}-size(pasr_))); } } return pasr_; }`,
  `pasuq(pasf_):={local pasa_,pasb_,pasc_,pasj_,past_; if (has(pasf_,pasubad)) return [3]; if (has(pasf_,undef) or has(pasf_,infinity)) return [5]; if (type(pasf_)!=DOM_SYMBOLIC and pasf_==0) return [4]; ` +
    `pasa_:=pasue(pasf_,1); ` +
    `if (lvar(pasa_)==[]) { pasc_:=normal(pasf_/product(zip((pasx_,pasy_)->pasx_^pasy_,${S},pasa_))); if (pasuh(pasc_)) return [2,pasumx(pasf_)]; return [0,pasa_,pasc_]; } ` +
    `if (!pasujc(pasf_,['+'])) return [2,0]; past_:=expand(pasf_); if (sommet(past_)!='+') return [2,pasumx(pasf_)]; past_:=[op(past_)]; ` +
    `pasb_:=map(past_,pasu_->pasue(pasu_,0)); ` +
    `for (pasj_:=0;pasj_<size(past_);pasj_++) { if (lvar(pasb_[pasj_])==[] and pasuh(normal(past_[pasj_]/product(zip((pasx_,pasy_)->pasx_^pasy_,${S},pasb_[pasj_]))))) return [2,pasumx(pasf_)]; } ` +
    `return [1,pasb_]; }`,
  `pasua(pasx_):={local pasw_,pasy_; if (pasx_==0) return 0; pasw_:=normal(pasdimA*diff(pasx_,pasdimA)/pasx_); pasy_:=normal(subst(pasx_,pasdimA,1)); ` +
    `if ((pasw_!=0 and pasw_!=1) or ${ANY_DIM}) return pasubad; if (pasw_==1) return pasy_; return pasy_*pasdeg; }`,
  ...["sin", "cos", "tan"].map((f) => `pasu${f}(pasx_):=${f}(pasua(pasx_))`),
  `pasuz(pasx_):={local pasy_; pasy_:=normal(pasx_); if (pasuh(pasy_)) return pasubad; return pasy_; }`,
  ...INVERSES.filter((f) => f !== "atan2").map((f) => `pasu${f}(pasx_):=${f}(pasuz(pasx_))*pasdimA`),
  `pasuatan2(pasy_,pasx_):={local pasa_,pasb_; pasa_:=normal(pasy_); pasb_:=normal(pasx_); if (pasa_!=0 and pasb_!=0 and pasuh(normal(pasa_/pasb_))) return pasubad; ` +
    `return atan2(subst(pasa_,${S},${ONES}),subst(pasb_,${S},${ONES}))*pasdimA; }`,
  `pasup(pasm_):={if (denom(normal(pasm_))==1) return 10^pasm_; return exp(pasm_*ln(10)); }`,
  `pasul(pase_):={local pasr_,pass_; pasr_:=normal(pase_); pass_:=simplify(pasr_); if (length(string(pass_))<length(string(pasr_))) return pass_; return pasr_; }`,
  `pasun(pasf_,pasg_):={local pasa_,pasb_; pasa_:=pasuq(normal(pasf_)); pasb_:=pasuq(normal(pasg_)); return normal(pasa_[2]/pasb_[2]); }`,
  `pasuo(pasa_,pasb_):={local pasx_,pasy_,past_,pasr_,pasq_; if (pasa_==0 and pasb_==0) return [[4],0]; pasx_:=evalf(subst(pasa_,${S},${ONES})); pasy_:=evalf(subst(pasb_,${S},${ONES})); ` +
    `if (pasx_+pasy_>0) { past_:=pasa_+pasb_; pasr_:=abs(pasy_)/(pasx_+pasy_); } else { past_:=pasa_; pasr_:=2; } pasq_:=pasuq(normal(past_)); ` +
    `if (pasq_[0]==0) return [[0,pasq_[1]/2,sqrt(pasq_[2])],pasr_]; return [pasq_,pasr_]; }`,
  `pasusg(pase_,past_,pasa_,pass_):={local pasL_,pasj_,pasp_; pasL_:=singular(pase_,past_); if (type(pasL_)!=DOM_LIST) return 0; ` +
    `for (pasj_:=0;pasj_<size(pasL_);pasj_++) { pasp_:=evalf(pasL_[pasj_]); if (im(pasp_)==0 and abs(pasp_-pasa_)<=2*pass_) return 1; } return 0; }`,
  `pasujc(pasx_,pasH_):={local paso_,pasj_; if (type(pasx_)!=DOM_SYMBOLIC) { return 0; } if (member(sommet(pasx_),pasH_)) { return 1; } paso_:=[op(pasx_)]; ` +
    `for (pasj_:=0;pasj_<size(paso_);pasj_++) { if (pasujc(paso_[pasj_],pasH_)) { return 1; } } return 0; }`,
  `pasumx(pasx_):={local paso_,pasj_,pasb_,pasv_; if (type(pasx_)!=DOM_SYMBOLIC) { return 0; } paso_:=[op(pasx_)]; if (sommet(pasx_)=='+') { pasb_:=[]; ` +
    `for (pasj_:=0;pasj_<size(paso_);pasj_++) { pasv_:=pasue(paso_[pasj_],1); if (lvar(pasv_)==[]) { pasb_:=append(pasb_,pasv_); } } ` +
    `for (pasj_:=1;pasj_<size(pasb_);pasj_++) { if (pasb_[pasj_]!=pasb_[0]) { return 1; } } } ` +
    `for (pasj_:=0;pasj_<size(paso_);pasj_++) { if (pasumx(paso_[pasj_])) { return 1; } } return 0; }`,
  `pasucg(pasx_,pasok_):={local pasn_,pasq_,pasj_; pasn_:=normal(pasx_); pasq_:=pasuq(pasn_); if (pasq_[0]==4 or pasq_[0]==5) return pasx_; ` +
    `if (pasq_[0]==2) { if (pasq_[1]==1) return pasubad; return pasuw; } if (pasq_[0]==0) { if (member(pasq_[1],pasok_)) return pasuw; return pasubad; } ` +
    `if (pasq_[0]!=1 or pasumx(pasn_)) return pasubad; for (pasj_:=0;pasj_<size(pasq_[1]);pasj_++) { if (lvar(pasq_[1][pasj_])==[] and !member(pasq_[1][pasj_],pasok_)) return pasubad; } return pasuw; }`,
  `pasucz(pasx_):=pasucg(pasx_,[${ZERO}])`,
  `pasuca(pasx_):=pasucg(pasx_,[${ZERO},${RAD}])`,
  ...TRIG_FNS.map((f) => `pasuc${f}(pasx_):=pasucf(pasuca(pasx_))`),
  ...INVERSES.filter((f) => f !== "atan2").map((f) => `pasuc${f}(pasx_):=pasucf(pasucz(pasx_))*pasdimA`),
  `pasucatan2(pasy_,pasx_):={ if (has(pasucz(normal(pasy_/pasx_)),pasubad)) return pasubad; return pasdimA; }`,
  `pasujk(pasc_):={local paso_; if (type(pasc_)!=DOM_SYMBOLIC) { return [3,lname(pasc_)]; } paso_:=[op(pasc_)]; ` +
    `if (member(sommet(pasc_),${CMP}) and size(paso_)==2 and !pasujc(paso_[0],${BOOL}) and !pasujc(paso_[1],${BOOL})) { return [1,paso_[0]-paso_[1]]; } ` +
    `return [3,lname(pasc_)]; }`,
  `pasujl(pase_,pasq_):={local pash_,paso_,pasr_,pasj_; if (type(pase_)!=DOM_SYMBOLIC) { return []; } pash_:=sommet(pase_); paso_:=[op(pase_)]; pasr_:=[]; ` +
    `if (pasq_==0 and member(pash_,['floor','ceil','trunc','iPart','frac','fPart'])) { pasr_:=[0,paso_[0]]; } if (pasq_==0 and pash_=='round') { pasr_:=[2,paso_[0]]; } ` +
    `if (pasq_==0 and member(pash_,['sign','Heaviside'])) { pasr_:=[1,paso_[0]]; } ` +
    `if (pash_=='piecewise' or pash_=='when') { for (pasj_:=0;pasj_+1<size(paso_);pasj_:=pasj_+2) { if (pasq_==0 or pasujc(paso_[pasj_],${EQS})) { pasr_:=concat(pasr_,pasujk(paso_[pasj_])); } } } ` +
    `for (pasj_:=0;pasj_<size(paso_);pasj_++) { pasr_:=concat(pasr_,pasujl(paso_[pasj_],pasq_)); } return pasr_; }`,
  `pasujr(pasc_,pasq_,past_,pasa_,pass_):={local pasd_,pasP_,pasR_,pasj_,pasp_,pasV_,paslo_,pashi_; if (!has(pasq_,past_)) { return 0; } if (pasc_==3) { return 1; } pasP_:=[pasa_-2*pass_,pasa_+2*pass_]; pasd_:=diff(pasq_,past_); ` +
    `if (has(pasd_,past_)) { pasR_:=singular(pasd_,past_); if (type(pasR_)==DOM_LIST) { for (pasj_:=0;pasj_<size(pasR_);pasj_++) { pasp_:=evalf(pasR_[pasj_]); if (im(pasp_)==0 and abs(pasp_-pasa_)<=2*pass_) { return 1; } } } ` +
    `pasR_:=solve(pasd_=0,past_); if (type(pasR_)!=DOM_LIST) { return 1; } ` +
    `for (pasj_:=0;pasj_<size(pasR_);pasj_++) { if (!has(pasR_[pasj_],past_)) { pasp_:=evalf(pasR_[pasj_]); if (im(pasp_)==0 and abs(pasp_-pasa_)<=2*pass_) { pasP_:=append(pasP_,pasR_[pasj_]); } } } } ` +
    `pasV_:=map(pasP_,pasp_->normal(subst(pasq_,past_,pasp_))); for (pasj_:=0;pasj_<size(pasV_);pasj_++) { if (has(pasV_[pasj_],undef) or has(pasV_[pasj_],infinity) or im(evalf(pasV_[pasj_]))!=0) { return 1; } } ` +
    `paslo_:=min(pasV_); pashi_:=max(pasV_); if (pasc_==1) { return paslo_<=0 and pashi_>=0; } if (pasc_==2) { paslo_:=paslo_-1/2; pashi_:=pashi_-1/2; } return ceil(paslo_)<=pashi_; }`,
  `pasuu(pasg_,pasv_,pasx_,pasu_,pasw_,pasQ_):={local pasn_,pask_,pasm_,pash_,pasf_,pasd_,pass1_,pass2_,pasz_,pasL_,pasi_; pasn_:=size(pasv_); pass1_:=0; pass2_:=0; pasz_:=0; ` +
    `pasL_:=concat(pasujl(subst(pasg_,${S},${ONES}),0),subst(pasujl(pasQ_,1),${S},${ONES})); ` +
    `for (pask_:=0;pask_<pasn_;pask_++) { pash_:=diff(pasg_,pasv_[pask_]); pasd_:=subst(pash_,pasw_); pass1_:=pass1_+pasd_^2*pasu_[pask_]^2; ` +
    `for (pasm_:=0;pasm_<pasn_;pasm_++) { pasf_:=diff(pash_,pasv_[pasm_]); pass2_:=pass2_+(1/2*subst(pasf_,pasw_)^2+pasd_*subst(diff(pasf_,pasv_[pasm_]),pasw_))*pasu_[pask_]^2*pasu_[pasm_]^2; } ` +
    `for (pasi_:=0;pasi_<size(pasL_) and pasz_==0;pasi_:=pasi_+2) { if (pasujr(pasL_[pasi_],subst(pasL_[pasi_+1],suppress(pasw_,pask_)),pasv_[pask_],pasx_[pask_],pasu_[pask_])) { pasz_:=2; } } ` +
    `if (pasz_==0 and has(pash_,pasv_[pask_]) and pasusg(subst(subst(pash_,suppress(pasw_,pask_)),${S},${ONES}),pasv_[pask_],pasx_[pask_],pasu_[pask_])==1) pasz_:=1; } ` +
    `return [op(pasuo(normal(pass1_),normal(pass2_))),pasz_]; }`,
];

/** G319: our unit functions (UNIT_DEFINITIONS, pasup of a level too) start with it: they change nothing the user stored,
 *  so they are not the user's functions that stop Home's walk for an infinity (a user name may not start with pas). */
const UNIT_PREFIX = "pasu";

/** G41: the second-order part above this share of σ² gives ⚠ "first order does not hold here". */
const ORDER2_SHARE = 0.1;

/** sin, cos and tan of the formula take an angle (P15), asin, acos, atan, atan2 and the others give one (G40): our
 *  versions. pasua reads the angle in the mode's unit itself and the inverses give rad, so the parser's degree factor
 *  (R64, `sin(pasdeg*u)`, `(asin(u)/pasdeg)`) is taken off here. */
export function withAngles(expr: string): string {
  let out = "";
  let i = 0;
  for (const c of callsOf(expr, ["sin", "cos", "tan"], "typed")) {
    out += `${expr.slice(i, c.at)}pasu${c.name}(`;
    i = c.open + 1;
    // the parser's `pasdeg*` right inside the bracket
    const rest = expr.slice(i).trimStart();
    const after = rest.slice(PASDEG.length).trimStart();
    i = expr.length - rest.length;
    if (rest.startsWith(PASDEG) && !isNameChar(rest.charAt(PASDEG.length)) && after.startsWith("*")) i = expr.length - after.length + 1;
  }
  return inverses(out + expr.slice(i));
}

/** Each inverse call as pasu<name>(…), its arguments done the same way, without the `/pasdeg` right after it. */
function inverses(t: string): string {
  let out = "";
  let i = 0;
  for (const c of callsOf(t, INVERSES, "typed")) {
    if (c.at < i) continue;
    // Unbalanced: the rest stays as it is, for Giac's syntax error.
    if (c.close < 0) break;
    out += `${t.slice(i, c.at)}pasu${c.name}(${inverses(t.slice(c.open + 1, c.close))})`;
    i = c.close + 1 + degreeAfter(t.slice(c.close + 1));
  }
  return out + t.slice(i);
}

/** The length of a `/pasdeg` (not raised to a power) that `t` starts with, spaces included; 0 when there is none. */
function degreeAfter(t: string): number {
  const slash = t.trimStart();
  if (!slash.startsWith("/")) return 0;
  const name = slash.slice(1).trimStart();
  const after = name.slice(PASDEG.length);
  if (!name.startsWith(PASDEG) || isNameChar(after.charAt(0)) || after.trimStart().startsWith("^")) return 0;
  return t.length - after.length;
}

const CHECKED_CALLS: ReadonlySet<string> = new Set([...TRIG_FNS, ...INVERSES].map((f) => `pasu${f}`));

/** G310: the dimension check's text (after withAngles) with every argument the check reads put through its test: sin,
 *  cos, tan, the inverses and atan2 as pasuc<name>, each function of PURE_FNS as pasucf(pasucz(first argument), the
 *  others): a pure number when its argument is one. The value's text keeps Giac's own calls. */
export function checkArgs(t: string): string {
  return pureArgs(mapNames(t, (n) => (n.call && CHECKED_CALLS.has(n.name) ? `pasuc${n.name.slice(4)}` : null), "typed"));
}

/** G310: whether the check's text (after withAngles) has a dimension symbol inside a call whose argument the check
 *  reads, a slot or a constant there: the check then runs with the value, whatever the value is (exp(0 m)). */
export function dimInCall(t: string): boolean {
  return callsOf(t, [...PURE_FNS, ...CHECKED_CALLS], "typed").some((c) => c.close >= 0 && [...names(t.slice(c.open + 1, c.close), "typed")].some((n) => !n.call && n.name.startsWith("pasdim")));
}

function pureArgs(t: string): string {
  let out = "";
  let i = 0;
  for (const c of callsOf(t, PURE_FNS, "typed")) {
    if (c.at < i) continue;
    // Unbalanced: the rest stays as it is, for Giac's syntax error.
    if (c.close < 0) break;
    const [first, ...rest] = topLevelArgs(t.slice(c.open + 1, c.close), "typed");
    out += `${t.slice(i, c.at)}pasucf(pasucz(${pureArgs(first ?? "")})${rest.map((a) => `,${pureArgs(a)}`).join("")})`;
    i = c.close + 1;
  }
  return out + t.slice(i);
}

type Checked = { kind: "term"; exps: string[]; num: string } | { kind: "sum"; terms: string[][] } | { kind: "function"; mixed?: true } | { kind: "trig" } | { kind: "zero" } | { kind: "undefined" };

/** pasuq's printed answer. */
function checked(text: string): Checked | null {
  const parts = splitList(text);
  if (!parts || !parts.length) return null;
  const exps = (t: string): string[] | null => {
    const e = splitList(t);
    return e && e.length === BASES.length ? e : null;
  };
  switch (parts[0]) {
    case "0": {
      const e = parts[1] !== undefined ? exps(parts[1]) : null;
      return e && e.every(isExponent) && parts[2] !== undefined ? { kind: "term", exps: e, num: parts[2] } : null;
    }
    case "1": {
      const terms = splitList(parts[1] ?? "")?.map(exps);
      return terms && terms.every((t) => t !== null) ? { kind: "sum", terms: terms as string[][] } : null;
    }
    case "2":
      return parts[1]?.trim() === "1" ? { kind: "function", mixed: true } : { kind: "function" };
    case "3":
      return { kind: "trig" };
    case "4":
      return { kind: "zero" };
    case "5":
      return { kind: "undefined" };
    default:
      return null;
  }
}

/** Why a checked answer is not one term, or null when it is. */
function refusal(c: Checked, job: UnitJob): UnitError | null {
  if (c.kind === "function" || c.kind === "trig") return { error: "function" };
  // Giac's 1/0 is infinity, 0/0 undef: not a number, and not the user's free name.
  if (c.kind === "undefined") return { error: "divzero" };
  if (c.kind === "sum") {
    if (c.terms.some((t) => !t.every(isExponent))) return { error: "function" };
    const dims = [...new Set(c.terms.map(dimKeyOf))].sort(byDimension);
    if (dims.length === 2) {
      const cy = cycleRefusal(job, dims[0]!, dims[1]!);
      if (cy) return cy;
    }
    return dims.length > 1 ? { error: "dimension", dims } : { error: "function" };
  }
  return null;
}

/** G32: rpm or rev on one side and the angle on the other (the dimensions differ by rad alone). */
function cycleRefusal(job: UnitJob, a: string, b: string): UnitError | null {
  if (!job.cycle) return null;
  const strip = (k: string): string => [...parseDimKey(k)].filter(([n]) => n !== "rad").map(([n, e]) => n + e).sort().join("");
  const angle = (k: string): boolean => parseDimKey(k).has("rad");
  return angle(a) !== angle(b) && strip(a) === strip(b) ? { error: "cycle", unit: job.cycle } : null;
}

/** G161: W, VA and var have one dimension, so no dimension check sees them meet: the job names its kinds of power
 *  (build.ts), and two of them are refused before Giac runs, as G32 refuses rpm against an angle. */
function powerRefusal(job: UnitJob): UnitError | null {
  return job.powers && job.powers.length > 1 ? { error: "power" } : null;
}

/** G40: dimension keys that differ by exactly one rad (either way), all other bases equal. */
function oneRadApart(a: string, b: string): boolean {
  const ea = parseDimKey(a);
  const eb = parseDimKey(b);
  const rad = (e: Map<string, string>): number | null => {
    const r = e.get("rad") ?? "0";
    return /^-?\d+$/.test(r) ? Number(r) : null;
  };
  const [ra, rb] = [rad(ea), rad(eb)];
  if (ra === null || rb === null || Math.abs(ra - rb) !== 1) return false;
  const rest = (e: Map<string, string>): string => [...e].filter(([n]) => n !== "rad").map(([n, x]) => n + x).sort().join("");
  return rest(ea) === rest(eb);
}

/** Dimension keys by the first base each is written with (M, L, T, …), then by text: a stable order for messages
 *  ("L vs T"; Giac's expand() does not keep the order the terms were typed in). */
function byDimension(a: string, b: string): number {
  const first = (k: string): number => {
    const e = parseDimKey(k);
    const i = BASES.findIndex((d) => e.has(d.key));
    return i < 0 ? BASES.length : i;
  };
  return first(a) - first(b) || a.localeCompare(b);
}

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

/** num/den as exact rational text when both are printed rationals ("25/18"), else null: no Giac call needed. */
function rationalQuotient(num: string, den: string): string | null {
  const a = rationalValue(num);
  const b = rationalValue(den);
  if (!a || !b || b.p === 0n) return null;
  let p = a.p * b.q;
  let q = a.q * b.p;
  if (q < 0n) [p, q] = [-p, -q];
  const g = gcd(p, q) || 1n;
  return q / g === 1n ? `${p / g}` : `${p / g}/${q / g}`;
}

/** Home's facts for one number, as a HomeResult (display at the digits setting, the mark's facts, the exact text). */
function result(facts: ElementFacts[], exact: string | undefined, s: HomeSettings, inexact: boolean, approximate: boolean): HomeResult {
  // A constant with an uncertainty went in: never "=" (decisions M4-4), as in Home.
  const fs = inexact ? facts.map((f) => ({ ...f, exact: false })) : facts;
  const r = resultFromFacts(fs, { kind: "scalar" }, Math.trunc(s.digits), "exact", approximate);
  return { ...r, ...(exact !== undefined && exact.length <= FULL_EXACT_MAX ? { exact, full: exact } : {}) };
}

/** The number stored in Giac as `name`, with Home's facts (exact, or the agreement check); null when it is not a
 *  number. `rerun` computes it again, for a float's check. */
function numberOf(giac: Giac, name: string, rerun: string, s: HomeSettings, inexact: boolean): HomeResult | null {
  // G103: the value through bridge-3 (its kind and num/den for exactFacts); a print cut at 2 kB is read whole
  const v = giac.value(name, []);
  const text = v.cut ? giac.eval(name) : v.text;
  if (isError(text)) return null;
  const digits = Math.trunc(s.digits);
  const scalar = { kind: "scalar" } as const;
  const float = hasFloat(text);
  const facts = float ? floatFacts(giac, name, rerun, scalar, digits, digits) : exactFacts(giac, name, scalar, digits, s.maxExactDigits, text, v);
  return facts && result(facts, float ? undefined : text, s, inexact, float);
}

/**
 * G18, G41: the uncertainty of the stored result, over the uncertain inputs (taken as independent), exactly with Giac's
 * diff at the inputs' values (GUM 5.1.2 with its note): σ² = Σᵢ (∂f/∂xᵢ)² uᵢ² + Σᵢ Σⱼ [½ (∂²f/∂xᵢ∂xⱼ)² +
 * ∂f/∂xᵢ · ∂³f/∂xᵢ∂xⱼ²] uᵢ² uⱼ². f is the result in the shown unit: the formula divided by the end slot's factor, or
 * for a level end slot the level of the ratio itself, so its curvature counts too. σ carries ⚠ (`why`) when an input's
 * x ± 2uᵢ reaches a jump of a step function in f (G143: floor, round, sign, …, whose derivative is 0 off the jumps; G159:
 * a condition of piecewise or when), else
 * a real point where ∂f/∂xᵢ is not defined (Giac's singular(), the other inputs at their values), else when the
 * second-order part is more than 10 % of σ². `valueExpr` is Giac text of the value as shown, `shownValue` its
 * display (kept for a σ of 0). Never "=": the facts of σ carry the approximation.
 */
function uncertainty(giac: Giac, job: UnitJob, src: Checked, dst: { num: string }, valueExpr: string, shownValue: string, dimension: string | null, s: HomeSettings): Uncertainty | UnitError {
  const u = job.unc!;
  const lit = toExactLiterals;
  const F = withAngles(lit(u.expr));
  const ones = BASES.map((b) => `${b.symbol}=1`);
  // A level is of a pure number: the ratio, the dimension symbols set to 1 (both sides have the same dimension).
  const level = job.endLog !== undefined && src.kind === "term";
  const G = level ? job.endLog!.replace(/pasux/g, `(subst(${F},[${ones.join(",")}])/(${dst.num}))`) : `(${F})/(${dst.num})`;
  // R271: a result chip as σ must be a real number, not below 0 (σ² would hide its sign; a typed σ is a plain number).
  // Decided exactly in Giac, as the sign checks below: a float would read -1/10^500 as -0, which passes >= 0.
  const realNonNegative = (x: string): boolean => giac.eval(`when(im(${x})==0 and sign(re(${x}))>=0,1,0)`).trim() === "1";
  if (u.vars.some((v) => v.chip && !realNonNegative(`(${lit(v.sigma)})`))) return { error: "sigma" };
  const list = (f: (v: UncVar) => string): string => `[${u.vars.map(f).join(",")}]`;
  const out = giac.eval(`pasuW:=pasuu(${G},${list((v) => v.name)},${list((v) => `(${lit(v.value)})`)},${list((v) => `(${lit(v.sigma)})`)},${list((v) => `${v.name}=(${lit(v.value)})`)},quote(${G}))`);
  if (isError(out)) return { error: "engine", detail: out };
  const parts = splitList(out);
  const q = parts?.[0] !== undefined ? checked(parts[0]) : null;
  // σ through a power of a unit holds ln(m): a ± in the exponent of a quantity (m^(2 ± 0.1)).
  if (q?.kind === "function") return { error: "uncpower" };
  if (!q || (q.kind !== "term" && q.kind !== "zero")) return { error: "engine", detail: `no uncertainty: ${out}` };
  if (q.kind === "term" && !level && dimension !== null && dimKeyOf(q.exps) !== dimension) return { error: "engine", detail: `uncertainty of ${dimKeyOf(q.exps)} on ${dimension}` };
  const set = giac.eval(`pasus:=normal(${q.kind === "term" ? q.num : "0"})`);
  if (isError(set)) return { error: "engine", detail: set };
  const value = numberOf(giac, "pasus", "pasus", s, true);
  const plain = giac.eval(`evalf(${valueExpr},30)`);
  const sig = giac.eval("evalf(pasus,30)");
  const text = isError(sig) ? null : uncertaintyText(sig);
  const shown = isError(plain) || isError(sig) ? null : shownWithUncertainty(plain, sig, shownValue);
  if (!value || text === null || shown === null) return { error: "engine", detail: `uncertainty not a number: ${sig}` };
  const share = Number(parts?.[1]);
  const big = (Number.isFinite(share) ? share : Number(giac.eval("evalf(pasuW[1])"))) > ORDER2_SHARE;
  const flag = parts?.[2]?.trim();
  const why = flag === "2" ? "jump" : flag === "1" ? "singular" : big ? "order2" : null;
  const c = u.chip;
  if (!c) return { value, text, shown, ...(why ? { why } : {}) };
  // R271: σ keeps the chips' facts: no more confirmed digits than theirs, and their ⚠ reason; R271f1: its `full` (the
  // chip's σ, units/chip.ts) then has its confirmed digits only, a decimal Giac reads (none confirmed: no chip text)
  const facts = worseFacts(value.facts, c);
  const n = facts.reliableDigits;
  const v = value.value?.re;
  const full = n === null || !v || v.digits.length <= n ? value.full : n < 1 ? "" : decimalToString({ ...roundSignificant(v, n), sticky: false });
  return { value: { ...value, facts, full }, text, shown, ...(why ? { why } : {}), chip: { reliableDigits: n, ...(facts.warn ? { warn: facts.warn } : {}) } };
}

const PREFIXES: Readonly<Record<number, string>> = { [-15]: "f", [-12]: "p", [-9]: "n", [-6]: "µ", [-3]: "m", 0: "", 3: "k", 6: "M", 9: "G", 12: "T", 15: "P" };

/** The SI unit of `dimension` with the SI prefix that puts the number `num` (in SI) from 1 to 999 (2.7), and its factor
 *  to SI; mass stops at kg. One evalf. */
function siPrefixed(giac: Giac, dimension: string, num: string): { text: string; factor: string } {
  const si = siUnit(dimension);
  const base = { text: si.text, factor: "1" };
  if (!si.prefixable) return base;
  const v = Math.abs(Number(giac.eval(`evalf(${num})`))) * 10 ** -si.prefixable.exp10;
  if (!(v > 0) || !Number.isFinite(v)) return base;
  const e = Number(v.toExponential(11).split("e")[1]);
  // Mass stops at kg (a tonne is 1000 kg, not 1 Mg).
  const k = Math.min(Math.floor(e / 3) * 3, si.prefixable.symbol === "g" ? 3 : 15);
  const pfx = PREFIXES[k];
  if (pfx === undefined) return base;
  const exp10 = k + si.prefixable.exp10;
  return { text: pfx + si.prefixable.symbol, factor: exp10 >= 0 ? `${10n ** BigInt(exp10)}` : `1/${10n ** BigInt(-exp10)}` };
}

/** The unit a result without an end slot is shown in (G25): the first typed unit of the job that has the result's
 *  dimension; an angle in the mode's unit (G40: ° in DEG, rad in RAD); else `si`, the SI unit with the SI prefix that
 *  puts the number from 1 to 999. `factor` is its factor to SI, `slot` its tokens (R60). G40: when no typed unit has the
 *  dimension, the first typed unit with one rad less is taken with the rad dropped (`asin(1/2)·1 rad` is π/6 rad, not
 *  rad²), unless a cycle unit is in. */
function chosenUnit(job: UnitJob, dimension: string, si: { text: string; factor: string }, angle: HomeSettings["angle"]): { text: string; factor: string; slot: UnitSlot; radDropped?: true } {
  const typed = job.shows?.find((u) => u.dim === dimension);
  if (typed) return { text: typed.text, factor: typed.factor, slot: typed.slot };
  // Only a result with one rad more than the unit: a pure number (sin 30°) never takes the typed °.
  const rad = (k: string): string => parseDimKey(k).get("rad") ?? "0";
  const near = job.cycles ? undefined : job.shows?.find((u) => oneRadApart(dimension, u.dim) && Number(rad(dimension)) === Number(rad(u.dim)) + 1);
  if (near) return { text: near.text, factor: near.factor, slot: near.slot, radDropped: true };
  if (dimension === "rad1" && angle === "deg") return { text: "°", factor: "pi/180", slot: { tokens: [{ unit: "deg" }] } };
  return { ...si, slot: siSlot(dimension, si.text) };
}

/** R121: `q` with the user's stored names its formula read (`read`: the host's, from Giac's tree, in the order they
 *  appear; asked only for a value). Each is a pure number here: Home keeps a value without its unit. A free name was
 *  refused before (symbolic). */
export function withNames(q: Quantity | UnitError, read: () => readonly string[]): Quantity | UnitError {
  if (isUnitError(q)) return q;
  const names = read();
  return names.length ? { ...q, names: [...names] } : q;
}

/** Evaluates a job in the engine's current (Home) mode. One Giac call when the value is rational; the agreement
 *  check's calls otherwise. */
export function unitEval(giac: Giac, job: UnitJob, s: HomeSettings): Quantity | UnitError {
  const t0 = performance.now();
  const power = powerRefusal(job);
  if (power) return power;
  const f = withAngles(toExactLiterals(job.expr));
  let g = job.end ? withAngles(toExactLiterals(job.end)) : "1";
  // G35: the dimension check (job.check, every number beside a slot a symbol of its own) goes in the same call.
  const checkForm = job.check !== undefined ? withAngles(toExactLiterals(job.check)) : null;
  const checkText = checkForm !== null ? `pasuq(normal(${checkArgs(checkForm)}))` : null;
  // G310: a slot inside a function whose argument the check reads is checked whatever the value is (exp(0 m)).
  const withValue = job.checkSum === true || (checkForm !== null && dimInCall(checkForm));
  const chk = checkText !== null && withValue ? `,${checkText}` : "";
  const out = giac.eval(`pasuR:=[pasuq(normal(${f})),pasuq(normal(${g}))${chk}]`);
  // G319: Home's refusals of the formula's number part, in Home's order (homeEval.ts: refusalOf, then lostNumber where no
  // number came, below, then throughInfinity), within Home's deadline; Giac's step budget is Home's (host.ts useHomeMode).
  const exactMs = performance.now() - t0;
  const n = toExactLiterals(job.number);
  const late = (): boolean => performance.now() - t0 > HOME_DEADLINE_MS;
  let ownFn: ((name: string) => boolean) | null = null;
  const userFn = (name: string): boolean => (ownFn ??= userFunctions(giac, (m) => m.startsWith(UNIT_PREFIX)))(name);
  let unverified = false;
  const converges = (numOut: string): UnitError | null => {
    const r = refusalOf(giac, n, numOut, Math.trunc(s.digits), true);
    if (r === "unchecked") unverified = true;
    return r && r !== "unchecked" ? { error: "refused", code: r } : null;
  };
  if (isError(out)) return converges(out) ?? { error: "engine", detail: out };
  const both = splitList(out);
  const src = both?.[0] !== undefined ? checked(both[0]) : null;
  let dst = both?.[1] !== undefined ? checked(both[1]) : null;
  if (!src || !dst) return { error: "engine", detail: out };
  // The number part's answer: the term's number (the dimension symbols are positive, so it is the number part's value),
  // 0, or for Giac's infinity or undef its own answer (asked only when it holds an integral, a series or a limit).
  const numOut = src.kind === "term" ? src.num : src.kind === "zero" ? "0" : src.kind === "undefined" && callsIn(n).length ? giac.eval(n) : null;
  if (numOut !== null) {
    const home = converges(numOut) ?? (src.kind !== "undefined" && throughInfinity(giac, n, numOut, late, exactMs, userFn) ? ({ error: "refused", code: "divisionByZero" } as const) : null);
    if (home) return home;
  }
  // The check refuses terms of different dimensions, whatever their numbers; a function it cannot read (max, with
  // symbols) leaves the decision to the value's own check, unless a sum in it has terms of different dimensions.
  // Otherwise only a value 0 needs the check, for its dimension: a call of its own then.
  const later = checkText !== null && !withValue && src.kind === "zero" ? giac.eval(checkText) : null;
  const third = later !== null ? (isError(later) ? undefined : later) : both?.[2];
  const per = third !== undefined ? checked(third) : null;
  // G310: an argument the check reads with the wrong dimension ([3]), or a sum whose terms differ inside a function
  // the check cannot read ([2] with pasumx's 1), is refused whatever the value is: exp(0 m) as exp(1 m).
  if (per?.kind === "trig" || (per?.kind === "function" && per.mixed)) return { error: "function" };
  const mixed = per?.kind === "sum" ? refusal(per, job) : null;
  if (mixed && mixed.error !== "function") return mixed;
  const bad = refusal(src, job) ?? refusal(dst, job);
  if (bad) return bad;
  if (dst.kind !== "term") return { error: "engine", detail: "an end slot of 0" };
  // A result 0 keeps the dimension of its terms (the check's), so `0 m → s` is refused and `0 m` shows m; G159: with no
  // slot and no constant (no check) nothing holds a dimension, so a 0 is a pure number, as any other value there.
  const dimension = src.kind === "term" ? dimKeyOf(src.exps) : per?.kind === "term" ? dimKeyOf(per.exps) : job.check === undefined ? "" : null;
  let note: UnitNote | undefined;
  if (dimension !== null && job.end && dimension !== dimKeyOf(dst.exps)) {
    // G40: one rad more or less than the end slot is dropped (rad = 1: ω·r → m/s, τ·θ → J), unless a cycle unit is in.
    if (!job.cycles && oneRadApart(dimension, dimKeyOf(dst.exps))) note = { note: "radDropped" };
    else return cycleRefusal(job, dimension, dimKeyOf(dst.exps)) ?? { error: "dimension", dims: [dimension, dimKeyOf(dst.exps)], end: true };
  }
  // G40: rpm or rev times a dimension other than time counts turns (a feed per turn); a speed at a radius needs 2π.
  if (job.cycle && dimension !== null && [...parseDimKey(dimension).keys()].some((b) => b !== "s")) note = { note: "cycle", unit: job.cycle };
  const num = src.kind === "term" ? src.num : "0";
  const si = src.kind === "term" && num.length <= FULL_EXACT_MAX ? { si: num } : {};
  let unit = job.endUnit ?? "";
  // R60: the SI unit with its prefix for this value, always (the alternatives' second chip); the unit shown as tokens.
  const sp = dimension === null || dimension === "" ? null : siPrefixed(giac, dimension, num);
  let shownSlot: UnitSlot | undefined = job.endSlot;
  // No end slot: the typed unit that fits, else the SI unit with a prefix (an absolute temperature stays in K).
  if (!job.end && dimension !== null && !job.absTemp) {
    const c = chosenUnit(job, dimension, sp ?? { text: "", factor: "1" }, s.angle);
    unit = c.text;
    if (c.slot.tokens.length) shownSlot = c.slot;
    if (c.radDropped) note = { note: "radDropped" };
    if (c.factor !== "1") {
      g = c.factor;
      const out2 = giac.eval(`pasuR:=[pasuR[0],pasuq(normal(${g}))]`);
      const re = isError(out2) ? null : splitList(out2);
      const d2 = re?.[1] !== undefined ? checked(re[1]) : null;
      if (!d2 || d2.kind !== "term") return { error: "engine", detail: out2 };
      dst = d2;
    }
  } else if (!job.end && dimension !== null) {
    unit = siUnit(dimension).text;
    shownSlot = siSlot(dimension);
  }
  // The end slot as shown: the one given, or the unit chosen for the result (σ is scaled by this one, like the value).
  const shownDst = dst;
  const done = (value: HomeResult, valueExpr: string): Quantity | UnitError => {
    const unc = job.unc ? uncertainty(giac, job, src, shownDst, valueExpr, value.display, dimension, s) : null;
    if (unc && isUnitError(unc)) return unc;
    // R271f1: σ's mark decided once: a σ from a result chip limits the value's facts (its confirmed digits, its ⚠), so
    // the view, the Home row, Copy and the chip read one fact (units/sigmaFacts.ts)
    if (unc?.chip) value = { ...value, facts: worseFacts(value.facts, unc.chip) };
    // G319: a convergence check that could not finish: the value stands with ⚠, as in Home (nothing confirmed it exists).
    if (unverified) value = { ...value, facts: { ...value.facts, warn: value.facts.warn ?? "unchecked", why: { ...value.facts.why, existsUnchecked: true } }, approximate: true };
    return { value, dimension, dimensionText: dimension === null ? null : dimensionText(dimension), unit, ...(shownSlot ? { shownSlot } : {}), siPrefixed: sp?.text ?? "", ...si, ...(unc ? { unc } : {}), ...(note ? { note } : {}), ms: performance.now() - t0 };
  };
  if ((job.absTemp || job.endOffset !== undefined) && src.kind === "term" && giac.eval(`sign(${num})`).trim() === "-1") return { error: "belowzero" };
  // An end slot in °C or °F: the SI number less the offset (K = a·x + b, the end slot holds a); in dB, dBm or Np: the
  // level of the ratio to its reference. Both give the number of Giac's text, not a rational quotient.
  const shifted = job.endOffset !== undefined ? giac.eval(`normal((${num})-(${job.endOffset}))`) : num;
  if (isError(shifted)) return { error: "engine", detail: shifted };
  const exact = job.endLog === undefined ? rationalQuotient(shifted, dst.num) : null;
  if (exact !== null) {
    const r = rationalValue(exact, valuePrecision(Math.trunc(s.digits)))!;
    const big = [r.p, r.q].some((x) => (x < 0n ? -x : x).toString().length > s.maxExactDigits);
    return done(result([{ value: { re: r.v, im: rationalValue("0")!.v }, exact: true, reliableDigits: null, big }], exact, s, job.inexact, false), exact);
  }
  if (job.endLog !== undefined) {
    // The level of a ratio at or below 0 is not a real number: refuse it before taking the log.
    if (src.kind === "zero") return { error: "level" };
    if (src.kind === "term" && ["-1", "0"].includes(giac.eval(`sign(normal(pasuR[0][2]/pasuR[1][2]))`).trim())) return { error: "level" };
  }
  const ratio = job.endOffset !== undefined ? `(${shifted})/pasuR[1][2]` : `${src.kind === "term" ? "pasuR[0][2]" : "0"}/pasuR[1][2]`;
  const rerun = job.endOffset !== undefined ? `((pasuq(normal(${f}))[2]-(${job.endOffset}))/pasuq(normal(${g}))[2])` : `pasun(${f},${g})`;
  const level = (r: string): string => job.endLog!.replace(/pasux/g, `(${r})`);
  giac.eval(job.endLog !== undefined ? `pasuv:=pasul(${level(ratio)})` : `pasuv:=normal(${ratio})`);
  const value = numberOf(giac, "pasuv", job.endLog !== undefined ? `pasul(${level(rerun)})` : rerun, s, job.inexact);
  if (value) return done(value, "pasuv");
  // G319: Giac's text with no free name where a number was asked for (Home's lostNumber): Home's reason.
  const lost = lostNumber(giac, "pasuv", n, giac.eval("pasuv"), late, exactMs, userFn);
  if (lost) return { error: "refused", code: lost };
  // Not a number: a free name in it is the user's to fix; anything else (a timeout in the check) is the engine's.
  const names = giac.eval("lname(pasuv)");
  return /^\[\s*\]$/.test(names) || isError(names) ? { error: "engine", detail: `no number: ${num}` } : { error: "symbolic", detail: num };
}
