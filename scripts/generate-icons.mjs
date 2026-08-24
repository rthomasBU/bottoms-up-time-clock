// One-off icon generator, not part of the app runtime. Run with:
//   node scripts/generate-icons.mjs
// Regenerates PWA icons from the real Bottoms Up logo (public/logo.png).
// The logo has a transparent background and must never sit on a light
// background (brand kit rule), so every square icon composites it onto a
// solid black canvas rather than leaving it transparent or white.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');
const logoSrc = path.join(publicDir, 'logo.png');

// scale: fraction of the canvas the logo's longest side should fill.
// Maskable icons need extra padding so the shape survives an aggressive
// circular/rounded-square mask on Android.
async function makeIcon(size, scale, outPath) {
  const logoSize = Math.round(size * scale);
  const logo = await sharp(logoSrc).resize(logoSize, logoSize, { fit: 'inside' }).toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(outPath);
  console.log(`wrote ${outPath}`);
}

await makeIcon(192, 0.82, path.join(iconsDir, 'icon-192.png'));
await makeIcon(512, 0.82, path.join(iconsDir, 'icon-512.png'));
await makeIcon(192, 0.6, path.join(iconsDir, 'icon-maskable-192.png'));
await makeIcon(512, 0.6, path.join(iconsDir, 'icon-maskable-512.png'));
await makeIcon(180, 0.82, path.join(publicDir, 'apple-touch-icon.png'));
await makeIcon(48, 0.82, path.join(publicDir, 'favicon.png'));
