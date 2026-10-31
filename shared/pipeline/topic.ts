import type { Dataset, Role, TopicContext } from '../types/blog'

const FILLER = /\b(top|best|biggest|largest|leading|list|of|the|uk|gb|british|companies|company|startups?|scale-?ups?|firms?|businesses|dataset|data|export|final|copy|upload|sample|example|test|file|new|ranked|ranking|by|funding|raised|total|clean|cleaned|messy|raw|minimal|directory|unsorted|tabs|sheet)\b/gi
const SHOUTY = new Set(['ai', 'ml', 'iot', 'saas', 'vr', 'ar', 'hr', 'b2b', 'b2c', 'ev', 'web3'])

const UK_PLACES = /^(?:london|greater london|south east|south west|north east|north west|east of england|east midlands|west midlands|yorkshire(?: and (?:the )?humber)?|wales|scotland|northern ireland|(?:east|west|north|south) of scotland|highlands(?: and islands)?|uk|united kingdom|great britain|england|manchester|birmingham|leeds|bristol|edinburgh|glasgow|cardiff|belfast|cambridge|oxford|sheffield|liverpool|newcastle|nottingham)$/i

/** Works out what the page is about, from the form, then the filename, then the data. */
export function inferContext(dataset: Dataset, fileName: string, typedTopic = ''): TopicContext {
  const topic = cleanTopic(typedTopic) || topicFromFileName(fileName) || topicFromData(dataset) || 'company'
  return { topic, geography: geographyOf(dataset, `${typedTopic} ${fileName}`), qualifier: qualifierOf(dataset) }
}

function cleanTopic(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} &-]/gu, '').trim().slice(0, 40)
  return cleaned
    .split(' ')
    .map(word => (SHOUTY.has(word.toLowerCase()) ? word.toUpperCase() : /^[A-Z]{2,}$/.test(word) ? word : word.toLowerCase()))
    .join(' ')
}

function topicFromFileName(fileName: string): string {
  const stem = fileName.replace(/\.[a-z\d]+$/i, '').replace(/[_.\-()[\]]+/g, ' ')
  const words = stem.replace(FILLER, ' ').split(/\s+/).filter(word => !/\d/.test(word) || SHOUTY.has(word.toLowerCase()))
  return cleanTopic(words.join(' '))
}

/** The most common tag that is not on almost every row. */
function topicFromData(dataset: Dataset): string {
  const column = dataset.columns.find(c => c.role === 'category')
  if (!column) return ''
  const counts = new Map<string, number>()
  for (const row of dataset.rows) {
    const value = row.cells[column.id]
    for (const tag of Array.isArray(value) ? value : value ? [String(value)] : []) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  const usable = [...counts.entries()].filter(([, n]) => n >= dataset.rows.length * 0.3 && n < dataset.rows.length * 0.9).sort((a, b) => b[1] - a[1])
  return usable.length ? cleanTopic(usable[0]![0]) : ''
}

function geographyOf(dataset: Dataset, hint: string): string {
  if (/\b(uk|british|united kingdom)\b/i.test(hint.replace(/_/g, ' '))) return 'UK'
  const column = dataset.columns.find(c => c.role === 'region')
  if (!column) return ''
  const values = dataset.rows.map(r => r.cells[column.id]).filter((v): v is string => typeof v === 'string')
  if (!values.length) return ''
  const known = values.filter(v => UK_PLACES.test(v.trim())).length
  return known / values.length >= 0.6 ? 'UK' : ''
}

function qualifierOf(dataset: Dataset): string {
  const stage = dataset.constants.find(c => c.role === ('stage' satisfies Role))
  if (!stage) return ''
  const value = stage.value.trim()
  return /stage$/i.test(value) ? value.toLowerCase() : `${value.toLowerCase()}-stage`
}
