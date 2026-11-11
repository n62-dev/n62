// SPDX-License-Identifier: GPL-3.0-or-later
// G100 (F57, structure audit 1.3): whether an input stores, from Giac's tree (bridge-2, giac_parse) instead of five
// readings of its text. An input stores when its tree has a target that is not one of our helpers' (ourNames.ts), a head
// of the state family (STATE_HEADS), a head that evaluates a string (STRING_HEADS: what the string holds is not in the
// tree, so the input keeps the full read after it), or when it reads a stored program whose kept stores (`programStores`,
// read once when the program is defined, restored or imported), walked through the programs it reads, are not empty.
// An over-read is allowed (a weaker mark, one more state read), an under-read never.
// Pure functions over the parse; only erasable TypeScript syntax, so Node runs this file directly.
import type { GiacParse } from "./bridge.ts";
import { FLAG_WORDS } from "./flags.ts";
import { isOurStore } from "./ourNames.ts";
import { afterStore, wordsOf } from "./giacPrint.ts";

/**
 * G174 (F96): Giac's commands that store into a name given as an argument, a name no store node of the tree holds (giac
 * 2.1.0, read in the pinned tarball; each `sto(…, <argument>)` or identifier_assign): the names are the user's, the
 * state read after the input logs them. ti89.cc: SortA 1691, SortD 1715, Fill 1830–1838, mRow 1855, mRowAdd 1881, rowAdd
 * 1911, rowSwap 1941, LU 1993–1997, QR 2022–2024, CopyVar 2285, NewPic 2535; maple.cc: igcdex 443 and gcdex 455 (their
 * last two names, 429–432), rowspace 1040 and colspace 1048 (the dimension, 1014–1016), delrows 1634 and delcols 1642
 * (1609), inverser 407; vecteur.cc: jordan 15561 and rat_jordan 15571 (15542); plot.cc: point2d and point3d (each name a
 * random point, point2d3d 3950); prog.cc: convert 9153 (a continued fraction), member 10136; misc.cc: clear 770; rpn.cc:
 * ADDROW 1445, ADDCOL 1483, SWAPCOL 1547, SUB 1615–1621, RANDMAT 1649–1653, REDIM 1703, REPLACE 1736–1801, INPUT 2722;
 * quater.cc: GF 372–374 (the field K and its generator g, assigned on purpose: "Now e.g. g^200+1 will build an element of
 * K"); graphtheory.cc (identifier_assign): draw_graph 2152, is_regular 3732, is_strongly_regular 3764,
 * number_of_triangles 4005, is_planar 4119, is_eulerian 4527, chromatic_number 5594, st_ordering 6150, is_bipartite
 * 6217, is_vertex_colorable 6305, find_cliques 6415, is_isomorphic 6549, is_subgraph_isomorphic 6606, is_hamiltonian
 * 6801, maxflow 7018. gbasis and syzygy store Giac's own names (GIAC_SCRATCH).
 */
export const ARG_STORE_HEADS: readonly string[] = [
  "SortA", "SortD", "Fill", "mRow", "mRowAdd", "rowAdd", "rowSwap", "LU", "QR", "CopyVar", "NewPic", "igcdex", "gcdex", "rowspace",
  "colspace", "delrows", "delcols", "inverser", "jordan", "rat_jordan", "point2d", "point3d", "convert", "member", "clear", "ADDROW",
  "ADDCOL", "SWAPCOL", "SUB", "RANDMAT", "REDIM", "REPLACE", "INPUT", "GF", "draw_graph", "is_regular", "is_strongly_regular",
  "number_of_triangles", "is_planar", "is_eulerian", "chromatic_number", "st_ordering", "is_bipartite", "is_vertex_colorable",
  "find_cliques", "is_isomorphic", "is_subgraph_isomorphic", "is_hamiltonian", "maxflow",
];

/** G174 (F96): the names Giac stores for itself, by the head that stores them (solve.cc, giac 2.1.0): gbasis keeps its
 *  answer in lastgb (_gbasis_, 9267) and the variables it chose in lastv (9033, 9170); syzygy reads lastv back (9004).
 *  Scratch, not the user's: the host purges them after the input (a logged one goes back to its entry), so the log and
 *  Vars never hold them. */
export const GIAC_SCRATCH: Readonly<Record<string, readonly string[]>> = { gbasis: ["lastgb", "lastv"], syzygy: ["lastv"] };

/**
 * Heads that change the engine's state with no target in the tree, or whose target the tree may miss (giac 2.1.0,
 * read in the pinned tarball): purge and its aliases (DelVar, del, unassign; their names are targets too), assume,
 * additionally, assign (`assign(q,5)` stores q), restart, rm_all_vars, restart_vars, restart_modes, rm_a_z (G93: purges
 * the one-letter names, usual.cc:231), the file readers read, ramene and unarchive, the writers write and archive,
 * every Giac setting (flags.ts; the check after the call puts them back, the input still runs once), and G174's heads
 * that store into an argument or into Giac's own names.
 */
export const STATE_HEADS: ReadonlySet<string> = new Set([
  "purge", "DelVar", "del", "assume", "additionally", "assign", "restart", "rm_all_vars", "restart_vars", "restart_modes", "rm_a_z",
  "reset", "read", "ramene", "unarchive", "write", "archive", ...FLAG_WORDS,
  ...ARG_STORE_HEADS, ...Object.keys(GIAC_SCRATCH),
]);

/** G174 (F87): the commands that clear every name and answer Giac's list of them (maple.cc:492 _restart, usual.cc:251
 *  _rm_all_vars, which restart_vars is): the list holds our names and the Ans slot, which the host leaves out. */
export const CLEARING_HEADS: ReadonlySet<string> = new Set(["restart", "restart_vars", "rm_all_vars"]);

/** G174 (F96): Giac's commands that need what N62 has not got, refused before they run: debug turns on Giac's step mode
 *  (prog.cc:6163–6167), whose loop asks the browser's prompt() (6728), so "prompt is not defined" is thrown out of the
 *  call and out of every program call after it. */
export const NOT_HERE_HEADS: ReadonlySet<string> = new Set(["debug"]);

/**
 * Heads that parse a string and evaluate (or return) what it holds (giac 2.1.0, every function that builds a gen from a
 * string: prog.cc _expr (expr, execute), _quest (quest, entry), _mupad2xcas, _python, _hash (make_symbol); misc.cc
 * _float (float), _build_complex (complex)). Probed: `expr("q:=5")`, `execute(…)` and `float(…)` store q; complex and
 * make_symbol return `q:=5` unevaluated, which a later evaluation of the result would run.
 */
export const STRING_HEADS: ReadonlySet<string> = new Set([
  "expr", "execute", "quest", "entry", "mupad2xcas", "python", "make_symbol", "float", "complex",
]);

/** The heads of the tree's store nodes (api.cc STORE_HEADS), written as calls. */
const STORE_CALLS = ["sto", "array_sto", "increment", "decrement", "multcrement", "divcrement"];

/** The tokens of Giac's lexer (input_lexer.ll, giac 2.1.0) that make a store node from text without a word: `:=`, `=>`,
 *  `=%`, `▶`, `►`, `→` (sto), `=<` (array_sto), `++`, `+=`, `--`, `-=`, `*=`, `/=` (the increments). */
const STORE_TOKENS = [":=", "=>", "=%", "▶", "►", "→", "=<", "=&lt;", "++", "+=", "--", "-=", "*=", "/="];

/** The words of Giac's lexer that make a store node or a loop that stores its variable (input_lexer.ll: _assign,
 *  augmente_de, diminue_de, est_multiplie_par, est_divise_par, unassign, PURGE; the loops for, pour, repeat, while). */
const STORE_WORDS: ReadonlySet<string> = new Set([
  ...STORE_CALLS, ...STATE_HEADS, ...STRING_HEADS, "_assign", "augmente_de", "diminue_de", "est_multiplie_par", "est_divise_par",
  "unassign", "PURGE", "for", "FOR", "For", "pour", "repeat", "repeter", "REPEAT", "while", "WHILE", "While", "tantque", "Loop",
]);


/** Whether the tree of `text` can hold a store at all: a store node needs one of Giac's store tokens or words in the
 *  text, so a text with neither needs no parse (it costs a bridge call per Enter). Over-reads only. */
export function mayStore(text: string): boolean {
  return STORE_TOKENS.some((t) => text.includes(t)) || wordsOf(text).some((w) => STORE_WORDS.has(w));
}

/** What a stored program changes when it runs, read once from its tree. `writes`: the global names its body stores
 *  (its own name and its parameters and locals left out) and the state or string heads it calls, written `head(`;
 *  `calls`: the names it reads, through which the walk goes on (only those that are programs count). */
export interface ProgramStores {
  writes: string[];
  calls: string[];
}

/** The heads of a tree that store without a target, or evaluate a string (a library body or test with one is refused). */
export function stateHeads(tree: GiacParse): string[] {
  return tree.heads.filter((h) => STATE_HEADS.has(h) || STRING_HEADS.has(h));
}

/** The targets of what runs when the stored value runs: for one top-level store (`f(x):=…`, `f:=x->…`, `a:=…`) its
 *  value's own targets (the bridge walks the value alone, so a body that stores into its own name, `f(x):={f:=0;…}`,
 *  keeps f: an under-read never), else every target of the tree (a printed value `(x)->…`). */
export function valueTargets(tree: GiacParse): string[] {
  return tree.form ? tree.value : tree.targets;
}

/** A program's kept stores from the tree of its definition (`f(x):=…`, `f:=x->…`, or its printed value `(x)->…`). */
export function programStores(tree: GiacParse): ProgramStores {
  return {
    writes: [...valueTargets(tree).filter((t) => !isOurStore(t)), ...stateHeads(tree).map((h) => `${h}(`)],
    calls: tree.reads,
  };
}

/** The targets stores (one of the user's), or the tree has a state or string head. */
function storesIn(tree: GiacParse, targets: readonly string[]): boolean {
  return targets.some((t) => !isOurStore(t)) || stateHeads(tree).length > 0;
}

/** The tree stores by itself (a target of the user's, a state or string head). */
export function treeStores(tree: GiacParse): boolean {
  return storesIn(tree, tree.targets);
}


/** Walks `names` through the programs `kept` knows: true when one of them, or a program it reads, writes. A name being
 *  visited counts as not writing (recursion ends). */
export function writesThrough(names: readonly string[], kept: (name: string) => ProgramStores | null): boolean {
  const seen = new Set<string>();
  const visit = (list: readonly string[]): boolean =>
    list.some((n) => {
      if (seen.has(n)) return false;
      seen.add(n);
      const k = kept(n);
      return k !== null && (k.writes.length > 0 || visit(k.calls));
    });
  return visit(names);
}

/** How an input stores, for Home and CAS. `once`: it must not run twice (it stores, or calls a program that does);
 *  for a plain assignment, its right side stores. `assignment`: `name:=value` (a program written with an arrow too,
 *  G49f4), evaluated as the value, then stored. `defined`: what it defines, for the live Find items (docs/04 3.4).
 *  `noValue`: it stores no value (a function definition, a purge, an assumption). */
export interface InputForm {
  stores: boolean;
  once: boolean;
  assignment: { name: string; rhs: string } | null;
  defined?: { name: string; kind: "var" | "fn" };
  noValue: boolean;
}

/** Root heads of an input that stores no value: a purge or an assumption. */
const NO_VALUE_HEADS: ReadonlySet<string> = new Set(["purge", "DelVar", "del", "assume", "additionally"]);

/** An input that stores nothing. */
export const PLAIN_FORM: InputForm = { stores: false, once: false, assignment: null, noValue: false };

/** `name:=value` in `text` when the tree says the text is one store into that name (top), not a function definition by
 *  `f(x):=`: the value is the text after the `:=`. The tree decides; the text gives only the place to cut. */
export function assignmentIn(text: string, tree: GiacParse): { name: string; rhs: string } | null {
  if (tree.top.length !== 1 || tree.form !== "name") return null;
  const name = tree.top[0]!;
  const rhs = valueAfter(text, name);
  return rhs === null ? null : { name, rhs };
}

/** The text after `name:=` at the start of `text`, or null. The tree says the text is one store into `name`; only the
 *  place to cut its value is read from the text (the tree has no text positions), and it tells `name:=…` from
 *  `name(args):=…`, which Giac's tree holds alike (`f:=(x)->…`). */
function valueAfter(text: string, name: string): string | null {
  return afterStore(text, name);
}

/** `form` for `text`, the same input with values put in for names (a chip, a constant): its assignment's value is cut
 *  from `text`. */
export function formIn(form: InputForm, text: string): InputForm {
  if (!form.assignment) return form;
  const rhs = valueAfter(text, form.assignment.name);
  return rhs === null ? form : { ...form, assignment: { name: form.assignment.name, rhs } };
}

/** The form of `input` from its tree (null: a text that cannot store, never parsed) and from the walk through the
 *  stored programs its words name (`writes`). */
export function formOf(input: string, tree: GiacParse | null, writes: (names: readonly string[]) => boolean): InputForm {
  if (!tree) {
    const calls = writes(wordsOf(input));
    return calls ? { ...PLAIN_FORM, stores: true, once: true } : PLAIN_FORM;
  }
  const assignment = assignmentIn(input, tree);
  if (assignment) {
    // a program's body stores when it runs, not when it is defined
    const rhsStores = !tree.program && (storesIn(tree, tree.value) || writes(wordsOf(assignment.rhs)));
    return { stores: true, once: rhsStores, assignment, defined: { name: assignment.name, kind: "var" }, noValue: false };
  }
  const stores = treeStores(tree) || writes(wordsOf(input));
  const top = tree.top.length === 1 ? tree.top[0]! : undefined;
  // L[k]:=… changes an element of L: no definition for the Find items (as before G100)
  const defined = top === undefined || tree.form === "indexed" ? undefined : { name: top, kind: tree.program ? ("fn" as const) : ("var" as const) };
  const noValue = defined?.kind === "fn" || NO_VALUE_HEADS.has(tree.heads[0] ?? "");
  return { stores, once: stores, assignment: null, ...(defined ? { defined } : {}), noValue };
}
