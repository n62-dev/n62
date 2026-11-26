// SPDX-License-Identifier: GPL-3.0-or-later
// A270: phones stay in portrait (landscape has no design yet); tablets (smallest width >= 600 dp) keep both.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const main = join(repo, "android/app/src/main");
const java = readFileSync(join(main, "java/dev/n62/calc/MainActivity.java"), "utf8");
const manifest = readFileSync(join(main, "AndroidManifest.xml"), "utf8");

/** The body of `private void name()` up to its closing brace at the method's indent. */
function method(name: string): string {
  const m = new RegExp(`void\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n    \\}`).exec(java);
  expect(m, `method ${name}`).not.toBeNull();
  return (m as RegExpExecArray)[1]!;
}

describe("MainActivity locks phones to portrait (A270)", () => {
  it("requests portrait when the smallest width is below 600 dp", () => {
    const body = method("lockPhonePortrait");
    expect(body).toMatch(/smallestScreenWidthDp\s*<\s*600/);
    expect(body).toMatch(/setRequestedOrientation\(\s*ActivityInfo\.SCREEN_ORIENTATION_PORTRAIT\s*\)/);
    expect(body).not.toMatch(/SCREEN_ORIENTATION_(LANDSCAPE|SENSOR|USER|UNSPECIFIED)/);
  });
  it("runs before super.onCreate on both paths (the measurement build and the normal one)", () => {
    const on = /public void onCreate\([^)]*\)\s*\{([\s\S]*?)\n    \}/.exec(java);
    expect(on).not.toBeNull();
    const body = on![1]!;
    const lock = body.indexOf("lockPhonePortrait();");
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(lock).toBeLessThan(body.indexOf("super.onCreate("));
  });
  it("the manifest sets no fixed orientation, so tablets keep both", () => {
    expect(manifest).not.toMatch(/android:screenOrientation/);
  });
});
