// scripts/make-icon.mjs —— 生成 512x512 圆角方块图标（紫 #A898FA），供 `tauri icon` 转全套
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIZE = 512;
const ACCENT = [168, 152, 250];

// CRC32
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// 圆角方块遮罩（角半径 100px）
function inside(x, y) {
  const dx = Math.abs(x - 256), dy = Math.abs(y - 256);
  if (dx > 206 || dy > 206) return false;
  if (dx > 156 && dy > 156) {
    const cx = dx - 156, cy = dy - 156;
    if (cx * cx + cy * cy > 100 * 100) return false;
  }
  return true;
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
let p = 0;
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0; // filter none
  for (let x = 0; x < SIZE; x++) {
    if (inside(x, y)) {
      // 中心稍微提亮，做出一点体积感
      const dx = (x - 256) / 256, dy = (y - 256) / 256;
      const lift = Math.max(0, 1 - (dx * dx + dy * dy) * 1.1) * 18;
      raw[p++] = Math.min(255, ACCENT[0] + lift);
      raw[p++] = Math.min(255, ACCENT[1] + lift);
      raw[p++] = Math.min(255, ACCENT[2] + lift);
      raw[p++] = 255;
    } else {
      raw[p++] = 0; raw[p++] = 0; raw[p++] = 0; raw[p++] = 0;
    }
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0))
]);

mkdirSync(join(__dirname, '..', 'src-tauri', 'icons'), { recursive: true });
writeFileSync(join(__dirname, '..', 'src-tauri', 'icons', 'icon-source.png'), png);
console.log('icon-source.png written:', png.length, 'bytes');
