// SPDX-License-Identifier: GPL-3.0-or-later
// G216: Copy as Python's unit table (clipboard/pyUnits.ts) against pint and find/factors.yaml, part of the pydiff stage.
// Every entry must exist in pint (the venv's pinned one), have Find's dimension and its exact factor to SI base units: a
// registry with Fraction numbers gives pint's factor as a rational, Find's `si` is "p/q" or a rational times a power of
// π (pint's own π then); °C and °F their scale and offset, and their delta unit the scale. Each prefix on each unit that
// takes one, likewise (prefix × unit), and each constant's dimension is Find's with pint's SI text worth exactly 1.
//   node scripts/pyunits-check.ts        # exit 1 on any problem
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { PY_CONSTS, PY_PREFIXED, PY_PREFIXES, PY_TEMPS, PY_UNITS, pintDim } from "../src/clipboard/pyUnits.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

interface Factors {
  prefixes: Record<string, { si: string }>;
  units: Record<string, { si?: string; dim: string }>;
  constants: Record<string, { dim: string }>;
}

/** Find's `si` as exact parts: a rational p/q times π^pi, and an offset (a temperature); undefined when it has another form. */
export function siParts(si: string): { q: string; pi: number; offset?: string } | undefined {
  const rat = (s: string): string | undefined => (/^\d+(\/\d+)?$/.test(s) ? s : /^10\^\d+$/.test(s) ? `1${"0".repeat(Number(s.slice(3)))}` : undefined);
  const off = /^([^+]+)\+(\d+(?:\/\d+)?)$/.exec(si);
  if (off) {
    const q = rat(off[1] as string);
    return q === undefined ? undefined : { q, pi: 0, offset: off[2] as string };
  }
  const forms: [RegExp, (m: RegExpExecArray) => { q?: string; pi: number }][] = [
    [/^(\d+(?:\/\d+)?)$/, (m) => ({ q: m[1], pi: 0 })],
    [/^(\d+)\*pi$/, (m) => ({ q: m[1], pi: 1 })],
    [/^pi(?:\^(\d+))?\/(\d+)$/, (m) => ({ q: `1/${m[2]}`, pi: Number(m[1] ?? 1) })],
    [/^(\d+)\*pi\/(\d+)$/, (m) => ({ q: `${m[1]}/${m[2]}`, pi: 1 })],
  ];
  for (const [re, f] of forms) {
    const m = re.exec(si);
    if (!m) continue;
    const r = f(m);
    return r.q === undefined ? undefined : { q: r.q, pi: r.pi };
  }
  return undefined;
}

/** pint's dimensionality of a Find dimension key (rad is a pure number in pint). */
export function pintDims(dim: string): Record<string, number> {
  const names: Record<string, string> = { kg: "[mass]", m: "[length]", s: "[time]", A: "[current]", K: "[temperature]", mol: "[substance]", cd: "[luminosity]", bit: "[information]" };
  const out: Record<string, number> = {};
  for (const [, sym, pow] of dim.matchAll(/([A-Za-z]+)(-?\d+)/g)) {
    if (sym === "rad") continue;
    const n = names[sym as string];
    out[n ?? `?${sym}`] = (out[n ?? `?${sym}`] ?? 0) + Number(pow);
  }
  return out;
}

interface Case {
  what: string;
  name: string;
  q: string;
  pi: number;
  dims: Record<string, number>;
  offset?: string;
}

/** The cases: each table entry, each prefixed unit, each temperature (absolute and delta), each constant's SI text. */
export function cases(f: Factors): { cases: Case[]; problems: string[] } {
  const out: Case[] = [];
  const problems: string[] = [];
  const unit = (id: string): { si: string; dim: string } | undefined => {
    const u = f.units[id];
    if (!u || u.si === undefined) return problems.push(`unit ${id}: no exact factor in find/factors.yaml`), undefined;
    return { si: u.si, dim: u.dim };
  };
  const mul = (a: string, b: string): string => {
    const [an, ad = "1"] = a.split("/");
    const [bn, bd = "1"] = b.split("/");
    return `${BigInt(an as string) * BigInt(bn as string)}/${BigInt(ad) * BigInt(bd)}`;
  };
  for (const [id, name] of PY_UNITS) {
    const u = unit(id);
    if (!u) continue;
    const p = siParts(u.si);
    if (!p || p.offset !== undefined) {
      problems.push(`unit ${id}: its factor ${u.si} is not read here`);
      continue;
    }
    out.push({ what: `unit ${id}`, name, q: p.q, pi: p.pi, dims: pintDims(u.dim) });
    if (!PY_PREFIXED.has(id)) continue;
    for (const [pid, pfx] of PY_PREFIXES) {
      const ps = f.prefixes[pid]?.si;
      const pq = ps === undefined ? undefined : siParts(ps);
      if (!pq || pq.pi !== 0) {
        problems.push(`prefix ${pid}: no factor in find/factors.yaml`);
        continue;
      }
      out.push({ what: `unit ${pid}${id}`, name: `${pfx}${name}`, q: mul(pq.q, p.q), pi: p.pi, dims: pintDims(u.dim) });
    }
  }
  for (const id of PY_PREFIXED) if (!PY_UNITS.has(id)) problems.push(`unit ${id}: takes a prefix but is not in the table`);
  for (const [id, t] of PY_TEMPS) {
    const u = unit(id);
    const p = u && siParts(u.si);
    if (!u || !p || p.offset === undefined) {
      problems.push(`temperature ${id}: its factor ${u?.si} is no scale+offset`);
      continue;
    }
    out.push({ what: `temperature ${id}`, name: t.abs, q: p.q, pi: 0, dims: pintDims(u.dim), offset: p.offset });
    out.push({ what: `temperature interval ${id}`, name: t.delta, q: p.q, pi: 0, dims: pintDims(u.dim) });
  }
  for (const [id, dim] of PY_CONSTS) {
    const c = f.constants[id];
    if (!c) problems.push(`constant ${id}: not in find/factors.yaml`);
    else if (c.dim !== dim) problems.push(`constant ${id}: dimension ${dim}, find/factors.yaml ${c.dim}`);
    const text = pintDim(dim);
    if (text === undefined) problems.push(`constant ${id}: no SI text for ${dim}`);
    else out.push({ what: `constant ${id}`, name: text, q: "1", pi: 0, dims: pintDims(dim) });
  }
  return { cases: out, problems };
}

/** The Python that checks each case in a Fraction registry; one JSON line per case that fails. */
const CHECK = `
import json, sys, warnings
from fractions import Fraction
import pint
r = pint.UnitRegistry(non_int_type=Fraction)
PI = r.Quantity(Fraction(1), "pi").to_base_units().magnitude
for c in json.load(sys.stdin):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            u = r.Unit(c["name"])
        dims = {k: int(v) for k, v in u.dimensionality.items() if v}
        want = Fraction(c["q"]) * PI ** c["pi"]
        if dims != c["dims"]:
            print(json.dumps({"what": c["what"], "why": f"pint's {c['name']} has dimension {dims}, Find {c['dims']}"}))
            continue
        if "offset" in c:
            conv = r._units[str(u)].converter if str(u) in r._units else None
            got = (Fraction(conv.scale), Fraction(getattr(conv, "offset", 0))) if conv is not None else None
            if got != (want, Fraction(c["offset"])):
                print(json.dumps({"what": c["what"], "why": f"pint's {c['name']} is scale, offset {got}, Find {want}, {c['offset']}"}))
            continue
        got = r.Quantity(Fraction(1), u).to_base_units().magnitude
        if Fraction(got) != want:
            print(json.dumps({"what": c["what"], "why": f"pint's {c['name']} is {got} in SI, Find {want}"}))
    except Exception as e:
        print(json.dumps({"what": c["what"], "why": f"pint has no {c['name']}: {type(e).__name__}: {e}"}))
print(json.dumps({"done": True}))
`;

/** Runs the check; the problems, none when the table agrees with pint and Find. */
export function pyunitsCheck(py: string, factorsFile = join(repo, "find/factors.yaml")): { problems: string[]; checked: number } {
  const { cases: cs, problems } = cases(parse(readFileSync(factorsFile, "utf8")) as Factors);
  const r = spawnSync(py, ["-I", "-c", CHECK], { input: JSON.stringify(cs), encoding: "utf8", timeout: 120_000 });
  const lines = (r.stdout ?? "").split("\n").filter((l) => l.startsWith("{"));
  if (r.status !== 0 || !lines.some((l) => l.includes('"done"'))) problems.push(`the check did not run: ${(r.stderr ?? "").trim().split("\n").pop() ?? r.error?.message}`);
  for (const l of lines) {
    const o = JSON.parse(l) as { what?: string; why?: string };
    if (o.what) problems.push(`${o.what}: ${o.why}`);
  }
  return { problems, checked: cs.length };
}

async function main(): Promise<number> {
  const { venvPython } = await import("./pydiff.ts");
  const py = venvPython();
  if (!py) {
    console.log("PYUNITS FAILED: no tests/golden/.venv (tests/golden/README.md)");
    return 1;
  }
  const r = pyunitsCheck(py);
  for (const p of r.problems) console.log(`  pyunits: ${p}`);
  console.log(r.problems.length === 0 ? `PYUNITS PASSED: ${r.checked} entries` : `PYUNITS FAILED: ${r.problems.length} problems of ${r.checked} entries`);
  return r.problems.length === 0 ? 0 : 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main());
