import { handleAnalyze, handleOptions } from '../server/handler.js'

// Vercel Function (Node.js runtime, Web Request/Response API).
// Flow: CORS allowlist → rate limit → body validation → Claude analysis → schema validation.
export function OPTIONS(request: Request): Response {
  return handleOptions(request)
}

export function POST(request: Request): Promise<Response> {
  return handleAnalyze(request)
}
