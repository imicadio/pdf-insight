import { useEffect, useRef } from 'react'

interface ErrorStateProps {
  message: string
  canRetry: boolean
  onRetry: () => void
  onReset: () => void
}

export function ErrorState({ message, canRetry, onRetry, onReset }: ErrorStateProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [message])

  return (
    <section role="alert" className="rounded-2xl border border-danger/40 bg-danger-soft p-6 sm:p-8">
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-danger outline-none">
        Nie udało się przeanalizować dokumentu
      </h2>
      <p className="mt-2 text-ink">{message}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {canRetry && (
          <button type="button" onClick={onRetry} className="btn-primary">
            Spróbuj ponownie
          </button>
        )}
        <button type="button" onClick={onReset} className="btn-secondary">
          Wybierz inny plik
        </button>
      </div>
    </section>
  )
}
