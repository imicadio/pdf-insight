import { useState } from 'react'
import { downloadJson, toJson } from '../lib/download'
import type { AnalysisResult } from '../lib/schema'

export function JsonPreview({ result }: { result: AnalysisResult }) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'error'>('idle')
  const json = toJson(result)

  async function copy() {
    try {
      await navigator.clipboard.writeText(json)
      setCopied('ok')
    } catch {
      setCopied('error')
    }
    setTimeout(() => setCopied('idle'), 2000)
  }

  return (
    <details className="group rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-5 sm:p-6">
        <span className="text-sm font-semibold uppercase tracking-wide text-muted">
          Podgląd JSON
        </span>
        <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-line p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap gap-3">
          <button type="button" onClick={copy} className="btn-secondary">
            {copied === 'ok'
              ? 'Skopiowano'
              : copied === 'error'
                ? 'Nie udało się skopiować'
                : 'Kopiuj JSON'}
          </button>
          <button type="button" onClick={() => downloadJson(result)} className="btn-secondary">
            Pobierz .json
          </button>
        </div>
        <pre
          tabIndex={0}
          aria-label="Wynik analizy w formacie JSON"
          className="max-h-96 overflow-auto rounded-xl bg-code p-4 text-xs leading-relaxed text-code-ink"
        >
          <code>{json}</code>
        </pre>
      </div>
    </details>
  )
}
