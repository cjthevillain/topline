import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { LOGO } from '../../shared/logo'

export interface OgCard {
  title: string
  /** The large number and what it counts. A page with neither shows the description only. */
  figure?: string
  label?: string
  note?: string
}

export interface OgFont {
  name: 'Archivo'
  data: Buffer
  weight: 500 | 600
  style: 'normal'
}

export const OG_FONT_FILES = [
  { file: 'archivo-latin-500-normal.woff', weight: 500 },
  { file: 'archivo-latin-600-normal.woff', weight: 600 },
  { file: 'archivo-latin-ext-500-normal.woff', weight: 500 },
  { file: 'archivo-latin-ext-600-normal.woff', weight: 600 },
] as const

const INK = '#121417'
const MUTED = '#5B616B'
const ACCENT = '#0A3BDB'
const LOCKUP_HEIGHT = 48
const LOCKUP = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO.viewBox}" width="${LOGO.width}" height="${LOGO.height}"><g transform="${LOGO.markTransform}"><path fill="${INK}" d="${LOGO.mark}"/></g><g transform="${LOGO.wordTransform}"><path fill="${INK}" d="${LOGO.word}"/></g></svg>`).toString('base64')}`

const box = (style: Record<string, unknown>, ...children: unknown[]) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children } })
const text = (style: Record<string, unknown>, value: string) => ({ type: 'div', props: { style, children: value } })

/** The sharing card for a page: the top line, the title and the headline figure. */
export async function renderOgImage(card: OgCard, fonts: OgFont[]): Promise<Buffer> {
  const tree = box(
    { width: 1200, height: 630, flexDirection: 'column', background: '#FAFBFC', color: INK, fontFamily: 'Archivo' },
    box({ height: 14, width: 1200, background: INK }),
    box(
      { flex: 1, flexDirection: 'column', justifyContent: 'space-between', padding: '48px 64px 52px' },
      box(
        { flexDirection: 'column' },
        { type: 'img', props: { src: LOCKUP, height: LOCKUP_HEIGHT, width: Math.round(LOCKUP_HEIGHT * (LOGO.width / LOGO.height)), style: { marginBottom: 36 } } },
        text({ fontSize: card.figure ? 56 : 72, fontWeight: 600, lineHeight: 1.1, letterSpacing: card.figure ? -1.2 : -1.6, lineClamp: 3, display: 'block' }, card.title),
      ),
      box(
        { alignItems: 'flex-end', justifyContent: 'space-between', borderTop: `2px solid ${INK}`, paddingTop: 22 },
        card.figure
          ? box(
              { flexDirection: 'column' },
              box({ height: 6, width: 96, background: ACCENT, marginBottom: 16 }),
              text({ fontSize: 88, fontWeight: 500, lineHeight: 1, letterSpacing: -3 }, card.figure),
              text({ marginTop: 8, fontSize: 26, fontWeight: 500, color: MUTED }, card.label ?? ''),
            )
          : text({ fontSize: 30, fontWeight: 500, color: MUTED, maxWidth: 880 }, card.note ?? ''),
        card.figure && card.note ? text({ fontSize: 26, fontWeight: 500, color: MUTED }, card.note) : box({}),
      ),
    ),
  )
  const svg = await satori(tree as Parameters<typeof satori>[0], { width: 1200, height: 630, fonts })
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng())
}
