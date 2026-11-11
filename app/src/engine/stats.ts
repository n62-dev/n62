// SPDX-License-Identifier: GPL-3.0-or-later
// G223 (owner's list: data list -> mean, sample/population deviation, min, max, linear regression + r²): `linreg(x,y)`
// and `stats1(l)`, our Giac definitions (homeEval.ts ENGINE_DEFINITIONS, loaded on the first input that names them).
// Exact for exact data: typed decimals are exact rationals in Home, so the slope of 2.1, 3.9, … is 97/50, not a double.
// A refusal is a throw of REFUSAL_MARK and its code; Giac's error text carries it, and statsRefusal reads it back
// (converge.ts errorRefusal, which Home and CAS ask before their error text), so the row shows its words, not the
// generic `error.engine`. Only erasable TypeScript syntax: the worker and Node run this file directly.
/** What a definition throws before the code; never typed by a user (wordOps.ts throws it too, G229). */
export const REFUSAL_MARK = "n62refusal:";

/** The refusals of these definitions (text: enEngine.ts). */
export const STATS_REFUSALS = ["notData", "listsDiffer", "emptyList", "fewValues", "xAllEqual", "yAllEqual"] as const;
export type StatsRefusal = (typeof STATS_REFUSALS)[number];

const refuse = (code: StatsRefusal): string => `throw("${REFUSAL_MARK}${code}")`;

/** Giac: every element of the list `l` is a real number (exact or float; a free name, a complex number, a list is not),
 *  else the notData refusal. Index `k`. As pasmedian's check. */
const realsOnly = (l: string, k: string): string =>
  `for (${k}:=0;${k}<size(${l});${k}:=${k}+1) { if (type(${l}[${k}])!=integer and type(${l}[${k}])!=rational and type(evalf(${l}[${k}]))!=DOM_FLOAT) ${refuse("notData")}; } `;

export const STATS_DEFINITIONS: Readonly<Record<string, string>> = {
  // {slope, intercept, r²} of the least-squares line y = slope·x + intercept: slope Sxy/Sxx, intercept ȳ − slope·x̄,
  // r² = Sxy²/(Sxx·Syy) (the square of the correlation). One parameter, the call's sequence (as paspercentile, G158f1):
  // Giac would refuse a fixed (x,y) function a wrong count with its own text. All-equal x has no slope; all-equal y has
  // a slope (0) but no r² (0/0), and a list cannot hold a refused element, so the whole answer is refused.
  linreg:
    "linreg(pasa_):={ local pasx_,pasy_,pasn_,pask_,pasmx_,pasmy_,pasxx_,pasxy_,pasyy_; " +
    `if (subtype(pasa_)!=1 or size(pasa_)!=2) ${refuse("notData")}; pasx_:=pasa_[0]; pasy_:=pasa_[1]; ` +
    `if (type(pasx_)!=DOM_LIST or type(pasy_)!=DOM_LIST) ${refuse("notData")}; ` +
    realsOnly("pasx_", "pask_") +
    realsOnly("pasy_", "pask_") +
    `pasn_:=size(pasx_); if (size(pasy_)!=pasn_) ${refuse("listsDiffer")}; if (pasn_==0) ${refuse("emptyList")}; ` +
    "pasmx_:=sum(pasx_)/pasn_; pasmy_:=sum(pasy_)/pasn_; pasxx_:=0; pasxy_:=0; pasyy_:=0; " +
    "for (pask_:=0;pask_<pasn_;pask_:=pask_+1) { pasxx_:=pasxx_+(pasx_[pask_]-pasmx_)^2; pasxy_:=pasxy_+(pasx_[pask_]-pasmx_)*(pasy_[pask_]-pasmy_); pasyy_:=pasyy_+(pasy_[pask_]-pasmy_)^2; } " +
    `pasxx_:=normal(pasxx_); pasyy_:=normal(pasyy_); if (pasxx_==0) ${refuse("xAllEqual")}; if (pasyy_==0) ${refuse("yAllEqual")}; ` +
    "return list[normal(pasxy_/pasxx_),normal(pasmy_-pasxy_/pasxx_*pasmx_),normal(pasxy_^2/(pasxx_*pasyy_))]; }",
  // {n, mean, sample s (n−1), population s (n), min, max} of one list, with Giac's mean, stddevp (n−1), stddev (n),
  // min and max (each golden-checked on its own: stat-mean, stat-stddevp-sample, stat-stddev-population). One value
  // has no sample deviation (Giac's stddevp([5]) is undef): refused, as sem's is (G155).
  stats1:
    "stats1(pasl_):={ local pasn_,pask_; " +
    `if (subtype(pasl_)==1 or type(pasl_)!=DOM_LIST) ${refuse("notData")}; pasn_:=size(pasl_); if (pasn_==0) ${refuse("emptyList")}; ` +
    realsOnly("pasl_", "pask_") +
    `if (pasn_<2) ${refuse("fewValues")}; ` +
    "return list[pasn_,mean(pasl_),normal(stddevp(pasl_)),normal(stddev(pasl_)),min(pasl_),max(pasl_)]; }",
};

/** The refusal a definition of this file threw in Giac's error text `output` (the code in quotes after the mark); null
 *  for any other text. */
export function statsRefusal(output: string): StatsRefusal | null {
  return STATS_REFUSALS.find((code) => output.includes(`"${REFUSAL_MARK}${code}"`)) ?? null;
}
