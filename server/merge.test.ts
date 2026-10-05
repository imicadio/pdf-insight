import { describe, expect, it } from 'vitest'
import type { AiResult } from '../src/lib/schema'
import { mergeKeywords, mergeResults } from './merge'

function partial(patch: Partial<AiResult>): AiResult {
  return {
    document: { language: 'pl', type: 'raport', title: null, date: null },
    summary: 'Fragment raportu. Opisuje wyniki. Zawiera dane.',
    keyPoints: ['a', 'b', 'c'],
    entities: { organizations: [], people: [] },
    amounts: [],
    dates: [],
    keywords: [],
    ...patch,
  }
}

describe('mergeResults', () => {
  it('takes document fields from the reduce step and deduplicates lists', () => {
    const reduced = partial({
      document: { language: 'pl', type: 'raport', title: 'Raport roczny', date: '2026' },
    })
    const merged = mergeResults(reduced, [
      partial({
        entities: { organizations: ['ACME sp. z o.o.'], people: ['Jan Kowalski'] },
        amounts: [{ value: 100, currency: 'PLN', context: 'Koszt' }],
        dates: [{ date: '2026-01-01', context: 'start' }],
      }),
      partial({
        entities: { organizations: ['acme  sp. z o.o.', 'Beta SA'], people: [] },
        amounts: [
          { value: 100, currency: 'PLN', context: 'koszt' },
          { value: 100, currency: 'EUR', context: 'koszt' },
        ],
        dates: [{ date: '2026-01-01', context: 'Start' }],
      }),
    ])
    expect(merged.document.title).toBe('Raport roczny')
    expect(merged.entities).toEqual({
      organizations: ['ACME sp. z o.o.', 'Beta SA'],
      people: ['Jan Kowalski'],
    })
    expect(merged.amounts).toHaveLength(2)
    expect(merged.dates).toHaveLength(1)
  })
})

describe('mergeKeywords', () => {
  it('ranks keywords by number of fragments and caps the list', () => {
    expect(mergeKeywords([['SLA', 'serwis'], ['serwis', 'umowa'], ['Serwis']])).toEqual([
      'serwis',
      'SLA',
      'umowa',
    ])
    expect(mergeKeywords([['a', 'b', 'c']], 2)).toEqual(['a', 'b'])
  })
})
