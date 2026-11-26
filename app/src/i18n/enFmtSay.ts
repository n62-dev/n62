// SPDX-License-Identifier: GPL-3.0-or-later
// R871: the texts of "Say the format" (Settings › Numbers › Fmt key cycle) and of the notice a Fmt press then shows. A table of
// its own, loaded with the Fmt key's code (state/cycleForms.ts) and the Mode sheet's chunk, so the start chunk does not carry it.
// The notation words are the short forms of the cycle's ticks (settings.fmt.*): a notice is read at a glance. English only so far.
export const enFmtSay = {
  "fmtSay.row": "Say the format on each Fmt press",
  "fmtSay.notice": "{mode} · this result",
  "fmtSay.std": "Std",
  "fmtSay.sci": "Sci",
  "fmtSay.eng": "Eng",
  "fmtSay.pfx": "Pfx",
  "fmtSay.fix": "Fix",
  /** CAS: the cycle back at the exact result. */
  "fmtSay.exact": "Exact",
} as const;

export type FmtSayKey = keyof typeof enFmtSay;

export const fmtSayText = (key: FmtSayKey, vars: Readonly<Record<string, string>> = {}): string =>
  enFmtSay[key].replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
