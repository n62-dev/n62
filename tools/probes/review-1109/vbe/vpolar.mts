// SPDX-License-Identifier: GPL-3.0-or-later
// sofia, verify be-10: a real Home result with ⚠ n and complex, then the polar form as cycleForms.computePolar builds it.
const A = new URL("../../../../app/src", import.meta.url).pathname;
const { EngineHost } = await import(`${A}/engine/host.ts`);
const { loadNodeGiac } = await import(`${A}/engine/nodeGiac.ts`);
const { defaultHomeSettings, precisionFacts } = await import(`${A}/engine/homeEval.ts`);
const { markOf, decimalToString } = await import(`${A}/engine/format.ts`);
const { renderNumeric, markFor } = await import(`${A}/state/displayMode.ts`);
const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const s = { ...defaultHomeSettings, digits: Number(process.env.DIG ?? 12), angle: "rad" as const };
const ctx = { format: "std", digits: Number(process.env.DIG ?? 12), fixDecimals: 4, decimalComma: false, angle: "rad", groupSep: "thin" };
for (const t of ['Gamma(0.5+i)','Zeta(0.5+14*i)','erf(1+i)','Psi(0.5+i)','(1+i)*erf(0.3)','(1+i)*Zeta(0.5)','(1+i)*Gamma(1.5)','(1+i)*normald_cdf(0.3)']) {
  const k = t;
  const r = host.home(t, s).result;
  if (!r.ok || !r.value) { console.log(k, "no value", r.display); continue; }
  const m = markOf(precisionFacts(r), { format: "STD", digits: Number(process.env.DIG ?? 12) });
  const z = `((${decimalToString(r.value.re)})+(${decimalToString(r.value.im)})*i)`;
  const a = host.home(`abs(${z})`, s).result, th = host.home(`arg(${z})`, s).result;
  const item = { value: r.value, facts: r.facts, polar: a.value && th.value ? { r: a.value.re, theta: th.value.re, angle: "rad" } : undefined };
  console.log(k, m?.mark, m?.n ?? "", "point:", renderNumeric(item as never, undefined, ctx as never)?.text, "polar:", renderNumeric(item as never, "polar", ctx as never)?.text, "markpolar", JSON.stringify(markFor(item as never, "polar", ctx as never)));
}
