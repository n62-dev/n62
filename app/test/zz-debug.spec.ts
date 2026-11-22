import { test } from "@playwright/test";
import { open } from "./helpers.ts";
test.use({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 4 });
test("dbg", async ({ page }) => {
  await open(page);
  const clip = { x: 140, y: 470, width: 130, height: 115 };
  const png = await page.screenshot({ clip, scale: "device" });
  const r = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const cv = document.createElement("canvas"); [cv.width, cv.height] = [bmp.width, bmp.height];
    const g = cv.getContext("2d")!; g.drawImage(bmp, 0, 0);
    const y = Math.round((475 + 53.5 - 470) * 4) + 10; // a row just under the centre, clear of the arrows
    const d = g.getImageData(0, y, bmp.width, 1).data;
    const row: string[] = [];
    for (let x = 0; x < bmp.width; x++) row.push(`${d[x*4]}`);
    // and a row at the right arrow's tip
    const y2 = Math.round((475 + 53.5 - 470) * 4);
    const d2 = g.getImageData(0, y2, bmp.width, 1).data;
    const row2: string[] = [];
    for (let x = 0; x < bmp.width; x++) row2.push(`${d2[x*4]}`);
    return { w: bmp.width, row: row.join(","), row2: row2.join(",") };
  }, png.toString("base64"));
  console.log(r.w); console.log(r.row); console.log(r.row2);
});
