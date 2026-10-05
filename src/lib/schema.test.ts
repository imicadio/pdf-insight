import { describe, expect, it } from 'vitest'
import {
  AiResultSchema,
  AnalysisResultSchema,
  AnalyzeRequestSchema,
  describeIssues,
  isIsoCurrency,
  isIsoDate,
  type AiResult,
  type AnalysisResult,
} from './schema'
import { countSentences } from './sentences'

const validAi: AiResult = {
  document: { language: 'pl', type: 'umowa', title: 'Umowa serwisowa', date: '2026-09-01' },
  summary:
    'Umowa określa zasady świadczenia usług serwisowych. Okres obowiązywania wynosi 12 miesięcy. Wynagrodzenie płatne jest miesięcznie.',
  keyPoints: ['Okres umowy 12 mies.', 'Wynagrodzenie 12 500 PLN', 'SLA 48 h'],
  entities: { organizations: ['Przykład sp. z o.o.'], people: [] },
  amounts: [{ value: 12500, currency: 'PLN', context: 'wynagrodzenie' }],
  dates: [{ date: '2026-10-01', context: 'termin płatności' }],
  keywords: ['serwis', 'SLA'],
}

const validResult: AnalysisResult = {
  ...validAi,
  document: { ...validAi.document, fileName: 'umowa.pdf', pages: 4 },
  meta: {
    model: 'claude-opus-5-5',
    analyzedAt: '2026-10-05T12:00:00.000Z',
    chunks: 1,
    truncated: false,
  },
}

function withAi(patch: (draft: AiResult) => void): unknown {
  const draft = structuredClone(validAi)
  patch(draft)
  return draft
}

describe('AiResultSchema', () => {
  it('accepts a valid result', () => {
    expect(AiResultSchema.safeParse(validAi).success).toBe(true)
  })

  it('accepts empty arrays and nulls when information is missing', () => {
    const result = AiResultSchema.safeParse(
      withAi((d) => {
        d.document.title = null
        d.document.date = null
        d.entities = { organizations: [], people: [] }
        d.amounts = []
        d.dates = []
        d.keywords = []
      }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects a missing required field', () => {
    const draft = structuredClone(validAi) as Partial<AiResult>
    delete draft.keyPoints
    expect(AiResultSchema.safeParse(draft).success).toBe(false)
  })

  it('rejects an unknown document type', () => {
    const draft = withAi((d) => {
      ;(d.document as { type: string }).type = 'list'
    })
    expect(AiResultSchema.safeParse(draft).success).toBe(false)
  })

  it.each(['PL', 'pol', 'polski', ''])('rejects non ISO 639-1 language %j', (language) => {
    expect(AiResultSchema.safeParse(withAi((d) => (d.document.language = language))).success).toBe(
      false,
    )
  })

  it.each(['01.10.2026', '2026-13-01', '2026-02-30', 'jutro'])('rejects bad date %j', (date) => {
    expect(AiResultSchema.safeParse(withAi((d) => (d.dates[0]!.date = date))).success).toBe(false)
  })

  it.each(['zł', 'pln', 'PLNN', 'XYZ'])('rejects bad currency %j', (currency) => {
    expect(
      AiResultSchema.safeParse(withAi((d) => (d.amounts[0]!.currency = currency))).success,
    ).toBe(false)
  })

  it('rejects an amount given as a string', () => {
    const draft = withAi((d) => {
      ;(d.amounts[0] as { value: unknown }).value = '12 500,00'
    })
    expect(AiResultSchema.safeParse(draft).success).toBe(false)
  })

  it('enforces 3–7 key points', () => {
    expect(AiResultSchema.safeParse(withAi((d) => (d.keyPoints = ['a', 'b']))).success).toBe(false)
    expect(
      AiResultSchema.safeParse(withAi((d) => (d.keyPoints = Array(8).fill('punkt')))).success,
    ).toBe(false)
    expect(
      AiResultSchema.safeParse(withAi((d) => (d.keyPoints = Array(7).fill('punkt')))).success,
    ).toBe(true)
  })

  it('enforces a 3–5 sentence summary', () => {
    const tooShort = withAi((d) => (d.summary = 'Jedno zdanie. Drugie zdanie.'))
    const tooLong = withAi((d) => (d.summary = 'A jest. B jest. C jest. D jest. E jest. F jest.'))
    expect(AiResultSchema.safeParse(tooShort).success).toBe(false)
    expect(AiResultSchema.safeParse(tooLong).success).toBe(false)
  })

  it('describes issues with field paths', () => {
    const result = AiResultSchema.safeParse(withAi((d) => (d.amounts[0]!.currency = 'zł')))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(describeIssues(result.error)).toEqual([
        'amounts.0.currency: Waluta musi być kodem ISO 4217',
      ])
    }
  })
})

describe('AnalysisResultSchema', () => {
  it('accepts the full exported result', () => {
    expect(AnalysisResultSchema.safeParse(validResult).success).toBe(true)
  })

  it('keeps every field from the brief in the exported JSON', () => {
    const parsed = AnalysisResultSchema.parse(validResult)
    expect(Object.keys(parsed.document)).toEqual(
      expect.arrayContaining(['fileName', 'pages', 'language', 'type', 'title', 'date']),
    )
    expect(Object.keys(parsed)).toEqual(
      expect.arrayContaining(['summary', 'keyPoints', 'entities', 'amounts', 'dates', 'keywords']),
    )
  })

  it('requires fileName and a positive page count', () => {
    const noPages = structuredClone(validResult)
    noPages.document.pages = 0
    expect(AnalysisResultSchema.safeParse(noPages).success).toBe(false)
  })
})

describe('AnalyzeRequestSchema', () => {
  it('rejects empty text', () => {
    expect(
      AnalyzeRequestSchema.safeParse({ fileName: 'a.pdf', pages: 1, text: '   ' }).success,
    ).toBe(false)
  })
})

describe('helpers', () => {
  it('accepts ISO 8601 dates with day, month or year precision', () => {
    expect(isIsoDate('2026-09-01')).toBe(true)
    expect(isIsoDate('2026-09')).toBe(true)
    expect(isIsoDate('2026')).toBe(true)
    expect(isIsoDate('2024-02-29')).toBe(true)
    expect(isIsoDate('2025-02-29')).toBe(false)
  })

  it('recognises ISO 4217 currencies', () => {
    expect(isIsoCurrency('PLN')).toBe(true)
    expect(isIsoCurrency('EUR')).toBe(true)
    expect(isIsoCurrency('ZLT')).toBe(false)
  })

  it('does not split sentences on common abbreviations', () => {
    expect(
      countSentences('Dostawa nastąpi m.in. w Warszawie, ul. Prosta 1. Koszt wynosi ok. 100 zł.'),
    ).toBe(2)
    expect(
      countSentences(
        'Strony, tj. Kupujący i Sprzedawca, zawarły umowę. Umowa obowiązuje od 1 października 2026 r. Termin płatności to 14 dni.',
      ),
    ).toBe(3)
    expect(
      countSentences(
        'The contract was signed by J. Smith. It runs for one year. Payment is monthly.',
        'en',
      ),
    ).toBe(3)
  })
})
