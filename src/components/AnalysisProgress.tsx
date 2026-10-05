import { useEffect, useState } from 'react'

interface AnalysisProgressProps {
  step: 'reading' | 'analyzing'
  fileName: string
  pages?: number
  startedAt: number
  onCancel: () => void
}

const STEPS = [
  { id: 'reading', label: 'Odczyt tekstu z PDF' },
  { id: 'analyzing', label: 'Analiza AI: podsumowanie i dane' },
] as const

export function AnalysisProgress({
  step,
  fileName,
  pages,
  startedAt,
  onCancel,
}: AnalysisProgressProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  const activeIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <section
      aria-labelledby="progress-title"
      className="rounded-2xl border border-line bg-surface p-6 sm:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="progress-title" className="text-lg font-semibold text-ink">
            Analizuję dokument…
          </h2>
          <p className="truncate text-sm text-muted" title={fileName}>
            {fileName}
            {pages ? ` · ${pages} ${pages === 1 ? 'strona' : 'str.'}` : ''}
          </p>
        </div>
        <span className="shrink-0 tabular-nums text-sm text-muted" aria-hidden="true">
          {seconds} s
        </span>
      </div>

      <ol className="mt-6 space-y-3">
        {STEPS.map((s, index) => {
          const done = index < activeIndex
          const active = index === activeIndex
          return (
            <li key={s.id} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${
                  done
                    ? 'bg-accent text-on-accent'
                    : active
                      ? 'border-2 border-accent border-t-transparent animate-spin'
                      : 'border border-line text-muted'
                }`}
              >
                {done ? '✓' : active ? '' : index + 1}
              </span>
              <span className={active ? 'font-medium text-ink' : 'text-muted'}>
                {s.label}
                <span className="sr-only">
                  {done ? ' — zakończono' : active ? ' — w toku' : ' — oczekuje'}
                </span>
              </span>
            </li>
          )
        })}
      </ol>

      <p className="sr-only" aria-live="polite">
        {STEPS[activeIndex]?.label}
      </p>

      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="progress-bar h-full rounded-full bg-accent" />
      </div>

      <button type="button" onClick={onCancel} className="btn-ghost mt-6">
        Anuluj
      </button>
    </section>
  )
}
