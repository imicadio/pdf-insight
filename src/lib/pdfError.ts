/** Problem with the uploaded file itself — retrying the same file will not help. */
export class PdfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfError'
  }
}
