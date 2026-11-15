// SPDX-License-Identifier: GPL-3.0-or-later
// G223 (owner's list: data list -> mean, sample/population deviation, min, max, linear regression + r²): `linreg(x,y)`
// and `stats1(l)`, our Giac definitions (homeEval.ts ENGINE_DEFINITIONS, loaded on the first input that names them); G361:
// `linterp(xs,ys,x)`, the value between two rows of a table.
// Exact for exact data: typed decimals are exact rationals in Home, so the slope of 2.1, 3.9, … is 97/50, not a double.
// A refusal is a throw of REFUSAL_MARK and its code; Giac's error text carries it, and statsRefusal reads it back
// (converge.ts errorRefusal, which Home and CAS ask before their error text), so the row shows its words, not the
// generic `error.engine`. Only erasable TypeScript syntax: the worker and Node run this file directly.
/** What a definition throws before the code; never typed by a user (wordOps.ts throws it too, G229). */
export const REFUSAL_MARK = "n62refusal:";

/** The refusals of these definitions (text: enEngine.ts). */
export const STATS_REFUSALS = ["notData", "listsDiffer", "emptyList", "fewValues", "xAllEqual", "yAllEqual", "tableArgs", "tablePoints", "tableOrder", "tableOutside"] as const;
export type StatsRefusal = (typeof STATS_REFUSALS)[number];

const refuse = (code: StatsRefusal): string => `throw("${REFUSAL_MARK}${code}")`;

/** Giac: every element of the list `l` is a real number (exact or float; a free name, a complex number, a list is not),
 *  else the notData refusal. Index `k`. As pasmedian's check. */
const realsOnly = (l: string, k: string): string =>
  `for (${k}:=0;${k}<size(${l});${k}:=${k}+1) { if (type(${l}[${k}])!=integer and type(${l}[${k}])!=rational and type(evalf(${l}[${k}]))!=DOM_FLOAT) ${refuse("notData")}; } `;

/** Giac: sets `flag` to 1 when every element of the list `l` equals its first, compared exactly, else 0. Index `k`. Each
 *  difference is tested against 0 with `!=`, which is exact for a float: Giac's `==` and `!=` of two floats compare them
 *  within epsilon (1e-12), so `x!=x0` would call 1E-15 and 2E-15, or 1 and 1+1E-14, equal (probed at Digits 12 and 40;
 *  golden g353f1-*, which fail with `x!=x0`). G353: a sum over a float list is no test, its rounding is not 0 (three
 *  floats 0.1 gave Sxx = 1E-62). */
const allEqual = (l: string, k: string, flag: string): string =>
  `${flag}:=1; for (${k}:=1;${k}<size(${l});${k}:=${k}+1) { if (normal(${l}[${k}]-${l}[0])!=0) ${flag}:=0; } `;

export const STATS_DEFINITIONS: Readonly<Record<string, string>> = {
  // {slope, intercept, r²} of the least-squares line y = slope·x + intercept: slope Sxy/Sxx, intercept ȳ − slope·x̄,
  // r² = Sxy²/(Sxx·Syy) (the square of the correlation). One parameter, the call's sequence (as paspercentile, G158f1):
  // Giac would refuse a fixed (x,y) function a wrong count with its own text. All-equal x has no slope; all-equal y has
  // a slope (0) but no r² (0/0), and a list cannot hold a refused element, so the whole answer is refused. G353: "all equal"
  // is decided on the values (allEqual), not on Sxx or Syy alone, whose float sum is rounding (Sxx 1E-62 gave the slope 0).
  linreg:
    "linreg(pasa_):={ local pasx_,pasy_,pasn_,pask_,pasmx_,pasmy_,pasxx_,pasxy_,pasyy_,paseq_; " +
    `if (subtype(pasa_)!=1 or size(pasa_)!=2) ${refuse("notData")}; pasx_:=pasa_[0]; pasy_:=pasa_[1]; ` +
    `if (type(pasx_)!=DOM_LIST or type(pasy_)!=DOM_LIST) ${refuse("notData")}; ` +
    realsOnly("pasx_", "pask_") +
    realsOnly("pasy_", "pask_") +
    `pasn_:=size(pasx_); if (size(pasy_)!=pasn_) ${refuse("listsDiffer")}; if (pasn_==0) ${refuse("emptyList")}; ` +
    "pasmx_:=sum(pasx_)/pasn_; pasmy_:=sum(pasy_)/pasn_; pasxx_:=0; pasxy_:=0; pasyy_:=0; " +
    "for (pask_:=0;pask_<pasn_;pask_:=pask_+1) { pasxx_:=pasxx_+(pasx_[pask_]-pasmx_)^2; pasxy_:=pasxy_+(pasx_[pask_]-pasmx_)*(pasy_[pask_]-pasmy_); pasyy_:=pasyy_+(pasy_[pask_]-pasmy_)^2; } " +
    allEqual("pasx_", "pask_", "paseq_") +
    `if (paseq_==1) ${refuse("xAllEqual")}; ` +
    allEqual("pasy_", "pask_", "paseq_") +
    `if (paseq_==1) ${refuse("yAllEqual")}; ` +
    `pasxx_:=normal(pasxx_); pasyy_:=normal(pasyy_); if (pasxx_==0) ${refuse("xAllEqual")}; if (pasyy_==0) ${refuse("yAllEqual")}; ` +
    "return list[normal(pasxy_/pasxx_),normal(pasmy_-pasxy_/pasxx_*pasmx_),normal(pasxy_^2/(pasxx_*pasyy_))]; }",
  // {n, mean, sample s (n−1), population s (n), min, max} of one list, with Giac's mean, min and max (golden-checked on
  // their own: stat-mean). One value has no sample deviation (Giac's stddevp([5]) is undef): refused, as sem's is (G155).
  // G353: both deviations from S = Σ(x − x0 − m)², m the mean of x − x0 (two passes about the first value x0): the one-pass
  // Σx² − n·x̄² of Giac's stddev cancels in floats (three stored floats 0.1 gave 1E-31·i). Every value equal to the first
  // (allEqual, exactly) gives S the exact 0, for floats too, so both deviations are the exact 0; a float list's row stays ≈
// through its other elements (the mean, min and max of three floats 0.1).
  stats1:
    "stats1(pasl_):={ local pasn_,pask_,pasm_,pass_,paseq_; " +
    `if (subtype(pasl_)==1 or type(pasl_)!=DOM_LIST) ${refuse("notData")}; pasn_:=size(pasl_); if (pasn_==0) ${refuse("emptyList")}; ` +
    realsOnly("pasl_", "pask_") +
    `if (pasn_<2) ${refuse("fewValues")}; ` +
    allEqual("pasl_", "pask_", "paseq_") +
    "pasm_:=0; for (pask_:=0;pask_<pasn_;pask_:=pask_+1) pasm_:=pasm_+(pasl_[pask_]-pasl_[0]); pasm_:=pasm_/pasn_; " +
    "pass_:=0; for (pask_:=0;pask_<pasn_;pask_:=pask_+1) pass_:=pass_+(pasl_[pask_]-pasl_[0]-pasm_)^2; " +
    "if (paseq_==1) pass_:=0; else pass_:=normal(pass_); " +
    "return list[pasn_,mean(pasl_),normal(sqrt(pass_/(pasn_-1))),normal(sqrt(pass_/pasn_)),min(pasl_),max(pasl_)]; }",
  // G361: linear interpolation in a table (property tables, pump and data-sheet curves): the straight line between the two
  // rows around x, exact for exact data; Giac's interp and lagrange are the polynomial through every point (G356). The xs
  // strictly increasing, compared exactly (the difference to 0, as allEqual); x in [x1, xn], no extrapolation. The pick of
  // the row is continuous (at a row both lines give its y); the ends decide between a value and a refusal (decisions.ts).
  // One parameter, the call's sequence (as linreg).
  linterp:
    "linterp(pasa_):={ local pasx_,pasy_,pasv_,pasn_,pask_; " +
    `if (subtype(pasa_)!=1 or size(pasa_)!=3) ${refuse("tableArgs")}; pasx_:=pasa_[0]; pasy_:=pasa_[1]; pasv_:=pasa_[2]; ` +
    `if (type(pasx_)!=DOM_LIST or type(pasy_)!=DOM_LIST) ${refuse("tableArgs")}; ` +
    `if (type(pasv_)!=integer and type(pasv_)!=rational and type(evalf(pasv_))!=DOM_FLOAT) ${refuse("tableArgs")}; ` +
    realsOnly("pasx_", "pask_") +
    realsOnly("pasy_", "pask_") +
    `pasn_:=size(pasx_); if (size(pasy_)!=pasn_) ${refuse("listsDiffer")}; if (pasn_==0) ${refuse("emptyList")}; if (pasn_<2) ${refuse("tablePoints")}; ` +
    `for (pask_:=1;pask_<pasn_;pask_:=pask_+1) { if (normal(pasx_[pask_]-pasx_[pask_-1])<=0) ${refuse("tableOrder")}; } ` +
    `if (pasv_<pasx_[0] or pasv_>pasx_[pasn_-1]) ${refuse("tableOutside")}; ` +
    "for (pask_:=1;pask_<pasn_;pask_:=pask_+1) { if (pasv_<=pasx_[pask_]) return normal(pasy_[pask_-1]+(pasv_-pasx_[pask_-1])*(pasy_[pask_]-pasy_[pask_-1])/(pasx_[pask_]-pasx_[pask_-1])); } " +
    `${refuse("tableOutside")}; }`,
};

/** The refusal a definition of this file threw in Giac's error text `output` (the code in quotes after the mark); null
 *  for any other text. */
export function statsRefusal(output: string): StatsRefusal | null {
  return STATS_REFUSALS.find((code) => output.includes(`"${REFUSAL_MARK}${code}"`)) ?? null;
}
