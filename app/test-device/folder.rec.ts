// SPDX-License-Identifier: GPL-3.0-or-later
// A65 step 1: can the app keep a folder? On the device's WebView (the test build, build.sh --test), attached over adb:
// pick a test folder once in the system folder picker (ACTION_OPEN_DOCUMENT_TREE), write n62-test.txt, kill the app,
// start it again, read the file back and list the folder with no dialog; another writer (adb shell, as Syncthing writes:
// straight to the file system) changes the file and adds one, the app reads the change; the folder removed → unavailable,
// never a throw; forget() → unavailable. Also the time of a 2 MB write (the backup's worst case), median of 5.
// A100: append ("wa") adds to the end byte-exact (a, b, c → "a\nb\nc\n"), never truncating; deviceModel() is Build.MODEL.
// Run by hand under the device lock (annabell; docs/shifts/rules.md section 5):
//   tools/devlock.sh acquire HA24BZ2Y <name> 1800 && (cd app && npx playwright test -c playwright.folder.config.ts);
//   tools/devlock.sh release HA24BZ2Y <name>
// It clears our app's data first (pm clear) and removes its test folder at the end. Prints one "A65 ..." line per step.
// A137: write() replaces a file whole. With the test build's seams (failAfter: an I/O error after n bytes; stallAfter: a
// 20 s pause after n bytes; stallAt: a 20 s pause after the check or between the two renames; failAt "rename": an I/O
// error in place of the second rename, the old file then put back whole) and kills (am force-stop),
// also at a sweep of times into a 2 MB write, the file under its real name is the old text or the new one, never a cut
// file; between the renames it is missing, read() then gives the new text and the next write puts it back; list() never
// shows the staged names (.n62-new~, .n62-old~) and the next write removes any a kill left.
// A101: tail() gives a file's last n bytes (by a seek; the noSeek seam reads the stream path), and appendChecked (the
// app's own code, run here on the device's append and tail) puts a torn last line (no final \n) alone on its line,
// with both new lines whole after it.
import { createHash } from "node:crypto";
import { _android as android, expect, test, type AndroidDevice, type Page } from "@playwright/test";
import { appendChecked, type AppendPort } from "../src/clipboard/folder.ts";

const PKG = "dev.n62.calc"; // our app only (docs/shifts/rules.md section 3)
const DIR = "n62-sync-test";
const PATH = `/sdcard/Download/${DIR}`;

let device: AndroidDevice;

type Answer = { result: string; [k: string]: unknown };
async function call(page: Page, method: string, options: object = {}): Promise<Answer> {
  return page.evaluate(
    ([m, o]) => (window as unknown as { Capacitor: { nativePromise(p: string, m: string, o: object): Promise<Answer> } }).Capacitor.nativePromise("N62Files", m as string, o as object),
    [method, options] as const,
  );
}

async function launch(): Promise<Page> {
  await device.shell(`am start -n ${PKG}/.MainActivity`);
  const view = await device.webView({ pkg: PKG }, { timeout: 30_000 });
  const page = await view.page();
  await page.waitForFunction(() => (window as unknown as { Capacitor?: { isPluginAvailable(n: string): boolean } }).Capacitor?.isPluginAvailable("N62Files") === true, undefined, { timeout: 30_000 });
  return page;
}

/** Taps the first node whose text or content-desc matches, from a uiautomator dump (DocumentsUI's ids differ by vendor). */
async function tapText(re: RegExp, timeoutMs = 15_000): Promise<string> {
  const end = Date.now() + timeoutMs;
  const num = (s: string | undefined): number => Number(s ?? 0);
  while (Date.now() < end) {
    const xml = (await device.shell("uiautomator dump /dev/tty")).toString();
    for (const m of xml.matchAll(/<node [^>]*?>/g)) {
      const node = m[0];
      const text = /\btext="([^"]*)"/.exec(node)?.[1] ?? "";
      const desc = /content-desc="([^"]*)"/.exec(node)?.[1] ?? "";
      const label = re.test(text) ? text : re.test(desc) ? desc : null;
      const b = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node);
      if (label !== null && b) {
        const [x, y] = [(num(b[1]) + num(b[3])) >> 1, (num(b[2]) + num(b[4])) >> 1];
        await device.shell(`input tap ${x} ${y}`);
        return label;
      }
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(`no node matching ${re}`);
}

function log(s: string): void {
  console.log(`A65 ${s}`);
}

test.beforeAll(async () => {
  const devices = await android.devices();
  const serial = process.env.ANDROID_SERIAL;
  const d = devices.find((x) => serial === undefined || x.serial() === serial);
  if (!d) throw new Error(`no device ${serial ?? ""}`);
  device = d;
});

test.afterAll(async () => {
  await device?.shell(`am force-stop ${PKG}`).catch(() => undefined);
  await device?.shell(`rm -rf ${PATH}`).catch(() => undefined);
  await device?.close().catch(() => undefined);
});

test("A65 sync folder on the device", async () => {
  test.setTimeout(900_000);
  log(`device ${device.serial()} ${device.model()}; ${(await device.shell("getprop ro.build.version.release")).toString().trim()}`);
  await device.shell(`rm -rf ${PATH}; mkdir -p ${PATH}`);
  await device.shell(`pm clear ${PKG}`);
  let page = await launch();
  expect(await call(page, "folder")).toEqual({ result: "unavailable" });
  expect(await call(page, "write", { name: "n62-test.txt", text: "x" })).toEqual({ result: "unavailable" });
  expect(await call(page, "append", { name: "n62-test.txt", text: "x" })).toEqual({ result: "unavailable" });
  expect(await call(page, "tail", { name: "n62-test.txt", n: 1 })).toEqual({ result: "unavailable" });
  log("no folder yet: folder, write, append, tail unavailable");

  // the one pick: the system folder picker, Downloads, the test folder, "Use this folder", "Allow"
  await page.evaluate(() => {
    const w = window as unknown as { __pick: Promise<Answer>; Capacitor: { nativePromise(p: string, m: string, o: object): Promise<Answer> } };
    w.__pick = w.Capacitor.nativePromise("N62Files", "pickFolder", {});
  });
  await new Promise((r) => setTimeout(r, 2500));
  log(`picker: ${(await device.shell("dumpsys activity activities | grep -m1 topResumedActivity")).toString().trim()}`);
  // it opens at the last place or at the storage root (the Tab One: "LTO", with Download among its folders)
  try {
    await tapText(new RegExp(`^${DIR}$`), 3000);
  } catch {
    try {
      await tapText(/^Downloads?$/, 3000);
    } catch {
      await tapText(/^Show roots$/i);
      await tapText(/^Downloads?$/);
    }
    await tapText(new RegExp(`^${DIR}$`));
  }
  await tapText(/^use this folder$/i);
  await tapText(/^allow$/i);
  const picked = await page.evaluate(() => (window as unknown as { __pick: Promise<Answer> }).__pick);
  expect(picked).toEqual({ result: "picked", name: DIR });
  log(`picked: ${JSON.stringify(picked)}`);

  const text = "N62 sync folder test ∑ é 1.5e-3\n";
  expect(await call(page, "write", { name: "n62-test.txt", text })).toEqual({ result: "written" });
  expect((await device.shell(`cat ${PATH}/n62-test.txt`)).toString()).toBe(text);
  log("written: the shell reads the same UTF-8 bytes");

  // kill the app; start it again; nothing asks
  await device.shell(`am force-stop ${PKG}`);
  page = await launch();
  expect(await call(page, "folder")).toEqual({ result: "ok", name: DIR });
  expect(await call(page, "read", { name: "n62-test.txt" })).toEqual({ result: "ok", text });
  const listed = await call(page, "list");
  expect(listed.result).toBe("ok");
  expect((listed.files as { name: string }[]).map((f) => f.name)).toEqual(["n62-test.txt"]);
  log(`after force-stop and start: folder ok, read the same text, list ${JSON.stringify(listed.files)}`);

  // replace: the same file, no "(1)" copy
  expect(await call(page, "write", { name: "n62-test.txt", text: "short\n" })).toEqual({ result: "written" });
  expect((await device.shell(`ls -1 ${PATH}`)).toString().trim()).toBe("n62-test.txt");
  expect((await device.shell(`cat ${PATH}/n62-test.txt`)).toString()).toBe("short\n");
  log("replace: one file, truncated to the new text");

  // A100: append opens "wa": the bytes go to the end, nothing before them is rewritten
  expect(await call(page, "write", { name: "n62-append.txt", text: "a\n" })).toEqual({ result: "written" });
  expect(await call(page, "append", { name: "n62-append.txt", text: "b\n" })).toEqual({ result: "appended", before: 2, after: 4 });
  expect(await call(page, "append", { name: "n62-append.txt", text: "c\n" })).toEqual({ result: "appended", before: 4, after: 6 });
  expect((await device.shell(`cat ${PATH}/n62-append.txt`)).toString()).toBe("a\nb\nc\n");
  expect(await call(page, "read", { name: "n62-append.txt" })).toEqual({ result: "ok", text: "a\nb\nc\n" });
  const fresh = await call(page, "append", { name: "n62-append-new.txt", text: "∑ é\n" });
  expect(fresh).toEqual({ result: "appended", before: 0, after: 7 });
  expect((await device.shell(`cat ${PATH}/n62-append-new.txt`)).toString()).toBe("∑ é\n");
  log("A100 append: a, b, c read back a\\nb\\nc\\n byte-exact (sizes 2→4→6); a missing file is created (0→7)");
  const model = await call(page, "deviceModel");
  expect(model).toEqual({ result: "ok", model: (await device.shell("getprop ro.product.model")).toString().trim() });
  log(`A100 deviceModel: ${JSON.stringify(model)}`);
  await device.shell(`rm -f ${PATH}/n62-append.txt ${PATH}/n62-append-new.txt`);
  await a101(page);

  // another writer changes the file and adds one
  await device.shell(`echo changed-outside > ${PATH}/n62-test.txt; echo other > ${PATH}/from-outside.json; mkdir ${PATH}/sub`);
  expect(await call(page, "read", { name: "n62-test.txt" })).toEqual({ result: "ok", text: "changed-outside\n" });
  const names = ((await call(page, "list")).files as { name: string }[]).map((f) => f.name).sort();
  expect(names).toEqual(["from-outside.json", "n62-test.txt"]);
  expect(await call(page, "read", { name: "none.txt" })).toEqual({ result: "missing" });
  log(`outside change read back; list ${JSON.stringify(names)} (the sub-folder left out); missing file: missing`);

  // a new file, created by the app, keeps its own name and extension
  expect(await call(page, "write", { name: "n62-backup-2026-11-07.json", text: "{}" })).toEqual({ result: "written" });
  expect((await device.shell(`ls -1 ${PATH}`)).toString()).toContain("n62-backup-2026-11-07.json\n");
  log("new .json file created under its own name");

  // the backup's worst case: 2 MB of text, written 5 times
  const ms = await page.evaluate(async () => {
    const cap = (window as unknown as { Capacitor: { nativePromise(p: string, m: string, o: object): Promise<Answer> } }).Capacitor;
    const big = "{\"x\":\"" + "é∑abcdef".repeat(2_000_000 / 10) + "\"}";
    const out: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      await cap.nativePromise("N62Files", "write", { name: "big.json", text: big });
      out.push(performance.now() - t);
    }
    const r = await cap.nativePromise("N62Files", "read", { name: "big.json" });
    return { out, same: r.text === big, bytes: new TextEncoder().encode(big).length };
  });
  const sorted = [...ms.out].sort((a, b) => a - b);
  expect(ms.same).toBe(true);
  log(`2 MB write (${ms.bytes} bytes): median ${(sorted[2] ?? 0).toFixed(0)} ms of 5 [${ms.out.map((x) => x.toFixed(0)).join(", ")}]; read back equal`);

  await a137(page);
  page = await launch();

  // the folder removed: unavailable, never a throw
  await device.shell(`rm -rf ${PATH}`);
  const gone: { folder: Answer; write: Answer; append: Answer; tail: Answer; read: Answer; list: Answer } = {
    folder: await call(page, "folder"),
    write: await call(page, "write", { name: "a.txt", text: "x" }).catch((e: Error) => ({ result: `rejected: ${e.message}` })),
    append: await call(page, "append", { name: "a.txt", text: "x" }).catch((e: Error) => ({ result: `rejected: ${e.message}` })),
    tail: await call(page, "tail", { name: "a.txt", n: 1 }).catch((e: Error) => ({ result: `rejected: ${e.message}` })),
    read: await call(page, "read", { name: "a.txt" }).catch((e: Error) => ({ result: `rejected: ${e.message}` })),
    list: await call(page, "list").catch((e: Error) => ({ result: `rejected: ${e.message}` })),
  };
  log(`folder removed: ${JSON.stringify(gone)}`);
  expect(gone.folder.result).toBe("unavailable");
  expect(gone.write.result).toBe("unavailable");
  expect(gone.append.result).toBe("unavailable");
  expect(gone.tail.result).toBe("unavailable");
  expect(gone.read.result).toBe("unavailable");
  expect(gone.list.result).toBe("unavailable");

  // forget gives the grant back
  await device.shell(`mkdir -p ${PATH}`);
  expect(await call(page, "forget")).toEqual({ result: "ok" });
  expect(await call(page, "folder")).toEqual({ result: "unavailable" });
  log("forget: folder unavailable");
});

const md5 = (t: string): string => createHash("md5").update(t, "utf8").digest("hex");
/** The device's md5 of the file, or "missing". */
async function shellMd5(name: string): Promise<string> {
  const out = (await device.shell(`[ -f ${PATH}/${name} ] && md5sum ${PATH}/${name} || echo missing`)).toString().trim();
  return out.split(/\s+/)[0] ?? "missing";
}
/** Every name in the folder that is not one of `keep`, the hidden ones included (the staged names, a "(1)" copy). */
async function strays(keep: string[]): Promise<string[]> {
  const all = (await device.shell(`ls -1a ${PATH}`)).toString().split("\n").map((x) => x.trim());
  return all.filter((x) => x !== "" && x !== "." && x !== ".." && !keep.includes(x));
}
function log137(s: string): void {
  console.log(`A137 ${s}`);
}

async function a137(start: Page): Promise<void> {
  let page = start;
  await device.shell(`rm -f ${PATH}/big.json ${PATH}/n62-backup-2026-11-07.json ${PATH}/from-outside.json; rm -rf ${PATH}/sub`);
  const keep = ["n62-test.txt", "n62-keep.json"];
  const isStaged = (n: string): boolean => n.startsWith(".n62-new~") || n.startsWith(".n62-old~");
  const listed = async (p: Page): Promise<string[]> => ((await call(p, "list")).files as { name: string }[]).map((f) => f.name).sort();

  // an I/O error after 10 bytes of the new text: the old text stays whole under the real name
  const old = `{"old":"${"o".repeat(200)}"}`;
  expect(await call(page, "write", { name: "n62-keep.json", text: old })).toEqual({ result: "written" });
  const failed = await call(page, "write", { name: "n62-keep.json", text: `{"new":"${"n".repeat(300)}"}`, failAfter: 10 })
    .catch((e: Error) => ({ result: `rejected: ${e.message}` }));
  const afterFail = (await device.shell(`cat ${PATH}/n62-keep.json`)).toString();
  log137(`failAfter 10: write ${JSON.stringify(failed.result).slice(0, 80)}; the file holds ${afterFail.length} bytes (old ${old.length}); strays ${JSON.stringify(await strays(keep))}`);
  expect.soft(String(failed.result)).toMatch(/^rejected: .*test seam/);
  expect.soft(afterFail).toBe(old);
  expect.soft(await call(page, "read", { name: "n62-keep.json" })).toEqual({ result: "ok", text: old });
  expect.soft(await strays(keep)).toEqual([]);

  // step 4 (the staged new file renamed to the real name) fails after the old file went aside: the old file is put back
  const failedRename = await call(page, "write", { name: "n62-keep.json", text: `{"new":"${"n".repeat(300)}"}`, failAt: "rename" })
    .catch((e: Error) => ({ result: `rejected: ${e.message}` }));
  const afterRename = await shellMd5("n62-keep.json");
  const strayRename = await strays(keep);
  log137(`failAt rename: write ${JSON.stringify(failedRename.result).slice(0, 80)}; the file is ${afterRename === md5(old) ? "old" : afterRename}; strays ${JSON.stringify(strayRename)}`);
  expect.soft(String(failedRename.result)).toMatch(/^rejected: .*test seam/);
  expect.soft(afterRename).toBe(md5(old));
  expect.soft(await call(page, "read", { name: "n62-keep.json" })).toEqual({ result: "ok", text: old });
  expect.soft(strayRename).toEqual([]);

  // 2 MB files; the app killed during a stalled write: in the bytes, after the check, between the two renames
  const bigOld = `{"x":"${"é∑abcdef".repeat(200_000)}"}`;
  const bigNew = `{"y":"${"ghijk∑é".repeat(200_000)}"}`;
  const known: Record<string, string> = { [md5(bigOld)]: "old", [md5(bigNew)]: "new", missing: "missing" };
  const fire = async (p: Page, text: string, extra: object): Promise<void> => {
    await p.evaluate(([t, x]) => {
      const w = window as unknown as { __w: unknown; Capacitor: { nativePromise(p: string, m: string, o: object): Promise<Answer> } };
      w.__w = w.Capacitor.nativePromise("N62Files", "write", { name: "n62-big.json", text: t, ...(x as object) }).catch(() => undefined);
    }, [text, extra] as const);
  };
  const textOf = (r: Answer): string => (r.text === bigOld ? "old" : r.text === bigNew ? "new" : `not whole (${String(r.result)})`);
  const keepBig = [...keep, "n62-big.json"];
  const stalls: [string, object, string, string][] = [
    ["in the bytes, after 1 MB", { stallAfter: 1_000_000 }, "old", "old"],
    ["after the check", { stallAt: "checked" }, "old", "old"],
    ["between the two renames", { stallAt: "aside" }, "missing", "new"],
  ];
  for (const [where, seam, wantNow, wantRead] of stalls) {
    expect(await call(page, "write", { name: "n62-big.json", text: bigOld })).toEqual({ result: "written" });
    await fire(page, bigNew, seam);
    await new Promise((r) => setTimeout(r, 3000));
    const mid = (await device.shell(`ls -1a ${PATH}`)).toString().trim().split("\n").filter((n) => n.startsWith(".n62-") || n.startsWith("n62-big"));
    await device.shell(`am force-stop ${PKG}`);
    const now = known[await shellMd5("n62-big.json")] ?? "cut";
    page = await launch();
    const read = textOf(await call(page, "read", { name: "n62-big.json" }));
    const names = await listed(page);
    const left = await strays(keepBig);
    expect(await call(page, "write", { name: "n62-big.json", text: bigOld })).toEqual({ result: "written" });
    const clean = await strays(keepBig);
    log137(`killed ${where}: the folder held ${JSON.stringify(mid)}; the file is ${now}; after restart read gives ${read}, list ${JSON.stringify(names)}, strays ${JSON.stringify(left)}; after the next write strays ${JSON.stringify(clean)}`);
    expect.soft(now).toBe(wantNow);
    expect.soft(read).toBe(wantRead);
    expect.soft(names.filter(isStaged)).toEqual([]);
    expect.soft(left.filter((n) => !isStaged(n))).toEqual([]);
    expect.soft(clean).toEqual([]);
    expect.soft(known[await shellMd5("n62-big.json")]).toBe("old");
  }

  // kills at a sweep of times into a plain 2 MB write (no seam): old, new or (between the renames) missing, never cut
  const seen: string[] = [];
  let text = bigOld;
  for (const ms of [0, 10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200]) {
    const next = text === bigOld ? bigNew : bigOld;
    await fire(page, next, {});
    await new Promise((r) => setTimeout(r, ms));
    await device.shell(`am force-stop ${PKG}`);
    const now = known[await shellMd5("n62-big.json")] ?? "cut";
    page = await launch();
    const r = await call(page, "read", { name: "n62-big.json" });
    const after = textOf(r);
    const left = await strays(keepBig);
    seen.push(`${ms} ms: ${now} → ${after}${left.length ? ` ${JSON.stringify(left)}` : ""}`);
    expect.soft(["old", "new", "missing"]).toContain(now);
    expect.soft(["old", "new"]).toContain(after);
    expect.soft(left.filter((n) => !isStaged(n))).toEqual([]);
    expect.soft((await listed(page)).filter(isStaged)).toEqual([]);
    text = r.text === bigNew ? bigNew : bigOld;
  }
  // "old"/"new" name the two texts (the sweep writes them in turn), not the text before each kill
  log137(`kill sweep (file right after the kill → read after restart, staged files left): ${seen.join("; ")}`);
  expect(await call(page, "write", { name: "n62-big.json", text: bigNew })).toEqual({ result: "written" });
  expect.soft(await strays(keepBig)).toEqual([]);
  await device.shell(`rm -f ${PATH}/n62-keep.json ${PATH}/n62-big.json`);
}

/** A101: the plugin's tail, and appendChecked over a torn last line. */
async function a101(page: Page): Promise<void> {
  const name = "n62-torn.txt";
  const tail = (n: number, more: object = {}): Promise<Answer> => call(page, "tail", { name, n, ...more });
  // a torn line: the file ends without its final \n (as a crash in the middle of an append leaves it)
  expect(await call(page, "write", { name, text: "{\"id\":\"a0\"}\n{\"id\":\"a1\",\"v\":\"∑" })).toEqual({ result: "written" });
  for (const more of [{}, { noSeek: true }]) {
    expect(await tail(1, more)).toEqual({ result: "ok", text: "\uFFFD" }); // the last byte of ∑
    expect(await tail(3, more)).toEqual({ result: "ok", text: "∑" });
    expect(await tail(1000, more)).toEqual({ result: "ok", text: "{\"id\":\"a0\"}\n{\"id\":\"a1\",\"v\":\"∑" });
  }
  expect(await call(page, "tail", { name: "none.txt", n: 1 })).toEqual({ result: "missing" });
  await expect(tail(0)).rejects.toThrow();
  log("A101 tail: last 1, 3 and 1000 bytes by seek and by stream; missing file: missing; n 0 rejected");

  const sent: Answer[] = [];
  const port: AppendPort = {
    append: async (o) => {
      const r = await call(page, "append", o);
      sent.push({ ...r, text: o.text });
      return r as Awaited<ReturnType<AppendPort["append"]>>;
    },
    tail: async (o) => (await call(page, "tail", o)) as Awaited<ReturnType<AppendPort["tail"]>>,
  };
  expect(await appendChecked(name, "{\"id\":\"b1\"}\n", port)).toBe("appended");
  expect(await appendChecked(name, "{\"id\":\"b2\",\"v\":\"é\"}\n", port)).toBe("appended");
  const text = (await device.shell(`cat ${PATH}/${name}`)).toString();
  expect(text).toBe("{\"id\":\"a0\"}\n{\"id\":\"a1\",\"v\":\"∑\n{\"id\":\"b1\"}\n{\"id\":\"b2\",\"v\":\"é\"}\n");
  expect(text.split("\n")).toEqual(["{\"id\":\"a0\"}", "{\"id\":\"a1\",\"v\":\"∑", "{\"id\":\"b1\"}", "{\"id\":\"b2\",\"v\":\"é\"}", ""]);
  log(`A101 appendChecked twice over a torn line: appended, appended; sent ${JSON.stringify(sent)}; the file ${JSON.stringify(text)}`);
  await device.shell(`rm -f ${PATH}/${name}`);
}
