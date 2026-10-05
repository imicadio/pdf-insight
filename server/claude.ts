import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { AiResultSchema, describeIssues, type AiResult } from '../src/lib/schema.js'
import { AppError } from './errors.js'
import { retryMessage, systemPrompt } from './prompt.js'

type MessageParam = Anthropic.Beta.BetaMessageParam
type Message = Anthropic.Beta.BetaMessage

export const DEFAULT_MODEL = 'claude-opus-5-5'

/** JSON Schema sent as structured-output format; constraints it cannot express are checked by Zod. */
const OUTPUT_FORMAT: Anthropic.Beta.BetaJSONOutputFormat = {
  type: 'json_schema',
  schema: betaZodOutputFormat(AiResultSchema).schema,
}

let client: Anthropic | undefined

function getClient(): Anthropic {
  // The key lives only in the server environment (Vercel secrets); never in the browser bundle.
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AppError(500, 'INTERNAL', 'Serwer nie jest poprawnie skonfigurowany.')
  }
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 })
  return client
}

export function modelName(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL
}

async function createMessage(messages: MessageParam[]): Promise<Message> {
  try {
    return await getClient().beta.messages.create({
      model: modelName(),
      max_tokens: 16_000,
      system: systemPrompt(),
      messages,
      // Extraction does not need deep reasoning; low effort keeps latency well under 30 s.
      output_config: { effort: 'low', format: OUTPUT_FORMAT },
      // If a safety classifier declines, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new AppError(
        503,
        'AI_UNAVAILABLE',
        'Usługa AI jest chwilowo przeciążona. Spróbuj ponownie za chwilę.',
      )
    }
    if (error instanceof Anthropic.APIError) {
      console.error('Anthropic API error', error.status, error.message)
      throw new AppError(
        502,
        'AI_UNAVAILABLE',
        'Usługa AI jest niedostępna. Spróbuj ponownie za chwilę.',
      )
    }
    throw error
  }
}

type Attempt = { ok: true; data: AiResult } | { ok: false; issues: string[] }

function parseResponse(response: Message): Attempt {
  if (response.stop_reason === 'max_tokens') {
    return { ok: false, issues: ['Odpowiedź została ucięta (limit długości).'] }
  }
  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, issues: ['Odpowiedź nie jest poprawnym JSON.'] }
  }
  const result = AiResultSchema.safeParse(json)
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, issues: describeIssues(result.error) }
}

/**
 * Asks the model for an analysis and validates it against the schema.
 * An invalid answer gets exactly one retry with the validation errors; then it fails.
 */
export async function requestAnalysis(userMessage: string): Promise<AiResult> {
  const messages: MessageParam[] = [{ role: 'user', content: userMessage }]

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await createMessage(messages)
    if (response.stop_reason === 'refusal') {
      throw new AppError(422, 'AI_REFUSED', 'Model AI odmówił analizy tego dokumentu.')
    }
    const parsed = parseResponse(response)
    if (parsed.ok) return parsed.data

    console.error('Invalid AI response', { attempt, issues: parsed.issues })
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: retryMessage(parsed.issues) })
  }

  throw new AppError(
    502,
    'AI_INVALID_RESPONSE',
    'Model AI zwrócił wynik niezgodny ze schematem. Spróbuj ponownie.',
  )
}
