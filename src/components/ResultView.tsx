import type { ReactNode } from 'react'
import { downloadJson } from '../lib/download'
import { DOCUMENT_TYPE_LABELS, formatAmount, formatIsoDate, languageName } from '../lib/format'
import type { AnalysisResult } from '../lib/schema'
import { JsonPreview } from './JsonPreview'

interface ResultViewProps {
  result: AnalysisResult
  onNew: () => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Empty() {
  return <p className="text-sm text-muted">Brak danych w dokumencie.</p>
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <Empty />
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <li
          key={`${index}-${item}`}
          className="rounded-full bg-accent-soft px-3 py-1 text-sm text-ink"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

export function ResultView({ result, onNew }: ResultViewProps) {
  const { document: doc } = result

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="rounded-full bg-accent px-2.5 py-1 text-on-accent">
            {DOCUMENT_TYPE_LABELS[doc.type]}
          </span>
          <span className="rounded-full border border-line px-2.5 py-1 text-muted">
            {languageName(doc.language)}
          </span>
          <span className="rounded-full border border-line px-2.5 py-1 text-muted">
            {doc.pages} {doc.pages === 1 ? 'strona' : 'str.'}
          </span>
          {doc.date && (
            <span className="rounded-full border border-line px-2.5 py-1 text-muted">
              <time dateTime={doc.date}>{formatIsoDate(doc.date)}</time>
            </span>
          )}
        </div>
        <h2 className="mt-3 text-xl font-semibold break-words text-ink sm:text-2xl">
          {doc.title ?? 'Dokument bez tytułu'}
        </h2>
        <p className="mt-1 text-sm break-all text-muted">{doc.fileName}</p>
        {result.meta.truncated && (
          <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-ink">
            Dokument był bardzo długi — przeanalizowano tylko jego początkową część.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={() => downloadJson(result)} className="btn-primary">
            Pobierz JSON
          </button>
          <button type="button" onClick={onNew} className="btn-secondary">
            Analizuj kolejny PDF
          </button>
        </div>
      </header>

      <Section title="Podsumowanie">
        <p className="leading-relaxed text-ink">{result.summary}</p>
      </Section>

      <Section title="Kluczowe punkty">
        <ul className="list-disc space-y-1.5 pl-5 text-ink marker:text-accent">
          {result.keyPoints.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Organizacje">
          <Chips items={result.entities.organizations} />
        </Section>
        <Section title="Osoby">
          <Chips items={result.entities.people} />
        </Section>
      </div>

      <Section title="Kwoty">
        {result.amounts.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-line">
            {result.amounts.map((amount, index) => (
              <li
                key={index}
                className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <span className="text-ink">{amount.context}</span>
                <span className="font-semibold tabular-nums whitespace-nowrap text-ink">
                  {formatAmount(amount.value, amount.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Daty">
        {result.dates.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-line">
            {result.dates.map((item, index) => (
              <li
                key={index}
                className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <span className="text-ink">{item.context}</span>
                <time dateTime={item.date} className="font-semibold whitespace-nowrap text-ink">
                  {formatIsoDate(item.date)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Słowa kluczowe">
        <Chips items={result.keywords} />
      </Section>

      <JsonPreview result={result} />
    </div>
  )
}
