export function PrivacyNotice() {
  return (
    <p className="flex gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="mt-0.5 size-4 shrink-0 text-accent"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
      <span>
        Tekst odczytany z pliku zostanie wysłany do zewnętrznego API AI (Anthropic Claude) w celu
        analizy. Nie wgrywaj dokumentów poufnych. Sam plik PDF nie opuszcza przeglądarki, a wyniki
        są zapisywane tylko lokalnie na tym urządzeniu.
      </span>
    </p>
  )
}
