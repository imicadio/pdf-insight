import { DOCUMENT_TYPE_LABELS, formatDateTime } from '../lib/format'
import type { HistoryEntry } from '../lib/history'

interface HistoryPanelProps {
  entries: HistoryEntry[]
  activeId?: string
  onOpen: (entry: HistoryEntry) => void
  onRemove: (id: string) => void
  onClear: () => void
}

export function HistoryPanel({ entries, activeId, onOpen, onRemove, onClear }: HistoryPanelProps) {
  return (
    <section
      aria-labelledby="history-title"
      className="rounded-2xl border border-line bg-surface p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="history-title" className="text-sm font-semibold uppercase tracking-wide text-muted">
          Historia analiz
        </h2>
        {entries.length > 0 && (
          <button type="button" onClick={onClear} className="link text-sm">
            Wyczyść
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Tu pojawią się ostatnie wyniki. Są zapisywane tylko w tej przeglądarce.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((entry) => {
            const { document: doc, meta } = entry.result
            const active = entry.id === activeId
            return (
              <li
                key={entry.id}
                className={`flex items-center gap-2 rounded-xl border p-1 ${
                  active ? 'border-accent bg-accent-soft' : 'border-transparent'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpen(entry)}
                  aria-current={active ? 'true' : undefined}
                  className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left hover:bg-accent-soft"
                >
                  <span className="block truncate text-sm font-medium text-ink">
                    {doc.fileName}
                  </span>
                  <span className="block text-xs text-muted">
                    {DOCUMENT_TYPE_LABELS[doc.type]} · {formatDateTime(meta.analyzedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(entry.id)}
                  aria-label={`Usuń z historii: ${doc.fileName}`}
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
