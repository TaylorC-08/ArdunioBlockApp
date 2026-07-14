// Generates build/icon.ico — a 256x256 PNG-compressed Windows icon — with no
// dependencies (PNG chunks + zlib from Node, wrapped in an ICO container).
// Design: four rounded colored blocks on a dark rounded tile (block coding motif).
// Run once (or after tweaking): node scripts/gen-icon.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const S = 256;

// ---- Pixel drawing ----

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
  const cx = Math.max(x0 + r, Math.min(x, x1 - r));
  const cy = Math.max(y0 + r, Math.min(y, y1 - r));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r || (x >= x0 + r && x < x1 - r) || (y >= y0 + r && y < y1 - r);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const TILE = hex('#1e1e1e');
const BLOCKS = [
  { x0: 32, y0: 32, c: hex('#CC6600') },   // orange — Arduino I/O
  { x0: 152, y0: 32, c: hex('#5C81A6') },  // blue   — logic
  { x0: 32, y0: 152, c: hex('#5CA65C') },  // green  — loops
  { x0: 152, y0: 152, c: hex('#9A5CA6') }, // purple — functions
];
const B = 72;    // block size
const GAP = 48;  // implied by positions above

const px = Buffer.alloc(S * S * 4);
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    let rgb = null, alpha = 0;
    if (inRoundRect(x, y, 8, 8, S - 8, S - 8, 44)) { rgb = TILE; alpha = 255; }
    for (const b of BLOCKS) {
      if (inRoundRect(x, y, b.x0, b.y0, b.x0 + B, b.y0 + B, 14)) { rgb = b.c; alpha = 255; }
    }
    if (rgb) { px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = alpha; }
  }
}

// ---- PNG encoding ----

const CRC_TABLE = (() => {
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
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;   // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- ICO container (single 256x256 PNG entry) ----

const png = encodePng(S, S, px);
const ico = Buffer.alloc(22 + png.length);
ico.writeUInt16LE(0, 0);            // reserved
ico.writeUInt16LE(1, 2);            // type: icon
ico.writeUInt16LE(1, 4);            // image count
ico[6] = 0;                         // width 256 -> 0
ico[7] = 0;                         // height 256 -> 0
ico[8] = 0;                         // palette
ico[9] = 0;                         // reserved
ico.writeUInt16LE(1, 10);           // planes
ico.writeUInt16LE(32, 12);          // bpp
ico.writeUInt32LE(png.length, 14);  // data size
ico.writeUInt32LE(22, 18);          // data offset
png.copy(ico, 22);

const out = path.join(__dirname, '..', 'build', 'icon.ico');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, ico);
console.log(`Wrote ${out} (${ico.length} bytes)`);
