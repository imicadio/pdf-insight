import {
  GlobalWorkerOptions,
  InvalidPDFException,
  PasswordException,
  getDocument,
} from 'pdfjs-dist'
import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api'
// `?url` makes Vite emit the worker as an asset and return its URL, including the `base` path.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PdfError } from './pdfError'

GlobalWorkerOptions.workerSrc = workerUrl

export const MAX_FILE_BYTES = 10 * 1024 * 1024
/** Below this many characters per page we assume a scan without a text layer. */
const MIN_CHARS_PER_PAGE = 30

export interface ExtractedPdf {
  text: string
  pages: number
}

/** Validates type and size, then checks the "%PDF-" magic bytes (the extension can lie). */
export async function validatePdfFile(file: File): Promise<void> {
  const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!looksLikePdf) throw new PdfError('Wybierz plik w formacie PDF.')
  if (file.size === 0) throw new PdfError('Plik jest pusty.')
  if (file.size > MAX_FILE_BYTES)
    throw new PdfError('Plik jest za duży. Maksymalny rozmiar to 10 MB.')
  const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer())
  if (header !== '%PDF-') throw new PdfError('Plik nie jest prawidłowym dokumentem PDF.')
}

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return 'str' in item
}

function normalizeText(text: string): string {
  return text
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function extractPdfText(file: File): Promise<ExtractedPdf> {
  const data = new Uint8Array(await file.arrayBuffer())
  const loadingTask = getDocument({ data })
  try {
    const pdf = await loadingTask.promise
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items
        .filter(isTextItem)
        .map((item) => item.str + (item.hasEOL ? '\n' : ''))
        .join('')
      pages.push(normalizeText(pageText))
      page.cleanup()
    }

    const text = pages.filter(Boolean).join('\n\n')
    if (text.replace(/\s/g, '').length < MIN_CHARS_PER_PAGE * Math.min(pdf.numPages, 3)) {
      throw new PdfError(
        'Ten PDF nie zawiera warstwy tekstowej (prawdopodobnie to skan). Obsługiwane są dokumenty z tekstem.',
      )
    }
    return { text, pages: pdf.numPages }
  } catch (error) {
    if (error instanceof PdfError) throw error
    if (error instanceof PasswordException) {
      throw new PdfError('PDF jest zabezpieczony hasłem. Usuń hasło i spróbuj ponownie.')
    }
    if (error instanceof InvalidPDFException) {
      throw new PdfError('Plik PDF jest uszkodzony lub nieprawidłowy.')
    }
    throw new PdfError('Nie udało się odczytać pliku PDF.')
  } finally {
    await loadingTask.destroy()
  }
}
