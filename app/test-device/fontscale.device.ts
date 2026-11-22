// SPDX-License-Identifier: GPL-3.0-or-later
// R703 (F383): at Android's font scale 1.5 and 2.0 the keypad, the bar and the sheets fit on a real WebView, which zooms every
// text after the CSS sizes (the e2e test, fontscale.spec.ts, scales only the app's tokens and cannot see it: this is the gate).
// 1.3 is the control (it fit before R703). Run by tools/fontscale-device.sh on an emulator (or a device the owner names: the
// script sets `font_scale`, which the device rules allow only there, and puts the old value back).
// Each scale: our app's data cleared, a cold start; the first-start tips are checked, closed with "Got it", then each screen.
import { _android as android, expect, test, type AndroidDevice, type Page } from "@playwright/test";
import { installTouchTap } from "./touch-tap.ts";
import { measure, walk } from "./fontscale-lib.ts";

const PKG = "dev.n62.calc"; // our app only (docs/shifts/rules.md section 3)
const SCALES = (process.env["FONT_SCALES"] ?? "1.3,1.5,2.0").split(",").map(Number);

let device: AndroidDevice;
let before = "";

test.beforeAll(async () => {
  const serial = process.env["ANDROID_SERIAL"];
  if (!serial) throw new Error("ANDROID_SERIAL is not set");
  // R703f1: the script's rule, here too, before any setting changes (a run of this file without the script)
  if (!serial.startsWith("emulator-") && process.env["FONTSCALE_DEVICE_OK"] !== "1")
    throw new Error(`${serial} is not an emulator: changing its font scale needs the owner's word (FONTSCALE_DEVICE_OK=1)`);
  const found = (await android.devices()).find((d) => d.serial() === serial);
  if (!found) throw new Error(`device ${serial} not attached`);
  device = found;
  before = (await device.shell("settings get system font_scale")).toString().trim();
});
test.afterAll(async () => {
  // the user's own scale back ("null": it was never set; 1.0 is the system's default then)
  await device?.shell(`settings put system font_scale ${/^[\d.]+$/.test(before) ? before : "1.0"}`).catch(() => undefined);
  await device?.shell(`am force-stop ${PKG}`).catch(() => undefined);
  await device?.close().catch(() => undefined);
});

async function start(scale: number): Promise<Page> {
  await device.shell(`settings put system font_scale ${scale}`);
  await device.shell(`pm clear ${PKG}`); // stops the app too: it starts under the new scale
  await device.shell(`am start -n ${PKG}/.MainActivity`);
  const page = await (await device.webView({ pkg: PKG }, { timeout: 30_000 })).page();
  installTouchTap(page);
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.n62 !== undefined, undefined, { timeout: 30_000 });
  await page.waitForTimeout(800); // the first fit and the tips' layout
  return page;
}

for (const scale of SCALES)
  test(`the screens fit at font scale ${scale}`, async () => {
    const page = await start(scale);
    const problems: string[] = [];
    const numbers: string[] = [];
    const look = async (screen: string): Promise<void> => {
      await page.waitForTimeout(300);
      const m = await measure(page);
      problems.push(...m.out.map((p) => `${screen}: ${p}`));
      numbers.push(`${screen} zoom ${m.zoom} smallest ${m.smallest}px cut ${m.cut}`);
    };
    await walk(page, look);
    console.log(`FONTSCALE ${scale}: ${numbers.join("; ")}`);
    expect(problems, `font scale ${scale}`).toEqual([]);
  });
