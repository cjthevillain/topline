import type { BlogCopy, CopyMode } from '../types/blog'
import { buildRepairPrompt, buildUserPrompt, SYSTEM_PROMPT } from './prompt'
import type { CopyInput } from './template'
import { templateCopy } from './template'
import { mergeCopy, reviewCopy } from './validate'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmProvider {
  name: string
  model: string
  complete: (messages: ChatMessage[], signal: AbortSignal) => Promise<string>
}

export interface CopyResult {
  copy: BlogCopy
  mode: CopyMode
  provider: string | null
  model: string | null
  notes: string[]
}

export interface GenerateOptions {
  /** Limit for one LLM call. */
  timeoutMs: number
  /** Limit for all calls together, which must stay under the host's request limit. */
  budgetMs?: number
  currentYear: number
}

const MIN_USEFUL_MS = 3000

/** Pulls the JSON object out of a reply, which some models wrap in a code fence. */
export function parseJsonReply(reply: string): unknown {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('no JSON object in the reply')
  return JSON.parse(reply.slice(start, end + 1))
}

/**
 * Tries each provider in turn, gives each one chance to fix what it got wrong,
 * and keeps the best reply. Always returns usable copy: the template fills
 * every field that no provider produced, so the upload cannot fail here.
 */
export async function generateCopy(input: CopyInput, providers: LlmProvider[], options: GenerateOptions): Promise<CopyResult> {
  const fallback = templateCopy(input)
  const notes: string[] = []
  if (providers.length === 0) {
    return { copy: fallback, mode: 'template', provider: null, model: null, notes: ['No LLM is configured, so the copy came from the data template.'] }
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(input) },
  ]
  let best: { accepted: Partial<BlogCopy>; provider: LlmProvider; score: number } | null = null
  const deadline = Date.now() + (options.budgetMs ?? Infinity)

  for (const provider of providers) {
    let conversation = messages
    for (let attempt = 1; attempt <= 2; attempt++) {
      const remaining = deadline - Date.now()
      if (remaining < Math.min(MIN_USEFUL_MS, options.timeoutMs)) {
        notes.push('Stopped early to stay inside the time budget.')
        break
      }
      try {
        const reply = await provider.complete(conversation, AbortSignal.timeout(Math.min(options.timeoutMs, remaining)))
        const review = reviewCopy(parseJsonReply(reply), input.insights.allowedNumbers, options.currentYear)
        const { complete, used } = mergeCopy(review.accepted, fallback)
        if (!best || used > best.score) best = { accepted: review.accepted, provider, score: used }
        if (complete && review.problems.length === 0) {
          return { copy: mergeCopy(review.accepted, fallback).copy, mode: 'llm', provider: provider.name, model: provider.model, notes }
        }
        notes.push(`${provider.name} attempt ${attempt}: ${review.problems.slice(0, 3).join(' ')}`)
        conversation = [...messages, { role: 'assistant', content: reply }, { role: 'user', content: buildRepairPrompt(review.problems) }]
      }
      catch (error) {
        notes.push(`${provider.name} attempt ${attempt}: ${describe(error)}`)
        // A timeout, an outage or a rate limit will not clear on an instant retry.
        if (!(error instanceof SyntaxError) && !String(error).includes('no JSON object')) break
      }
    }
  }

  if (best && best.score > 0) {
    const { copy } = mergeCopy(best.accepted, fallback)
    return { copy, mode: 'hybrid', provider: best.provider.name, model: best.provider.model, notes: [...notes, 'Fields that failed the checks were replaced by the data template.'] }
  }
  return { copy: fallback, mode: 'template', provider: null, model: null, notes: [...notes, 'No LLM reply passed the checks, so the copy came from the data template.'] }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.name === 'TimeoutError' ? 'timed out' : error.message.slice(0, 160)
  return 'failed'
}

interface ProviderConfig {
  apiKey: string
  model: string
  fetcher?: typeof fetch
}

async function failOnError(response: Response, name: string): Promise<void> {
  if (response.ok) return
  // The body is left out on purpose: providers can echo request details in it.
  throw new Error(`${name} returned HTTP ${response.status}`)
}

/** Works with Groq, Ollama, OpenRouter and anything else that speaks the OpenAI chat API. */
export function openAiCompatibleProvider({ baseUrl, name, apiKey, model, fetcher = fetch }: ProviderConfig & { baseUrl: string; name: string }): LlmProvider {
  return {
    name,
    model,
    async complete(messages, signal) {
      const response = await fetcher(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({ model, messages, temperature: 0.4, response_format: { type: 'json_object' } }),
      })
      await failOnError(response, name)
      const body = await response.json() as { choices?: { message?: { content?: string } }[] }
      const content = body.choices?.[0]?.message?.content
      if (!content) throw new Error(`${name} returned an empty reply`)
      return content
    },
  }
}

export function geminiProvider({ apiKey, model, fetcher = fetch }: ProviderConfig): LlmProvider {
  return {
    name: 'gemini',
    model,
    async complete(messages, signal) {
      const system = messages.find(m => m.role === 'system')?.content ?? ''
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
      const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
        }),
      })
      await failOnError(response, 'gemini')
      const body = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      const content = body.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('')
      if (!content) throw new Error('gemini returned an empty reply')
      return content
    },
  }
}
