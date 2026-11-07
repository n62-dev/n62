// SPDX-License-Identifier: GPL-3.0-or-later
// A65 step 1: can the app keep a folder? On the device's WebView (the test build, build.sh --test), attached over adb:
// pick a test folder once in the system folder picker (ACTION_OPEN_DOCUMENT_TREE), write n62-test.txt, kill the app,
// start it again, read the file back and list the folder with no dialog; another writer (adb shell, as Syncthing writes:
// straight to the file system) changes the file and adds one, the app reads the change; the folder removed → unavailable,
// never a throw; forget() → unavailable. Also the time of a 2 MB write (the backup's worst case), median of 5.
// Run by hand under the device lock (annabell; docs/shifts/rules.md section 5):
//   tools/devlock.sh acquire HA24BZ2Y <name> 1800 && (cd app && npx playwright test -c playwright.folder.config.ts);
//   tools/devlock.sh release HA24BZ2Y <name>
// It clears our app's data first (pm clear) and removes its test folder at the end. Prints one "A65 ..." line per step.
import { _android as android, expect, test, type AndroidDevice, type Page } from "@playwright/test";

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
  test.setTimeout(300_000);
  log(`device ${device.serial()} ${device.model()}; ${(await device.shell("getprop ro.build.version.release")).toString().trim()}`);
  await device.shell(`rm -rf ${PATH}; mkdir -p ${PATH}`);
  await device.shell(`pm clear ${PKG}`);
  let page = await launch();
  expect(await call(page, "folder")).toEqual({ result: "unavailable" });
  expect(await call(page, "write", { name: "n62-test.txt", text: "x" })).toEqual({ result: "unavailable" });
  log("no folder yet: folder, write unavailable");

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

  // the folder removed: unavailable, never a throw
  await device.shell(`rm -rf ${PATH}`);
  const gone: { folder: Answer; write: Answer; read: Answer; list: Answer } = {
    folder: await call(page, "folder"),
    write: await call(page, "write", { name: "a.txt", text: "x" }).catch((e: Error) => ({ result: `rejected: ${e.message}` })),
    read: await call(page, "read", { name: "a.txt" }).catch((e: Error) => ({ result: `rejected: ${e.message}` })),
    list: await call(page, "list").catch((e: Error) => ({ result: `rejected: ${e.message}` })),
  };
  log(`folder removed: ${JSON.stringify(gone)}`);
  expect(gone.folder.result).toBe("unavailable");
  expect(gone.write.result).toBe("unavailable");
  expect(gone.read.result).toBe("unavailable");
  expect(gone.list.result).toBe("unavailable");

  // forget gives the grant back
  await device.shell(`mkdir -p ${PATH}`);
  expect(await call(page, "forget")).toEqual({ result: "ok" });
  expect(await call(page, "folder")).toEqual({ result: "unavailable" });
  log("forget: folder unavailable");
});
