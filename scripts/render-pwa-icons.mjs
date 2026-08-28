import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const svg = readFileSync(new URL("../public/favicon.svg", import.meta.url), "utf8");

async function rasterize(page, size, outPath) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html>
<html>
  <body style="margin:0;background:#0e0e0c">
    <div style="width:${size}px;height:${size}px">${svg.replace(
      "<svg",
      '<svg width="100%" height="100%"',
    )}</div>
  </body>
</html>`,
    { waitUntil: "load" },
  );
  const buf = await page.screenshot({ type: "png", omitBackground: false });
  writeFileSync(outPath, buf);
}

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
const page = await browser.newPage();
await rasterize(page, 180, new URL("../public/apple-touch-icon.png", import.meta.url));
await rasterize(page, 192, new URL("../public/icon-192.png", import.meta.url));
await rasterize(page, 512, new URL("../public/icon-512.png", import.meta.url));
await browser.close();
console.log("wrote apple-touch-icon.png, icon-192.png, icon-512.png");
