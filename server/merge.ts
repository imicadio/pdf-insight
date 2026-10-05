import { MAX_KEYWORDS, type AiResult } from '../src/lib/schema.js'

type Entities = AiResult['entities']
type Amount = AiResult['amounts'][number]
type DateItem = AiResult['dates'][number]

function normalize(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

/** Keeps the first occurrence of every item, comparing by `key`. */
function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const id = key(item)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export function mergeEntities(parts: readonly Entities[]): Entities {
  return {
    organizations: uniqueBy(
      parts.flatMap((p) => p.organizations),
      normalize,
    ),
    people: uniqueBy(
      parts.flatMap((p) => p.people),
      normalize,
    ),
  }
}

export function mergeAmounts(parts: readonly Amount[][]): Amount[] {
  return uniqueBy(parts.flat(), (a) => `${a.value}|${a.currency}|${normalize(a.context)}`)
}

export function mergeDates(parts: readonly DateItem[][]): DateItem[] {
  return uniqueBy(parts.flat(), (d) => `${d.date}|${normalize(d.context)}`)
}

/** Keywords that appear in more fragments rank higher; ties keep document order. */
export function mergeKeywords(parts: readonly string[][], limit = MAX_KEYWORDS): string[] {
  const stats = new Map<string, { keyword: string; count: number; order: number }>()
  let order = 0
  for (const keywords of parts) {
    for (const keyword of uniqueBy(keywords, normalize)) {
      const id = normalize(keyword)
      const entry = stats.get(id)
      if (entry) entry.count += 1
      else stats.set(id, { keyword, count: 1, order: order++ })
    }
  }
  return [...stats.values()]
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, limit)
    .map((entry) => entry.keyword)
}

/** Combines the document-level reduce result with deterministic merges of per-fragment data. */
export function mergeResults(reduced: AiResult, partials: readonly AiResult[]): AiResult {
  return {
    document: reduced.document,
    summary: reduced.summary,
    keyPoints: reduced.keyPoints,
    entities: mergeEntities(partials.map((p) => p.entities)),
    amounts: mergeAmounts(partials.map((p) => p.amounts)),
    dates: mergeDates(partials.map((p) => p.dates)),
    keywords: mergeKeywords(partials.map((p) => p.keywords)),
  }
}
