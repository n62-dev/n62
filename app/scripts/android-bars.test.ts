// SPDX-License-Identifier: GPL-3.0-or-later
// A59: Android's splash and system bars take the default Dark's background, whatever the system mode.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const res = join(repo, "android/app/src/main/res/values");
const read = (p: string): string => readFileSync(p, "utf8");

/** The Dark --bg of app/src/style.css (family n62). */
function darkBg(): string {
  const css = read(join(repo, "app/src/style.css"));
  const m = /\[data-family="n62"\]\[data-brightness="dark"\]\s*\{[^}]*?--bg:\s*(#[0-9a-fA-F]{6})\s*;/.exec(css);
  expect(m).not.toBeNull();
  return (m as RegExpExecArray)[1]!.toLowerCase();
}

/** All <color name=…> values of every values/*.xml. */
function colors(): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of ["colors.xml", "styles.xml", "ic_launcher_background.xml"]) {
    let text = "";
    try { text = read(join(res, f)); } catch { continue; }
    for (const m of text.matchAll(/<color\s+name="([^"]+)">\s*([^<\s]+)\s*<\/color>/g)) out.set(m[1]!, m[2]!.toLowerCase());
  }
  return out;
}

/** The body of <style name="…"> in styles.xml. */
function style(name: string): string {
  const m = new RegExp(`<style\\s+name="${name.replace(".", "\\.")}"[^>]*>([\\s\\S]*?)</style>`).exec(read(join(res, "styles.xml")));
  expect(m, `style ${name}`).not.toBeNull();
  return (m as RegExpExecArray)[1]!;
}

/** The value of <item name="…"> of a style, a @color/ reference resolved. */
function item(body: string, name: string): string | undefined {
  const m = new RegExp(`<item\\s+name="${name}">\\s*([^<\\s]+)\\s*</item>`).exec(body);
  if (!m) return undefined;
  const v = m[1]!;
  const ref = /^@color\/(.+)$/.exec(v);
  return ref ? colors().get(ref[1]!) : v.toLowerCase();
}

describe("Android splash and bars are the Dark background (A59)", () => {
  const bg = darkBg();
  it("the splash background", () => {
    expect(item(style("AppTheme.NoActionBarLaunch"), "windowSplashScreenBackground")).toBe(bg);
  });
  it("the status and navigation bars", () => {
    const s = style("AppTheme.NoActionBar");
    expect(item(s, "android:statusBarColor")).toBe(bg);
    expect(item(s, "android:navigationBarColor")).toBe(bg);
    expect(item(s, "android:windowBackground")).toBe(bg); // what shows behind the bars from Android 15 on
  });
  it("the bars' icons are light", () => {
    const s = style("AppTheme.NoActionBar");
    expect(item(s, "android:windowLightStatusBar")).toBe("false");
    expect(item(s, "android:windowLightNavigationBar")).toBe("false");
  });
});

describe("the WebView's first frame is the Dark background (A72)", () => {
  it("capacitor.config.ts sets android.backgroundColor to it", () => {
    const cfg = read(join(repo, "app/capacitor.config.ts"));
    const m = /android:\s*\{[^}]*?backgroundColor:\s*'(#[0-9a-fA-F]{6})'/.exec(cfg) ?? /^\s*backgroundColor:\s*'(#[0-9a-fA-F]{6})'/m.exec(cfg);
    expect(m, "backgroundColor in capacitor.config.ts").not.toBeNull();
    expect((m as RegExpExecArray)[1]!.toLowerCase()).toBe(darkBg());
  });
});

describe("the bars follow the look from the page on (A266)", () => {
  const java = (f: string): string => read(join(repo, "android/app/src/main/java/dev/n62/calc", `${f}.java`));
  it("MainActivity registers N62BarsPlugin before super.onCreate", () => {
    const main = java("MainActivity");
    const at = main.indexOf("registerPlugin(N62BarsPlugin.class)");
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(main.indexOf("super.onCreate(savedInstanceState)"));
  });
  it("the plugin is named N62Bars on both sides and sets the window background and the icons", () => {
    const src = java("N62BarsPlugin");
    expect(/@CapacitorPlugin\(name = "([^"]+)"\)/.exec(src)?.[1]).toBe("N62Bars");
    expect(read(join(repo, "app/src/theme/bars.ts"))).toMatch(/isPluginAvailable\("N62Bars"\)/);
    for (const s of ["setBackgroundDrawable", "setAppearanceLightStatusBars", "setAppearanceLightNavigationBars"]) expect(src).toContain(s);
  });
});
