import { useId, useRef, useState, type DragEvent } from 'react'

interface DropzoneProps {
  onFile: (file: File) => void
  compact?: boolean
}

export function Dropzone({ onFile, compact = false }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [dragging, setDragging] = useState(false)

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition-colors ${
        compact ? 'px-4 py-6' : 'px-6 py-12 sm:py-16'
      } ${
        dragging ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent/60'
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-10 text-accent"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" />
      </svg>
      <p className="text-base font-medium text-ink">
        {dragging ? 'Upuść plik, aby rozpocząć analizę' : 'Przeciągnij i upuść plik PDF tutaj'}
      </p>
      <p className="text-sm text-muted">lub</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-describedby={hintId}
        className="btn-primary"
      >
        Wybierz plik PDF
      </button>
      <p id={hintId} className="text-sm text-muted">
        Tylko pliki PDF z warstwą tekstową, maks. 10 MB
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onFile(file)
        }}
      />
    </div>
  )
}
