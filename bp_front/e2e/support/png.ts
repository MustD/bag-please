import {inflateSync} from 'node:zlib'

// A minimal PNG reader, in the suite rather than in a throwaway script on
// purpose (Story 7.14 review): the maskable icon's safe-zone property is the
// one thing standing between the committed artwork and Android's adaptive-icon
// mask clipping it, and a check that lives only in a deleted temp directory
// gates nothing. Everything here reads the icon BYTES, so it also catches a
// re-rasterisation that silently changes the artwork's scale.
//
// Deliberately narrow: 8-bit RGB or RGBA only, which is what rsvg-convert emits
// for these icons. Anything else THROWS rather than returning a soft pass — a
// format change must be loud.

export type DecodedPng = {width: number; height: number; channels: number; pixels: Buffer}

const PNG_SIGNATURE = '89504e470d0a1a0a'

export function decodePng(bytes: Buffer): DecodedPng {
  if (bytes.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) throw new Error('not a PNG')

  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  const bitDepth = bytes[24]
  const colorType = bytes[25]
  if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth}`)
  if (colorType !== 2 && colorType !== 6) throw new Error(`unsupported PNG colour type ${colorType}`)
  const channels = colorType === 6 ? 4 : 3

  const idat: Buffer[] = []
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii')
    if (type === 'IDAT') idat.push(bytes.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }

  // Undo the per-scanline filters (PNG spec 9.2). Each row is prefixed with its
  // filter type byte and predicts from the pixel to the left (a), the row above
  // (b) and the pixel above-left (c).
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const pixels = Buffer.alloc(stride * height)
  let previous = Buffer.alloc(stride)
  for (let y = 0, pos = 0; y < height; y++) {
    const filter = raw[pos++]
    const line = Buffer.from(raw.subarray(pos, pos + stride))
    pos += stride
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0
      const b = previous[x]
      const c = x >= channels ? previous[x - channels] : 0
      if (filter === 1) line[x] = (line[x] + a) & 0xff
      else if (filter === 2) line[x] = (line[x] + b) & 0xff
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 0xff
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff
      } else if (filter !== 0) throw new Error(`unsupported PNG filter ${filter}`)
    }
    line.copy(pixels, y * stride)
    previous = line
  }

  return {width, height, channels, pixels}
}

// Android composites a maskable icon under masks that all CONTAIN the central
// circle of 80% diameter — so proving every pixel outside that circle is the
// flat background proves no mask can clip the artwork, for a circle, a squircle
// or anything between. Returns the offending pixel count so a failure reports a
// magnitude rather than a bare boolean.
export function maskableSafeZoneViolations(png: DecodedPng, background: [number, number, number]): number {
  const {width, height, channels, pixels} = png
  const centre = width / 2
  const safeRadiusSquared = (width * 0.4) ** 2
  let violations = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((x - centre) ** 2 + (y - centre) ** 2 <= safeRadiusSquared) continue
      const at = y * width * channels + x * channels
      const opaque = channels === 3 || pixels[at + 3] === 255
      if (!opaque) violations++
      else if (pixels[at] !== background[0] || pixels[at + 1] !== background[1] || pixels[at + 2] !== background[2]) violations++
    }
  }
  return violations
}
