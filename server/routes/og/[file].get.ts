import { headlineTile } from '#shared/pipeline/document'
import { formatCount } from '#shared/ui/format'

const FILE = /^(.+)\.png$/

async function loadFonts(): Promise<OgFont[]> {
  const assets = useStorage('assets:og')
  return await Promise.all(OG_FONT_FILES.map(async ({ file, weight }) => ({
    name: 'Archivo' as const,
    weight,
    style: 'normal' as const,
    data: Buffer.from(await assets.getItemRaw(file) as Uint8Array),
  })))
}

/** Drawn the first time it is asked for, then kept with the page. */
export default defineEventHandler(async (event) => {
  const slug = FILE.exec(getRouterParam(event, 'file') ?? '')?.[1]
  const doc = slug ? await getBlog(slug) : null
  if (!slug || !doc) throw createError({ statusCode: 404, statusMessage: 'Image not found' })

  const store = useStorage('blogs')
  const key = `og:${slug}.png`
  let image = await store.getItemRaw<Buffer>(key)
  if (!image) {
    const figure = headlineTile(doc)
    try {
      image = await renderOgImage({ title: doc.copy.h1, figure: figure.value, label: figure.label, note: figure.id === 'count' ? undefined : `${formatCount(doc.dataset.rows.length)} companies` }, await loadFonts())
      await store.setItemRaw(key, image)
    }
    catch {
      // Text the font cannot draw must not break a share preview.
      return sendRedirect(event, '/og.png', 302)
    }
  }
  setResponseHeaders(event, { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' })
  return image
})
