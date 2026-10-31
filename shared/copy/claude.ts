import Anthropic from '@anthropic-ai/sdk'
import type { LlmProvider } from './generate'

/** The reply shape from the prompt. The API enforces it, so the reply is always valid JSON. */
const COPY_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    h1: { type: 'string' },
    metaDescription: { type: 'string' },
    intro: { type: 'array', items: { type: 'string' } },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          paragraphs: { type: 'array', items: { type: 'string' } },
        },
        required: ['heading', 'paragraphs'],
        additionalProperties: false,
      },
    },
    faq: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
        },
        required: ['question', 'answer'],
        additionalProperties: false,
      },
    },
    keywords: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'h1', 'metaDescription', 'intro', 'sections', 'faq', 'keywords'],
  additionalProperties: false,
}

interface ClaudeConfig {
  apiKey: string
  model: string
  client?: Pick<Anthropic, 'messages'>
}

/**
 * Claude through the official SDK. This file is imported on the server only, so
 * the SDK never reaches the browser bundle.
 */
export function claudeProvider({ apiKey, model, client = new Anthropic({ apiKey, maxRetries: 1 }) }: ClaudeConfig): LlmProvider {
  return {
    name: 'claude',
    model,
    async complete(messages, signal) {
      const system = messages.find(m => m.role === 'system')?.content ?? ''
      const conversation = messages.flatMap(m => (m.role === 'system' ? [] : [{ role: m.role, content: m.content }]))
      try {
        const response = await client.messages.create({
          model,
          max_tokens: 8000,
          system,
          messages: conversation,
          output_config: { effort: 'low', format: { type: 'json_schema', schema: COPY_SCHEMA } },
        }, { signal })
        console.info(`claude usage: ${response.usage.input_tokens} input, ${response.usage.output_tokens} output tokens`)
        if (response.stop_reason === 'refusal') throw new Error('claude refused the request')
        if (response.stop_reason === 'max_tokens') throw new Error('claude reply was cut off')
        const content = response.content.flatMap(block => (block.type === 'text' ? [block.text] : [])).join('')
        if (!content) throw new Error('claude returned an empty reply')
        return content
      }
      catch (error) {
        if (signal.aborted) throw signal.reason
        // The body is left out on purpose: providers can echo request details in it.
        if (error instanceof Anthropic.APIError && error.status !== undefined) throw new Error(`claude returned HTTP ${error.status}`)
        throw error
      }
    },
  }
}
