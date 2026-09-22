// Generates the PWA / home-screen icons as real PNG files.
// No image library needed - this writes the PNG bytes directly.
//   node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

function crc32(buf) {
  let c, table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixel) {
  // raw scanlines, filter byte 0 per row, RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let p = 0
  for (let y = 0; y < size; y++) {
    raw[p++] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size)
      raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8    // bit depth
  ihdr[9] = 6    // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const lerp = (a, b, t) => a + (b - a) * t
// soft sage gradient, matching the app's primary colour
const TOP = [122, 165, 137]
const BOT = [74, 122, 94]

// implicit heart curve; returns <= 0 inside the shape
function heart(x, y) {
  const a = x * x + y * y - 1
  return a * a * a - x * x * y * y * y
}

function makeIcon(size, { maskable = false } = {}) {
  const pad = maskable ? 0 : size * 0.06    // maskable icons must fill the square
  const r = size * 0.235                    // corner radius
  // fraction of the icon width the heart spans. Maskable icons need the glyph
  // inside the 80% safe zone because launchers crop the edges into a circle.
  const glyph = maskable ? 0.40 : 0.52

  const SS = 4                              // 4x4 supersampling for clean edges
  const halfW = (size * glyph) / 2
  const cx = size / 2
  // the heart curve spans y in [-1.26, 1.0]; nudge down so it looks centred
  const cy = size * 0.5 - halfW * 0.13

  const inRounded = (px, py) => {
    if (maskable) return true
    const lo = pad, hi = size - pad
    if (px < lo || px > hi || py < lo || py > hi) return false
    const qx = Math.min(Math.max(px, lo + r), hi - r)
    const qy = Math.min(Math.max(py, lo + r), hi - r)
    return Math.hypot(px - qx, py - qy) <= r
  }

  const inHeart = (px, py) =>
    heart((px - cx) / halfW, (cy - py) / halfW) <= 0

  return png(size, (x, y) => {
    let bgHits = 0, glyphHits = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS
        const py = y + (sy + 0.5) / SS
        if (!inRounded(px, py)) continue
        bgHits++
        if (inHeart(px, py)) glyphHits++
      }
    }
    const total = SS * SS
    if (bgHits === 0) return [0, 0, 0, 0]

    // diagonal gradient background
    const t = Math.min(Math.max((x / size) * 0.35 + (y / size) * 0.65, 0), 1)
    let R = lerp(TOP[0], BOT[0], t)
    let G = lerp(TOP[1], BOT[1], t)
    let B = lerp(TOP[2], BOT[2], t)

    // white heart, coverage-blended against the background it sits on
    const cov = glyphHits / bgHits
    if (cov > 0) {
      R = lerp(R, 255, cov); G = lerp(G, 255, cov); B = lerp(B, 255, cov)
    }

    return [Math.round(R), Math.round(G), Math.round(B), Math.round((255 * bgHits) / total)]
  })
}

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: true }], // iOS adds its own corners
  ['favicon-32.png', 32, {}],
]

for (const [name, size, opts] of targets) {
  const buf = makeIcon(size, opts)
  writeFileSync(join(OUT, name), buf)
  console.log(`wrote ${name}  ${size}x${size}  ${(buf.length / 1024).toFixed(1)}kb`)
}
