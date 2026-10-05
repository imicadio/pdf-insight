export type ErrorCode =
  | 'ORIGIN_NOT_ALLOWED'
  | 'METHOD_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_REQUEST'
  | 'RATE_LIMITED'
  | 'AI_INVALID_RESPONSE'
  | 'AI_REFUSED'
  | 'AI_UNAVAILABLE'
  | 'INTERNAL'

/** Error with an HTTP status and a user-facing Polish message. */
export class AppError extends Error {
  readonly status: number
  readonly code: ErrorCode
  readonly retryAfterSeconds?: number

  constructor(status: number, code: ErrorCode, message: string, retryAfterSeconds?: number) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}
