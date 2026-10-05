import { z } from 'zod'
import { countSentences } from './sentences.js'

export const DOCUMENT_TYPES = ['faktura', 'umowa', 'oferta', 'raport', 'inne'] as const

export const SUMMARY_SENTENCES = { min: 3, max: 5 } as const
export const KEY_POINTS = { min: 3, max: 7 } as const
export const MAX_KEYWORDS = 15

/** ISO 8601 calendar date at day, month or year precision: YYYY-MM-DD | YYYY-MM | YYYY. */
const ISO_DATE = /^\d{4}(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  if (value.length < 10) return true
  // Reject impossible days such as 2026-02-30.
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

const supportedCurrencies: ReadonlySet<string> = new Set(
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : [],
)

export function isIsoCurrency(value: string): boolean {
  if (!/^[A-Z]{3}$/.test(value)) return false
  return supportedCurrencies.size === 0 || supportedCurrencies.has(value)
}

const text = z.string().trim().min(1)
const isoDate = z.string().refine(isIsoDate, { message: 'Data musi być w formacie ISO 8601' })

/** Fields produced by the model. fileName and pages are set by the app, never by the model. */
export const AiResultSchema = z.object({
  document: z.object({
    language: z.string().regex(/^[a-z]{2}$/, { message: 'Język musi być kodem ISO 639-1' }),
    type: z.enum(DOCUMENT_TYPES),
    title: text.nullable(),
    date: isoDate.nullable(),
  }),
  summary: text.refine(
    (value) => {
      const count = countSentences(value)
      return count >= SUMMARY_SENTENCES.min && count <= SUMMARY_SENTENCES.max
    },
    { message: `Podsumowanie musi mieć ${SUMMARY_SENTENCES.min}–${SUMMARY_SENTENCES.max} zdań` },
  ),
  keyPoints: z.array(text).min(KEY_POINTS.min).max(KEY_POINTS.max),
  entities: z.object({
    organizations: z.array(text),
    people: z.array(text),
  }),
  amounts: z.array(
    z.object({
      value: z.number().finite(),
      currency: z.string().refine(isIsoCurrency, { message: 'Waluta musi być kodem ISO 4217' }),
      context: text,
    }),
  ),
  dates: z.array(z.object({ date: isoDate, context: text })),
  keywords: z.array(text).max(MAX_KEYWORDS),
})

export const AnalysisMetaSchema = z.object({
  model: z.string(),
  analyzedAt: z.iso.datetime(),
  chunks: z.number().int().positive(),
  truncated: z.boolean(),
})

/** Full result returned by the API and exported as JSON (schema from the brief + `meta`). */
export const AnalysisResultSchema = AiResultSchema.extend({
  document: z.object({
    fileName: text,
    pages: z.number().int().positive(),
    ...AiResultSchema.shape.document.shape,
  }),
  meta: AnalysisMetaSchema,
})

export type AiResult = z.infer<typeof AiResultSchema>
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>
export type AnalysisMeta = z.infer<typeof AnalysisMetaSchema>
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

/** Request body sent from the browser to the analyze endpoint. */
export const MAX_TEXT_CHARS = 600_000

export const AnalyzeRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  pages: z.number().int().positive().max(10_000),
  text: z.string().trim().min(1).max(MAX_TEXT_CHARS),
})

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>

/** Human-readable list of validation problems, used in the retry prompt and error UI. */
export function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
}
