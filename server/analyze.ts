import {
  AnalysisResultSchema,
  type AiResult,
  type AnalysisResult,
  type AnalyzeRequest,
} from '../src/lib/schema.js'
import { planChunks } from './chunk.js'
import { modelName, requestAnalysis } from './claude.js'
import { AppError } from './errors.js'
import { mergeResults } from './merge.js'
import { analyzeMessage, chunkMessage, reduceMessage } from './prompt.js'

type Analyzer = (userMessage: string) => Promise<AiResult>

/**
 * Short documents: one call. Long documents: fragments analyzed in parallel (map),
 * one call to write document-level fields (reduce) and a deterministic merge of the lists.
 */
export async function analyzeDocument(
  request: AnalyzeRequest,
  analyze: Analyzer = requestAnalysis,
): Promise<AnalysisResult> {
  const { chunks, truncated } = planChunks(request.text)

  let ai: AiResult
  if (chunks.length === 1) {
    ai = await analyze(analyzeMessage(chunks[0] ?? ''))
  } else {
    const partials = await Promise.all(
      chunks.map((chunk, index) => analyze(chunkMessage(chunk, index, chunks.length))),
    )
    const reduced = await analyze(reduceMessage(partials))
    ai = mergeResults(reduced, partials)
  }

  const result = AnalysisResultSchema.safeParse({
    ...ai,
    document: { fileName: request.fileName, pages: request.pages, ...ai.document },
    meta: {
      model: modelName(),
      analyzedAt: new Date().toISOString(),
      chunks: chunks.length,
      truncated,
    },
  })
  if (!result.success) {
    throw new AppError(502, 'AI_INVALID_RESPONSE', 'Wynik analizy jest niezgodny ze schematem.')
  }
  return result.data
}
