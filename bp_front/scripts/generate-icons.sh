#!/usr/bin/env bash
# Regenerate the PWA launcher icons from public/favicon.svg (Story 7.14).
#
# Committed to the repo because the icons are GENERATED artefacts with a
# non-obvious geometric constraint, and the recipe previously existed only in a
# story record. Change favicon.svg and you must re-run this, or the installed
# app's icon silently drifts from the browser tab's.
#
# Requires: rsvg-convert (librsvg) and magick (ImageMagick 7).
#
# Usage:  bash scripts/generate-icons.sh [output-dir]     (default: public/icons)
#
# REPRODUCIBILITY: running this on a clean tree is a no-op — all three files come
# back byte-identical (librsvg 2.62.3 + ImageMagick 7). That is the property that
# makes the script, rather than a story record, the source of truth. Correctness
# is separately gated by the suite: e2e/pwa.spec.ts re-derives the maskable
# safe-zone property from the SERVED bytes, so a bad re-raster fails the run.

set -euo pipefail

cd "$(dirname "$0")/.."
SOURCE="public/favicon.svg"
OUT="${1:-public/icons}"

for tool in rsvg-convert magick; do
  command -v "$tool" >/dev/null || { echo "error: $tool is required but not installed" >&2; exit 1; }
done
[ -f "$SOURCE" ] || { echo "error: $SOURCE not found" >&2; exit 1; }
mkdir -p "$OUT"

# purpose: 'any' — full-bleed, exactly as the favicon draws itself.
rsvg-convert -w 192 -h 192 "$SOURCE" -o "$OUT/icon-192.png"
rsvg-convert -w 512 -h 512 "$SOURCE" -o "$OUT/icon-512.png"

# purpose: 'maskable' — the artwork at 307px (~60%) centred on an OPAQUE
# #1C1C1E field filling the whole 512 canvas. Both halves matter:
#   * 60% because the glyph's extreme corner sits 0.46 of the icon width from
#     centre, so a full-bleed 512 raster lands it 235px out against Android's
#     204.8px safe radius (0.4 x 512) and gets clipped by the adaptive mask;
#   * opaque and full-bleed because transparency at the edge is what produces
#     the letterboxed "broken third-party install" look.
# -depth 8 is load-bearing: without it ImageMagick writes a 16-bit PNG, which
# e2e/support/png.ts rejects outright rather than mis-decoding.
# -strip is load-bearing too: ImageMagick otherwise writes tIME plus three tEXt
# metadata chunks carrying the current timestamp, so two runs of this script
# minutes apart produced DIFFERENT bytes. A generator whose output churns on
# every run cannot be the source of truth for a committed artefact.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
rsvg-convert -w 307 -h 307 "$SOURCE" -o "$TMP/artwork.png"
magick -size 512x512 xc:'#1C1C1E' "$TMP/artwork.png" -gravity center -composite \
  -alpha remove -alpha off -depth 8 -strip -define png:color-type=2 "$OUT/icon-512-maskable.png"

echo "wrote $OUT/icon-192.png $OUT/icon-512.png $OUT/icon-512-maskable.png"
