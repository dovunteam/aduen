import { createHmac } from 'node:crypto'
import type { Pool } from 'pg'
import type rateLimit from '@fastify/rate-limit'
import type { RouteOptions } from 'fastify'

type IncrementResult = { current: number; ttl: number }
type IncrementCallback = (error: Error | null, result?: IncrementResult) => void
export type RateLimitStoreConstructor = new (options: rateLimit.FastifyRateLimitOptions) => rateLimit.FastifyRateLimitStore

const incrementSql = `
  WITH expired_keys AS (
    SELECT key_hash, window_start
    FROM aduen_api_rate_limits
    WHERE expires_at <= clock_timestamp()
    ORDER BY expires_at
    LIMIT 100
  ), pruned AS (
    DELETE FROM aduen_api_rate_limits AS stored
    USING expired_keys
    WHERE stored.key_hash = expired_keys.key_hash AND stored.window_start = expired_keys.window_start
    RETURNING 1
  ), bucket AS (
    SELECT clock_timestamp() AS now, $2::double precision / 1000 AS window_seconds
  ), updated AS (
    INSERT INTO aduen_api_rate_limits (key_hash, window_start, request_count, expires_at)
    SELECT $1,
      to_timestamp(floor(extract(epoch FROM bucket.now) / bucket.window_seconds) * bucket.window_seconds),
      1,
      to_timestamp((floor(extract(epoch FROM bucket.now) / bucket.window_seconds) + 1) * bucket.window_seconds)
    FROM bucket
    ON CONFLICT (key_hash, window_start)
    DO UPDATE SET request_count = aduen_api_rate_limits.request_count + 1
    RETURNING request_count, expires_at
  )
  SELECT request_count,
    GREATEST(0, CEIL(extract(epoch FROM (expires_at - clock_timestamp())) * 1000))::integer AS ttl
  FROM updated
`

export function createPostgresRateLimitStore(pool: Pick<Pool, 'query'>, hmacKey: string): RateLimitStoreConstructor {
  if (Buffer.byteLength(hmacKey, 'utf8') < 32) throw new Error('Rate-limit HMAC key must contain at least 32 UTF-8 bytes.')

  class PostgresRateLimitStore implements rateLimit.FastifyRateLimitStore {
    constructor(_options: rateLimit.FastifyRateLimitOptions) {}

    incr(key: string, callback: IncrementCallback, timeWindow: number, _max: number): void {
      if (!Number.isSafeInteger(timeWindow) || timeWindow < 1) {
        callback(new Error('Rate-limit window must be a positive integer.'))
        return
      }
      const keyHash = createHmac('sha256', hmacKey).update(key, 'utf8').digest('hex')
      void pool.query<{ request_count: number; ttl: number }>(incrementSql, [keyHash, timeWindow]).then(({ rows }) => {
        const row = rows[0]
        if (!row) throw new Error('Rate-limit store returned no counter.')
        callback(null, { current: Number(row.request_count), ttl: Number(row.ttl) })
      }).catch((error: unknown) => callback(error instanceof Error ? error : new Error('Rate-limit storage failed.')))
    }

    child(_routeOptions: RouteOptions & { path: string; prefix: string }): rateLimit.FastifyRateLimitStore { return this }
  }

  return PostgresRateLimitStore
}
