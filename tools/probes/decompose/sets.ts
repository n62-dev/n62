// SPDX-License-Identifier: GPL-3.0-or-later
// S54: the input sets of run.ts --set <name>, each row [input, inputs evaluated first (';'-separated)].
// The note (docs/research/r20-decompose.md) gives each set's answers on the dev engine of its base commit.
const F214 = "(asinh(surd(1/2,3)))^((pi/2+1/1000)^(90001/1000/(pi/2+1/1000000)))";
const MIN = "sqrt(ln(1+sqrt(1+2^(1/3))))";

export const SETS: Record<string, [string, string][]> = {
  // step 1: F214's power, then one part dropped at a time, down to the smallest input that still recurses
  shrink: [
    [`simplify(${F214})`, ""],
    ["simplify((asinh(1/2))^((pi/2+1/1000)^(90001/1000/(pi/2+1/1000000))))", ""], // no cube root: answers
    ["simplify(x^((pi/2+1/1000)^(90001/1000/(pi/2+1/1000000))))", ""], // no asinh: answers
    ["simplify((asinh(surd(1/2,3)))^(pi^pi))", ""],
    ["simplify((asinh(surd(1/2,3)))^pi)", ""],
    ["simplify(asinh(2^(1/3))^pi)", ""],
    ["simplify(asinh(sqrt(2))^pi)", ""], // a square root alone: answers
    ["simplify(ln(2^(1/3)+sqrt(2^(2/3)+1))^pi)", ""], // asinh's ln form
    ["simplify(ln(1+sqrt(1+2^(1/3)))^pi)", ""],
    [`simplify(${MIN})`, ""], // the smallest found
    ["simplify(sqrt(ln(1+sqrt(1+3^(1/3)))))", ""],
    ["simplify(sqrt(ln(1+sqrt(1+2^(1/4)))))", ""],
    ["simplify(sqrt(ln(1+sqrt(1+sqrt(2)))))", ""], // two square roots: answers
    ["simplify(sqrt(ln(sqrt(1+2^(1/3)))))", ""], // no 1+ outside the root: answers
    ["simplify(sqrt(ln(1+sqrt(2^(1/3)))))", ""], // no 1+ inside the root: answers
    ["simplify(ln(ln(1+sqrt(1+2^(1/3)))))", ""], // no power: answers
    ["simplify(ln(1+sqrt(1+2^(1/3)))^2)", ""], // an integer power: answers
  ],
  // the same inputs at other Digits, and through tsimplify (simplify's own call, subst.cc:2703, is tsimplify_noexpln)
  digits: [
    [`simplify(${F214})`, "Digits:=40"],
    [`simplify(${F214})`, "Digits:=60"],
    [`simplify(${MIN})`, "Digits:=40"],
    [`tsimplify(${F214})`, ""],
    [`tsimplify(${MIN})`, ""],
    [`simplify(${MIN})`, "timeout 1;ckevery 10"], // Giac's own clock (patch 0002) stops it after 1 s: the loop's gcd calls control_c (Home's clock does the same; CAS waits 600 s)
  ],
  // the cause's last step on the dev engine: e2r with a variable list that lacks ln(rootof(...)) is undef (with lvar's list it is not)
  cause: [
    ["e2r(-ln(2)+ln(rootof([[1,0],[1,0,-12,-32,48,0,-64]])),[ln(2),pi])", ""],
    ["e2r(-ln(2)+ln(rootof([[1,0],[1,0,-12,-32,48,0,-64]])),lvar(-ln(2)+ln(rootof([[1,0],[1,0,-12,-32,48,0,-64]]))))", ""],
    ["evalf(rootof([[1,0],[1,0,-12,-32,48,0,-64]]),20)", ""], // (4^(1/3)+sqrt(4^(2/3)+4)), the root of asinh(surd(1/2,3))'s ln form
  ],
  // a wrong answer met on the way (not F214): simplify's square root of an algebraic number drops the numerator
  forms: [
    ["simplify(sqrt(1+sqrt(1+2^(1/3))))", ""],
    ["evalf(simplify(sqrt(1+sqrt(1+2^(1/3)))),20)", ""],
    ["evalf(sqrt(1+sqrt(1+2^(1/3))),20)", ""],
    ["normal(sqrt(1+sqrt(1+2^(1/3))))", ""],
    ["evalf(normal(sqrt(1+sqrt(1+2^(1/3)))),20)", ""],
  ],
};
