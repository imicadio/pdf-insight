import { Dropzone } from './Dropzone'
import { PrivacyNotice } from './PrivacyNotice'

const FEATURES = [
  { title: 'Podsumowanie', text: '3–5 zdań w języku dokumentu' },
  { title: 'Dane', text: 'Podmioty, kwoty, daty, słowa kluczowe' },
  { title: 'Eksport', text: 'Plik JSON zgodny ze schematem' },
]

export function EmptyState({ onFile }: { onFile: (file: File) => void }) {
  return (
    <div className="space-y-4">
      <Dropzone onFile={onFile} />
      <PrivacyNotice />
      <ul className="grid gap-3 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="text-sm font-semibold text-ink">{feature.title}</p>
            <p className="text-sm text-muted">{feature.text}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
