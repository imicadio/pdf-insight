import { describe, expect, it } from 'vitest'
import { AppError } from './errors'
import { LIMITS, memoryLimiter } from './rateLimit'

async function rejection(promise: Promise<void>): Promise<AppError | undefined> {
  try {
    await promise
    return undefined
  } catch (error) {
    return error instanceof AppError ? error : undefined
  }
}

describe('memoryLimiter', () => {
  it('allows the per-minute quota, then returns 429 until the window passes', async () => {
    let time = 0
    const limiter = memoryLimiter(() => time)
    for (let i = 0; i < LIMITS.perMinute; i++) await limiter.check('1.1.1.1')

    const error = await rejection(limiter.check('1.1.1.1'))
    expect(error?.status).toBe(429)
    expect(error?.retryAfterSeconds).toBe(60)

    // Another IP is not affected.
    await expect(limiter.check('2.2.2.2')).resolves.toBeUndefined()

    time += 60_000
    await expect(limiter.check('1.1.1.1')).resolves.toBeUndefined()
  })

  it('enforces the daily per-IP limit across minutes', async () => {
    let time = 0
    const limiter = memoryLimiter(() => time)
    for (let i = 0; i < LIMITS.perDay; i++) {
      await limiter.check('1.1.1.1')
      time += 15_000
    }
    const error = await rejection(limiter.check('1.1.1.1'))
    expect(error?.message).toContain('dzienny')
  })
})
