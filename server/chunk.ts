/** Documents up to this length are analyzed in a single model call. */
export const SINGLE_CALL_MAX_CHARS = 80_000
/** Target fragment size for long documents (~15–20k tokens). */
export const CHUNK_CHARS = 60_000
/** Fragments are analyzed in parallel; more than this is cut off to stay within time and cost limits. */
export const MAX_CHUNKS = 8

export interface ChunkPlan {
  chunks: string[]
  truncated: boolean
}

/** Finds the best place to cut `text` before `limit`: paragraph, then line, then word boundary. */
function cutPosition(text: string, limit: number): number {
  const minimum = Math.floor(limit * 0.5)
  for (const separator of ['\n\n', '\n', ' ']) {
    const position = text.lastIndexOf(separator, limit)
    if (position >= minimum) return position + separator.length
  }
  return limit
}

export function splitIntoChunks(text: string, chunkChars = CHUNK_CHARS): string[] {
  const chunks: string[] = []
  let rest = text.trim()
  while (rest.length > chunkChars) {
    const cut = cutPosition(rest, chunkChars)
    chunks.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) chunks.push(rest)
  return chunks
}

export function planChunks(text: string): ChunkPlan {
  if (text.length <= SINGLE_CALL_MAX_CHARS) return { chunks: [text], truncated: false }
  const chunks = splitIntoChunks(text)
  return { chunks: chunks.slice(0, MAX_CHUNKS), truncated: chunks.length > MAX_CHUNKS }
}
