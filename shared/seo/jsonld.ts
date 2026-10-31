import { BRAND } from '../brand'
import type { BlogDocument } from '../types/blog'

const SITE_NAME = BRAND.name

/** Article, ranking, breadcrumb and FAQ markup, all from the stored document. */
export function buildJsonLd(doc: BlogDocument, origin: string): object[] {
  const url = `${origin}/blog/${doc.slug}`
  const publisher = { '@type': 'Organization', 'name': SITE_NAME, 'url': origin, 'logo': { '@type': 'ImageObject', 'url': `${origin}/icon-512.png` } }
  const article = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': doc.copy.h1,
    'description': doc.copy.metaDescription,
    'url': url,
    'mainEntityOfPage': url,
    'datePublished': doc.provenance.generatedAt,
    'dateModified': doc.provenance.generatedAt,
    'image': `${origin}/og.png`,
    'inLanguage': 'en-GB',
    'keywords': doc.copy.keywords.join(', '),
    'author': publisher,
    publisher,
  }
  const list = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': doc.copy.h1,
    'numberOfItems': doc.dataset.rows.length,
    'itemListOrder': 'https://schema.org/ItemListOrderDescending',
    'itemListElement': doc.dataset.rows.map(row => ({
      '@type': 'ListItem',
      'position': row.rank,
      'item': { '@type': 'Organization', 'name': row.name, ...(row.url ? { url: row.url } : {}), ...(row.description ? { description: row.description } : {}) },
    })),
  }
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': origin },
      { '@type': 'ListItem', 'position': 2, 'name': doc.copy.h1, 'item': url },
    ],
  }
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': doc.copy.faq.map(item => ({
      '@type': 'Question',
      'name': item.question,
      'acceptedAnswer': { '@type': 'Answer', 'text': item.answer },
    })),
  }
  return [article, list, breadcrumbs, faq]
}

/** Stops a cell such as `</script>` from closing the tag this JSON sits in. */
export function serialiseJsonLd(value: object): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', ' ').replaceAll('\u2029', ' ')
}
