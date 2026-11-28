// SPDX-License-Identifier: GPL-3.0-or-later
// G314: the steps of host.ts casRun after its first run of the input (the CAS view, D3): Giac's error, the decisions
// taken again, the refusals as in Home, and the result as a checked number or as Giac's text. EngineHost sets the run
// up (its stores, its tree, its settings check) and passes it in as a CasRun. Worker side only; only erasable
// TypeScript syntax, so Node runs this file directly.
import type { CasResult, CasSettings } from "./types.ts";
import type { GatedGiac } from "./ctxGate.ts";
import type { DefChange, DefEntry, NameFacts } from "./defs.ts";
import type { InputForm } from "./stores.ts";
import type { InputReads } from "./stateRead.ts";
import { decideFloatTest, latexShown, onceUndecided, resultFromFacts, symbolicWhy, testSides, toExactLiterals, unquote } from "./homeEval.ts";
import { floatsAtView, shownOf } from "./shownText.ts";
import { isDimensionError, shapeRefusal, type nonSquarePower } from "./nonsquare.ts";
import { unaskedPoly } from "./polyvec.ts";
import { approxClimbed } from "./approxClimb.ts";
import { approxRange, lostCas, mayBeNumbers, throughInfinity } from "./novalue.ts";
import { listAsArguments } from "./listargs.ts";
import { errorRefusal, floatBounds, giacPair, hasDefiniteIntegral, hasNestedIntegral, integratedNumerically, refusalOf } from "./converge.ts";
import { enEngine } from "../i18n/enEngine.ts";
import { askedDigits, doubleFormsIn, unauditedIn, floatFacts, hasFloat, integratedFacts, numberLatex, shapeOfValue, valuePrecision, whyOf, withDigits, type Giac } from "./numeric.ts";
import { notBuiltin } from "./names.ts";
import { isError, isTimeout } from "./giacPrint.ts";
import { contradictedCall, contradictedFloats, decidedAtDouble, decideTwice, nonRealArg, restsOnDecision } from "./decisions.ts";
import { inherited, readFacts, type FactsHost } from "./facts.ts";
import { resultFacts } from "./storedMark.ts";
import { EQ_INEXACT_FLAG, EQ_VERDICT } from "./ourNames.ts";
import { putBack } from "./assumed.ts";
import { plainRowsText, soleMatrixLatexOfText } from "./matrixType.ts";
import { casSequence, nameBack } from "./sequences.ts";

export type CasError = NonNullable<CasResult["error"]>;
export type CasAnswer = { result: CasResult; defs: DefChange[] };
/** What the call after the input gives the steps (host.ts AfterInput). */
export type CasPost = { reads: InputReads; flagsChanged: boolean };

/** One CAS run as EngineHost set it up; `text` and `ambiguous` are the current answer, which the steps change. */
export interface CasRun<P extends CasPost> {
  readonly giac: GatedGiac["giac"];
  /** G806: Giac's messages after each eval (EngineHost.watched), for decideTwice. */
  readonly watched: Giac;
  readonly host: FactsHost;
  byName(): ReadonlyMap<string, DefEntry>;
  readonly input: string;
  readonly s: CasSettings;
  readonly t0: number;
  readonly exactInput: string;
  /** The input is an == or ≠ test (input/emit.ts equalityTest). */
  readonly test: boolean;
  readonly form: InputForm;
  readonly asg0: InputForm["assignment"];
  readonly guarded: InputForm["assignment"];
  readonly digitsSet: number;
  readonly body: string;
  /** The body (or `e`) run at P into pcasans, strict (a syntax error throws). */
  run(e?: string): string;
  ambiguousPower(): boolean;
  readonly single: boolean;
  readonly onceRun: boolean;
  userFn(name: string): boolean;
  text: string;
  ambiguous: boolean;
  shapes(): ReturnType<typeof nonSquarePower>;
  fail(text: string, error: CasError): CasAnswer;
  /** G65: the call after the input. */
  after(): P;
  /** The definitions log's changes of the input (none unless it stores). */
  defsOf(post: P, preview: string, facts: NameFacts | null): DefChange[];
}

/** casDecide's findings that the later steps read. */
export interface CasDecided {
  decided: ReturnType<typeof decideFloatTest>;
  floatInput: string | null;
  asg: InputForm["assignment"];
  undecided: boolean;
  refusedCut: boolean;
}

/** casRefusals' findings when nothing was refused. */
export interface CasChecked {
  refused: ReturnType<typeof refusalOf>;
  square: ReturnType<typeof nonSquarePower>;
  climbed: ReturnType<typeof approxClimbed> | null;
  pastCap: boolean;
}

/** Giac answered the run with an error. */
export function casErrorAnswer<P extends CasPost>(r: CasRun<P>): CasAnswer {
  const { giac, body, text, fail, asg0, form, digitsSet, t0 } = r;
  // G225f2: Giac's error for operands of its matrix type of different shape is the refusal their plain rows get, as in Home
  const sizes = isDimensionError(text) ? shapeRefusal(r.shapes()) : null;
  if (sizes) return fail(enEngine[`error.${sizes}`], sizes);
  const noLimit = errorRefusal(body, text); // G305 (F182): one-sided limits that differ: no limit, as in Home, nothing stored
  if (noLimit) return fail(enEngine[`error.${noLimit}`], noLimit);
  // G71 (F59): no MPFR value at P (a decision over BesselJ): an expression that stores nothing is decided at the double,
  // with ⚠, as in Home. An assignment keeps the error (its definitions-log entry would hold a double).
  const dbl = isTimeout(text) || asg0 || form.stores ? null : decidedAtDouble(giac, "pcasans", body, digitsSet);
  if (dbl === null) return fail(text, isTimeout(text) ? "timeout" : "engine");
  const why = { unaudited: unauditedIn(body, "typed") };
  const engineMs = performance.now() - t0;
  if ("text" in dbl) return { result: { ok: true, text: dbl.text, latex: dbl.text, timedOut: false, engineMs, approximate: true, facts: { exact: false, reliableDigits: null, warn: "unaudited", why } }, defs: [] };
  const res = resultFromFacts(dbl.facts, dbl.shape, digitsSet, "numeric", true, engineMs);
  const numeric = { ...res, facts: { ...res.facts, why } };
  return { result: { ok: true, text: numeric.display, latex: numberLatex(numeric.display), timedOut: false, engineMs, numeric, facts: numeric.facts }, defs: [] };
}

/** The decisions of the answer: a float test, a float argument's run (G325f2), the second run at P + 20 (G38). */
export function casDecide<P extends CasPost>(r: CasRun<P>): CasDecided {
  const { giac, exactInput, digitsSet, single, guarded, form, test, body } = r;
  // An == or ≠ test on a float side: decided by its own digits, as in Home (R18f2).
  const inexactTest = test && giac.eval(EQ_INEXACT_FLAG) === "1";
  const decided = inexactTest && !single ? decideFloatTest(giac, exactInput, digitsSet) : null;
  if (decided) {
    r.text = r.run();
    r.ambiguous = r.ambiguousPower();
    giac.eval(`purge(${EQ_VERDICT})`);
  }
  // G325f2: Giac's evalf of its exact text of asin, acos or acosh of a non-real argument cancels: run from the argument's float, as Home
  const [complexArg, contradicted] = [nonRealArg(giac, valuePrecision(digitsSet)), contradictedCall(giac, valuePrecision(digitsSet), digitsSet)]; // per call (fix round 2)
  const floatsOf = (e: string): string | null => contradictedFloats(giac, e, r.text, valuePrecision(digitsSet), digitsSet, complexArg, contradicted);
  const floatInput = (single && !guarded) || isError(r.text) ? null : floatsOf(exactInput);
  const bodyFloats = floatInput !== null && guarded ? (floatsOf(guarded.rhs) ?? body) : floatInput;
  if (floatInput !== null) r.text = r.run(bodyFloats!);
  // G38: a result that rests on a numeric decision is decided again at P + 20 (and P + 40), as in Home; an exact
  // == or ≠ test too, only one with a float side is decideFloatTest's.
  // A plain name:=value decides its value (the right-hand side) and stores the agreed one, as Home does; other
  // stateful inputs (f(x):=…, purge, assume, =>) must not run twice.
  const asg = form.assignment;
  const once = asg ? form.once : form.stores;
  // G48: an input that runs once and rests on a decision is ⚠, as in Home (it cannot be decided again).
  let undecided = once && !inexactTest && onceUndecided(giac, form, exactInput, r.text);
  const decisionExpr = asg ? toExactLiterals(asg.rhs) : exactInput;
  // G57: a decision the precisions do not agree on, or a tie Giac cannot prove, is refused as in Home (nothing is stored).
  let refusedCut = false;
  if (!once && !inexactTest && !hasFloat(r.text) && restsOnDecision(decisionExpr, "typed", r.text, notBuiltin(giac), complexArg)) {
    const d = decideTwice(r.watched, decisionExpr, r.text, digitsSet, digitsSet, mayBeNumbers(r.text)); // G806: Giac's messages (roundedPivot); G404: it climbs as Home's
    if ("undecided" in d) undecided = true;
    if ("undecided" in d && d.refused) refusedCut = true;
    if (!("undecided" in d) && d.from !== undefined) {
      if (giac.eval(`pcasans:=${d.from};purge(${d.from})`).startsWith("GIAC_ERROR")) giac.eval(`purge(${d.from})`);
      if (asg && !guarded) giac.eval(`${asg.name}:=pcasans`);
      r.text = d.text;
    }
  }
  return { decided, floatInput, asg, undecided, refusedCut };
}

/** The refusals of Home on the CAS answer (each puts a refused once store back), then a guarded assignment's store. */
export function casRefusals<P extends CasPost>(r: CasRun<P>, d: CasDecided): CasAnswer | CasChecked {
  const { giac, asg0, guarded, single, onceRun, exactInput, digitsSet, form, fail, userFn, input, t0 } = r;
  const { asg } = d;
  // G119, G173 (owner, 2026-11-05): Giac's sequence answer as in Home (sequences.ts); none is refused, and a name it was
  // stored under goes back (a guarded assignment has stored nothing yet)
  const seq = casSequence(giac, "pcasans", r.text, (f) => withDigits(giac, valuePrecision(digitsSet), digitsSet, f), form, r.byName());
  if (seq?.empty && asg0 && !guarded) giac.eval(nameBack(asg0.name, r.byName()));
  if (seq?.empty) return fail(enEngine["error.noValue"], "noValue");
  if (seq) {
    r.text = seq.text;
    if (asg && !guarded) giac.eval(`${asg.name}:=pcasans`);
  }
  // G39: a divergent integral or series, or no limit, is refused as in Home; Giac's [exact, numeric] pair of a
  // definite integral is shown as Giac's text (both answers) with ⚠, never as a numeric list.
  const refused = guarded ? refusalOf(giac, guarded.rhs, r.text, digitsSet) : single ? null : refusalOf(giac, exactInput, r.text, digitsSet);
  if (refused && refused !== "unchecked") return fail(enEngine[`error.${refused}`], refused);
  if (d.refusedCut) return fail(enEngine["error.undecided"], "undecided");
  // G97 (F69): a power, inverse or division of a non-square matrix is Giac's elementwise answer, refused as in Home.
  const square = r.shapes();
  // a refused once store keeps the name's earlier value, as Home (which stores only on success): its logged entry back
  const logged = asg0 ? r.byName().get(asg0.name) : undefined;
  const badShape = shapeRefusal(square); // G225: or dot, cross of vectors of different lengths
  if (badShape && onceRun && asg0) giac.eval(logged ? putBack([], [logged]) : `purge(${asg0.name})`);
  if (badShape) return fail(enEngine[`error.${badShape}`], badShape);
  // G111 (F98), R80f1: one list argument of LambertW, a distribution and others read as their argument list, refused as in Home.
  const listRefused = listAsArguments(giac, asg0 ? asg0.rhs : exactInput, userFn);
  if (listRefused) return fail(enEngine[`error.${listRefused}`], listRefused);
  // G106 (F78): Giac's polynomial of a list plus a number (`[1,4]+1` = poly1[1,5]), which the input did not ask for.
  if (unaskedPoly(giac, "pcasans", asg0 ? asg0.rhs : exactInput, r.text, userFn)) return fail(enEngine["error.listPlusNumber"], "listPlusNumber");
  // G148: approx or evalf of a finite value past MPFR's range (±infinity, or a float 0) is refused as in Home.
  const range0 = guarded || !single ? approxRange(giac, asg0 ? asg0.rhs : exactInput, r.text, valuePrecision(digitsSet), () => false, userFn) : null;
  // G404: one finite higher up the climb is that number, climbed as in Home (approxClimb.ts); past its reach Giac's text, ⚠
  const climbed = range0 !== null && typeof range0 === "object" ? approxClimbed(giac, "pcasans", range0.bare, askedDigits(input) ?? digitsSet, digitsSet, performance.now() - t0) : null;
  const pastCap = climbed !== null && typeof climbed === "object" && "pastReach" in climbed;
  if (pastCap) r.text = climbed.pastReach;
  const range = range0 !== null && typeof range0 === "object" ? (climbed === "undecided" ? climbed : climbed ? null : "noValue") : range0;
  if (range) return fail(enEngine[`error.${range}`], range);
  // G168 (F93): Giac's undef, or the call back with no free name (no number comes of it), is refused as in Home; an
  // assignment that ran once puts its name back, as a non-square power's (G171), so no name keeps Giac's word.
  const lostAsked = !pastCap && (!!guarded || !single || (onceRun && !!asg0 && !form.noValue));
  const lost = lostAsked ? lostCas(giac, "pcasans", asg0 ? asg0.rhs : exactInput, r.text, () => false, userFn, digitsSet, !!guarded || !single) : null;
  if (lost && onceRun && asg0) giac.eval(logged ? putBack([], [logged]) : `purge(${asg0.name})`);
  if (lost) return fail(enEngine[`error.${lost}`], lost);
  // G320 (arch review N5; owner 2026-11-10, answer 7): an answer with no free name that rests on an infinity inside
  // (1/(1/0), exp(ln(0)): Giac's extended reals) is refused as in Home, after the lost number (lostCas, as Home's
  // lostNumber) and with the same inputs; with a free name in the answer Giac's algebra stays.
  const viaInf = lostAsked && mayBeNumbers(r.text) && throughInfinity(giac, asg0 ? asg0.rhs : exactInput, r.text, () => false, performance.now() - t0, userFn);
  if (viaInf && onceRun && asg0) giac.eval(logged ? putBack([], [logged]) : `purge(${asg0.name})`);
  if (viaInf) return fail(enEngine["error.divisionByZero"], "divisionByZero");
  if (guarded) {
    const stored = giac.eval(`${guarded.name}:=pcasans`);
    if (isError(stored)) return fail(stored, isTimeout(stored) ? "timeout" : "engine");
  }
  return { refused, square, climbed, pastCap };
}

/** The answer that passed every check: a climbed number, a checked number, or Giac's text with its mark. */
export function casAnswer<P extends CasPost>(r: CasRun<P>, d: CasDecided, c: CasChecked): CasAnswer {
  const { giac, single, exactInput, t0, host, input, s } = r;
  const { refused, square, climbed, pastCap } = c;
  r.text = plainRowsText(giac, "pcasans", r.text); // G130 (F125): Giac's matrix type as plain rows, as in Home
  // A check that could not finish: the result stands with ⚠ (its numeric facts, or the text's mark).
  const unverified = refused === "unchecked" || square === "unchecked";
  const pair = !single && hasDefiniteIntegral(exactInput) && giacPair(r.text, hasNestedIntegral(exactInput)) !== null;
  if (climbed && typeof climbed === "object" && "ok" in climbed) {
    const post = r.after(); // the moved run of `inherited` would meet the input's infinity again: none
    const numeric = inherited(host, climbed, post.reads, null, climbed.digits ?? r.digitsSet, r.digitsSet);
    return { result: { ok: true, text: numeric.display, latex: numberLatex(numeric.display), timedOut: false, engineMs: performance.now() - t0, numeric, facts: numeric.facts }, defs: r.defsOf(post, numeric.display, resultFacts(numeric)) };
  }
  // A number with a float in it: checked like Home (the value as `numeric`, its text and LaTeX from our formatter).
  // `evalf(e,n)` alone is shown with the n digits it asks for, checked at that precision (decisions M4-6).
  // G103: its shape from bridge-3's kind and elements (one call, only for a text with a float)
  const shape = hasFloat(r.text) && !pair ? shapeOfValue(giac.value("pcasans", [])) : null;
  if (shape) {
    const asked = askedDigits(input);
    const digits = asked ?? Math.trunc(s.digits);
    // G90: evalf of an integral whose exact answer keeps Giac's integrate(…) is its numeric integration of the typed
    // integrand (float bounds), ⚠ without a count, as in Home.
    const integrated = !single && integratedNumerically(giac, exactInput, r.text);
    const read = floatFacts(giac, "pcasans", single ? null : integrated ? floatBounds(exactInput) : (d.floatInput ?? exactInput), shape, digits, Math.trunc(s.digits), exactInput);
    const facts = read && integrated ? integratedFacts(read) : read;
    if (facts) {
      let numeric = resultFromFacts(facts, shape, digits, "numeric", true, performance.now() - t0);
      if (unverified) numeric.facts = { ...numeric.facts, warn: numeric.facts.warn ?? "unchecked" };
      if (asked !== null) numeric.digits = asked;
      const why0 = whyOf(facts, single ? null : exactInput);
      const why = refused === "unchecked" || square === "unchecked" ? { ...(why0 ?? {}), ...(refused === "unchecked" ? { existsUnchecked: true } : {}), ...(square === "unchecked" ? { squareUnchecked: true } : {}) } : why0;
      if (why) numeric.facts = { ...numeric.facts, why };
      const post = r.after();
      numeric = inherited(host, numeric, post.reads, single || post.flagsChanged ? null : exactInput, digits, Math.trunc(s.digits));
      return {
        result: { ok: true, text: numeric.display, latex: numberLatex(numeric.display), timedOut: false, engineMs: performance.now() - t0, numeric, facts: numeric.facts },
        defs: r.defsOf(post, numeric.display, resultFacts(numeric)),
      };
    }
  }
  return casText(r, d, c, unverified, pair);
}

/** Giac's text as the answer: its floats at the view's digits, its mark and why, its LaTeX. */
function casText<P extends CasPost>(r: CasRun<P>, d: CasDecided, c: CasChecked, unverified: boolean, pair: boolean): CasAnswer {
  const { giac, exactInput, digitsSet, test, host, input, s, t0, fail } = r;
  const { decided, undecided } = d;
  const { refused, square, pastCap } = c;
  // G38: a float in a non-number prints with the precision it was computed at (P). pcasans keeps the P result; the
  // text prints its floats at the setting (floatsShown), never by running the input again (that redid decisions).
  // G317: shownText.ts, the one path a side name's CAS preview takes too
  const { text: atView, slot, atN } = floatsAtView(giac, r.text, "pcasans", digitsSet);
  r.text = atView;
  const text = atView;
  // An == or ≠ test on a side with a float in it (input/emit.ts equalityTest): its true or false is approximate.
  // A float in a non-number (x-0.54764225985): nobody checked its digits, so ⚠ without a count (G27, docs/04 2.4),
  // as the definitions log records it.
  const unchecked = hasFloat(text) || undecided || unverified || pastCap;
  // G51: a result without a float that read a stored name, or called a function, with facts takes their warn, why.inherited
  // and (R36f1) why.rounded, as `inherited` does for a number; one built from exact names stays unmarked.
  const post = r.after();
  const read = readFacts(host, input, post.reads);
  // G71 (N7): Giac's two-argument round and trunc work in a double; the integer trunc(x,0) prints is not exact.
  const doubled = doubleFormsIn(exactInput, "typed").length > 0;
  const approximate = (test && giac.eval(EQ_INEXACT_FLAG) === "1") || unchecked || doubled || read !== null;
  const own = decided?.warn ?? (doubled ? "unaudited" : unchecked ? "unchecked" : undefined);
  const warn = own === "unaudited" || read?.facts.warn === "unaudited" ? "unaudited" : (own ?? read?.facts.warn);
  const symWhy = symbolicWhy(own, testSides(exactInput));
  // G38: "decided at limited precision"; the value was computed, not compared, so `once` is not said.
  const why0 = pastCap ? { pastCap: true as const } : pair ? { differ: true } : undecided ? { ...(symWhy && !symWhy.once ? symWhy : {}), decided: true } : symWhy;
  const why1 = refused === "unchecked" || square === "unchecked" ? { ...(why0 ?? {}), ...(refused === "unchecked" ? { existsUnchecked: true } : {}), ...(square === "unchecked" ? { squareUnchecked: true } : {}) } : why0;
  const why = read && (read.causes.length || read.rounded.length) ? { ...(why1 ?? {}), ...(read.causes.length ? { inherited: read.causes } : {}), ...(read.rounded.length ? { rounded: read.rounded } : {}) } : why1;
  // G46, G109, G173 (shownText.ts shownOf): Ans, chips (`full`) and pcasans keep the radian text, which means the same
  // in every mode, and Giac's `list[…]`; MathPrint draws Giac's latex() (`\{…\}`)
  const { deg, shown } = shownOf(giac, text, s.angle);
  const tex = deg !== null ? (soleMatrixLatexOfText(giac, deg) ?? giac.eval(`latex(quote(${deg}))`)) : latexShown(giac, slot, text);
  if (atN) giac.eval("purge(pasfl)");
  if (isError(tex)) return fail(tex, isTimeout(tex) ? "timeout" : "engine");
  return {
    result: {
      ok: true,
      text: shown,
      ...(shown !== text ? { full: text } : {}),
      latex: unquote(tex),
      timedOut: false,
      engineMs: performance.now() - t0,
      ...(approximate ? { approximate } : {}),
      facts: { exact: false, reliableDigits: null, ...(warn ? { warn } : {}), ...(why ? { why } : {}) },
    },
    defs: r.defsOf(post, shown, unchecked ? { exact: false, reliableDigits: null, warn: "unchecked", inexact: true } : null),
  };
}
