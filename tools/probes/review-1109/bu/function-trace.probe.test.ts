// SPDX-License-Identifier: GPL-3.0-or-later
// bu: the Plot trace's y after the function or the angle unit changed; ▲▼ in Symb after Esc emptied the line.
const A = new URL("../../../../app/src", import.meta.url).pathname;
(globalThis as unknown as { document: unknown }).document = { documentElement: { dataset: {} } };
(globalThis as unknown as { MutationObserver: unknown }).MutationObserver = class { observe() {} };
const { FunctionApp } = await import(`${A}/apps/function/app.svelte.ts`);
const { AppShell } = await import(`${A}/apps/shell.svelte.ts`);
function harness() {
  const settings = { digits: 12, angle: "rad", format: "std", decimalMark: "point", groupSep: "thin" };
  const asked: string[] = [];
  const calc = {
    ready: async () => ({}),
    table: async (r: { fns: string[]; xs: string[] }, s: { angle: string }) => { asked.push(`${r.fns[0]}@${r.xs[0]}|${s.angle}`); return r.xs.map((x) => r.fns.map((f) => ({ ok: true, display: `${f}@${x}|${s.angle}`, facts: { exact: false, reliableDigits: 12 } }))); },
  };
  const host = { calc, kv: { get: async () => undefined, set: async () => {} }, get settings() { return settings; }, userNames: [], setEntry() {}, copy() {}, notice() {} };
  return { app: new FunctionApp(host as never), settings, asked };
}
const tick = () => new Promise((r) => setTimeout(r, 20));
test("redefine F1 at the same trace x", async () => {
  const { app, asked } = harness();
  app.define(0, "x^{2}");
  app.show("plot"); await tick();
  console.log("BEFORE", app.traceY?.display, "asked", asked.join(" ; "));
  app.define(0, "x^{2}+1");
  app.show("plot"); await tick();
  console.log("AFTER redefine", app.traceY?.display, "asked", asked.join(" ; "));
});
test("the angle unit changes at the same trace x", async () => {
  const { app, settings, asked } = harness();
  app.define(0, "\\sin\\left(x\\right)");
  app.trace.x = "0.1";
  app.show("plot"); await tick();
  console.log("RAD", app.traceY?.display);
  settings.angle = "deg"; // the status chip (StatusLine.svelte, session.setAngle)
  app.syncAngle(); // FunctionPlot.svelte's effect does this and only board.update()
  app.show("plot"); await tick();
  console.log("DEG after a view change too", app.traceY?.display, "asked", asked.join(" ; "));
});
test("Symb: Esc empties the line, then ▼", () => {
  let value = "";
  const entry = { get value() { return value; }, set(l: string) { value = l; }, clear() { value = ""; } };
  const calc = { ready: async () => ({}) };
  const kv = { get: async () => undefined, set: async () => {} };
  const s = { digits: 12, angle: "rad", format: "std", decimalMark: "point", groupSep: "thin" };
  const shell = new AppShell(calc as never, kv as never, entry, () => s as never);
  // the host the shell gives an app: setEntry records the base
  const host = (shell as unknown as { host(): { setEntry(l: string): void } }).host();
  const app = new FunctionApp({ ...host, calc, kv, settings: s, userNames: [] } as never);
  app.define(0, "x^{2}");
  shell.loaded = { function: { instance: app, Root: null } } as never;
  shell.app = "function"; shell.view = "symb"; shell.loading = null;
  host.setEntry(app.slots.latex[0]);
  console.log("loaded: edited", shell.entryEdited, "selected", app.slots.selected, "nav down", shell.nav("down"), "now", app.slots.selected);
  shell.nav("up");
  host.setEntry(app.slots.latex[app.slots.selected]);
  entry.clear(); // Esc on the line (route.ts escape → entry.clear)
  console.log("after Esc: line", JSON.stringify(value), "edited", shell.entryEdited, "nav down", shell.nav("down"), "selected", app.slots.selected);
});
