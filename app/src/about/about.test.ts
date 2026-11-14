// SPDX-License-Identifier: GPL-3.0-or-later
// R87: the About screen's list is THIRD_PARTY.md's tables, the licence texts are LICENSES/, the version is
// package.json's; no UI string names the reference calculator (rules-core.md, "Legal / clean room").
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import about from "virtual:about";
import { aboutPlugin } from "../../vite-plugin-about.ts";
import { AUTHOR_SOURCE_DATE, aboutTrust, goldenFacts, patchFacts, trapTable, trustFacts, type TrustFacts } from "../../../tools/trust/facts.mts";
import { trustText } from "../views/trustText.ts";
import { en } from "../i18n/en.ts";
import { enAbout } from "../i18n/enAbout.ts";
import { enEngine } from "../i18n/enEngine.ts";
import { enFind } from "../i18n/enFind.ts";
import { enPalettes } from "../i18n/enPalettes.ts";
import { enParser } from "../i18n/enParser.ts";
import { enUnits } from "../i18n/enUnits.ts";

const ROOT = new URL("../../../", import.meta.url);
const read = (p: string): string => readFileSync(new URL(p, ROOT), "utf8");

/** Every data row of THIRD_PARTY.md's tables, read here on its own (not with the parser under test): its cells by
 *  the header they sit under. */
function tableRows(): { name: string; version: string; licence: string; copyright: string }[] {
  const rows: { name: string; version: string; licence: string; copyright: string }[] = [];
  let head: string[] | null = null;
  for (const line of read("THIRD_PARTY.md").split("\n")) {
    if (!line.startsWith("|")) {
      head = null;
      continue;
    }
    const c = line.split("|").slice(1, -1).map((x) => x.trim());
    if (head === null) head = c.map((h) => h.toLowerCase());
    else if (!/^[\s:-]+$/.test(c[0] ?? "")) {
      const col = (n: string): string => c[head?.indexOf(n) ?? -1] ?? "";
      rows.push({ name: c[0] as string, version: col("version"), licence: col("licence"), copyright: col("copyright") === "–" ? "" : col("copyright") });
    }
  }
  return rows;
}

describe("About data", () => {
  it("lists every row of THIRD_PARTY.md's tables with its version, licence and copyright line", () => {
    const rows = tableRows();
    expect(rows.length).toBeGreaterThan(30);
    expect(about.parts.length).toBe(rows.length);
    for (const r of rows) {
      const p = about.parts.find((x) => x.name === r.name);
      expect(p, r.name).toBeDefined();
      expect(p?.version, r.name).toBe(r.version);
      expect(p?.licence, r.name).toBe(r.licence);
      expect(p?.copyright, r.name).toBe(r.copyright);
    }
  });

  it("carries the app's version from package.json", () => {
    expect(about.version).toBe((JSON.parse(read("app/package.json")) as { version: string }).version);
  });

  it("carries one text per file of LICENSES/, and a text for every licence of the table that has a file", () => {
    const files = readdirSync(new URL("LICENSES/", ROOT)).filter((f) => f.endsWith(".txt")).map((f) => f.slice(0, -4));
    expect(Object.keys(about.licences).sort()).toEqual(files.sort());
    for (const id of files) expect(about.licences[id], id).toBe(read(`LICENSES/${id}.txt`));
    const named = new Set(about.parts.flatMap((p) => p.ids));
    for (const id of ["GPL-3.0-or-later", "GPL-2.0-or-later", "LGPL-3.0-or-later", "MIT", "Apache-2.0", "OFL-1.1"]) {
      expect(named.has(id), id).toBe(true);
      expect(about.licences[id]?.length, id).toBeGreaterThan(500);
    }
  });

  it("splits 'A OR B' and 'A / B' into licences", () => {
    expect(about.parts.find((p) => p.name === "GMP")?.ids).toEqual(["LGPL-3.0-or-later", "GPL-2.0-or-later"]);
    expect(about.parts.find((p) => p.name === "JSXGraph")?.ids).toEqual(["MIT", "LGPL-3.0-or-later"]);
  });
});

/** Every key of every object, in the order they sit in the text, is sorted: two builds give the same bytes. */
function sortedKeys(v: unknown): boolean {
  if (Array.isArray(v)) return v.every(sortedKeys);
  if (v === null || typeof v !== "object") return true;
  const keys = Object.keys(v);
  return keys.every((k, i) => i === 0 || (keys[i - 1] as string) < k) && Object.values(v).every(sortedKeys);
}

describe("About trust facts (A94)", () => {
  const g = goldenFacts(), p = patchFacts();

  it("carries the golden counts and the patch counts of tools/trust/facts.mts", () => {
    expect(about.trust.golden).toEqual({
      answers: g.answers, open: g.open, computed: g.computed, exact: g.exact, mpmath: g.mpmath, crossChecked: g.crossChecked, handOrGuard: g.handOrGuard,
    });
    expect(about.trust.patches).toEqual({ total: p.total, sent: p.sent, reported: p.reported, applied: p.applied, waiting: p.waiting, notSent: p.notSent, authorDate: AUTHOR_SOURCE_DATE });
    expect(about.trust.golden.answers).toBeGreaterThan(1000);
    expect(about.trust.patches.total).toBeGreaterThan(5);
  });

  it("carries the five traps with the input, expect and mark of their golden rows", () => {
    expect(about.trust.traps.map((t) => t.id)).toEqual(["trust-rump-12", "trust-cos-12", "trust-limit-12", "trust-ramanujan-30", "g39-int-1/x-pv"]);
    for (const t of about.trust.traps) {
      const row = g.traps[t.id];
      expect(row, t.id).toBeDefined();
      expect(t.expect, t.id).toBe(row?.expect);
      expect(t.mark, t.id).toBe(row?.mark);
      expect(t.input, t.id).toBe(row?.input);
      expect(t.input.length, t.id).toBeGreaterThan(0);
      expect(t.truth.length, t.id).toBeGreaterThan(0);
      expect(t.double.length, t.id).toBeGreaterThan(0);
    }
    expect(about.trust.traps[0]?.truth).toBe("-54767/66192");
  });

  it("holds no clock, no path and no host: sorted keys, and one text on every load", async () => {
    expect(sortedKeys(about.trust)).toBe(true);
    const text = JSON.stringify(about);
    expect(text).not.toContain(process.cwd());
    expect(text).not.toContain(ROOT.pathname);
    const plugin = aboutPlugin();
    const load = (): unknown => (plugin.load as (this: { addWatchFile: (f: string) => void }, id: string) => unknown).call({ addWatchFile: () => undefined }, "\0virtual:about");
    const a = load(), b = load();
    expect(typeof a).toBe("string");
    expect(a).toBe(b);
  });

  it("watches the golden files, oracle-counts.json, the patches README and the patch files", () => {
    const watched: string[] = [];
    (aboutPlugin().load as (this: { addWatchFile: (f: string) => void }, id: string) => unknown).call({ addWatchFile: (f) => watched.push(f) }, "\0virtual:about");
    const rel = watched.map((f) => f.slice(ROOT.pathname.length));
    for (const f of ["tests/golden/home.yaml", "tests/golden/precision.yaml", "tests/golden/units.yaml", "tests/golden/solve.yaml", "tests/golden/function.yaml", "tests/golden/oracle-counts.json", "engine/giac/patches/README.md"])
      expect(rel, f).toContain(f);
    for (const f of p.files) expect(rel, f).toContain(`engine/giac/patches/${f}`);
  });
});

/** The N62 cell of each row of README's trap table, and the N62 line of each trap on the page, in trap order. */
function n62Cells(f: TrustFacts): { table: string[]; page: string[] } {
  const table = trapTable(f).split("\n").slice(2).map((l) => (l.split(/ \| /)[1] ?? "").trim());
  const page = trustText(aboutTrust(f)).split("\n").filter((l) => l.startsWith("N62: ")).map((l) => l.slice(5));
  return { table, page };
}
/** The README's markdown quotes and the page's curly quotes are one style argument: compare without them. */
const plainQuotes = (s: string): string => s.replace(/[“”"]/g, "'");

describe("About trust page and README (R174f1): one rule for what N62 shows", () => {
  const facts = trustFacts();
  /** The facts with every trap's golden mark set by `mark(id)`. */
  const withMarks = (mark: (id: string) => string): TrustFacts => ({
    ...facts,
    golden: { ...facts.golden, traps: Object.fromEntries(Object.entries(facts.golden.traps).map(([id, r]) => [id, { ...r, mark: mark(id) }])) },
  });

  it("gives the README's N62 cell and the page's N62 line the same mark and value for the five traps", () => {
    const { table, page } = n62Cells(facts);
    expect(table).toHaveLength(5);
    expect(page.map(plainQuotes)).toEqual(table.map(plainQuotes));
  });

  it("follows the golden mark in both: a mark shows mark and value, no mark is a refusal, whatever the trap", () => {
    for (const mark of [(id: string) => (id === "g39-int-1/x-pv" ? "≈" : ""), (id: string) => (id === "trust-cos-12" ? "=" : id === "trust-rump-12" ? "" : "≈")]) {
      const { table, page } = n62Cells(withMarks(mark));
      expect(page.map(plainQuotes)).toEqual(table.map(plainQuotes));
    }
    const { table } = n62Cells(withMarks((id) => (id === "g39-int-1/x-pv" ? "≈" : "")));
    expect(table[4]).toMatch(/^≈ /);
    expect(table[0]).toMatch(/^refused: /);
  });
});

describe("UI strings", () => {
  it("never name HP or Prime as a word", () => {
    const tables = { en, enAbout, enEngine, enFind, enPalettes, enParser, enUnits } as Record<string, Record<string, string>>;
    for (const [table, messages] of Object.entries(tables))
      for (const [key, text] of Object.entries(messages)) expect(/\b(HP|Prime)\b/.test(text), `${table}.${key}`).toBe(false);
  });
});
