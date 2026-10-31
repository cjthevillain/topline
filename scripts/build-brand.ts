/**
 * Draws the favicons, app icons and default sharing card from one set of paths.
 * Run with `pnpm brand` after changing the mark.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import { BRAND } from '../shared/brand'
import { LOGO } from '../shared/logo'
import { OG_FONT_FILES, renderOgImage } from '../server/utils/ogImage'

const INK = '#121417'
const { mark: MARK, smallMark: SMALL_MARK } = LOGO

const output = (name: string) => new URL(`../public/${name}`, import.meta.url)
const png = (svg: string, size: number) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()

const small = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="${fill}" d="${SMALL_MARK}"/></svg>`
/** `scale` is the share of the tile the mark fills. Maskable icons need it inside the safe zone. */
const tile = (scale: number) => {
  const offset = (24 - 24 * scale) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="512" height="512"><rect width="24" height="24" fill="${INK}"/><path fill="#FFFFFF" transform="translate(${offset} ${offset}) scale(${scale})" d="${MARK}"/></svg>`
}

writeFileSync(output('favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><style>path{fill:${INK}}@media (prefers-color-scheme:dark){path{fill:#fff}}</style><path d="${SMALL_MARK}"/></svg>\n`)
writeFileSync(output('apple-touch-icon.png'), png(tile(0.72), 180))
writeFileSync(output('icon-192.png'), png(tile(0.72), 192))
writeFileSync(output('icon-512.png'), png(tile(0.72), 512))
writeFileSync(output('icon-maskable-512.png'), png(tile(0.6), 512))

// An .ico is a small directory followed by whole PNG files.
const sizes = [16, 32, 48]
const images = sizes.map(size => png(small(INK), size))
const directory = Buffer.alloc(6 + sizes.length * 16)
directory.writeUInt16LE(1, 2)
directory.writeUInt16LE(sizes.length, 4)
let offset = directory.length
images.forEach((image, i) => {
  const entry = 6 + i * 16
  directory.writeUInt8(sizes[i]!, entry)
  directory.writeUInt8(sizes[i]!, entry + 1)
  directory.writeUInt16LE(1, entry + 4)
  directory.writeUInt16LE(32, entry + 6)
  directory.writeUInt32LE(image.length, entry + 8)
  directory.writeUInt32LE(offset, entry + 12)
  offset += image.length
})
writeFileSync(output('favicon.ico'), Buffer.concat([directory, ...images]))

const fonts = OG_FONT_FILES.map(({ file, weight }) => ({
  name: 'Archivo' as const,
  weight,
  style: 'normal' as const,
  data: readFileSync(new URL(`../server/assets/og/${file}`, import.meta.url)),
}))
writeFileSync(output('og.png'), await renderOgImage({ title: BRAND.tagline, note: 'Every figure comes from your data.' }, fonts))
console.log('Wrote the icons and sharing card.')
