import type { DocumentType } from './schema'

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  faktura: 'Faktura',
  umowa: 'Umowa',
  oferta: 'Oferta',
  raport: 'Raport',
  inne: 'Inny dokument',
}

export function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(value)
  } catch {
    return `${value.toLocaleString('pl-PL')} ${currency}`
  }
}

/** Formats YYYY-MM-DD, YYYY-MM or YYYY for display; the JSON keeps ISO 8601. */
export function formatIsoDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  if (!year) return value
  if (!month) return String(year)
  const date = new Date(Date.UTC(year, month - 1, day ?? 1))
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    ...(day ? { day: 'numeric' } : {}),
  }).format(date)
}

export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(['pl'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  )
}
