import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

const crcTable = createCrcTable();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type: string, data: Buffer): Buffer {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const rawData = Buffer.alloc(height * (1 + width * 4));
  const rowBytes = width * 4;
  for (let y = 0; y < height; y++) {
    const outRow = y * (1 + rowBytes);
    rawData[outRow] = 0; // Filter: None
    rgba.copy(rawData, outRow + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdrData),
    createChunk('IDAT', zlib.deflateSync(rawData, { level: 9 })),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(pngBuffer: Buffer, size: number): Buffer {
  // Valid modern ICO header + single PNG image directory entry
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(1, 4); // count: 1 image

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12); // offset = 6 + 16

  return Buffer.concat([header, entry, pngBuffer]);
}

type IconMode =
  | 'any' // rounded squircle with transparent corners (PWA standard)
  | 'opaque' // full-bleed opaque square (iOS apple-touch-icon & AppIcon)
  | 'maskable' // full-bleed opaque square with extra Android safe-zone margin
  | 'foreground' // transparent background, safe-zone foreground only (Android Adaptive)
  | 'background' // opaque gradient background only (Android Adaptive)
  | 'splash' // light-navy splash screen
  | 'splashDark'; // deep-navy dark-mode splash screen

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function isInsideRoundedRect(
  nx: number,
  ny: number,
  rx: number,
  ry: number,
  rad: number
): boolean {
  const qx = Math.max(0, Math.abs(nx) - (rx - rad));
  const qy = Math.max(0, Math.abs(ny) - (ry - rad));
  return qx * qx + qy * qy <= rad * rad;
}

/**
 * Signed/boolean test for the Hydrate Hub water droplet in normalized coordinates
 * centered at (0, 0) where droplet fits roughly within [-0.46, 0.46] in x and [-0.66, 0.66] in y.
 */
function insideDroplet(dx: number, dy: number): boolean {
  // Bottom circle centered at (0, 0.16) radius 0.46
  const cy = 0.16;
  const r = 0.46;
  if (dy >= 0.08) {
    return dx * dx + (dy - cy) * (dy - cy) <= r * r;
  }
  // Upper tapered teardrop curve from y = -0.64 (tip) down to y = 0.08 (tangent to circle)
  if (dy < -0.64) return false;
  const t = (dy - -0.64) / (0.08 - -0.64); // 0 at tip, 1 at shoulder
  // Smooth curve widening to circle chord at y = 0.08
  const shoulderHalfWidth = Math.sqrt(r * r - (0.08 - cy) * (0.08 - cy));
  const halfWidth = shoulderHalfWidth * Math.pow(t, 0.72);
  return Math.abs(dx) <= halfWidth;
}

function sampleIconPixel(
  u: number, // [0, 1]
  v: number, // [0, 1]
  mode: IconMode
): [number, number, number, number] {
  // Normalized coordinates centered at (0, 0) in [-1, 1]
  const cx = u * 2 - 1;
  const cy = v * 2 - 1;

  // Background gradient: #0A1F44 -> #173D7A -> #2864D9
  const gradT = Math.max(0, Math.min(1, (u + v) * 0.5));
  let bgR = mix(10, 40, gradT);
  let bgG = mix(31, 100, gradT);
  let bgB = mix(68, 217, gradT);

  if (mode === 'splash') {
    bgR = 10;
    bgG = 31;
    bgB = 68;
  } else if (mode === 'splashDark') {
    bgR = 6;
    bgG = 19;
    bgB = 43;
  }

  let outR = bgR;
  let outG = bgG;
  let outB = bgB;
  let outA = 255;

  if (mode === 'any') {
    if (!isInsideRoundedRect(cx, cy, 1.0, 1.0, 0.44)) {
      return [0, 0, 0, 0];
    }
    // Subtle inner highlight border on rounded square
    if (!isInsideRoundedRect(cx, cy, 0.975, 0.975, 0.415)) {
      outR = mix(bgR, 96, 0.28);
      outG = mix(bgG, 165, 0.28);
      outB = mix(bgB, 250, 0.28);
    }
  } else if (mode === 'foreground') {
    outA = 0;
  }

  if (mode === 'background') {
    return [Math.round(outR), Math.round(outG), Math.round(outB), 255];
  }

  // Emblem scale:
  // - maskable / foreground: strictly inside central 62% safe zone (Android Adaptive & Maskable)
  // - opaque (iOS): comfortable 14% padding inside square
  // - any: balanced 84% presence inside squircle
  // - splash: crisp small centered emblem (24%)
  const emblemScale =
    mode === 'maskable' || mode === 'foreground'
      ? 0.62
      : mode === 'opaque'
        ? 0.72
        : mode === 'splash' || mode === 'splashDark'
          ? 0.24
          : 0.84;

  const ex = cx / emblemScale;
  const ey = cy / emblemScale;

  if (insideDroplet(ex, ey)) {
    // Droplet gradient: #7DD3FC -> #38BDF8 -> #0284C7
    const dt = Math.max(0, Math.min(1, (ey + 0.64) / 1.26));
    let dR = mix(125, 2, dt);
    let dG = mix(211, 132, dt);
    let dB = mix(252, 199, dt);

    // Subtle lower wave shadow inside droplet
    const waveY = 0.22 + 0.04 * Math.sin(ex * 6.0);
    if (ey > waveY) {
      dR = mix(dR, 10, 0.24);
      dG = mix(dG, 31, 0.24);
      dB = mix(dB, 68, 0.24);
    }

    // Specular highlight ellipse on upper-left of droplet
    const hx = ex + 0.16;
    const hy = ey + 0.12;
    const rotX = hx * Math.cos(0.42) - hy * Math.sin(0.42);
    const rotY = hx * Math.sin(0.42) + hy * Math.cos(0.42);
    if ((rotX * rotX) / (0.045 * 0.045) + (rotY * rotY) / (0.11 * 0.11) <= 1) {
      dR = mix(dR, 255, 0.45);
      dG = mix(dG, 255, 0.45);
      dB = mix(dB, 255, 0.45);
    }

    // Crisp "H" emblem centered in droplet
    const inLeftBar = isInsideRoundedRect(ex + 0.145, ey - 0.16, 0.055, 0.22, 0.02);
    const inRightBar = isInsideRoundedRect(ex - 0.145, ey - 0.16, 0.055, 0.22, 0.02);
    const inCrossBar = isInsideRoundedRect(ex, ey - 0.16, 0.19, 0.05, 0.018);

    if (inLeftBar || inRightBar) {
      dR = 255;
      dG = 255;
      dB = 255;
    } else if (inCrossBar) {
      // Golden-amber crossbar matching Hydrate Hub BrandMark (#FBBF24 -> #F59E0B)
      dR = 245;
      dG = 158;
      dB = 11;
    }

    return [Math.round(dR), Math.round(dG), Math.round(dB), 255];
  }

  return [Math.round(outR), Math.round(outG), Math.round(outB), outA];
}

function renderIcon(width: number, height: number, mode: IconMode): Buffer {
  const rgba = Buffer.alloc(width * height * 4);
  const sub = width > 1024 ? 2 : 4; // 4x4 supersampling for icons; 2x2 inside splash emblem
  const invSamples = 1 / (sub * sub);
  const isSplash = mode === 'splash' || mode === 'splashDark';
  const splashR = mode === 'splashDark' ? 6 : 10;
  const splashG = mode === 'splashDark' ? 19 : 31;
  const splashB = mode === 'splashDark' ? 43 : 68;

  for (let y = 0; y < height; y++) {
    const vCenter = (y + 0.5) / height;
    const cyCenter = vCenter * 2 - 1;
    const rowOutsideSplashEmblem = isSplash && Math.abs(cyCenter) > 0.25;

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (rowOutsideSplashEmblem || (isSplash && Math.abs(((x + 0.5) / width) * 2 - 1) > 0.25)) {
        rgba[idx] = splashR;
        rgba[idx + 1] = splashG;
        rgba[idx + 2] = splashB;
        rgba[idx + 3] = 255;
        continue;
      }

      let rAcc = 0;
      let gAcc = 0;
      let bAcc = 0;
      let aAcc = 0;

      for (let sy = 0; sy < sub; sy++) {
        for (let sx = 0; sx < sub; sx++) {
          const u = (x + (sx + 0.5) / sub) / width;
          const v = (y + (sy + 0.5) / sub) / height;
          const [r, g, b, a] = sampleIconPixel(u, v, mode);
          rAcc += r * (a / 255);
          gAcc += g * (a / 255);
          bAcc += b * (a / 255);
          aAcc += a;
        }
      }

      const avgA = aAcc * invSamples;
      if (avgA > 0.5) {
        const norm = 255 / avgA;
        rgba[idx] = Math.min(255, Math.round(rAcc * invSamples * norm));
        rgba[idx + 1] = Math.min(255, Math.round(gAcc * invSamples * norm));
        rgba[idx + 2] = Math.min(255, Math.round(bAcc * invSamples * norm));
        rgba[idx + 3] = Math.min(255, Math.round(avgA));
      } else {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
      }
    }
  }

  return encodePng(width, height, rgba);
}

const publicDir = path.resolve(process.cwd(), 'public');
const assetsDir = path.resolve(process.cwd(), 'assets');
fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

console.log('Generating Hydrate Hub PWA, Android, and iOS icons...');

// 1. PWA standard icons (purpose: "any")
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), renderIcon(192, 192, 'any'));
console.log('Created public/pwa-192x192.png (192x192 any)');

fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), renderIcon(512, 512, 'any'));
console.log('Created public/pwa-512x512.png (512x512 any)');

// 2. PWA maskable icon (opaque full-bleed with 19% safe-zone padding)
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), renderIcon(512, 512, 'maskable'));
console.log('Created public/pwa-maskable-512x512.png (512x512 maskable opaque)');

// 3. iOS Safari Apple Touch Icon (180x180 opaque PNG — zero transparent corners)
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), renderIcon(180, 180, 'opaque'));
console.log('Created public/apple-touch-icon.png (180x180 opaque iOS)');

// 4. Desktop Browser Favicon (.ico wrapping 48x48 PNG)
const faviconPng = renderIcon(48, 48, 'any');
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), encodeIco(faviconPng, 48));
console.log('Created public/favicon.ico (48x48 ICO)');

// 5. Capacitor Native Android & iOS Master Assets (1024x1024 icons, 2732x2732 splash)
fs.writeFileSync(path.join(assetsDir, 'icon-only.png'), renderIcon(1024, 1024, 'opaque'));
console.log('Created assets/icon-only.png (1024x1024 opaque iOS/legacy Android)');

fs.writeFileSync(path.join(assetsDir, 'icon-foreground.png'), renderIcon(1024, 1024, 'foreground'));
console.log('Created assets/icon-foreground.png (1024x1024 Android adaptive foreground)');

fs.writeFileSync(path.join(assetsDir, 'icon-background.png'), renderIcon(1024, 1024, 'background'));
console.log('Created assets/icon-background.png (1024x1024 Android adaptive background)');

fs.writeFileSync(path.join(assetsDir, 'splash.png'), renderIcon(2732, 2732, 'splash'));
fs.writeFileSync(path.join(assetsDir, 'splash-dark.png'), renderIcon(2732, 2732, 'splashDark'));
console.log('Created assets/splash.png & assets/splash-dark.png (2732x2732)');

console.log('All Hydrate Hub icons generated successfully.');
