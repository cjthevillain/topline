import type { BlogDocument, BlogSummary, Provenance } from '../types/blog'
import type { CopyResult } from '../copy/generate'
import { slugify } from '../copy/text'
import { subject } from '../copy/template'
import type { Analysis } from './analyse'

/** The stored page: data, derived insights, copy and provenance, kept separate. */
export function buildDocument(analysis: Analysis, result: CopyResult, slug: string, sourceFile: string, generatedAt: string, seeded: boolean): BlogDocument {
  const provenance: Provenance = {
    mode: result.mode,
    provider: result.provider,
    model: result.model,
    notes: result.notes,
    sourceFile,
    generatedAt,
  }
  return {
    version: 1,
    slug,
    context: analysis.context,
    dataset: analysis.dataset,
    insights: analysis.insights,
    copy: result.copy,
    provenance,
    seeded,
  }
}

/** The URL comes from the data, not from LLM text, so it stays stable and readable. */
export function baseSlug(analysis: Analysis): string {
  const { dataset, context } = analysis
  const phrase = dataset.metric
    ? `top ${dataset.rows.length} ${subject(context)} companies by ${dataset.metric.label}`
    : `${dataset.rows.length} ${subject(context)} companies`
  return slugify(phrase) || 'company-ranking'
}

export function summarise(doc: BlogDocument): BlogSummary {
  return {
    slug: doc.slug,
    title: doc.copy.h1,
    description: doc.copy.metaDescription,
    rows: doc.dataset.rows.length,
    topic: doc.context.topic,
    generatedAt: doc.provenance.generatedAt,
    seeded: doc.seeded,
    mode: doc.provenance.mode,
  }
}
