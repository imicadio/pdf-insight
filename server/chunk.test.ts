import { describe, expect, it } from 'vitest'
import { MAX_CHUNKS, SINGLE_CALL_MAX_CHARS, planChunks, splitIntoChunks } from './chunk'

describe('splitIntoChunks', () => {
  it('cuts on paragraph boundaries and keeps all text', () => {
    const paragraph = 'Lorem ipsum dolor sit amet. '.repeat(20).trim()
    const text = Array.from({ length: 30 }, () => paragraph).join('\n\n')
    const chunks = splitIntoChunks(text, 2_000)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2_000)
      expect(chunk.startsWith('Lorem')).toBe(true)
    }
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '))
  })

  it('hard-cuts text without any separators', () => {
    expect(splitIntoChunks('x'.repeat(250), 100)).toEqual([
      'x'.repeat(100),
      'x'.repeat(100),
      'x'.repeat(50),
    ])
  })
})

describe('planChunks', () => {
  it('uses a single call for short documents', () => {
    expect(planChunks('krótki tekst')).toEqual({ chunks: ['krótki tekst'], truncated: false })
  })

  it('splits long documents and marks truncation above the chunk limit', () => {
    const long = planChunks('słowo '.repeat(SINGLE_CALL_MAX_CHARS / 3))
    expect(long.chunks.length).toBeGreaterThan(1)
    expect(long.truncated).toBe(false)

    const huge = planChunks('słowo '.repeat(200_000))
    expect(huge.chunks).toHaveLength(MAX_CHUNKS)
    expect(huge.truncated).toBe(true)
  })
})
