import type { AnalysisResult } from './schema'

export function toJson(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2)
}

export function jsonFileName(pdfName: string): string {
  const base = pdfName.replace(/\.pdf$/i, '').replace(/[^\p{L}\p{N}._-]+/gu, '_') || 'dokument'
  return `${base}.insight.json`
}

export function downloadJson(result: AnalysisResult): void {
  const blob = new Blob([toJson(result)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = jsonFileName(result.document.fileName)
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
