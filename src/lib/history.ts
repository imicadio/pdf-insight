import { z } from 'zod'
import { AnalysisResultSchema, type AnalysisResult } from './schema'

const STORAGE_KEY = 'pdf-insight:history:v1'
export const HISTORY_LIMIT = 10

export interface HistoryEntry {
  id: string
  result: AnalysisResult
}

const HistorySchema = z.array(z.object({ id: z.string(), result: AnalysisResultSchema }))

/** Reads history from localStorage; invalid or unavailable storage yields an empty list. */
export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = HistorySchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function save(entries: HistoryEntry[]): HistoryEntry[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage full or blocked (private mode) — history is a convenience, keep working.
  }
  return entries
}

export function addToHistory(entries: HistoryEntry[], result: AnalysisResult): HistoryEntry[] {
  const entry: HistoryEntry = { id: crypto.randomUUID(), result }
  return save([entry, ...entries].slice(0, HISTORY_LIMIT))
}

export function removeFromHistory(entries: HistoryEntry[], id: string): HistoryEntry[] {
  return save(entries.filter((entry) => entry.id !== id))
}

export function clearHistory(): HistoryEntry[] {
  return save([])
}
