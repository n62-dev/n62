// SPDX-License-Identifier: GPL-3.0-or-later
// Run from the checkout: env -C app npx vitest run -c ../tools/probes/review-1116/vr.vitest.config.mts
it("probe", async () => {
// vr (night review 2026-11-16): R128's SyncFolder remembers what it wrote per file name, not per folder. After Choose
// folder picks another folder (live.ts keeps one SyncFolder per page; pickFolder does not reset it), Write now finds
// "nothing changed" and the new folder gets no file until the data changes.
const SRC = new URL("../../../app/src", import.meta.url).pathname;
const { SyncFolder } = await import(`${SRC}/sync/backupSync.ts`);
const { memKv } = await import(`${SRC}/sync/fakeFolder.ts`);
const { DATA_VERSION } = await import(`${SRC}/state/storage.ts`);

const folders = { one: new Map<string, string>(), two: new Map<string, string>() };
let chosen: keyof typeof folders = "one";
const dir = () => folders[chosen];
const port = {
  name: async () => ({ name: chosen }),
  list: async () => [...dir()].map(([name, text]) => ({ name, size: text.length, modified: 0 })),
  read: async (name: string) => (dir().has(name) ? { text: dir().get(name) as string } : "missing"),
  write: async (name: string, text: string) => (dir().set(name, text), "written"),
  model: async () => "PhoneA",
};
const store = new Map([["settings", { "@n62": DATA_VERSION, value: { digits: 12 } }]]);
const page = new SyncFolder({ folder: port, kv: memKv(), raw: async (k: string) => store.get(k), counts: () => undefined, library: async () => undefined, now: () => new Date(), random: () => 0.5 });
console.log("folder one, Write now:", JSON.stringify(await page.leave()), "files in one:", [...folders.one.keys()]);
chosen = "two"; // Settings › Data › Sync folder › Choose folder: another folder
console.log("folder two, Write now:", JSON.stringify(await page.leave()), "files in two:", [...folders.two.keys()]);
}, 60_000);
