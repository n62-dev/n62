// SPDX-License-Identifier: GPL-3.0-or-later
// S51: which rows of THIRD_PARTY.md ship in the app, and does docs/research/ios-rights.md have a row for each?
// Shipped = the maths engine's table, the theme palettes, and every other row whose Notes or Use column says it ships
// ("(shipped", "ships in"; libqalculate's data); the toolchain, deploy and build-only rows do not. Read-only.
//   node tools/probes/ios-rights-rows.ts          (exit 1 when a shipped row has no row in the note)
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseThirdParty } from "../third-party/parse.mts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const parts = parseThirdParty(readFileSync(join(root, "THIRD_PARTY.md"), "utf8"));
const note = readFileSync(join(root, "docs/research/ios-rights.md"), "utf8").replace(/`/g, "");
const tableRows = note.split("\n").filter((l) => l.startsWith("| "));

const ships = (p: (typeof parts)[number]): boolean =>
  p.group.startsWith("Maths engine") || p.group.startsWith("Theme colours") ||
  (/\(shipped|ships in/i.test(p.note) && !/not shipped/i.test(p.note));

let missing = 0;
for (const p of parts.filter(ships)) {
  const key = p.name.replace(/`/g, "").replace(/\s*\(.*$/, "").trim();
  const row = tableRows.find((l) => l.split("|")[1]?.includes(key));
  if (!row) missing++;
  console.log(`${row ? "ok     " : "MISSING"} ${key} | ${p.licence} | ${p.group}`);
}
console.log(missing === 0 ? "every shipped row has a row in the note" : `${missing} shipped rows lack a row in the note`);
process.exit(missing === 0 ? 0 : 1);
