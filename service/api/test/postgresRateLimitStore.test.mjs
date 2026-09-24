import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'
import { createPostgresRateLimitStore } from '../dist/postgresRateLimitStore.js'

const key = 'synthetic-shared-rate-limit-secret-123456'

test('PostgreSQL rate-limit store uses a shared HMAC key and returns atomic counter values', async () => {
  const counts = new Map()
  const calls = []
  const pool = { async query(sql, params) {
    calls.push({ sql, params })
    const [digest] = params
    const current = (counts.get(digest) ?? 0) + 1
    counts.set(digest, current)
    return { rows: [{ request_count: String(current), ttl: '42000' }] }
  } }
  const StoreOne = createPostgresRateLimitStore(pool, key)
  const StoreTwo = createPostgresRateLimitStore(pool, key)
  const storeOne = new StoreOne({})
  const storeTwo = new StoreTwo({})

  assert.deepEqual(await increment(storeOne, '192.0.2.42'), { current: 1, ttl: 42000 })
  assert.deepEqual(await increment(storeTwo, '192.0.2.42'), { current: 2, ttl: 42000 })
  assert.deepEqual(await increment(storeTwo, '192.0.2.43'), { current: 1, ttl: 42000 })
  assert.equal(calls[0].params[0], createHmac('sha256', key).update('192.0.2.42').digest('hex'))
  assert.equal(calls[0].params[0].includes('192.0.2.42'), false)
  assert.match(calls[0].sql, /ON CONFLICT \(key_hash, window_start\)/u)
  assert.match(calls[0].sql, /LIMIT 100/u)
  assert.equal(storeOne.child({ path: '/v1/cases', prefix: '' }), storeOne)
})

test('PostgreSQL rate-limit store fails closed when shared storage fails', async () => {
  const store = new (createPostgresRateLimitStore({ query: async () => { throw new Error('synthetic database failure') } }, key))({})
  await assert.rejects(increment(store, '192.0.2.42'), /synthetic database failure/u)
  assert.throws(() => createPostgresRateLimitStore({ query: async () => ({ rows: [] }) }, 'too-short'), /32 UTF-8 bytes/u)
})

function increment(store, address, timeWindow = 60_000, max = 120) {
  return new Promise((resolve, reject) => {
    store.incr(address, (error, result) => error ? reject(error) : resolve(result), timeWindow, max)
  })
}
