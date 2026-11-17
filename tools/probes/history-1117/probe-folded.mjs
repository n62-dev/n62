// SPDX-License-Identifier: GPL-3.0-or-later
// sandra 2026-11-17: the folded history on phase-1 (228bc43f), real engine, Pixel 7 emulation at 412 x 815.
// Usage: node probe-folded.mjs <port> <outdir>   (a dev server from app/ on <port>; GIAC_OUT set)
// Checks: (1) a tap on a row's empty area picks nothing; (2) Store ▶ on a folded pick unfolds; (3) what a swipe right does;
// (4) the picked row's colours. Screenshots to <outdir>.
import { chromium, devices } from "../../../app/node_modules/playwright/index.mjs";

const port = process.argv[2] ?? "5291";
const out = process.argv[3] ?? ".";
const scheme = process.argv[4] ?? "light";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 412, height: 815 }, colorScheme: scheme });
const page = await ctx.newPage();
await page.goto(`http://localhost:${port}/?tips=off`);
await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.n62 !== undefined);
await page.evaluate(() => window.n62.entry.ready);
await page.waitForFunction(() => window.n62?.session.engineState === "ready", undefined, { timeout: 30000 });
const tap = async (ids) => { for (const id of ids) await page.locator(`[data-key="${id}"]`).tap(); };
await tap(["d1", "div", "d3", "enter"]);
await tap(["d2", "add", "d3", "enter"]);
await tap(["d2", "pow", "d0", "dot", "d5", "enter"]);
await tap(["d7", "mul", "d6", "enter"]);
await page.waitForFunction(() => !document.querySelector('article.item[data-status="pending"]'));
await page.waitForFunction(() => document.querySelector('[data-testid="keys"]')?.getAttribute("data-fold-ready") === "true", undefined, { timeout: 15000 });
const cdp = await ctx.newCDPSession(page);
const drag = async (x, y, dx, dy, steps = 8, still = 120) => {
  const at = (a, b) => [{ x: Math.round(a), y: Math.round(b), id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(x, y) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(x + (dx * i) / steps, y + (dy * i) / steps) });
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(still);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};
const folded = () => page.getByTestId("keys").getAttribute("data-folded");
const picked = () => page.locator('[data-selected="true"]').count();
const e = await page.getByTestId("entry").boundingBox();
await drag(e.x + e.width / 2, e.y + e.height / 2, 0, 40, 4, 0);
await page.waitForTimeout(300);
console.log("folded after swipe:", await folded());
await page.screenshot({ path: `${out}/1-folded.png` });

// (1) the empty area of the second row: right of the input, left of the result, on the input's line
const row = page.locator("article.item").nth(1);
const rb = await row.boundingBox();
const ib = await row.locator(".in").boundingBox();
const ob = await row.locator(".out").boundingBox();
console.log("row", JSON.stringify(rb), "in", JSON.stringify(ib), "out", JSON.stringify(ob));
const emptyX = rb.x + rb.width - 20;
const emptyY = ib.y + ib.height / 2;
const hit = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? `${el.tagName}.${el.className}` : "none"; }, [emptyX, emptyY]);
console.log("element at the empty area:", hit);
await page.touchscreen.tap(emptyX, emptyY);
await page.waitForTimeout(200);
console.log("picked after a tap on the empty area:", await picked());
const rowShare = await page.evaluate(() => {
  const r = document.querySelectorAll("article.item")[1].getBoundingClientRect();
  const parts = [...document.querySelectorAll("article.item")[1].querySelectorAll(".in, .result")].map((x) => x.getBoundingClientRect());
  const area = parts.reduce((n, p) => n + p.width * p.height, 0);
  return { row: Math.round(r.width * r.height), targets: Math.round(area), share: +(area / (r.width * r.height)).toFixed(2) };
});
console.log("tappable share of a row:", JSON.stringify(rowShare));

// (4) a pick: the colours
await row.locator(".result").tap();
await page.waitForTimeout(200);
console.log("picked after a tap on the result:", await picked());
const colours = await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('[data-selected="true"]'));
  const root = getComputedStyle(document.documentElement);
  const v = (n) => root.getPropertyValue(n).trim();
  return { family: document.documentElement.dataset.family, brightness: document.documentElement.dataset.brightness, keys: document.documentElement.dataset.keys ?? "", bg: v("--bg"), pick: v("--pick"), focus: v("--focus"), line: v("--line"), rowBg: cs.backgroundColor, outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}` };
});
console.log("theme and pick:", JSON.stringify(colours));
await page.screenshot({ path: `${out}/2-picked.png` });
const bar = await page.getByTestId("row-actions").getByRole("button").allTextContents();
console.log("row bar:", JSON.stringify(bar));

// (2) Store ▶ on the folded pick
await page.getByTestId("row-actions").getByRole("button", { name: /Store/ }).tap();
await page.waitForTimeout(500);
console.log("folded after Store ▶:", await folded(), "store sheet:", await page.getByTestId("store").isVisible());
await page.screenshot({ path: `${out}/3-store.png` });
await page.locator('[data-key="esc"]').tap().catch(() => {});
await page.evaluate(() => window.n62.entry.clear());
await page.waitForTimeout(200);

// (3) a swipe right on the last row while folded
const e2 = await page.getByTestId("entry").boundingBox();
await drag(e2.x + e2.width / 2, e2.y + e2.height / 2, 0, 40, 4, 0);
await page.waitForTimeout(300);
const n0 = await page.locator("article.item").count();
const last = await page.locator("article.item").last().boundingBox();
await drag(last.x + last.width * 0.3, last.y + last.height / 2, 0.6 * last.width, 0, 10, 120);
await page.waitForTimeout(600);
console.log("rows before / after a swipe right:", n0, await page.locator("article.item").count(), "undo note:", await page.getByTestId("undo-note").isVisible());
// a swipe that starts 8 px from the right edge (where Android's back gesture lives on a device)
await browser.close();
