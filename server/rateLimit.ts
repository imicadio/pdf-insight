import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { AppError } from './errors.js'

/** Limits shared by both backends. Platform-level limiting is also set in Vercel Firewall (WAF). */
export const LIMITS = {
  perMinute: 5,
  perDay: 30,
  // Caps total daily spend no matter how many clients there are.
  globalPerDay: 500,
} as const

const MESSAGES = {
  perMinute: 'Zbyt wiele analiz w krótkim czasie. Spróbuj ponownie za minutę.',
  perDay: 'Osiągnięto dzienny limit analiz. Spróbuj ponownie jutro.',
  global: 'Dzienny limit demo został wyczerpany. Spróbuj ponownie jutro.',
} as const

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS

interface Limiter {
  check(ip: string): Promise<void>
}

/** Shared across all function instances; used when Upstash Redis credentials are configured. */
function redisLimiter(url: string, token: string): Limiter {
  const redis = new Redis({ url, token })
  const prefix = 'pdf-insight'
  const checks: [Ratelimit, keyOf: (ip: string) => string, message: string][] = [
    [
      new Ratelimit({
        redis,
        prefix: `${prefix}:min`,
        limiter: Ratelimit.slidingWindow(LIMITS.perMinute, '1 m'),
      }),
      (ip) => ip,
      MESSAGES.perMinute,
    ],
    [
      new Ratelimit({
        redis,
        prefix: `${prefix}:day`,
        limiter: Ratelimit.fixedWindow(LIMITS.perDay, '1 d'),
      }),
      (ip) => ip,
      MESSAGES.perDay,
    ],
    [
      new Ratelimit({
        redis,
        prefix: `${prefix}:all`,
        limiter: Ratelimit.fixedWindow(LIMITS.globalPerDay, '1 d'),
      }),
      () => 'global',
      MESSAGES.global,
    ],
  ]
  return {
    async check(ip) {
      for (const [limiter, keyOf, message] of checks) {
        const { success, reset } = await limiter.limit(keyOf(ip))
        if (!success) {
          throw new AppError(
            429,
            'RATE_LIMITED',
            message,
            Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
          )
        }
      }
    },
  }
}

/**
 * Per-instance sliding windows kept in memory. Vercel reuses warm instances (Fluid compute),
 * so this limits real traffic, but it is not shared between instances — the Vercel Firewall
 * rate-limit rule is the platform-wide layer in front of it.
 */
export function memoryLimiter(now: () => number = Date.now): Limiter {
  const hits = new Map<string, number[]>()

  return {
    async check(ip) {
      const time = now()
      const windows = (
        [
          [`min:${ip}`, LIMITS.perMinute, MINUTE_MS, MESSAGES.perMinute],
          [`day:${ip}`, LIMITS.perDay, DAY_MS, MESSAGES.perDay],
          ['global', LIMITS.globalPerDay, DAY_MS, MESSAGES.global],
        ] as const
      ).map(([key, limit, windowMs, message]) => ({
        key,
        limit,
        windowMs,
        message,
        recent: (hits.get(key) ?? []).filter((t) => time - t < windowMs),
      }))

      // Check every window before recording, so a rejected request does not use up quota.
      for (const { limit, windowMs, message, recent } of windows) {
        if (recent.length >= limit) {
          const retryAfter = Math.ceil((windowMs - (time - (recent[0] ?? time))) / 1000)
          throw new AppError(429, 'RATE_LIMITED', message, Math.max(1, retryAfter))
        }
      }
      for (const { key, recent } of windows) hits.set(key, [...recent, time])
    },
  }
}

let limiter: Limiter | undefined

function createLimiter(): Limiter {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  return url && token ? redisLimiter(url, token) : memoryLimiter()
}

export function clientIp(request: Request): string {
  // On Vercel x-forwarded-for is set by the platform to the real client IP (not spoofable).
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'unknown'
}

export async function enforceRateLimit(ip: string): Promise<void> {
  limiter ??= createLimiter()
  await limiter.check(ip)
}
