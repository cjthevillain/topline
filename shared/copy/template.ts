import type { BlogCopy, BlogSection, Breakdown, Dataset, FaqItem, Insights, TopicContext } from '../types/blog'
import { formatCompact, formatPercent } from '../pipeline/values'
import { titleCase, truncateAtWord } from './text'

export interface CopyInput {
  dataset: Dataset
  insights: Insights
  context: TopicContext
}

/** `UK seed-stage fintech`, or `AI` when the data supports nothing more. */
export function subject(context: TopicContext): string {
  return [context.geography, context.qualifier, context.topic === 'company' ? '' : context.topic].filter(Boolean).join(' ')
}

function plural(context: TopicContext): string {
  return `${subject(context)} companies`.trim()
}

function joinList(items: string[]): string {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

/**
 * Builds complete copy from the numbers alone. The upload never fails because
 * an LLM is down, and any LLM section that fails its checks is replaced by the
 * matching section from here.
 */
export function templateCopy({ dataset, insights, context }: CopyInput): BlogCopy {
  const { metric, rows } = dataset
  const count = rows.length
  const money = (value: number) => (metric?.kind === 'percent' ? formatPercent(value) : formatCompact(value, metric?.currency ?? ''))
  const valued = rows.filter(r => r.metric !== null)
  const leader = valued[0]
  const total = metric ? tileValue(insights, 'total') : null
  const med = metric ? tileValue(insights, 'median') : null
  const concentration = insights.tiles.find(t => t.id === 'concentration')
  const region = insights.breakdowns.find(b => b.id === 'region')
  const sector = insights.breakdowns.find(b => b.id === 'category')
  const size = insights.breakdowns.find(b => b.id === 'size')
  const stage = insights.breakdowns.find(b => b.id === 'stage')
  const others = insights.breakdowns.filter(b => !['region', 'category', 'size', 'stage'].includes(b.id))
  const label = metric ? titleCase(metric.label) : ''
  const heading = titleCase(subject(context) || 'Company')

  const h1 = metric ? `Top ${count} ${heading} Companies by ${label}` : `${count} ${heading} Companies to Know`
  const title = truncateAtWord(h1, 65)

  const lead = metric && leader
    ? `This ranking lists the top ${count} ${plural(context)} by ${metric.label}${total ? `, with ${total} combined` : ''}. ${leader.name} leads with ${money(leader.metric!)}.`
    : `This guide lists ${count} ${plural(context)}, with the sectors and locations they cover.`
  const extra = `${lead} See the full table and key statistics.`
  const metaBody = extra.length <= 158 ? extra : lead

  const intro = [
    metric && leader
      ? `Which ${plural(context)} sit at the top of the table? This ranking lists ${count} of them by ${metric.label}${total ? `, and together they account for ${total}` : ''}. ${leader.name} is in first place with ${money(leader.metric!)}.`
      : `This guide brings together ${count} ${plural(context)} in one place, so you can compare them at a glance.`,
    'Every figure on this page comes directly from the source dataset. The statistics below are calculated from it, and the full table is further down the page.',
  ]

  const sections: BlogSection[] = []

  if (metric && leader) {
    const paragraphs = []
    if (med) {
      paragraphs.push(`The median ${metric.label} is ${med}${total ? `, against a combined ${total}` : ''}. The median is the better guide to a typical company here, because a few large values pull the average upwards.`)
    }
    if (concentration) {
      paragraphs.push(`The leading group holds ${concentration.value} of the total: ${concentration.note}. ${shapeSentence(concentration.value)}`)
    }
    const others = valued.slice(1, 3).map(r => `${r.name} (${money(r.metric!)})`)
    if (others.length) paragraphs.push(`${leader.name} is followed by ${joinList(others)}.`)
    if (paragraphs.length) sections.push({ heading: `How ${label} Is Distributed`, paragraphs })
  }

  if (region) sections.push({ heading: `Where ${heading} Companies Are Based`, paragraphs: [breakdownSentence(region, count, money)] })

  if (sector) {
    const names = sector.rows.slice(0, 3).map(r => `${r.label} (${r.count})`)
    sections.push({
      heading: `The Sectors Behind the Ranking`,
      paragraphs: [`The most common sectors are ${joinList(names)}. A company can appear in more than one sector, so these counts overlap and do not add up to ${count}.`],
    })
  }

  if (size) {
    const largest = [...size.rows].sort((a, b) => b.count - a.count)[0]!
    sections.push({
      heading: `Company Size`,
      paragraphs: [`The most common band for ${size.header.toLowerCase()} is ${largest.label}, which covers ${largest.count} of the ${count} companies (${formatPercent(largest.share)}).${medianLine(size, metric?.label, money)}`],
    })
  }

  if (stage) sections.push({ heading: 'Stage of Development', paragraphs: [breakdownSentence(stage, count, money)] })
  for (const other of others.slice(0, 1)) {
    sections.push({ heading: titleCase(other.title), paragraphs: [breakdownSentence(other, count, money)] })
  }

  sections.push({
    heading: 'How to Read This Ranking',
    paragraphs: [
      metric
        ? `Companies are ranked from highest to lowest ${metric.label}, using the values in the source data. ${dataset.stats.missingMetric ? `Companies with no value are listed last.` : `Every company in the list has a value.`}`
        : 'Companies are listed in the order of the source data, because it has no numeric column to rank by.',
      'The data is a snapshot, so check a company directly before relying on any single figure.',
    ],
  })

  const faq: FaqItem[] = []
  if (metric && leader) {
    faq.push({ question: `Which ${subject(context) || 'company'} company has the highest ${metric.label}?`.replace(/  +/g, ' '), answer: `${leader.name} is first in this dataset, with ${money(leader.metric!)}.` })
  }
  if (total && metric) {
    faq.push({ question: `What is the combined ${metric.label} of these companies?`, answer: `The ${valued.length} companies with a value have a combined ${metric.label} of ${total}.` })
  }
  if (region?.rows[0]) {
    faq.push({ question: `Where are most of these companies based?`, answer: `${region.rows[0].label} is the most common location, with ${region.rows[0].count} of the ${count} companies (${formatPercent(region.rows[0].share)}).` })
  }
  if (med && metric) {
    faq.push({ question: `What is a typical ${metric.label} for these companies?`, answer: `The median is ${med}, which means half of the companies with a value are above it and half are below it.` })
  }
  faq.push({ question: 'Where does this data come from?', answer: 'Everything on this page comes from the dataset used to create it. The statistics are calculated directly from that data.' })

  return {
    title,
    h1,
    metaDescription: truncateAtWord(metaBody, 158),
    intro,
    sections,
    faq: faq.slice(0, 5),
    keywords: keywordsFor(context, metric?.label),
  }
}

function tileValue(insights: Insights, id: string): string | null {
  return insights.tiles.find(t => t.id === id)?.value ?? null
}

function shapeSentence(value: string): string {
  const share = Number.parseFloat(value)
  if (share >= 50) return 'That is a very top-heavy ranking.'
  if (share >= 25) return 'That is a moderate concentration at the top of the ranking.'
  return 'That is a fairly even spread across the ranking.'
}

function breakdownSentence(breakdown: Breakdown, count: number, money: (value: number) => string): string {
  const [first, second] = breakdown.rows
  if (!first) return ''
  const lead = `${first.label} is the largest group, with ${first.count} of the ${count} companies (${formatPercent(first.share)})`
  const follow = second && second.label !== 'Other' ? `, followed by ${second.label} with ${second.count}` : ''
  const value = first.total !== null ? ` Companies in ${first.label} account for ${money(first.total)} combined.` : ''
  return `${lead}${follow}.${value}`
}

function medianLine(breakdown: Breakdown, label: string | undefined, money: (value: number) => string): string {
  if (!label) return ''
  const bands = breakdown.rows.filter(r => r.median !== null && r.count >= 3)
  if (bands.length < 2) return ''
  const top = [...bands].sort((a, b) => b.median! - a.median!)[0]!
  return ` Among bands with at least 3 companies, ${top.label} has the highest median ${label}, at ${money(top.median!)}.`
}

export function keywordsFor(context: TopicContext, metricLabel?: string): string[] {
  const base = subject(context)
  const keywords = [
    `top ${base} companies`,
    `${base} companies`,
    `${context.topic} companies ranking`,
    metricLabel ? `${base} companies by ${metricLabel}` : '',
  ]
  return [...new Set(keywords.map(k => k.replace(/\s+/g, ' ').trim()).filter(Boolean))]
}
