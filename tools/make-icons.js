/* Generates the PWA icons from the same golden-angle maths the game
   uses to draw its plants, so the icon is a real phyllotactic seed
   head rather than a picture of one. Writes 8-bit RGB PNGs with no
   dependencies. Run: node tools/make-icons.js */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const GOLDEN = 137.5077640500378 * Math.PI / 180;

/* ---- tiny PNG writer ---- */
const CRC_TABLE = (function () {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function png(width, height, rgb) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 2;      // colour type: truecolour RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // raw scanlines, each prefixed with filter type 0
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const off = y * (1 + width * 3);
    raw[off] = 0;
    rgb.copy(raw, off + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---- a very small software rasteriser ---- */
function makeCanvas(S) {
  const buf = Buffer.alloc(S * S * 3);
  return {
    S: S, buf: buf,
    set: function (x, y, r, g, b, a) {
      if (x < 0 || y < 0 || x >= S || y >= S) return;
      const i = (y * S + x) * 3;
      if (a === undefined) a = 1;
      buf[i]     = Math.round(buf[i]     * (1 - a) + r * a);
      buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + g * a);
      buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + b * a);
    },
    disc: function (cx, cy, rad, r, g, b) {
      const x0 = Math.floor(cx - rad - 1), x1 = Math.ceil(cx + rad + 1);
      const y0 = Math.floor(cy - rad - 1), y1 = Math.ceil(cy + rad + 1);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d > rad + 0.7) continue;
          this.set(x, y, r, g, b, Math.max(0, Math.min(1, rad + 0.5 - d)));   // soft edge
        }
      }
    },
    /* an ellipse rotated about (cx,cy) — used for the ray petals */
    petal: function (cx, cy, dist, rx, ry, ang, r, g, b) {
      const ox = cx + Math.cos(ang) * dist, oy = cy + Math.sin(ang) * dist;
      const rad = Math.max(rx, ry) + 1;
      const ca = Math.cos(-ang), sa = Math.sin(-ang);
      for (let y = Math.floor(oy - rad); y <= Math.ceil(oy + rad); y++) {
        for (let x = Math.floor(ox - rad); x <= Math.ceil(ox + rad); x++) {
          const dx = x + 0.5 - ox, dy = y + 0.5 - oy;
          const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
          const v = (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry);
          if (v <= 1) this.set(x, y, r, g, b, Math.min(1, (1 - v) * 6 + 0.35));
        }
      }
    }
  };
}
function hsl(h, s, l) {                       // -> [r,g,b] 0..255
  s /= 100; l /= 100;
  const k = function (n) { return (n + h / 30) % 12; };
  const a = s * Math.min(l, 1 - l);
  const f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function drawIcon(S) {
  const c = makeCanvas(S);
  // soil-to-night vertical gradient
  for (let y = 0; y < S; y++) {
    const t = y / (S - 1);
    const r = Math.round(0x1d * (1 - t) + 0x0b * t);
    const g = Math.round(0x26 * (1 - t) + 0x0f * t);
    const b = Math.round(0x17 * (1 - t) + 0x08 * t);
    for (let x = 0; x < S; x++) c.set(x, y, r, g, b, 1);
  }
  const cx = S / 2, cy = S * 0.47, R = S * 0.30;
  // stem
  const sw = S * 0.022;
  for (let y = Math.round(cy + R * 1.15); y < S * 0.95; y++)
    for (let x = Math.round(cx - sw); x <= Math.round(cx + sw); x++)
      c.set(x, y, 0x3f, 0x8a, 0x44, 1);
  // 34 ray petals — a Fibonacci number, as on a real sunflower
  const PET = 34;
  for (let p = 0; p < PET; p++) {
    const th = (p / PET) * Math.PI * 2;
    const col = p % 2 ? [0xf0, 0xb5, 0x2e] : [0xe7, 0x9a, 0x3c];
    c.petal(cx, cy, R * 1.30, R * 0.46, R * 0.115, th, col[0], col[1], col[2]);
  }
  // the seed head itself, at the golden angle
  const N = Math.round(S * 1.35);
  const k = R / Math.sqrt(N);
  for (let i = 0; i < N; i++) {
    const r = k * Math.sqrt(i + 0.5), th = (i + 0.5) * GOLDEN;
    const t = i / (N - 1);
    const col = hsl(44 - t * 26, 80 - t * 10, 68 - t * 34);
    c.disc(cx + Math.cos(th) * r, cy + Math.sin(th) * r, Math.max(1.0, S * 0.0105), col[0], col[1], col[2]);
  }
  return png(S, S, c.buf);
}

const dir = path.join(__dirname, '..');
[192, 512].forEach(function (S) {
  const out = path.join(dir, 'icon-' + S + '.png');
  fs.writeFileSync(out, drawIcon(S));
  console.log('wrote icon-' + S + '.png (' + fs.statSync(out).size + ' bytes)');
});
