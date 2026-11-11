// SPDX-License-Identifier: GPL-3.0-or-later
// G229 (docs/04 5.4: "shifts and rotations as definitions that respect the word size"): `shl`, `shr`, `rotl`, `rotr` and
// `bnot`, our Giac definitions (homeEval.ts ENGINE_DEFINITIONS, loaded on the first input that names them). Giac has none
// of these names, and its `bitnot` is the unbounded NOT (bitnot(5) = -6 whatever the word); `bitand`, `bitor`, `bitxor`
// are right on big and negative integers and stay Giac's.
//   shl(x,n,w,s)  shr(x,n,w,s)  rotl(x,n,w,s)  rotr(x,n,w,s)  bnot(x,w,s)
// w is the word size (8, 16, 32 or 64) and s is 0 (unsigned) or 1 (signed, two's complement). x must fit the word as
// read: 0 ≤ x < 2^w unsigned, −2^(w−1) ≤ x < 2^(w−1) signed; the count n is an integer ≥ 0. The operation works on the
// w-bit pattern of x and reads the result back the same way, so shl(1,7,8,1) = −128. `shr` of a signed word is the
// arithmetic shift (the sign bit is copied in: shr(−128,1,8,1) = −64), of an unsigned one the logical shift. A count of
// w or more shifts every bit out (0, or −1 for a negative signed shr); a rotation turns by n mod w.
// The short forms (shl(x,n), bnot(x); a third argument gives the word alone) take WORD_BITS and WORD_SIGNED. R194 brings
// the word size and sign as settings; until then these defaults hold.
// A refusal is a throw of stats.ts REFUSAL_MARK and its code, which wordRefusal reads back from Giac's error text
// (converge.ts errorRefusal), as G223's are. Only erasable TypeScript syntax: the worker and Node run this file directly.
import { REFUSAL_MARK } from "./stats.ts";

/** The word size and sign of the short forms (docs/04 5.4); R194 makes them settings. */
export const WORD_BITS = 64;
export const WORD_SIGNED = 0;

/** The refusals of these definitions (text: enEngine.ts). */
export const WORD_REFUSALS = ["wordArgs", "wordSize", "wordValue", "wordCount"] as const;
export type WordRefusal = (typeof WORD_REFUSALS)[number];

const refuse = (code: WordRefusal): string => `throw("${REFUSAL_MARK}${code}")`;

/**
 * One definition: its arguments arrive as one sequence (as `par`), `[pasa_]` makes them a list. `count` says whether a
 * shift count comes second; `op` sets pasr_, the w-bit result pattern (0 ≤ pasr_ < 2^w), from pasu_ (x's pattern), pasx_
 * (x as read), pasn_ (the count), pasw_, pass_ and pasm_ = 2^w. Every check is a test on a value already known to be an
 * integer, so Giac never meets an undecidable test.
 */
function wordOp(name: string, count: boolean, op: string): string {
  const at = count ? 1 : 0;
  return (
    `${name}(pasa_):={ local pasl_,pasx_,pasn_,pasw_,pass_,pasm_,pasu_,pasr_,pask_; pasl_:=[pasa_]; ` +
    `if (size(pasl_)<${at + 1} or size(pasl_)>${at + 3}) ${refuse("wordArgs")}; ` +
    `pasx_:=pasl_[0]; pasw_:=${WORD_BITS}; pass_:=${WORD_SIGNED}; ` +
    `if (size(pasl_)>${at + 1}) pasw_:=pasl_[${at + 1}]; if (size(pasl_)>${at + 2}) pass_:=pasl_[${at + 2}]; ` +
    `if (type(pasw_)!=integer) ${refuse("wordSize")}; if (pasw_!=8 and pasw_!=16 and pasw_!=32 and pasw_!=64) ${refuse("wordSize")}; ` +
    `if (type(pass_)!=integer) ${refuse("wordSize")}; if (pass_!=0 and pass_!=1) ${refuse("wordSize")}; ` +
    `if (type(pasx_)!=integer) ${refuse("wordValue")}; pasm_:=2^pasw_; ` +
    `if (pass_==1) { if (pasx_<-pasm_/2 or pasx_>=pasm_/2) ${refuse("wordValue")}; } else { if (pasx_<0 or pasx_>=pasm_) ${refuse("wordValue")}; } ` +
    (count ? `pasn_:=pasl_[1]; if (type(pasn_)!=integer) ${refuse("wordCount")}; if (pasn_<0) ${refuse("wordCount")}; ` : "") +
    "pasu_:=pasx_; if (pasu_<0) pasu_:=pasu_+pasm_; " +
    op +
    "if (pass_==1 and pasr_>=pasm_/2) pasr_:=pasr_-pasm_; return pasr_; }"
  );
}

/** pasr_ := pasu_ turned left by pask_ bits (0 ≤ pask_ < w). */
const TURN_LEFT = "pasr_:=irem(pasu_*2^pask_,pasm_)+iquo(pasu_,2^(pasw_-pask_)); ";

export const WORD_DEFINITIONS: Readonly<Record<string, string>> = {
  // n ≥ w leaves no bit; 2^n is only formed below w (shl(1,10^9) must not build a 10^9-bit number).
  shl: wordOp("shl", true, "if (pasn_>=pasw_) pasr_:=0; else pasr_:=irem(pasu_*2^pasn_,pasm_); "),
  // Signed: floor(x/2^n), the arithmetic shift (−1 once every bit is the sign); unsigned: the quotient of the pattern.
  shr: wordOp("shr", true, "pask_:=min(pasn_,pasw_); if (pass_==1) pasr_:=floor(pasx_/2^pask_); else pasr_:=iquo(pasu_,2^pask_); if (pasr_<0) pasr_:=pasr_+pasm_; "),
  rotl: wordOp("rotl", true, "pask_:=irem(pasn_,pasw_); " + TURN_LEFT),
  // Right by k is left by w − k (mod w).
  rotr: wordOp("rotr", true, "pask_:=irem(pasw_-irem(pasn_,pasw_),pasw_); " + TURN_LEFT),
  // Every bit of the word flipped: 2^w − 1 − pattern (Giac's bitnot flips an unbounded word).
  bnot: wordOp("bnot", false, "pasr_:=pasm_-1-pasu_; "),
};

/** The refusal a definition of this file threw in Giac's error text `output`; null for any other text. */
export function wordRefusal(output: string): WordRefusal | null {
  return WORD_REFUSALS.find((code) => output.includes(`"${REFUSAL_MARK}${code}"`)) ?? null;
}
