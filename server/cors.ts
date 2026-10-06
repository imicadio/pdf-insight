/** Origins allowed to call the API, e.g. "https://imicadio.github.io,http://localhost:5173". */
export function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((entry) => toOrigin(entry.trim()))
    .filter((origin): origin is string => origin !== null)
}

/** Accepts full URLs too ("https://x.github.io/repo/") — browsers send only scheme + host. */
function toOrigin(value: string): string | null {
  try {
    return value ? new URL(value).origin : null
  } catch {
    return null
  }
}

export function isOriginAllowed(origin: string | null): origin is string {
  return origin !== null && allowedOrigins().includes(origin)
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}
