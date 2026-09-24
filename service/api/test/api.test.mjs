import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, test } from 'node:test'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { createApp } from '../dist/app.js'
import { AuthenticationUnavailable, createAuthenticator } from '../dist/auth.js'
import { caseRecordSchema } from '../dist/caseRecord.js'
import { readConfig } from '../dist/config.js'

let signingKey
const keyId = 'test-key'
let app
let jwksServer
let jwksUrl
let authenticator
let store

before(async () => {
  const pair = await generateKeyPair('RS256')
  signingKey = pair.privateKey
  const publicJwk = await exportJWK(pair.publicKey)
  publicJwk.kid = keyId
  publicJwk.alg = 'RS256'
  publicJwk.use = 'sig'
  jwksServer = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' })
    response.end(JSON.stringify({ keys: [publicJwk] }))
  })
  await new Promise((resolve) => jwksServer.listen(0, '127.0.0.1', resolve))
  const address = jwksServer.address()
  jwksUrl = `http://127.0.0.1:${address.port}/jwks`
  authenticator = createAuthenticator({ issuer: 'https://identity.example.test/', jwksUrl, audience: 'aduen-api' })
  store = new MemoryCaseStore()
  app = createApp(store, authenticator, ['https://app.example.test'])
  await app.ready()
})

after(async () => {
  await app.close()
  await new Promise((resolve, reject) => jwksServer.close((error) => error ? reject(error) : resolve()))
})

test('health is public and API responses disable caching and browser embedding', async () => {
  const response = await app.inject({ method: 'GET', url: '/health/live' })
  assert.equal(response.statusCode, 200)
  assert.equal(response.json().status, 'ok')
  assert.equal(response.headers['cache-control'], 'no-store')
  assert.equal(response.headers['x-content-type-options'], 'nosniff')
  assert.equal(response.headers['x-frame-options'], 'DENY')
  assert.match(response.headers['x-request-id'], /^[\da-f-]{36}$/iu)
})

test('production limiter keys requests by the client IP from explicitly trusted proxies', async () => {
  const keys = new Map()
  class SharedTestStore {
    incr(key, callback, timeWindow) {
      const current = (keys.get(key) ?? 0) + 1
      keys.set(key, current)
      callback(null, { current, ttl: timeWindow })
    }
    child() { return this }
  }
  const limitedApp = createApp(new MemoryCaseStore(), authenticator, [], () => {}, { trustedProxies: ['127.0.0.1'], rateLimitStore: SharedTestStore })
  await limitedApp.ready()
  try {
    const headers = bearer(await signToken({ sub: 'rate-limit-test' }))
    await limitedApp.inject({ method: 'GET', url: '/health/live', headers: { 'x-forwarded-for': '198.51.100.10' } })
    assert.equal(keys.size, 0)
    const response = await limitedApp.inject({ method: 'GET', url: '/v1/cases', headers: { ...headers, 'x-forwarded-for': '198.51.100.10' } })
    assert.equal(response.statusCode, 200)
    assert.deepEqual([...keys.keys()], ['198.51.100.10'])
    await limitedApp.inject({ method: 'GET', url: '/v1/cases', headers: { ...headers, 'x-forwarded-for': '198.51.100.11' } })
    assert.equal(keys.has('198.51.100.11'), true)
  } finally { await limitedApp.close() }
})

test('browser access requires an exact allowed origin and exposes revision headers', async () => {
  const preflight = await app.inject({ method: 'OPTIONS', url: '/v1/cases', headers: { origin: 'https://app.example.test', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'authorization,if-match' } })
  assert.equal(preflight.statusCode, 204)
  assert.equal(preflight.headers['access-control-allow-origin'], 'https://app.example.test')
  assert.match(preflight.headers['access-control-allow-headers'], /authorization/iu)
  assert.match(preflight.headers['access-control-allow-headers'], /if-match/iu)
  assert.match(preflight.headers['access-control-expose-headers'], /etag/iu)
  assert.match(preflight.headers['access-control-expose-headers'], /x-request-id/iu)

  const disallowed = await app.inject({ method: 'GET', url: '/v1/cases', headers: { origin: 'https://attacker.example.test' } })
  assert.equal(disallowed.headers['access-control-allow-origin'], undefined)
})

test('request logs correlate responses without recording case IDs, queries, tokens, or bodies', async () => {
  const record = makeRecord('550e8400-e29b-41d4-a716-446655440099')
  record.draft.consumerName = 'Synthetic Private Name'
  const token = await signToken({ sub: 'synthetic-private-subject' })
  const entries = []
  const loggingApp = createApp(new MemoryCaseStore(), authenticator, ['https://app.example.test'], (entry) => entries.push(entry))
  await loggingApp.ready()
  try {
    const response = await loggingApp.inject({ method: 'POST', url: '/v1/cases?private=query-value', headers: bearer(token), payload: record })
    assert.equal(response.statusCode, 201)
    assert.equal(response.headers['x-request-id'], entries[0].requestId)
    const unmatched = await loggingApp.inject({ method: 'GET', url: '/unmatched/550e8400-e29b-41d4-a716-446655440098?private=unmatched-value' })
    assert.equal(unmatched.statusCode, 404)
  } finally { await loggingApp.close() }

  assert.equal(entries.length, 2)
  assert.deepEqual(Object.keys(entries[0]).sort(), ['durationMs', 'event', 'method', 'requestId', 'route', 'statusCode'].sort())
  assert.deepEqual(entries[0], { event: 'api_request', requestId: entries[0].requestId, method: 'POST', route: '/v1/cases', statusCode: 201, durationMs: entries[0].durationMs })
  assert.equal(entries[1].event, 'api_request')
  assert.equal(entries[1].method, 'GET')
  assert.equal(entries[1].statusCode, 404)
  const serialized = JSON.stringify(entries)
  for (const sensitive of [record.id, '550e8400-e29b-41d4-a716-446655440098', record.draft.consumerName, 'private=query-value', 'unmatched-value', token, 'synthetic-private-subject']) assert.equal(serialized.includes(sensitive), false)
})

test('production refuses missing database TLS and insecure identity endpoints', () => {
  const config = { NODE_ENV: 'production', DATABASE_URL: 'postgres://localhost/aduen', AUTH_ISSUER: 'http://identity.example.test/', AUTH_JWKS_URL: 'http://identity.example.test/jwks', AUTH_AUDIENCE: 'aduen-api', CORS_ORIGINS: 'https://app.example.test', DATABASE_SSL: 'false' }
  assert.throws(() => readConfig(config), /DATABASE_SSL=true is required/u)
  assert.throws(() => readConfig({ ...config, DATABASE_SSL: 'true' }), /must use HTTPS/u)
  assert.throws(() => readConfig({ ...config, NODE_ENV: 'prod' }), /NODE_ENV must/u)
  assert.throws(() => readConfig({ ...config, DATABASE_SSL: 'true', AUTH_ISSUER: 'https://identity.example.test/', AUTH_JWKS_URL: 'https://identity.example.test/jwks', CORS_ORIGINS: 'https://app.example.test/path' }), /exact HTTP\(S\) origins/u)
  assert.throws(() => readConfig({ ...config, DATABASE_SSL: 'true', AUTH_ISSUER: 'https://identity.example.test/', AUTH_JWKS_URL: 'https://identity.example.test/jwks', CORS_ORIGINS: 'http://app.example.test' }), /must use HTTPS/u)
  const secure = { ...config, DATABASE_SSL: 'true', AUTH_ISSUER: 'https://identity.example.test/', AUTH_JWKS_URL: 'https://identity.example.test/jwks', TRUSTED_PROXIES: '10.20.0.0/16,2001:db8::1', RATE_LIMIT_HMAC_KEY: 'synthetic-shared-rate-limit-secret-123456', HOSTED_CASE_RETENTION_DAYS: '365' }
  assert.throws(() => readConfig({ ...secure, HOSTED_CASE_RETENTION_DAYS: '' }), /HOSTED_CASE_RETENTION_DAYS must be explicitly selected/u)
  assert.throws(() => readConfig({ ...secure, HOSTED_CASE_RETENTION_DAYS: '0' }), /whole number from 1 to 3650/u)
  assert.equal(readConfig({ ...secure, HOSTED_CASE_RETENTION_DAYS: '365' }).hostedCaseRetentionDays, 365)
  assert.throws(() => readConfig({ ...secure, AUTH_MAX_TOKEN_AGE_SECONDS: '59' }), /from 60 to 86400/u)
  assert.throws(() => readConfig({ ...secure, AUTH_MAX_TOKEN_AGE_SECONDS: '1.5' }), /whole number/u)
  assert.equal(readConfig(secure).authMaxTokenAgeSeconds, 3600)
  assert.throws(() => readConfig({ ...secure, TRUSTED_PROXIES: '' }), /TRUSTED_PROXIES must list/u)
  assert.throws(() => readConfig({ ...secure, TRUSTED_PROXIES: 'ingress.example.test' }), /IP addresses or CIDR/u)
  assert.throws(() => readConfig({ ...secure, RATE_LIMIT_HMAC_KEY: '' }), /RATE_LIMIT_HMAC_KEY is required/u)
  assert.throws(() => readConfig({ ...secure, RATE_LIMIT_HMAC_KEY: 'too-short' }), /at least 32 UTF-8 bytes/u)
  assert.deepEqual(readConfig(secure).trustedProxies, ['10.20.0.0/16', '2001:db8::1'])
})

test('case endpoints reject missing, forged, and wrong-audience bearer tokens', async () => {
  assert.equal((await app.inject({ method: 'GET', url: '/v1/cases' })).statusCode, 401)
  assert.equal((await app.inject({ method: 'GET', url: '/v1/cases', headers: { authorization: 'Bearer forged' } })).statusCode, 401)
  const token = await signToken({ sub: 'user-a', audience: 'other-api' })
  assert.equal((await app.inject({ method: 'GET', url: '/v1/cases', headers: bearer(token) })).statusCode, 401)
  assert.equal((await app.inject({ method: 'GET', url: '/v1/cases', headers: bearer(await signToken({ sub: 'bad\u0000subject' })) })).statusCode, 401)
  assert.equal((await app.inject({ method: 'GET', url: '/v1/cases', headers: bearer(await signToken({ ageSeconds: 3700, lifetimeSeconds: 7200 })) })).statusCode, 401)
  assert.equal((await app.inject({ method: 'GET', url: '/v1/cases', headers: bearer(await signToken({ issuedAt: false })) })).statusCode, 401)
})

test('identity-provider outages return unavailable instead of rejecting valid users', async () => {
  const unavailableServer = createServer((_request, response) => { response.writeHead(503); response.end() })
  await new Promise((resolve) => unavailableServer.listen(0, '127.0.0.1', resolve))
  const address = unavailableServer.address()
  const outageAuth = createAuthenticator({ issuer: 'https://identity.example.test/', jwksUrl: `http://127.0.0.1:${address.port}/jwks`, audience: 'aduen-api' })
  try {
    await assert.rejects(outageAuth(`Bearer ${await signToken()}`), AuthenticationUnavailable)
    const outageApp = createApp(store, outageAuth)
    const response = await outageApp.inject({ method: 'GET', url: '/v1/cases', headers: bearer(await signToken()) })
    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error, 'authentication_unavailable')
    await outageApp.close()
  } finally {
    await new Promise((resolve, reject) => unavailableServer.close((error) => error ? reject(error) : resolve()))
  }
})

test('cases are owner scoped, validated, and updated only with the current revision', async () => {
  const record = makeRecord()
  assert.equal(caseRecordSchema.safeParse(record).success, true)

  const invalid = { ...record, draft: { ...record.draft, amount: '-2.00' } }
  const bad = await app.inject({ method: 'POST', url: '/v1/cases', headers: bearer(await signToken({ sub: 'user-a' })), payload: invalid })
  assert.equal(bad.statusCode, 400)
  assert.equal(store.records.size, 0)

  const aliceToken = await signToken({ sub: 'user-a' })
  const created = await app.inject({ method: 'POST', url: '/v1/cases', headers: bearer(aliceToken), payload: record })
  assert.equal(created.statusCode, 201)
  assert.equal(created.headers.etag, '"1"')

  const bobToken = await signToken({ sub: 'user-b' })
  const hidden = await app.inject({ method: 'GET', url: `/v1/cases/${record.id}`, headers: bearer(bobToken) })
  assert.equal(hidden.statusCode, 404)
  assert.deepEqual((await app.inject({ method: 'GET', url: `/v1/cases/${record.id}`, headers: bearer(aliceToken) })).json().record, record)

  const changed = { ...record, status: 'review' }
  const stale = await app.inject({ method: 'PUT', url: `/v1/cases/${record.id}`, headers: { ...bearer(aliceToken), 'if-match': '"2"' }, payload: changed })
  assert.equal(stale.statusCode, 412)

  const saved = await app.inject({ method: 'PUT', url: `/v1/cases/${record.id}`, headers: { ...bearer(aliceToken), 'if-match': '"1"' }, payload: changed })
  assert.equal(saved.statusCode, 200)
  assert.equal(saved.headers.etag, '"2"')
  assert.equal(saved.json().record.status, 'review')
})

test('case deletion is owner scoped and requires an exact revision', async () => {
  const aliceToken = await signToken({ sub: 'user-a' })
  const bobToken = await signToken({ sub: 'user-b' })
  const record = makeRecord('550e8400-e29b-41d4-a716-446655440001')
  const created = await app.inject({ method: 'POST', url: '/v1/cases', headers: bearer(aliceToken), payload: record })
  assert.equal(created.statusCode, 201)

  const noPrecondition = await app.inject({ method: 'DELETE', url: `/v1/cases/${record.id}`, headers: bearer(aliceToken) })
  assert.equal(noPrecondition.statusCode, 428)
  const otherOwner = await app.inject({ method: 'DELETE', url: `/v1/cases/${record.id}`, headers: { ...bearer(bobToken), 'if-match': '"1"' } })
  assert.equal(otherOwner.statusCode, 412)
  const deleted = await app.inject({ method: 'DELETE', url: `/v1/cases/${record.id}`, headers: { ...bearer(aliceToken), 'if-match': '"1"' } })
  assert.equal(deleted.statusCode, 204)
  assert.equal((await app.inject({ method: 'GET', url: `/v1/cases/${record.id}`, headers: bearer(aliceToken) })).statusCode, 404)
})

test('account data deletion removes every hosted case for that subject and is idempotent', async () => {
  const aliceToken = await signToken({ sub: 'delete-account-a' })
  const bobToken = await signToken({ sub: 'delete-account-b' })
  const aliceCase = makeRecord('550e8400-e29b-41d4-a716-446655440011')
  const aliceCaseTwo = makeRecord('550e8400-e29b-41d4-a716-446655440012')
  const bobCase = makeRecord('550e8400-e29b-41d4-a716-446655440013')
  for (const record of [aliceCase, aliceCaseTwo]) assert.equal((await app.inject({ method: 'POST', url: '/v1/cases', headers: bearer(aliceToken), payload: record })).statusCode, 201)
  assert.equal((await app.inject({ method: 'POST', url: '/v1/cases', headers: bearer(bobToken), payload: bobCase })).statusCode, 201)

  const exported = await app.inject({ method: 'GET', url: '/v1/account/data/export', headers: bearer(aliceToken) })
  assert.equal(exported.statusCode, 200)
  assert.deepEqual(new Set(exported.json().cases.map((item) => item.record.id)), new Set([aliceCase.id, aliceCaseTwo.id]))
  assert.equal(exported.headers['cache-control'], 'no-store')

  const deleted = await app.inject({ method: 'DELETE', url: '/v1/account/data', headers: bearer(aliceToken) })
  assert.equal(deleted.statusCode, 204)
  assert.equal(store.records.has(`delete-account-a:${aliceCase.id}`), false)
  assert.equal(store.records.has(`delete-account-a:${aliceCaseTwo.id}`), false)
  assert.equal(store.records.has(`delete-account-b:${bobCase.id}`), true)
  assert.deepEqual((await store.exportAll('delete-account-b')).map((item) => item.record.id), [bobCase.id])
  assert.equal((await app.inject({ method: 'DELETE', url: '/v1/account/data', headers: bearer(aliceToken) })).statusCode, 204)
  assert.equal((await app.inject({ method: 'GET', url: '/v1/account/data' })).statusCode, 401)
})

async function signToken({ sub = 'user-a', audience = 'aduen-api', tokenIssuer = 'https://identity.example.test/', ageSeconds = 0, lifetimeSeconds = 300, issuedAt = true } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const token = new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: keyId })
    .setIssuer(tokenIssuer)
    .setSubject(sub)
    .setAudience(audience)
  if (issuedAt) token.setIssuedAt(now - ageSeconds)
  return token.setExpirationTime(now - ageSeconds + lifetimeSeconds).sign(signingKey)
}

function bearer(token) { return { authorization: `Bearer ${token}` } }

function makeRecord(id = '550e8400-e29b-41d4-a716-446655440000') {
  const at = '2026-09-01T00:00:00.000Z'
  return {
    id, createdAt: at, updatedAt: at, status: 'draft',
    draft: {
      consumerName: 'Synthetic Consumer', consumerLocation: 'malaysia', seller: 'Synthetic Store', sellerLocation: 'malaysia', platform: '',
      purchaseDate: '2026-08-01', amount: '125.50', claimAmount: '', claimAccruedDate: '', currency: 'MYR', paymentMethod: 'Card', orderReference: '',
      purpose: 'personal', issue: 'non_delivery', category: 'general_goods', remedy: 'refund', remedyAmount: '125.50', promisedDate: '', contactHistory: 'none', contactDate: '',
    },
    history: [{ at, actor: 'system', action: 'case_created', status: 'draft' }],
  }
}

class MemoryCaseStore {
  records = new Map()

  async ping() {}
  async list(subject, limit) {
    return { cases: [...this.records.entries()].filter(([key]) => key.startsWith(`${subject}:`)).slice(0, limit).map(([, value]) => value), nextCursor: null }
  }
  async exportAll(subject) { return [...this.records.entries()].filter(([key]) => key.startsWith(`${subject}:`)).map(([, value]) => value) }
  async get(subject, id) { return this.records.get(`${subject}:${id}`) ?? null }
  async create(subject, record) {
    const key = `${subject}:${record.id}`
    if (this.records.has(key)) throw Object.assign(new Error('duplicate'), { code: '23505' })
    const stored = { record, revision: 1 }
    this.records.set(key, stored)
    return stored
  }
  async replace(subject, id, record, revision) {
    const key = `${subject}:${id}`
    const current = this.records.get(key)
    if (!current || current.revision !== revision) return null
    const stored = { record, revision: revision + 1 }
    this.records.set(key, stored)
    return stored
  }
  async delete(subject, id, revision) {
    const key = `${subject}:${id}`
    const current = this.records.get(key)
    return Boolean(current && current.revision === revision && this.records.delete(key))
  }
  async deleteAccountData(subject) {
    for (const key of this.records.keys()) if (key.startsWith(`${subject}:`)) this.records.delete(key)
  }
}
