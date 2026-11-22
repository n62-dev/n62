// SPDX-License-Identifier: GPL-3.0-or-later
// R793 (owner's K10, 2026-11-20): the "＋" on an empty user key (U1–U6) sits in the key's centre. Its face lies in the
// grid row under the legend line, which is empty on an empty slot, so it sat 3.4 to 4.1 px low. The test measures the
// ink: the pixels of the key's box that change when the face is hidden (so the slot's outline never counts), weighted by
// how much they change; their centroid is within 1 px of the box centre. A set user key keeps its face where the grid
// puts it (the control).
import { expect, test, type Page } from "@playwright/test";
import { open } from "./helpers.ts";

const USER = ["u1", "u2", "u3", "u4", "u5", "u6"];
const NO_FACE = ".main, .main::after { color: transparent !important; }";

/** Two frames, so a style just added or removed is painted before the next shot. */
async function frames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

/** The key's box as a PNG (base64), shot with these styles injected. */
async function shot(page: Page, id: string, ...css: string[]): Promise<string> {
  const box = (await page.locator(`[data-key="${id}"]`).boundingBox())!;
  const tags = await Promise.all(css.map((content) => page.addStyleTag({ content })));
  await frames(page);
  const png = await page.screenshot({ clip: box, animations: "disabled" });
  for (const t of tags) await t.evaluate((el) => (el as Element).remove());
  await frames(page);
  return png.toString("base64");
}

/** The face's ink centroid less the box centre, in CSS px: [dx, dy] (null when there is no ink). */
async function offset(page: Page, id: string): Promise<[number, number] | null> {
  const box = (await page.locator(`[data-key="${id}"]`).boundingBox())!;
  const [withFace, without] = [await shot(page, id), await shot(page, id, NO_FACE)];
  return page.evaluate(
    async ({ shots, w }) => {
      const decode = async (b64: string): Promise<ImageData> => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const cv = document.createElement("canvas");
        [cv.width, cv.height] = [bmp.width, bmp.height];
        const g = cv.getContext("2d", { willReadFrequently: true });
        if (!g) throw new Error("no canvas");
        g.drawImage(bmp, 0, 0);
        return g.getImageData(0, 0, bmp.width, bmp.height);
      };
      const [p, q] = await Promise.all(shots.map(decode));
      let [sum, sx, sy] = [0, 0, 0];
      for (let j = 0; j < p!.height; j++)
        for (let i = 0; i < p!.width; i++) {
          const o = (j * p!.width + i) * 4;
          const d = Math.max(...[0, 1, 2].map((c) => Math.abs(p!.data[o + c]! - q!.data[o + c]!)));
          if (d <= 8) continue;
          sum += d;
          sx += d * (i + 0.5);
          sy += d * (j + 0.5);
        }
      if (sum === 0) return null;
      const k = p!.width / w; // device pixels per CSS px
      return [(sx / sum - p!.width / 2) / k, (sy / sum - p!.height / 2) / k] as [number, number];
    },
    { shots: [withFace, without], w: box.width },
  );
}

for (const [width, height] of [
  [412, 915],
  [412, 760],
  [360, 740],
] as const)
  test(`an empty user key's ＋ is centred in the key at ${width} × ${height}; a set one keeps its face`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    for (const id of USER) await expect(page.locator(`[data-key="${id}"]`)).toHaveAttribute("data-user", "empty");
    const off: string[] = [];
    for (const id of USER) {
      const d = await offset(page, id);
      expect(d, id).not.toBeNull();
      const [dx, dy] = d!;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) off.push(`${id}: dx ${dx.toFixed(1)}, dy ${dy.toFixed(1)}`);
    }
    expect(off).toEqual([]);
    // the control: a set user key's face stays in the grid's face row, centred there, unmoved
    await page.evaluate(() => window.n62.userKeys.set("u1", "primary", { label: "sinh", action: { insert: "\\sinh\\left(#0\\right)" } }));
    const u1 = page.locator('[data-key="u1"]');
    await expect(u1).toHaveAttribute("data-user", "set");
    const place = await u1.evaluate((key) => {
      const main = key.querySelector<HTMLElement>(".main")!;
      const legend = parseFloat(getComputedStyle(key).getPropertyValue("--legend-h"));
      const bottom = parseFloat(getComputedStyle(key).paddingBottom);
      const [k, m] = [key.getBoundingClientRect(), main.getBoundingClientRect()];
      const row = k.top + legend + (k.height - legend - bottom) / 2; // the centre of the face's row
      return { translate: getComputedStyle(main).translate, dy: m.top + m.height / 2 - row, dx: m.left + m.width / 2 - (k.left + k.width / 2) };
    });
    expect(place.translate).toBe("none");
    expect(Math.abs(place.dy)).toBeLessThan(0.5);
    expect(Math.abs(place.dx)).toBeLessThan(0.5);
  });
