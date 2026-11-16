// SPDX-License-Identifier: GPL-3.0-or-later
// bu hunt (night review 2026-11-16), finding bu-3: ☰ › Export › CSV and LaTeX (R200, writers G232: clipboard/text.ts
// sessionCsv :192-200, sessionLatex :226-240) read σ from a unit row only (`i.units?.unc?.text`, :196 and :234). A Home
// row with σ (an inexact constant or a chip with σ: facts.uncSigma, drawn as the σ line, state/sigmaLine.ts) gets an
// empty sigma column, while the work report (clipboard/workReport.ts:74-78 sigmaOf) and the uncertainty sheet (R327)
// both read that σ. The row below has the facts shape the engine gives a Home row with σ (constUnc.ts:200).
// Run: env -C <review worktree>/app npx vitest run --config <probes>/bu/vitest.config.mts --silent=false csv-sigma
import { decimalFromString, ZERO_VALUE } from "../../../../app/src/engine/format.ts";
import { sessionCsv, sessionLatex, sessionText, type CopySource } from "../../../../app/src/clipboard/text.ts";
import { sigmaText } from "../../../../app/src/state/sigmaLine.ts";
import type { DisplayContext } from "../../../../app/src/state/displayMode.ts";

const CTX: DisplayContext = { format: "std", digits: 12, fixDecimals: 4, angle: "rad" };
const facts = { exact: false, reliableDigits: null, uncSigma: "3.0e-15", uncDigits: 5 };
const row = {
  latex: "2\\times G",
  status: "done",
  view: "home",
  text: "1.33486E-10",
  full: "1.33486E-10",
  fullExact: false,
  value: { re: decimalFromString("1.33486e-10") ?? ZERO_VALUE, im: ZERO_VALUE },
  facts,
} as unknown as CopySource;

test("a Home row with σ in the exports", () => {
  console.log("σ line on screen:", sigmaText(facts as never, "std"));
  console.log("CSV:\n" + sessionCsv([row], {}, CTX));
  console.log("LaTeX:\n" + sessionLatex([row], {}, CTX, "probe"));
  console.log("Share session:\n" + sessionText([row], {}, CTX));
});
