import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalysisResult } from '../src/lib/schema'
import { AppError } from './errors'
import { handleAnalyze, handleOptions, type HandlerDeps } from './handler'

const ORIGIN = 'https://imicadio.github.io'

const result: AnalysisResult = {
  document: { fileName: 'a.pdf', pages: 1, language: 'pl', type: 'inne', title: null, date: null },
  summary: 'Jedno. Dwa. Trzy.',
  keyPoints: ['a', 'b', 'c'],
  entities: { organizations: [], people: [] },
  amounts: [],
  dates: [],
  keywords: [],
  meta: { model: 'test', analyzedAt: '2026-10-05T12:00:00.000Z', chunks: 1, truncated: false },
}

function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    analyze: vi.fn(async () => result),
    rateLimit: vi.fn(async () => undefined),
    ...overrides,
  }
}

function post(body: unknown, origin: string | null = ORIGIN): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (origin) headers.Origin = origin
  return new Request('https://api.test/api/analyze', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const validBody = { fileName: 'a.pdf', pages: 1, text: 'Treść dokumentu' }

beforeEach(() => {
  vi.stubEnv('ALLOWED_ORIGINS', `${ORIGIN},http://localhost:5173`)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('handleAnalyze', () => {
  it('returns the analysis with CORS headers for an allowed origin', async () => {
    const response = await handleAnalyze(post(validBody), deps())
    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(await response.json()).toEqual(result)
  })

  it.each([null, 'https://evil.example'])(
    'rejects origin %j without calling the AI',
    async (origin) => {
      const d = deps()
      const response = await handleAnalyze(post(validBody, origin), d)
      expect(response.status).toBe(403)
      expect(response.headers.get('access-control-allow-origin')).toBeNull()
      expect(d.analyze).not.toHaveBeenCalled()
    },
  )

  it('rejects malformed JSON and invalid bodies with 400', async () => {
    expect((await handleAnalyze(post('{oops'), deps())).status).toBe(400)
    expect((await handleAnalyze(post({ fileName: 'a.pdf' }), deps())).status).toBe(400)
  })

  it('rejects too long text with 413', async () => {
    const response = await handleAnalyze(post({ ...validBody, text: 'a'.repeat(600_001) }), deps())
    expect(response.status).toBe(413)
  })

  it('maps rate limit errors to 429 with Retry-After', async () => {
    const rateLimit = vi.fn(async () => {
      throw new AppError(429, 'RATE_LIMITED', 'Za dużo', 30)
    })
    const response = await handleAnalyze(post(validBody), deps({ rateLimit }))
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('30')
    expect(await response.json()).toEqual({ error: { code: 'RATE_LIMITED', message: 'Za dużo' } })
  })

  it('hides unexpected errors behind a generic 500', async () => {
    const analyze = vi.fn(async () => {
      throw new Error('secret details')
    })
    const response = await handleAnalyze(post(validBody), deps({ analyze }))
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('secret')
  })
})

describe('handleOptions', () => {
  it('answers preflight only for allowed origins', () => {
    const preflight = (origin: string) =>
      handleOptions(
        new Request('https://api.test/api/analyze', {
          method: 'OPTIONS',
          headers: { Origin: origin },
        }),
      )
    expect(preflight(ORIGIN).status).toBe(204)
    expect(preflight('https://evil.example').status).toBe(403)
  })
})

describe('ALLOWED_ORIGINS parsing', () => {
  it('accepts entries written as full URLs with a path', async () => {
    vi.stubEnv('ALLOWED_ORIGINS', ' https://imicadio.github.io/pdf-insight/ , not a url')
    const response = await handleAnalyze(post(validBody), deps())
    expect(response.status).toBe(200)
  })
})
