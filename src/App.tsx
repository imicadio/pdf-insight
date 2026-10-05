import { useCallback, useState } from 'react'
import { AnalysisProgress } from './components/AnalysisProgress'
import { EmptyState } from './components/EmptyState'
import { ErrorState } from './components/ErrorState'
import { HistoryPanel } from './components/HistoryPanel'
import { ResultView } from './components/ResultView'
import { useAnalysis } from './hooks/useAnalysis'
import {
  addToHistory,
  clearHistory,
  loadHistory,
  removeFromHistory,
  type HistoryEntry,
} from './lib/history'
import type { AnalysisResult } from './lib/schema'

export default function App() {
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)
  const [activeId, setActiveId] = useState<string>()

  const handleResult = useCallback((result: AnalysisResult) => {
    setHistory((entries) => {
      const next = addToHistory(entries, result)
      setActiveId(next[0]?.id)
      return next
    })
  }, [])

  const { state, analyzeFile, retry, reset, show } = useAnalysis(handleResult)

  function startNew() {
    setActiveId(undefined)
    reset()
  }

  function openEntry(entry: HistoryEntry) {
    setActiveId(entry.id)
    show(entry.result)
  }

  function removeEntry(id: string) {
    setHistory((entries) => removeFromHistory(entries, id))
    if (id === activeId) startNew()
  }

  function clearAll() {
    setHistory(clearHistory())
    if (state.status === 'done') startNew()
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-xl bg-accent text-sm font-bold text-on-accent"
          >
            PDF
          </span>
          <div>
            <h1 className="text-lg font-semibold text-ink">PDF Insight</h1>
            <p className="text-sm text-muted">Podsumowanie i dane strukturalne z dokumentu PDF</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:py-10">
        <div className="min-w-0">
          {state.status === 'idle' && <EmptyState onFile={analyzeFile} />}
          {(state.status === 'reading' || state.status === 'analyzing') && (
            <AnalysisProgress
              step={state.status}
              fileName={state.fileName}
              pages={state.status === 'analyzing' ? state.pages : undefined}
              startedAt={state.startedAt}
              onCancel={startNew}
            />
          )}
          {state.status === 'error' && (
            <ErrorState
              message={state.message}
              canRetry={state.canRetry}
              onRetry={retry}
              onReset={startNew}
            />
          )}
          {state.status === 'done' && <ResultView result={state.result} onNew={startNew} />}
        </div>

        <aside>
          <HistoryPanel
            entries={history}
            activeId={state.status === 'done' ? activeId : undefined}
            onOpen={openEntry}
            onRemove={removeEntry}
            onClear={clearAll}
          />
        </aside>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted sm:px-6">
        Wyniki generuje model AI i mogą zawierać błędy — zweryfikuj ważne informacje w dokumencie.
      </footer>
    </div>
  )
}
