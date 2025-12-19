/**
 * Script to generate PNG icons from SVG
 * Run: npx tsx scripts/generate-icons.ts
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [16, 32, 48, 128];

const createSvg = (size: number, active = false): string => {
  const gradient = active 
    ? `<stop offset="0%" style="stop-color:#10b981"/><stop offset="100%" style="stop-color:#059669"/>`
    : `<stop offset="0%" style="stop-color:#667eea"/><stop offset="100%" style="stop-color:#764ba2"/>`;
  
  const r = Math.floor(size * 0.44);
  const cx = size / 2;
  const cy = size / 2;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      ${gradient}
    </linearGradient>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#grad)"/>
  <path d="M${cx} ${size * 0.25}c-${size * 0.055} 0-${size * 0.1} ${size * 0.045}-${size * 0.1} ${size * 0.1}v${size * 0.2}c0 ${size * 0.055} ${size * 0.045} ${size * 0.1} ${size * 0.1} ${size * 0.1}s${size * 0.1}-${size * 0.045} ${size * 0.1}-${size * 0.1}v-${size * 0.2}c0-${size * 0.055}-${size * 0.045}-${size * 0.1}-${size * 0.1}-${size * 0.1}zm${size * 0.2} ${size * 0.2}c0 ${size * 0.11}-${size * 0.09} ${size * 0.2}-${size * 0.2} ${size * 0.2}s-${size * 0.2}-${size * 0.09}-${size * 0.2}-${size * 0.2}h-${size * 0.05}c0 ${size * 0.14} ${size * 0.1} ${size * 0.25} ${size * 0.23} ${size * 0.27}V${size * 0.8}h${size * 0.04}v-${size * 0.03}c${size * 0.13}-${size * 0.02} ${size * 0.23}-${size * 0.13} ${size * 0.23}-${size * 0.27}h-${size * 0.05}z" fill="white" transform="scale(1)"/>
</svg>`;
};

// Simpler microphone SVG
const createSimpleSvg = (size: number, active = false): string => {
  const bgColor = active ? '#10b981' : '#667eea';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="45" fill="${bgColor}"/>
    <rect x="40" y="25" width="20" height="35" rx="10" fill="white"/>
    <path d="M30 50 v5 a20 20 0 0 0 40 0 v-5" stroke="white" stroke-width="5" fill="none"/>
    <rect x="47" y="72" width="6" height="12" fill="white"/>
    <rect x="38" y="82" width="24" height="5" rx="2" fill="white"/>
  </svg>`;
};

const main = async () => {
  const iconsDir = join(__dirname, '..', 'public', 'icons');
  
  if (!existsSync(iconsDir)) {
    mkdirSync(iconsDir, { recursive: true });
  }

  console.log('Generating PNG icons from SVG...\n');

  for (const size of sizes) {
    const pngPath = join(iconsDir, `icon-${size}.png`);
    const svg = createSimpleSvg(size);
    
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(pngPath);
    
    console.log(`✓ Generated icon-${size}.png`);
  }

  // Generate active icon
  const activePngPath = join(iconsDir, 'icon-128-active.png');
  const activeSvg = createSimpleSvg(128, true);
  
  await sharp(Buffer.from(activeSvg))
    .resize(128, 128)
    .png()
    .toFile(activePngPath);
  
  console.log(`✓ Generated icon-128-active.png`);
  
  console.log('\n✅ All icons generated successfully!');
};

main().catch(console.error);
