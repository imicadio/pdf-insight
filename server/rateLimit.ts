import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { AppError } from './errors.js'

interface Limiters {
  perMinute: Ratelimit
  perDay: Ratelimit
  global: Ratelimit
}

let limiters: Limiters | undefined

function createLimiters(): Limiters | undefined {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url || !token) return undefined
  const redis = new Redis({ url, token })
  const prefix = 'pdf-insight'
  return {
    perMinute: new Ratelimit({
      redis,
      prefix: `${prefix}:min`,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
    }),
    perDay: new Ratelimit({
      redis,
      prefix: `${prefix}:day`,
      limiter: Ratelimit.fixedWindow(30, '1 d'),
    }),
    // Caps total daily spend no matter how many clients there are.
    global: new Ratelimit({
      redis,
      prefix: `${prefix}:all`,
      limiter: Ratelimit.fixedWindow(500, '1 d'),
    }),
  }
}

/** In-memory fallback for local development (per instance, not shared). */
const memory = new Map<string, number[]>()

function checkMemory(ip: string): void {
  const now = Date.now()
  const recent = (memory.get(ip) ?? []).filter((time) => now - time < 60_000)
  if (recent.length >= 5) {
    throw new AppError(
      429,
      'RATE_LIMITED',
      'Zbyt wiele analiz w krótkim czasie. Spróbuj ponownie za minutę.',
      60,
    )
  }
  memory.set(ip, [...recent, now])
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'unknown'
}

export async function enforceRateLimit(ip: string): Promise<void> {
  limiters ??= createLimiters()
  if (!limiters) {
    if (process.env.VERCEL_ENV === 'production') {
      throw new AppError(500, 'INTERNAL', 'Serwer nie jest poprawnie skonfigurowany.')
    }
    checkMemory(ip)
    return
  }

  const checks: [Ratelimit, string, string][] = [
    [limiters.perMinute, ip, 'Zbyt wiele analiz w krótkim czasie. Spróbuj ponownie za minutę.'],
    [limiters.perDay, ip, 'Osiągnięto dzienny limit analiz. Spróbuj ponownie jutro.'],
    [limiters.global, 'global', 'Dzienny limit demo został wyczerpany. Spróbuj ponownie jutro.'],
  ]
  for (const [limiter, key, message] of checks) {
    const { success, reset } = await limiter.limit(key)
    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
      throw new AppError(429, 'RATE_LIMITED', message, retryAfter)
    }
  }
}
