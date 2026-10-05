import { AnalyzeRequestSchema, MAX_TEXT_CHARS, type AnalysisResult } from '../src/lib/schema.js'
import { analyzeDocument } from './analyze.js'
import { corsHeaders, isOriginAllowed } from './cors.js'
import { AppError } from './errors.js'
import { clientIp, enforceRateLimit } from './rateLimit.js'

/** Vercel rejects bodies above 4.5 MB; we stop earlier with a clear message. */
export const MAX_BODY_BYTES = 4_000_000

export interface HandlerDeps {
  analyze: typeof analyzeDocument
  rateLimit: typeof enforceRateLimit
}

const defaultDeps: HandlerDeps = { analyze: analyzeDocument, rateLimit: enforceRateLimit }

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

function errorResponse(error: AppError, headers: Record<string, string>): Response {
  const extra: Record<string, string> =
    error.retryAfterSeconds !== undefined ? { 'Retry-After': String(error.retryAfterSeconds) } : {}
  return json({ error: { code: error.code, message: error.message } }, error.status, {
    ...headers,
    ...extra,
  })
}

async function readBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) {
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Dokument jest zbyt duży do analizy.')
  }
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Dokument jest zbyt duży do analizy.')
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new AppError(400, 'INVALID_REQUEST', 'Nieprawidłowe żądanie.')
  }
}

export function handleOptions(request: Request): Response {
  const origin = request.headers.get('origin')
  if (!isOriginAllowed(origin)) return new Response(null, { status: 403 })
  return new Response(null, { status: 204, headers: corsHeaders(origin) })
}

export async function handleAnalyze(
  request: Request,
  deps: HandlerDeps = defaultDeps,
): Promise<Response> {
  const origin = request.headers.get('origin')
  if (!isOriginAllowed(origin)) {
    return errorResponse(
      new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Niedozwolone źródło żądania.'),
      {},
    )
  }
  const headers = corsHeaders(origin)

  try {
    await deps.rateLimit(clientIp(request))
    const parsed = AnalyzeRequestSchema.safeParse(await readBody(request))
    if (!parsed.success) {
      const tooLong = parsed.error.issues.some(
        (issue) => issue.path[0] === 'text' && issue.code === 'too_big',
      )
      throw tooLong
        ? new AppError(
            413,
            'PAYLOAD_TOO_LARGE',
            `Tekst dokumentu przekracza ${MAX_TEXT_CHARS.toLocaleString('pl-PL')} znaków.`,
          )
        : new AppError(400, 'INVALID_REQUEST', 'Nieprawidłowe żądanie.')
    }
    const result: AnalysisResult = await deps.analyze(parsed.data)
    return json(result, 200, headers)
  } catch (error) {
    if (error instanceof AppError) return errorResponse(error, headers)
    console.error('Unexpected error', error)
    return errorResponse(
      new AppError(500, 'INTERNAL', 'Wystąpił nieoczekiwany błąd serwera.'),
      headers,
    )
  }
}
