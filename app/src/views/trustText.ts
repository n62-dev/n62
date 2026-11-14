// SPDX-License-Identifier: GPL-3.0-or-later
// R174: the text of Settings › Help and about › Why trust it. Every number and every trap comes from `virtual:about`'s `trust`
// (tools/trust/facts.mts reads the golden files and the patch table at build time); the three sentences are A93's, word for
// word, from tools/trust/wording.mts, the same function README.md's section is generated with. No number is written here.
import { trustSentences } from "../../../tools/trust/wording.mts";
import { aboutText as t } from "../i18n/enAbout.ts";
import type { AboutData } from "./aboutData.svelte.ts";

type Trust = AboutData["trust"];

/** The three sentences as the page shows them: the README's, with the patch sentence's date from the data. */
export function trustParagraphs(trust: Trust): string {
  return trustSentences(trust, trust.patches.authorDate);
}

/** What N62 shows for a trap: its mark and value; a row with no mark is a refusal and says so. */
function shown(trap: Trust["traps"][number]): string {
  return trap.mark ? `${trap.mark} ${trap.expect}` : `${t("trust.refused")}: “${trap.expect}”`;
}

/** A trap as four lines. A label is markdown in the facts (backticks); the level is plain text. */
function trapLines(trap: Trust["traps"][number]): string {
  return [
    trap.label.replace(/`/g, ""),
    `${t("trust.n62")}: ${shown(trap)}`,
    `${t("trust.true")}: ${trap.truth}`,
    `${t("trust.double")}: ${trap.double}`,
  ].join("\n");
}

/** The whole level: the sentences, the traps, the caption. */
export function trustText(trust: Trust): string {
  return [trustParagraphs(trust), t("trust.traps"), ...trust.traps.map(trapLines), t("trust.note")].join("\n\n");
}
