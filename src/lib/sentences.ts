// Abbreviations that are never sentence-final (PL + EN). Ambiguous ones such as
// "r." (rok), "zł" or "o.o." are left out on purpose: they often do end a sentence.
const ABBREVIATIONS = new Set([
  'np',
  'tj',
  'tzn',
  'tzw',
  'ok',
  'ul',
  'al',
  'nr',
  'godz',
  'pkt',
  'ust',
  'art',
  'sp',
  'dr',
  'inż',
  'mgr',
  'prof',
  'e.g',
  'i.e',
  'vs',
  'mr',
  'mrs',
  'ms',
  'approx',
])

function endsWithAbbreviation(segment: string): boolean {
  const match = /(?:^|[\s(])([\p{L}.]+)\.\s*$/u.exec(segment)
  if (!match?.[1]) return false
  const word = match[1]
  // Single capital letters ("J. Kowalski") are initials, not sentence ends.
  return ABBREVIATIONS.has(word.toLowerCase()) || /^\p{Lu}$/u.test(word)
}

/** Splits text into sentences using Intl.Segmenter, re-joining breaks after abbreviations. */
export function splitSentences(text: string, locale = 'pl'): string[] {
  const segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' })
  const sentences: string[] = []
  let pending = ''
  for (const { segment } of segmenter.segment(text.trim())) {
    pending += segment
    if (!endsWithAbbreviation(pending)) {
      if (pending.trim()) sentences.push(pending.trim())
      pending = ''
    }
  }
  if (pending.trim()) sentences.push(pending.trim())
  return sentences
}

export function countSentences(text: string, locale?: string): number {
  return splitSentences(text, locale).length
}
