// SPDX-License-Identifier: GPL-3.0-or-later
// A93: `trust:check` compares README.md's "Why trust it" section and tests/golden/README.md's table with the files (exit 1 on
// anything stale; no Python); `trust:refresh` runs oracle.py --counts (G202) and rewrites both. Fresh at the tag only: it is
// no stage of `npm run gate`. TRUST_SKIP_ORACLE=1 skips the oracle step (the tests, which have no Python).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { goldenFacts, oraclePython, rewriteGoldenReadme, rewriteReadme, trustFacts, trustProblems } from "./facts.mts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const command = process.argv[2];

if (command === "check") {
  const problems = trustProblems(root);
  for (const p of problems) console.error(`trust: ${p}`);
  console.log(problems.length === 0 ? "trust:check ok" : `trust:check: ${problems.length} stale (npm run trust:refresh)`);
  process.exit(problems.length === 0 ? 0 : 1);
} else if (command === "refresh") {
  if (process.env["TRUST_SKIP_ORACLE"] !== "1") {
    const run = spawnSync(oraclePython(root), [join(root, "tests", "golden", "oracle.py"), "--counts"], { cwd: root, stdio: "inherit" });
    if (run.status !== 0) {
      console.error("trust:refresh: oracle.py --counts failed (venv: tests/golden/README.md)");
      process.exit(1);
    }
  }
  const goldenReadme = join(root, "tests", "golden", "README.md");
  writeFileSync(goldenReadme, rewriteGoldenReadme(readFileSync(goldenReadme, "utf8"), goldenFacts(root)));
  const readme = join(root, "README.md");
  writeFileSync(readme, rewriteReadme(readFileSync(readme, "utf8"), trustFacts(root)));
  const problems = trustProblems(root);
  for (const p of problems) console.error(`trust: ${p}`);
  console.log(problems.length === 0 ? "trust:refresh ok" : `trust:refresh: ${problems.length} problem(s) a rewrite cannot fix`);
  process.exit(problems.length === 0 ? 0 : 1);
} else {
  console.error("usage: cli.mts check|refresh");
  process.exit(2);
}
