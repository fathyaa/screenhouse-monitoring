import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, "../wireframes-mobile.html");
const outDir = path.resolve(__dirname, "../wireframes-mobile/png");

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });

const phones = page.locator(".phone-wrap");
const count = await phones.count();

for (let i = 0; i < count; i++) {
  const wrap = phones.nth(i);
  const label = (await wrap.locator(".phone-label").textContent())?.trim() || `screen-${i + 1}`;
  const slug = label.replace(/[^\w\-]+/g, "-").replace(/-+/g, "-").toLowerCase();
  const phone = wrap.locator(".phone");
  await phone.screenshot({
    path: path.join(outDir, `${String(i + 1).padStart(2, "0")}-${slug}.png`),
  });
  console.log(`Exported: ${label}`);
}

await browser.close();
console.log(`\nDone — ${count} PNG files in docs/wireframes-mobile/png/`);
