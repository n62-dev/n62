// SPDX-License-Identifier: GPL-3.0-or-later
// bu hunt (night review 2026-11-16), finding bu-4: R325's Paste of a unit row's Copy text (clipboard/actions.svelte.ts
// pasteQuantity :227-246) puts a result chip (`\res{k}{…}`, entry/macros.ts:49) on any line that shows (shell.showsEntry),
// an app's too; R329's Shift + Vars takes the same path. An app's Enter reads the LaTeX alone (apps/types.ts:149
// `enter(view, latex)`), never the line's chip table. What the Function app's Symb and Num make of such a line, and what
// the plain-number Paste does with the same text (the path before R325 refused it as "not a number").
// Run: env -C <review worktree>/app npx vitest run --config <probes>/bu/vitest.config.mts --silent=false app-paste
import { compileDefinition } from "../../../../app/src/apps/function/compile.ts";
import { resChip } from "../../../../app/src/entry/macros.ts";
import { parsePastedNumber } from "../../../../app/src/clipboard/paste.ts";
import { quantityText } from "../../../../app/src/clipboard/pasteUnit.ts";

test("a pasted unit row in an app's line", () => {
  const clip = "20 m/s";
  console.log("plain paste:", JSON.stringify(parsePastedNumber(clip)), "| quantityText:", JSON.stringify(quantityText(clip)));
  const shown = "20\\,\\mathrm{m/s}";
  for (const latex of [resChip(0, shown), `${resChip(0, shown)}\\times x`]) {
    const c = compileDefinition(latex, "rad");
    console.log(`Function Symb ${latex} -> error: ${JSON.stringify(c.error)}`);
  }
});
