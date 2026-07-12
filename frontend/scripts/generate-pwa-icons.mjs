/**
 * Generate PWA icons from logo-bibitlive.png (sama dengan sidebar).
 * Run: npm run icons
 */
import sharp from "sharp";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const source = join(publicDir, "logo-bibitlive.png");

/** Logo square di tengah file landscape 1536×1024 */
const CROP = { left: 256, top: 0, width: 1024, height: 1024 };

function squareIcon(size) {
  return sharp(source).extract(CROP).resize(size, size, { fit: "fill" });
}

const outputs = [
  { file: "pwa-192x192.png", size: 192 },
  { file: "pwa-512x512.png", size: 512 },
  { file: "pwa-512-maskable.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-512.png", size: 512 },
];

for (const { file, size } of outputs) {
  await squareIcon(size).png().toFile(join(publicDir, file));
  console.log(`✓ ${file} (${size}×${size})`);
}
