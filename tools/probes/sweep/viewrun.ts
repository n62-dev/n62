// SPDX-License-Identifier: GPL-3.0-or-later
// G63: the engine half of the view sweep: expressions in x (G61's generator) are asked the same value from Home (x stored), CAS evalf,
// Num, the plot evaluator (against Giac's evalf(…, 20)), Solve (the residual at a root), Slope (against Home's diff) and Area
// (against Home's int); views.ts compares them. G188: the engine runs in a worker thread (viewhost.ts, viewworker.ts) with a deadline
// per call; a call that traps the engine is a `crash` finding, one past its deadline a `hang` finding, and the sweep goes on with a fresh
// engine (the stored x set again). Each engine's Giac calls go to a call log (calllog.ts); a crashed one's is kept for replay.ts.
import { compileDefinition } from "../../../app/src/apps/function/compile.ts";
import { markOf, type ComplexValue } from "../../../app/src/engine/format.ts";
import { defaultHomeSettings, precisionFacts, type HomeResult, type HomeSettings } from "../../../app/src/engine/homeEval.ts";
import { defaultCasSettings } from "../../../app/src/engine/types.ts";
import { generate, type Case } from "./gen.ts";
import { ViewEngine, type Failed } from "./viewhost.ts";
import { compareViews, comparePlot, numView, type View } from "./views.ts";
import type { ViewHost, ViewMethod } from "./viewworker.ts";

export const XS = ["-2.7", "-1", "-0.5", "0", "0.3", "1", "2", "4.5"];
const SLOPE_XS = ["0.3", "1"];
const AREAS: [string, string][] = [["0", "1"], ["-1", "0.5"]];
const DIGITS = 12;

/** Inputs that were found wrong and stay in every run: F56 (Area refused ∫₀¹ ln x, hunt N6; G70). */
export const PINNED_X: Case[] = [
  { latex: "\\ln\\left(x\\right)", mp: "", angle: false },
  { latex: "x\\times \\ln\\left(x\\right)", mp: "", angle: false },
  { latex: "\\frac{1-\\cos\\left(x\\right)}{x^{2}}", mp: "", angle: true },
  { latex: "\\frac{1}{x}", mp: "", angle: false },
];

export interface ViewFailure {
  id: string;
  check: string;
  detail: string;
}
export interface ViewSweepResult {
  failures: ViewFailure[];
  compared: number;
  cases: number;
  /** Engines ended by a crash or a hang (each is a finding), the largest heap an engine reported (bytes), the Giac calls of all engines. */
  restarts: number;
  maxHeap: number;
  calls: number;
}

/** The view of a Home-style result at the digits it ran at. A failed result is a refusal (a timeout is not compared). */
export function viewOfResult(r: HomeResult): View {
  if (!r.ok) return r.error === "timeout" ? { kind: "other" } : { kind: "refused" };
  if (!r.value || r.items) return { kind: "other" };
  const m = markOf(precisionFacts(r), { format: "STD", digits: DIGITS });
  const claim = m === null ? DIGITS : m.mark === "⚠" ? (m.n === undefined || m.n < 1 ? null : m.n) : DIGITS;
  return numView(r.value as ComplexValue, claim);
}

/** Cases with no fixed x in them are not interesting for a function; the generator's depth 2 keeps the engine's work small. */
export function viewCases(seed: number, count: number): Case[] {
  const seen = new Set<string>();
  return [...PINNED_X, ...generate(seed, count, { x: true, depth: 2 })].filter((c) => {
    if (!c.latex.includes("x") || seen.has(c.latex)) return false;
    seen.add(c.latex);
    return true;
  });
}

export interface Limits {
  roots: number;
  slopes: number;
  areas: number;
}

export interface ViewSweepOptions {
  /** The call logs' folder (emptied first); null: none. */
  logDir: string | null;
  /** A stand-in host module and its argument (tests; viewworker.ts). */
  host?: string;
  hostArg?: unknown;
  /** Per-call deadline, ms, by method (default deadlineOf). */
  deadlineMs?: (method: ViewMethod) => number;
  /** The i-th of n contiguous slices of the expressions only (a nightly run in pieces; each piece starts a fresh engine). */
  part?: { i: number; n: number };
  /** Called at once with each crash or hang finding (a long run says so before its end). */
  onFailed?: (f: ViewFailure) => void;
}

/** A call's deadline: Home and a raw call a few of Home's 2 s deadlines, the CAS view more, a table one Home call per x, Solve and the analyses
 *  past Solve's 30 s clock. Past it the engine is ended and the call is a `hang` finding. */
export const deadlineOf = (m: ViewMethod): number => ({ eval: 10_000, home: 10_000, cas: 20_000, table: 10_000 * XS.length, analyze: 45_000, solve: 45_000 })[m];

const mb = (bytes: number): string => `${(bytes / 2 ** 20).toFixed(0)} MB`;

/** The text of a crash or hang finding: what happened, on which engine call, the heap then and the kept call log. */
export const failedDetail = (f: Failed): string => `${f.detail}; ${f.calls} Giac calls on that engine, heap ${mb(f.heap)}${f.log ? `; call log ${f.log}` : ""}`;

export async function viewSweep(seed: number, count: number, lim: Limits, opts: ViewSweepOptions = { logDir: null }): Promise<ViewSweepResult> {
  const engine = new ViewEngine({ logDir: opts.logDir, host: opts.host, hostArg: opts.hostArg, deadlineMs: opts.deadlineMs ?? deadlineOf });
  try {
    const all = viewCases(seed, count);
    const p = opts.part;
    const cases = p ? all.slice(Math.floor(((p.i - 1) * all.length) / p.n), Math.floor((p.i * all.length) / p.n)) : all;
    return await sweepWith(engine, cases, lim, opts.onFailed ?? (() => {}));
  } finally {
    await engine.close();
  }
}

async function sweepWith(engine: ViewEngine, cases: Case[], lim: Limits, onFailed: (f: ViewFailure) => void): Promise<ViewSweepResult> {
  const failures: ViewFailure[] = [];
  let compared = 0;
  /** One host call for `latex` at `where`; null when the engine crashed or hung, which is a finding of that kind. */
  const ask = async <M extends ViewMethod>(angle: string, where: string, latex: string, method: M, ...args: Parameters<ViewHost[M]>): Promise<ReturnType<ViewHost[M]> | null> => {
    const r = await engine.call(method, ...args);
    if (r.ok) return r.value;
    const f = { id: `${angle} ${where} ${latex}`, check: r.failed, detail: failedDetail(r) };
    failures.push(f);
    onFailed(f);
    return null;
  };
  const diff = (angle: string, check: string, x: string, latex: string, d: string | null): void => {
    compared++;
    if (d !== null) failures.push({ id: `${angle} ${x} ${latex}`, check, detail: d });
  };
  /** Giac keeps an assumption on x after some calls (F64: Home's int of tanh(√x)); it would change every later case, so it is a finding and is cleared. */
  const leak = async (angle: string, latex: string, where: string): Promise<void> => {
    const about = (await ask(angle, `${where} about`, latex, "eval", "about(x)"))?.output.trim() ?? "x";
    if (about === "x") return;
    failures.push({ id: `${angle} ${where} ${latex}`, check: "leak", detail: `x holds ${about}` });
    await ask(angle, `${where} purge`, latex, "eval", "purge(x)");
  };
  const other: View = { kind: "other" };
  for (const angle of ["rad", "deg"] as const) {
    const s: HomeSettings = { ...defaultHomeSettings, angle, digits: DIGITS, workDigits: 30 };
    const cs = cases
      .filter((c) => angle === "rad" || c.angle)
      .map((c) => ({ c, k: compileDefinition(c.latex, angle) }))
      .filter((e) => e.k.giac !== "" && e.k.error === "");
    // Num: one table call per expression (a crash names its expression)
    const table: (HomeResult[] | null)[] = [];
    for (const e of cs) table.push((await ask(angle, "num", e.c.latex, "table", { fns: [e.k.giac], xs: XS }, s))?.map((row) => row[0]!) ?? null);
    await leak(angle, "(Num table)", "num");
    // Home with x stored: a fresh engine after a crash stores x again
    const home: View[][] = [];
    for (const x of XS) {
      await ask(angle, `home ${x}`, "(x:=)", "home", `x:=${x}`, s);
      engine.context = [{ method: "home", args: [`x:=${x}`, s] }];
      const row: View[] = [];
      for (const e of cs) {
        const r = await ask(angle, `home ${x}`, e.c.latex, "home", e.k.giac, s);
        row.push(r ? viewOfResult(r.result) : other);
      }
      home.push(row);
      engine.context = [];
      await ask(angle, `home ${x}`, "(purge(x))", "home", "purge(x)", s);
      await leak(angle, "(Home with x stored)", x);
    }
    for (const [fi, e] of cs.entries()) {
      for (const [xi, x] of XS.entries()) {
        const h = home[xi]![fi]!;
        const t = table[fi]?.[xi];
        diff(angle, "num", x, e.c.latex, compareViews(h, t ? viewOfResult(t) : other));
        const cas = (await ask(angle, `cas ${x}`, e.c.latex, "cas", `evalf(subst(${e.k.giac},x=(${x})))`, { ...defaultCasSettings, angle, digits: DIGITS }))?.result;
        await leak(angle, e.c.latex, `cas ${x}`);
        diff(angle, "cas", x, e.c.latex, compareViews(h, !cas ? other : cas.ok ? (cas.numeric ? viewOfResult(cas.numeric) : other) : { kind: "refused" }));
      }
    }
    // The plot evaluator against Giac's evalf(…, 20), in the mode Home just left (a fresh engine sets it again)
    await ask(angle, "plot", "(mode)", "home", "0", s);
    engine.context = [{ method: "home", args: ["0", s] }];
    for (const e of cs) {
      if (!e.k.fn) continue;
      for (const x of XS) {
        const out = (await ask(angle, `plot ${x}`, e.c.latex, "eval", `evalf(subst(${e.k.giac},x=(${x})),20)`))?.output.trim() ?? "";
        if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(out)) continue; // not a real number: not compared
        diff(angle, "plot", x, e.c.latex, comparePlot(e.k.fn(Number(x)), Number(out)));
      }
    }
    engine.context = [];
    for (const e of cs.slice(0, lim.slopes)) {
      for (const x of SLOPE_XS) {
        const a = await ask(angle, `slope ${x}`, e.c.latex, "analyze", { kind: "slope", f: e.k.giac, x0: x }, s);
        const h = (await ask(angle, `slope ${x}`, e.c.latex, "home", `subst(diff(${e.k.giac},x),x=(${x}))`, s))?.result;
        await leak(angle, e.c.latex, `slope ${x}`);
        diff(angle, "slope", x, e.c.latex, compareViews(h ? viewOfResult(h) : other, !a ? other : a.ok && a.value ? viewOfResult(a.value) : { kind: "refused" }));
      }
    }
    for (const e of cs.slice(0, lim.areas)) {
      for (const [lo, hi] of AREAS) {
        const a = await ask(angle, `area ${lo}..${hi}`, e.c.latex, "analyze", { kind: "area", f: e.k.giac, a: lo, b: hi }, s);
        const h = (await ask(angle, `area ${lo}..${hi}`, e.c.latex, "home", `int(${e.k.giac},x,${lo},${hi})`, s))?.result;
        await leak(angle, e.c.latex, `area ${lo}..${hi}`);
        diff(angle, "area", `${lo}..${hi}`, e.c.latex, compareViews(h ? viewOfResult(h) : other, !a ? other : a.ok && a.value ? viewOfResult(a.value) : { kind: "refused" }));
      }
    }
    for (const e of cs.slice(0, lim.roots)) {
      if (!e.k.fn) continue;
      const r = await ask(angle, "root", e.c.latex, "analyze", { kind: "root", f: e.k.giac, x0: "1", lo: "-10", hi: "10" }, s);
      await leak(angle, e.c.latex, "root");
      // The residual of the root each app shows: the Function app's Root and the Solve app's answer for f(x)=0 (same settings, same guess).
      const residual = (check: string, ok: boolean, warn: boolean, xv: ComplexValue | undefined, display: string): void => {
        if (!ok || warn || !xv || xv.im.digits !== "") return;
        const xr = numView(xv, DIGITS);
        if (xr.kind !== "num") return;
        // the root is shown to 12 digits: f there is as small as f' times that rounding
        const h = 1e-6 * Math.max(1, Math.abs(xr.v));
        const slope = (e.k.fn!(xr.v + h) - e.k.fn!(xr.v - h)) / (2 * h);
        const res = Math.abs(e.k.fn!(xr.v));
        const tol = 1e-9 * Math.max(1, Math.abs(xr.v) * Math.abs(Number.isFinite(slope) ? slope : 1));
        compared++;
        if (!(res <= tol)) failures.push({ id: `${angle} ${check} ${e.c.latex}`, check, detail: `f(${display}) = ${res.toExponential(2)}, tolerance ${tol.toExponential(2)}` });
      };
      if (r) residual("root", r.ok, r.warn, r.x?.value, r.x?.display ?? "");
      const so = await ask(angle, "solve", e.c.latex, "solve", { kind: "equations", equations: [`(${e.k.giac})=0`], unknowns: ["x"], guesses: ["1"] }, s);
      if (so) residual("solve", so.ok, so.warn, so.roots[0]?.result.value, so.roots[0]?.result.display ?? "");
    }
  }
  return { failures, compared, cases: cases.length, restarts: engine.restarts, maxHeap: engine.maxHeap, calls: engine.calls };
}
