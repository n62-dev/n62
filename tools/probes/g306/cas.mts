// SPDX-License-Identifier: GPL-3.0-or-later
// G306 probe: the CAS view's text, mark and error for typed Giac inputs (12 digits, RAD).
//   node tools/probes/g306/cas.mts 'ln(x^2)' 'surd(sin(10^70),3)'
const W = new URL("../../../app/src", import.meta.url).pathname;
const { nodeHost } = await import(`${W}/engine/nodeGiac.ts`);
const { defaultCasSettings } = await import(`${W}/engine/types.ts`);
const h = await nodeHost();
for (const g of process.argv.slice(2)) {
  const r = h.cas(g, { ...defaultCasSettings }).result as { ok: boolean; text?: string; error?: string; mark?: string; facts?: unknown };
  console.log(`${g} => ${r.ok ? r.text : `error ${r.error}`} ${JSON.stringify(r.facts ?? null).slice(0, 120)}`);
}
