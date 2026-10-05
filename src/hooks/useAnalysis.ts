import { useCallback, useRef, useState } from 'react'
import { ApiError, analyzeText } from '../api/client'
import type { ExtractedPdf } from '../lib/pdf'
import { PdfError } from '../lib/pdfError'
import type { AnalysisResult } from '../lib/schema'

export type AnalysisState =
  | { status: 'idle' }
  | { status: 'reading'; fileName: string; startedAt: number }
  | { status: 'analyzing'; fileName: string; pages: number; startedAt: number }
  | { status: 'done'; result: AnalysisResult }
  | { status: 'error'; message: string; canRetry: boolean }

interface LastInput {
  file: File
  extracted?: ExtractedPdf
}

function errorMessage(error: unknown): string {
  if (error instanceof PdfError || error instanceof ApiError) return error.message
  return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.'
}

export function useAnalysis(onResult: (result: AnalysisResult) => void) {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' })
  const lastInput = useRef<LastInput | null>(null)
  const controller = useRef<AbortController | null>(null)

  const run = useCallback(
    async (input: LastInput) => {
      controller.current?.abort()
      const abort = new AbortController()
      controller.current = abort
      lastInput.current = input
      const startedAt = Date.now()

      try {
        let extracted = input.extracted
        if (!extracted) {
          setState({ status: 'reading', fileName: input.file.name, startedAt })
          // pdf.js is large; load it only when the first file is analyzed.
          const { validatePdfFile, extractPdfText } = await import('../lib/pdf')
          await validatePdfFile(input.file)
          extracted = await extractPdfText(input.file)
          input.extracted = extracted
        }
        if (abort.signal.aborted) return

        setState({
          status: 'analyzing',
          fileName: input.file.name,
          pages: extracted.pages,
          startedAt,
        })
        const result = await analyzeText(
          { fileName: input.file.name, pages: extracted.pages, text: extracted.text },
          abort.signal,
        )
        if (abort.signal.aborted) return
        setState({ status: 'done', result })
        onResult(result)
      } catch (error) {
        if (abort.signal.aborted) return
        // Invalid files cannot be fixed by retrying; network/AI errors can.
        const canRetry = !(error instanceof PdfError)
        setState({ status: 'error', message: errorMessage(error), canRetry })
      }
    },
    [onResult],
  )

  const analyzeFile = useCallback((file: File) => run({ file }), [run])

  const retry = useCallback(() => {
    if (lastInput.current) void run(lastInput.current)
  }, [run])

  const reset = useCallback(() => {
    controller.current?.abort()
    lastInput.current = null
    setState({ status: 'idle' })
  }, [])

  const show = useCallback((result: AnalysisResult) => {
    controller.current?.abort()
    setState({ status: 'done', result })
  }, [])

  return { state, analyzeFile, retry, reset, show }
}
