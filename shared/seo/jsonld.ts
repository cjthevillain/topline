import { BRAND } from '../brand'
import type { BlogDocument, BlogSummary } from '../types/blog'

const SITE_NAME = BRAND.name

function organisation(origin: string) {
  return { '@type': 'Organization', '@id': `${origin}/#organization`, 'name': SITE_NAME, 'url': `${origin}/`, 'logo': { '@type': 'ImageObject', 'url': `${origin}/icon-512.png` } }
}

/** Who runs the site, what the site is and what the product does. On the home page. */
export function siteJsonLd(origin: string): object[] {
  return [
    { '@context': 'https://schema.org', ...organisation(origin), 'sameAs': [BRAND.repo] },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${origin}/#website`,
      'url': `${origin}/`,
      'name': SITE_NAME,
      'description': BRAND.description,
      'inLanguage': 'en-GB',
      'publisher': { '@id': `${origin}/#organization` },
      'potentialAction': {
        '@type': 'SearchAction',
        'target': { '@type': 'EntryPoint', 'urlTemplate': `${origin}/blog?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': SITE_NAME,
      'url': `${origin}/generate`,
      'applicationCategory': 'BusinessApplication',
      'operatingSystem': 'Any',
      'description': BRAND.description,
      'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'GBP' },
    },
  ]
}

/** The rankings index, as a list of links to each page. */
export function collectionJsonLd(blogs: BlogSummary[], origin: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': `${SITE_NAME} rankings`,
    'url': `${origin}/blog`,
    'isPartOf': { '@id': `${origin}/#website` },
    'mainEntity': {
      '@type': 'ItemList',
      'numberOfItems': blogs.length,
      'itemListElement': blogs.map((blog, index) => ({ '@type': 'ListItem', 'position': index + 1, 'url': `${origin}/blog/${blog.slug}`, 'name': blog.title })),
    },
  }
}

/** Article, ranking, breadcrumb, FAQ and dataset markup, all from the stored document. */
export function buildJsonLd(doc: BlogDocument, origin: string): object[] {
  const url = `${origin}/blog/${doc.slug}`
  const publisher = organisation(origin)
  const words = [doc.copy.intro, ...doc.copy.sections.map(s => s.paragraphs), doc.copy.faq.map(f => f.answer)].flat().join(' ')
  const article = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': doc.copy.h1,
    'description': doc.copy.metaDescription,
    'url': url,
    'mainEntityOfPage': url,
    'datePublished': doc.provenance.generatedAt,
    'dateModified': doc.provenance.generatedAt,
    'image': `${origin}/og/${doc.slug}.png`,
    'inLanguage': 'en-GB',
    'keywords': doc.copy.keywords.join(', '),
    'articleSection': doc.context.topic,
    'wordCount': words.split(/\s+/).filter(Boolean).length,
    'isAccessibleForFree': true,
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
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${origin}/` },
      { '@type': 'ListItem', 'position': 2, 'name': 'Rankings', 'item': `${origin}/blog` },
      { '@type': 'ListItem', 'position': 3, 'name': doc.copy.h1, 'item': url },
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
  const dataset = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    'name': doc.copy.h1,
    'description': doc.copy.metaDescription,
    'url': url,
    'dateModified': doc.provenance.generatedAt,
    'creator': publisher,
    'variableMeasured': [doc.dataset.metric?.header, ...doc.dataset.columns.map(c => c.header)].filter(Boolean),
    'distribution': { '@type': 'DataDownload', 'encodingFormat': 'text/csv', 'contentUrl': `${origin}/data/${doc.slug}.csv` },
  }
  return [article, list, breadcrumbs, faq, dataset]
}

/** Stops a cell such as `</script>` from closing the tag this JSON sits in. */
export function serialiseJsonLd(value: object): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', ' ').replaceAll('\u2029', ' ')
}
