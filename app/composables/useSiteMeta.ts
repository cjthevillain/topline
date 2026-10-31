import { BRAND } from '#shared/brand'

interface SiteMeta {
  title: string
  description: string
  path: string
  image?: string
  imageAlt?: string
  type?: 'website' | 'article'
  publishedAt?: string
}

/** The title, description, canonical link and sharing tags for one page, always set together. */
export function useSiteMeta({ title, description, path, image = '/og.png', imageAlt = `${BRAND.name}: ${BRAND.tagline}`, type = 'website', publishedAt }: SiteMeta) {
  const origin = useSiteOrigin()
  const url = `${origin}${path}`
  const imageUrl = `${origin}${image}`
  useSeoMeta({
    title,
    description,
    robots: 'index, follow, max-snippet:-1, max-image-preview:large',
    ogTitle: title,
    ogDescription: description,
    ogType: type,
    ogUrl: url,
    ogSiteName: BRAND.name,
    ogLocale: BRAND.locale,
    ogImage: imageUrl,
    ogImageType: 'image/png',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: imageAlt,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: imageUrl,
    twitterImageAlt: imageAlt,
    articlePublishedTime: publishedAt,
    articleModifiedTime: publishedAt,
  })
  useHead({ link: [{ rel: 'canonical', href: url }] })
}
