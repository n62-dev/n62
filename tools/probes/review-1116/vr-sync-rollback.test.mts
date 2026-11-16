// SPDX-License-Identifier: GPL-3.0-or-later
// Run from the checkout: env -C app npx vitest run -c ../tools/probes/review-1116/vr.vitest.config.mts
it("probe", async () => {
// vr (night review 2026-11-16): R128's start look ranks another device's backup only against the last one this device
// read, never against this device's own newer backup. Two devices A and B, one folder, both "Restore silently".
const SRC = new URL("../../../app/src", import.meta.url).pathname;
const { SyncFolder } = await import(`${SRC}/sync/backupSync.ts`);
const { memKv } = await import(`${SRC}/sync/fakeFolder.ts`);
const { patchSync } = await import(`${SRC}/sync/record.ts`);
const { DATA_VERSION } = await import(`${SRC}/state/storage.ts`);

const files = new Map<string, string>();
const port = (model: string) => ({
  name: async () => ({ name: "Sync" }),
  list: async () => [...files].map(([name, text]) => ({ name, size: text.length, modified: 0 })),
  read: async (name: string) => (files.has(name) ? { text: files.get(name) as string } : "missing"),
  write: async (name: string, text: string) => (files.set(name, text), "written"),
  model: async () => model,
});
const rec = (value: unknown) => ({ "@n62": DATA_VERSION, value });
let clock = "";
function device(model: string, digits: number, r: number) {
  const store = new Map([["settings", rec({ digits })]]);
  const kv = memKv();
  const host = { folder: port(model), kv, raw: async (k: string) => store.get(k), counts: () => undefined, library: async () => undefined, now: () => new Date(clock), random: () => r };
  return { store, kv, host, page: new SyncFolder(host) };
}
const digitsOf = (d: { store: Map<string, unknown> }) => JSON.stringify(d.store.get("settings"));
const ui = (d: ReturnType<typeof device>, who: string) => ({
  offer: (f: { device: string; made: string }) => console.log(`${who}: OFFER "A newer backup from ${f.device}, made ${f.made}"`),
  apply: async (f: { device: string; made: string }, c: { parts: Record<string, unknown> }) => {
    console.log(`${who}: APPLY silently the backup from ${f.device} made ${f.made}`);
    for (const [k, v] of Object.entries(c.parts)) d.store.set(k, (v && typeof v === "object" && "@n62" in v ? v : rec(v)) as never); // restoreParts, then reload
  },
  refused: (_f: unknown, why: string) => console.log(`${who}: refused ${why}`),
});

const A = device("PhoneA", 12, 0.1);
const B = device("PhoneB", 9, 0.9);
await patchSync(A.kv, { mode: "silent" });
await patchSync(B.kv, { mode: "silent" });

clock = "2026-11-16T11:00:00Z"; await B.page.leave(); console.log("11:00 B leaves (digits 9)");
clock = "2026-11-16T12:00:00Z"; await A.page.leave(); console.log("12:00 A leaves (digits 12)");
clock = "2026-11-16T12:10:00Z"; await new SyncFolder(B.host).onStart(ui(B, "12:10 B start"));
clock = "2026-11-16T12:30:00Z"; await new SyncFolder(B.host).leave(); console.log(`12:30 B leaves (digits ${digitsOf(B)})`);
A.store.set("settings", rec({ digits: 5 })); // A's newer work
clock = "2026-11-16T13:00:00Z"; await A.page.leave(); console.log("13:00 A changes Digits to 5 and leaves (its own file: digits 5, made 13:00)");
clock = "2026-11-16T14:00:00Z"; await new SyncFolder(A.host).onStart(ui(A, "14:00 A start"));
console.log(`A's Digits now: ${digitsOf(A)} (its own work of 13:00 was digits 5)`);
for (const [n, t] of files) console.log(`  ${n}: made ${JSON.parse(t).made}`);
}, 60_000);
