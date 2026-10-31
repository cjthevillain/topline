import { claudeProvider } from '#shared/copy/claude'
import { geminiProvider, openAiCompatibleProvider } from '#shared/copy/generate'
import type { LlmProvider } from '#shared/copy/generate'

/** Builds the provider chain from config. With no config the chain is empty and the template is used. */
export function configuredProviders(config: ReturnType<typeof useRuntimeConfig>): LlmProvider[] {
  const providers: LlmProvider[] = []
  if (config.anthropicApiKey) {
    providers.push(claudeProvider({ apiKey: config.anthropicApiKey, model: config.anthropicModel }))
  }
  if (config.llmModel) {
    providers.push(openAiCompatibleProvider({
      name: config.llmName,
      baseUrl: config.llmBaseUrl,
      apiKey: config.llmApiKey,
      model: config.llmModel,
    }))
  }
  if (config.geminiApiKey) {
    providers.push(geminiProvider({ apiKey: config.geminiApiKey, model: config.geminiModel }))
  }
  return providers
}
