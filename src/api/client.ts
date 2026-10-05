import { z } from 'zod'
import { AnalysisResultSchema, type AnalysisResult, type AnalyzeRequest } from '../lib/schema'

const REQUEST_TIMEOUT_MS = 90_000

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

const ErrorBodySchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })

function apiUrl(): string {
  const base = import.meta.env.VITE_API_URL
  if (!base) throw new ApiError('Brak konfiguracji adresu API (VITE_API_URL).')
  return `${base.replace(/\/$/, '')}/api/analyze`
}

async function readError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null)
  const parsed = ErrorBodySchema.safeParse(body)
  if (parsed.success) return parsed.data.error.message
  if (response.status === 429) return 'Zbyt wiele analiz. Spróbuj ponownie za chwilę.'
  if (response.status === 413) return 'Dokument jest zbyt duży do analizy.'
  return `Serwer zwrócił błąd (${response.status}). Spróbuj ponownie.`
}

export async function analyzeText(
  request: AnalyzeRequest,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: combined,
    })
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (signal?.aborted) throw error
    if (timeout.aborted) throw new ApiError('Analiza trwała zbyt długo. Spróbuj ponownie.')
    throw new ApiError('Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.')
  }

  if (!response.ok) throw new ApiError(await readError(response))

  // Validate again in the browser: nothing is shown unless it matches the schema.
  const result = AnalysisResultSchema.safeParse(await response.json().catch(() => null))
  if (!result.success) {
    throw new ApiError('Otrzymany wynik jest niezgodny ze schematem. Spróbuj ponownie.')
  }
  return result.data
}
