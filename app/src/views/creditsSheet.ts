// SPDX-License-Identifier: GPL-3.0-or-later
// R149: the credits sheet, opened by Enter on the line N62 (entry/credits.ts). A lazy chunk with the About data
// (virtual:about, which builds THIRD_PARTY.md's parts at build time, so the list cannot drift): the story of the name,
// "Made with" and each part with its copyright line as THIRD_PARTY.md has it, then the licence and the web address.
import about from "virtual:about";
import type { AppShell } from "../apps/shell.svelte.ts";
import { aboutText as t } from "../i18n/enAbout.ts";
import { partLabel } from "./aboutItems.ts";
import type { CreditBlock } from "./sheet.svelte.ts";

export const SITE_URL = "https://n62.dev";

/** The credits' text: pure, so a test can read it. */
export function creditBlocks(parts: typeof about.parts): CreditBlock[] {
  return [
    { text: t("credits.story") },
    { heading: t("credits.madeWith") },
    ...parts.flatMap((p): CreditBlock[] => [{ heading: partLabel(p.name, p.version) }, ...(p.copyright ? [{ text: p.copyright }] : [])]),
    { text: t("credits.licence") },
    { text: SITE_URL },
  ];
}

/** The sheet over the keypad, as every ☰ list is (the shell's showMenu); no rows, so the root level reads the blocks. */
export function showCredits(shell: AppShell): void {
  shell.showMenu(t("credits.title"), [], { remember: false, credits: creditBlocks(about.parts) });
}
