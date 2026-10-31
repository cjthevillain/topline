/** The product name and everything said about it. Change them here and nowhere else. */
export const BRAND = {
  name: 'Topline',
  tagline: 'The headline numbers from any company dataset',
  description: 'Turn a spreadsheet of companies into a ranked page that readers and search engines can trust. Every figure comes from your data.',
  locale: 'en_GB',
  operator: 'CJ Villanueva',
  email: 'hi@itsmechristian.co.uk',
  repo: 'https://github.com/cjthevillain/topline',
} as const

/** The pages that always exist, for the sitemap and the footer. */
export const STATIC_PAGES = ['/', '/blog', '/generate', '/how-it-works', '/privacy', '/terms'] as const
