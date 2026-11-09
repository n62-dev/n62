// SPDX-License-Identifier: GPL-3.0-or-later
// G97 (backlog F69): no power of a non-square matrix exists but the first, and Giac answers every one. For a base that
// is a list but not a square matrix, Giac's pow (gen.cc:6880-6886 in the pinned giac-2.1.0) warns "^ is ambiguous on
// non square matrices" and gives v·v to the n/2 for an even integer n, else the power of each element; its inv of a
// list that is not marked as a matrix is elementwise too (usual.cc:357, gen.cc:7706-7708), and a/M is a·inv(M). That is
// Giac's meaning on purpose (the warning says so), so the refusal is ours, read from the operand's shape in Giac, not
// from the text: a part `M^n` (n ≠ 1), `inv(M)` or `a/M` whose M evaluates to a matrix with rows ≠ columns. A flat
// vector ([1,2]^2 = v·v, [5,1]^-1 elementwise) keeps Giac's meaning: it is no matrix.
// G225 (backlog F194): the same walk finds dot and cross of two flat vectors of different lengths, where Giac pads the
// short one with zeros (its convention; only the 2-vector cross is documented), a value nothing asked for.
// G225f1 (backlog F194, decisions.md Defaults): dot and cross take vectors only, so a matrix operand of the two-argument
// form is refused, equal shapes included; and +, -, * and the pointwise operators of operands of different shape are
// refused (Giac pads or cuts), the shapes read from the operands' values in Giac.
// Runs synchronously next to the engine; only erasable TypeScript syntax.
import { type Giac } from "./numeric.ts";
import { callsOf, functionsIn, names, namesIn, parsePrinted, withoutStrings } from "./giacPrint.ts";
import { changesState } from "./novalue.ts";
import { asksPoly } from "./polyvec.ts";
import { MAX_NODES, treeOf, UNEVALUATED, type TreeNode } from "./tree.ts";
import type { ParseNode } from "./bridge.ts";

/** What can hold such a part: a power, a division or inv, and a list or a name (a stored matrix, a chip) to be M. */
const powerIn = (t: string): boolean => t.includes("^");
const inverseIn = (t: string): boolean => t.includes("/") || callsOf(t, ["inv"], "typed").length > 0;
/** Names that hold no matrix. */
const NO_MATRIX: ReadonlySet<string> = new Set(["pi", "e", "i", "euler_gamma", "pasdeg", "inf", "infinity"]);
const operandIn = (t: string): boolean => t.includes("[") || [...names(t, "typed")].some((n) => !n.call && !NO_MATRIX.has(n.name));
/** G225: what can hold a dot or cross call: a call by one of their spellings, or Giac's infix ⊗; the tree then names the head. */
const productIn = (t: string): boolean => t.includes("⊗") || callsOf(t, VECTOR_PRODUCTS, "typed").length > 0;
/** G225: every spelling of `_dotprod` and `_cross` in the pinned Giac; the tree's head is the one typed. */
const VECTOR_PRODUCTS: ReadonlySet<string> = new Set(["dot", "dotP", "dotprod", "DOT", "scalar_product", "scalarProduct", "cross", "crossP", "crossproduct", "CROSS"]);
/** G225f1: what `s`, the slot of a dot or cross call's evaluated arguments, holds: 2 a matrix operand (a list holding a
 *  list) of a two-argument call, 1 two flat vectors of different lengths, 0 anything else. Nested whens: `s[k]` is read
 *  only on two. */
const productShape = (s: string): string => {
  const kind = (k: number): string => `when(type(${s}[${k}])!=DOM_LIST,0,when(count_eq(DOM_LIST,apply(type,${s}[${k}]))==0,1,2))`;
  return `when(type(${s})!=DOM_LIST,0,when(size(${s})!=2,0,when(${kind(0)}==2 or ${kind(1)}==2,2,when(${kind(0)}==1 and ${kind(1)}==1 and size(${s}[0])!=size(${s}[1]),1,0))))`;
};
/** G225f1: the operators that take their operands position by position (`-` is a `+` of a negated operand). Giac's parser
 *  makes `*` and the pointwise ones binary, read from the left (`[1,2]*[3,4]*[5,6,7]` is a number after its first pair);
 *  `+` is n-ary. */
const COMBINING: ReadonlySet<string> = new Set(["+", "*", ".+", ".-", ".*", "./", ".^"]);
/** G225f1: how those operators read in the typed text (`-` is `+` in the tree; `.+`, `.-`, `.*` hold `+`, `-`, `*`). */
const COMBINING_TEXT: readonly string[] = ["+", "-", "*", "./", ".^"];
/** G225f1: each operand's shape in one Giac value, read from its value (`s` the list of them, evaluated): 0 a non-list or
 *  an asked coefficient vector (subtype 10, polyvec.ts), n+1 a flat list of n, -1 a list of lists that is no matrix,
 *  -(r*100000+c) an r by c matrix. */
const shapeCodes = (s: string): string =>
  `apply(v->when(subtype(v)==10 or type(v)!=DOM_LIST,0,when(count_eq(DOM_LIST,apply(type,v))==0,size(v)+1,when(is_matrix(v),-(rowdim(v)*100000+coldim(v)),-1))),${s})`;
const ROWS = 100000;
/** G225f1: whether the operands' shape codes (shapeCodes) are ones `op` cannot combine. `*` of two matrices is the matrix
 *  product and of a matrix and a vector Giac's own check; a row vector times a matrix needs as many entries as rows. */
function shapesDiffer(op: string, codes: readonly number[]): boolean {
  const flat = new Set(codes.filter((c) => c > 0));
  if (flat.size > 1) return true;
  if (op === "*") {
    const [a, b] = codes;
    return codes.length === 2 && a! > 0 && b! < -1 && a! - 1 !== Math.floor(-b! / ROWS);
  }
  return new Set(codes.filter((c) => c < 0)).size > 1;
}
/** Time the operands may take, as throughInfinity's walk (novalue.ts): a part costs at most about the whole input. */
const WALK_BUDGET_MS = 500;

/** G101: how deep the walk goes into the bodies of called functions (g calls f: two). */
const MAX_DEPTH = 8;

/** G101: a part's text under the parameters of the body it sits in (`subst(part, x=value)`), or as it is. */
type Bind = (expr: string) => string;

/** G101: a stored function whose body is known, from its tree (bridge-2): the names it binds (its parameters alone
 *  when it is walked), the names it reads, and its heads. */
export interface KnownBody {
  params: readonly string[];
  reads: readonly string[];
  heads: readonly string[];
  /** G225f1: its text holds a list. */
  list?: boolean;
}

/** G101: the names the input reads (G99, its tree; asked for only when a body could matter), and the stored functions:
 *  a known body, null for a stored function whose body is not known, undefined for a name that is none. */
export interface Bodies {
  reads: () => readonly string[];
  of: (name: string) => KnownBody | null | undefined;
  /** G171: the names a run of the input may have written (its targets, the stores of the programs it reaches; the host's
   *  candidatesOf), null when they are not known; asked for only for an input that runs once. */
  writes?: () => ReadonlySet<string> | null;
  /** G225f1: whether a stored name (or a chip) holds a list, from the host's table: no engine call. */
  isList?: (name: string) => boolean;
}

export const NO_BODIES: Bodies = { reads: () => [], of: () => undefined };

/** G101: the known bodies the input reads, and those read, by name; `unknown`: the input reads a stored function whose
 *  body is not known. */
function bodiesRead(bodies: Bodies): { known: Map<string, KnownBody>; unknown: boolean } {
  const known = new Map<string, KnownBody>();
  const direct = bodies.reads();
  let unknown = false;
  const seen = new Set<string>();
  const todo = [...direct];
  while (todo.length) {
    const n = todo.pop()!;
    if (seen.has(n)) continue;
    seen.add(n);
    const k = bodies.of(n);
    if (k === null && direct.includes(n)) unknown = true;
    if (!k) continue;
    known.set(n, k);
    todo.push(...k.reads);
  }
  return { known, unknown };
}

/** G225f1: cheap text test for an input or a value to store that may combine lists by position: it holds an operator of
 *  COMBINING and a list, or a name `isList` says holds one (the host reads that from its table, no engine call), so an input
 *  with no list costs no engine call. */
export function mayCombineLists(input: string, isList: (name: string) => boolean): boolean {
  const t = withoutStrings(input, "", "typed");
  return COMBINING_TEXT.some((op) => t.includes(op)) && (t.includes("[") || namesIn(t, "typed").some(isList));
}

/** Cheap text test: could `input` hold a power, inverse or division of a matrix, or (G225) a dot or cross call? */
export function mayPowerMatrix(input: string): boolean {
  const t = withoutStrings(input, "", "typed");
  return ((powerIn(t) || inverseIn(t)) && operandIn(t)) || productIn(t);
}

/** What the walk's answer refuses (the name of the refusal), null when it refuses nothing. */
export function shapeRefusal(found: boolean | "unchecked" | "lengthsDiffer" | "vectorsOnly"): "notSquare" | "lengthsDiffer" | "vectorsOnly" | null {
  return found === true ? "notSquare" : found === "lengthsDiffer" || found === "vectorsOnly" ? found : null;
}

/**
 * F69: `input` (decimals exact), whose result is `output`, holds a part `M^n` with n ≠ 1, `inv(M)` or `a/M` whose M
 * evaluates to a matrix that is not square. Looked for only where Giac says it may be there: a power when the run
 * printed Giac's warning for a list base (`ambiguous`; undefined = not known, looked for), an inverse or a division
 * when the result holds a list (each is elementwise; a·inv(M) of a non-square M is a list). Then one engine call per
 * part for the shape (no evaluation), and two per candidate operand; a candidate whose text changes state
 * (changesState) or calls a function `userFn` names is not evaluated again, and the walk stops (nothing found) before
 * a part that could take it past WALK_BUDGET_MS, at `exactMs` per part, or once `late()`.
 * G101 (F74): a call of a stored function the input reads (`bodies`, G99's reads) whose body is known (it stores
 * nothing, declares no local: the host's table and the function's tree) is walked into, its parameters bound to the
 * call's argument values, and so on through the functions that body reads; any other function keeps the check above.
 * A function the input reads without calling it (`map(L,f)`) is not walked.
 * G171 (F88): a candidate is read as Giac prints the part (not as a string, which hid its calls and stores), and is
 * evaluated only when it changes no state and every function of the user's it calls has a known body; `once` (the input
 * ran once: it stores, or calls a program that does) also leaves out a candidate that reads a name the run may have
 * written (`bodies.writes`). Any other candidate is not evaluated, so the answer is "unchecked" (⚠, never `=`), unless
 * the output's shape proves it: the candidate is the whole input, an inverse (`inv(X)`, a number over X) or a power with
 * a number exponent other than 1, and the answer (the value Giac stored in `ans`, read in Giac, not from its print) a
 * matrix that is not square (Giac's elementwise answer keeps X's shape, a square X gives a square answer, a scalar or
 * flat vector X none). True: refused; false: nothing found.
 * G225: a dot or cross call is a candidate too, its arguments evaluated under the same rules; "lengthsDiffer" when they
 * are two flat vectors of different lengths, G225f1: "vectorsOnly" when one is a matrix.
 * G225f1: so is a `+`, `*` or pointwise part (mayCombineLists; never for an input with no list) whose operands can be
 * lists, "lengthsDiffer" when they are flat lists of different lengths (or matrices of different shape in `+` and the
 * pointwise ones, or a row vector and a matrix with another number of rows in `*`).
 */
export function nonSquarePower(
  giac: Giac,
  input: string,
  output: string,
  ambiguous: boolean | undefined,
  late: () => boolean,
  exactMs: number,
  userFn: (name: string) => boolean,
  bodies: Bodies = NO_BODIES,
  once = false,
  ans?: string,
): boolean | "unchecked" | "lengthsDiffer" | "vectorsOnly" {
  const mayPower = ambiguous !== false;
  const mayInverse = output.includes("[");
  const [powIn, invIn] = [powerIn(input), inverseIn(input)];
  const plain = withoutStrings(input, "", "typed");
  const productTyped = productIn(plain);
  const listName = bodies.isList ?? ((): boolean => false);
  const combinesTyped = mayCombineLists(input, listName);
  const typed = (mayPowerMatrix(input) && ((mayPower && powIn) || (mayInverse && invIn))) || productTyped || combinesTyped;
  // G101: the input's reads (its tree) when the typed text alone is not enough, or it calls a known stored function
  let read: ReturnType<typeof bodiesRead> | null = null;
  const reached = (): ReturnType<typeof bodiesRead> => (read ??= bodiesRead(bodies));
  const callsKnown = !typed || functionsIn(input, "typed").some((n) => !!bodies.of(n));
  const inBodies = (...heads: string[]): boolean =>
    callsKnown && [...reached().known.values()].some((k) => heads.some((h) => k.heads.includes(h)));
  // G101f1: a known body's heads count also when the typed text has an operator of its own (w(A)+inv(B), w(M):=M^2);
  // bridge-2's tree writes both a/b and inv(M) as the head "/" (inv(M) is stored as 1/M), so either head is a division
  const powers = mayPower && (powIn || inBodies("^"));
  const inverses = mayInverse && (invIn || inBodies("/", "inv"));
  // G225: the bodies only for a call of a stored function (the input's reads are an engine call that every other input is spared)
  const callsStored = functionsIn(input, "typed").some((n) => !!bodies.of(n));
  const products = productTyped || (callsStored && inBodies(...VECTOR_PRODUCTS));
  // G225f1: and those bodies, for a list operand, only when a list can be in play: in the input, a name, or a body
  const listInPlay = (): boolean => plain.includes("[") || namesIn(plain, "typed").some(listName) || [...reached().known.values()].some((k) => k.list || k.reads.some(listName));
  const combines = combinesTyped || (callsStored && listInPlay() && inBodies(...COMBINING));
  if (!(powers || inverses || products || combines) || !(typed || reached().known.size > 0)) return false;
  // G101: a call's arguments are evaluated once more to bind the body: not when the input stores, or reads a function
  // of the user's whose body is not known (the known bodies store nothing, nor do the functions they read)
  const inline = (): boolean => !once && !changesState(input, "typed") && !reached().unknown;
  const temps = ["pasq", "pasnb"];
  const t0 = performance.now();
  // the walk stops (nothing found) before an evaluation that could take it past WALK_BUDGET_MS, at `exactMs` each
  const overBudget = (): boolean => late() || performance.now() - t0 + exactMs > WALK_BUDGET_MS;
  try {
    // `proof`: the other operand is a number literal (an inverse's numerator, a power's exponent), G171
    const candidates: { part: string; operand: string; power: boolean; bind: Bind; proof: boolean; product?: true; combine?: string }[] = [];
    let nodes = 0;
    // G103: each tree (the input's, a body's) in one call (tree.ts), walked here: a power, a division or inv is a
    // candidate, a call of a known stored function is walked into
    const shape = (root: string, raw: ParseNode | null | undefined, bind: Bind, depth: number): boolean => {
      if (late()) return false;
      const tree = treeOf(raw, root);
      if (!tree) return false;
      const visit = (t: TreeNode): boolean => {
        if (++nodes > MAX_NODES) return false;
        if (t.kind === 0 || UNEVALUATED.has(t.head)) return true;
        const p = t.path;
        const op = t.head;
        // An operand that is a number literal is no matrix (the 3 of 1/3): not evaluated.
        const literal = (k: number): boolean => t.children.length === (op === "inv" ? 1 : 2) && t.children[k]!.number;
        if (t.kind === 1 && op === "^" && powers) {
          if (!literal(0)) candidates.push({ part: p, operand: `[op(${p})][0]`, power: true, bind, proof: literal(1) });
        } else if (t.kind === 1 && op === "/" && inverses) {
          if (!literal(1)) candidates.push({ part: p, operand: `[op(${p})][1]`, power: false, bind, proof: literal(0) });
        }
        // inv's argument is its whole feuille: op() of inv(M) would be M's rows.
        else if (t.kind === 1 && op === "inv" && inverses) {
          if (!literal(0)) candidates.push({ part: p, operand: `feuille(${p})`, power: false, bind, proof: true });
        }
        else if (t.kind === 1 && VECTOR_PRODUCTS.has(op) && products) candidates.push({ part: p, operand: `[op(${p})]`, power: false, bind, proof: false, product: true });
        // G225f1: two operands that can be lists at the least (a number literal is none); only a `*` of two is the product read from the left
        else if (t.kind === 1 && COMBINING.has(op) && combines && t.children.filter((c) => !c.number).length >= 2 && (op === "+" || t.children.length === 2)) candidates.push({ part: p, operand: `[op(${p})]`, power: false, bind, proof: false, combine: op });
        else if (t.kind === 1 && op === "of" && depth < MAX_DEPTH && !into(p, bind, depth)) return false;
        return t.children.every(visit);
      };
      return visit(tree);
    };
    // G101: the call `p` of a known stored function: its body walked with its parameters (from the function's tree)
    // bound to the argument values (evaluated once, under the caller's binding). Walked only when the function's
    // parameters, in Giac, are the names its tree binds, so a local, a loop variable or a quoting command's variable
    // (each read in global scope here) is never in the body walked. False: the walk is out of nodes or time.
    const into = (p: string, bind: Bind, depth: number): boolean => {
      if (!inline()) return true;
      if (++nodes > MAX_NODES || late()) return false;
      const known = [...reached().known].filter(([, k]) => k.params.length > 0);
      if (!known.length) return true;
      const argv = `when(subtype([op(${p})][1])==1,[op(${p})][1],[[op(${p})][1]])`;
      let pick = "0";
      for (let i = known.length - 1; i >= 0; i--) {
        const [name, k] = known[i]!;
        const test = `string([op(${p})][0])=="${name}" and size(${argv})==${k.params.length} and [[op(${name})][0]]==quote([${k.params.join(",")}])`;
        pick = `when(${test},${i + 1},${pick})`;
      }
      const i = Number(giac.eval(pick).trim()) - 1;
      if (!(i >= 0 && i < known.length)) return true;
      const [name, k] = known[i]!;
      if (overBudget()) return false;
      const n = k.params.length;
      const j = temps.length;
      temps.push(`pasnf${j}`, `pasne${j}`);
      const eqs = k.params.map((x, a) => `quote(${x})=eval(${bind(n === 1 ? `[op(${p})][1]` : `[op(${p})][1][${a}]`)})`);
      // G103: the body as Giac stores it (inv(M) prints as 1/M), with its tree from bridge-3 in the same call
      const body = giac.value(`pasnf${j}:=[op(${name})][2]`, [], true).tree;
      giac.eval(`pasne${j}:=[${eqs.join(",")}]`);
      return shape(`pasnf${j}`, body, (e) => `subst(${e},pasne${j})`, depth + 1);
    };
    // G103: the quoted input stored in pasq, with its tree from bridge-3 in the same call
    if (!shape("pasq", giac.value(`pasq:=quote(${input})`, [], true).tree, (e) => e, 0)) return false;
    // G171: the names a candidate reads, through the known bodies it calls; whether the run may have written one
    let written: ReadonlySet<string> | null | undefined;
    const writes = (): ReadonlySet<string> | null => (written === undefined ? (written = bodies.writes?.() ?? null) : written);
    const evaluable = (text: string): boolean => {
      if (changesState(text, "printed")) return false;
      const fns = functionsIn(text, "printed").filter(userFn);
      if (fns.some((n) => !bodies.of(n))) return false;
      if (!once) return true;
      const read = new Set<string>();
      for (const n of names(text, "printed")) if (!n.call && !NO_MATRIX.has(n.name)) read.add(n.name);
      for (const todo = [...fns]; todo.length; ) {
        const n = todo.pop()!;
        if (read.has(n)) continue;
        read.add(n);
        todo.push(...(bodies.of(n)?.reads ?? []));
      }
      const w = writes();
      return w === null ? [...read].every((n) => fns.includes(n)) : ![...read].some((n) => w.has(n));
    };
    const unchecked: (typeof candidates)[number][] = [];
    for (const c of candidates) {
      if (overBudget()) {
        if (!unchecked.length) return false;
        break;
      }
      // G171 (F88): the part as Giac prints it (printing a part does not evaluate it), so its calls and stores are seen
      // G225: of a dot or cross only the arguments are evaluated (notBuiltin takes the head DOT for a program of the user's)
      const operandsOnly = c.product || c.combine !== undefined;
      const printed = giac.eval(operandsOnly ? c.operand : c.part);
      // G225f1: a list the input asks for as coefficients (an operand that is a call of a polynomial function)
      if (c.combine !== undefined && asksPoly(printed, "printed")) continue;
      if (!evaluable(printed)) {
        unchecked.push(c);
        continue;
      }
      if (c.combine !== undefined) {
        // one call: the shapes come from the values in Giac, printed as a list of integers
        const out = giac.eval(shapeCodes(`eval(${c.bind(c.operand)})`)).trim();
        const printed = (parsePrinted(out)?.items ?? []).map((n) => Number(n.raw));
        const codes = printed.every(Number.isInteger) ? printed : [];
        if (shapesDiffer(c.combine, codes)) return "lengthsDiffer";
        continue;
      }
      if (c.product) {
        // one argument can hold the two (`dot(L)`, L stored): Giac reads a list of two as the two arguments
        giac.eval(`pasnb:=eval(${c.bind(c.operand)})`);
        giac.eval("pasnb:=when(type(pasnb)==DOM_LIST and size(pasnb)==1,pasnb[0],pasnb)");
        const shape = giac.eval(productShape("pasnb")).trim();
        if (shape === "1") return "lengthsDiffer";
        if (shape === "2") return "vectorsOnly";
        continue;
      }
      const first = c.power ? `when(eval(${c.bind(`[op(${c.part})][1]`)})==1,0,1)` : "1";
      const hit = giac.eval(`when(is_matrix(pasnb:=eval(${c.bind(c.operand)})) and rowdim(pasnb)!=coldim(pasnb),${first},0)`).trim();
      if (hit === "1") return true;
    }
    if (!unchecked.length) return false;
    // G171: the answer's shape, in one Giac call on the value it holds, decides a candidate that is the whole input
    // (a number exponent other than 1)
    const whole = unchecked.find((c) => c.part === "pasq" && c.proof);
    const exponent = whole?.power ? " and [op(pasq)][1]!=1" : "";
    if (whole && ans && giac.eval(`when(is_matrix(${ans}) and rowdim(${ans})!=coldim(${ans})${exponent},1,0)`).trim() === "1") return true;
    return "unchecked";
  } finally {
    giac.eval(`purge(${temps.join(",")})`);
  }
}
