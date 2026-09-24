import { randomUUID } from 'node:crypto'
import rateLimit from '@fastify/rate-limit'
import cors from '@fastify/cors'
import Fastify from 'fastify'
import { z } from 'zod'
import { caseRecordSchema } from './caseRecord.js'
import { AuthenticationUnavailable } from './auth.js'
import type { Authenticate } from './auth.js'
import type { CaseStore } from './caseStore.js'
import type { RateLimitStoreConstructor } from './postgresRateLimitStore.js'

const idSchema = z.uuid()
const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(512).optional(),
}).strict()

export type AppOptions = { trustedProxies?: string[]; rateLimitStore?: RateLimitStoreConstructor }

export function createApp(store: CaseStore, authenticate: Authenticate, corsOrigins: string[] = [], writeRequestLog: (entry: object) => void = (entry) => console.info(JSON.stringify(entry)), options: AppOptions = {}) {
  const trustedProxies = options.trustedProxies ?? []
  const app = Fastify({ logger: false, bodyLimit: 128 * 1024, trustProxy: trustedProxies.length ? trustedProxies : false, requestIdHeader: false, genReqId: () => randomUUID() })
  const requestStarted = new WeakMap<object, bigint>()
  void app.register(cors, { origin: corsOrigins, methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Authorization', 'Content-Type', 'If-Match'], exposedHeaders: ['ETag', 'X-Request-Id'], credentials: false, maxAge: 600 })
  if (options.rateLimitStore) {
    const sharedStore = new options.rateLimitStore({ max: 120, timeWindow: 60_000 } as never)
    app.addHook('onRequest', async (request, reply) => {
      if (request.url === '/health/live' || request.url === '/health/ready') return
      const result = await new Promise<{ current: number; ttl: number }>((resolve, reject) => {
        sharedStore.incr(request.ip, (error, value) => error ? reject(error) : resolve(value!), 60_000, 120)
      }).catch(() => null)
      if (!result) return reply.code(503).send({ error: 'rate_limit_unavailable' })
      if (result.current > 120) return reply.code(429).header('Retry-After', String(Math.max(1, Math.ceil(result.ttl / 1000)))).send({ error: 'rate_limited' })
    })
  } else {
    void app.register(rateLimit, { max: 120, timeWindow: '1 minute' })
  }
  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-Id', request.id)
    reply.header('Cache-Control', 'no-store')
    reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
    reply.header('Cross-Origin-Resource-Policy', 'same-origin')
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
    reply.header('Referrer-Policy', 'no-referrer')
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')
  })
  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url ?? 'unmatched'
    const startedAt = requestStarted.get(request)
    const durationMs = startedAt === undefined ? 0 : Number(process.hrtime.bigint() - startedAt) / 1_000_000
    writeRequestLog({ event: 'api_request', requestId: request.id, method: request.method, route, statusCode: reply.statusCode, durationMs: Math.round(durationMs * 100) / 100 })
  })
  app.addHook('onRequest', async (request) => { requestStarted.set(request, process.hrtime.bigint()) })

  app.get('/health/live', { config: { rateLimit: false } }, async () => ({ status: 'ok' }))
  app.get('/health/ready', { config: { rateLimit: false } }, async (_request, reply) => {
    try { await store.ping(); return { status: 'ready' } }
    catch { return reply.code(503).send({ error: 'not_ready' }) }
  })

  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/v1/')) return
    try { request.userSubject = await authenticate(request.headers.authorization) }
    catch (error) {
      if (error instanceof AuthenticationUnavailable) return reply.code(503).send({ error: 'authentication_unavailable' })
      return reply.code(401).header('WWW-Authenticate', 'Bearer').send({ error: 'unauthorized' })
    }
  })

  app.get('/v1/cases', async (request, reply) => {
    const query = pageSchema.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: 'invalid_query' })
    try { return await store.list(request.userSubject!, query.data.limit, query.data.cursor) }
    catch (error) { return error instanceof Error && error.message === 'invalid_cursor' ? reply.code(400).send({ error: 'invalid_cursor' }) : reply.code(500).send({ error: 'internal_error' }) }
  })

  app.post('/v1/cases', async (request, reply) => {
    const parsed = caseRecordSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_case_record', fields: parsed.error.flatten().fieldErrors })
    try {
      const stored = await store.create(request.userSubject!, parsed.data)
      return reply.code(201).header('ETag', etag(stored.revision)).send(stored)
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'case_id_conflict' })
      return reply.code(500).send({ error: 'internal_error' })
    }
  })

  app.get<{ Params: { id: string } }>('/v1/cases/:id', async (request, reply) => {
    if (!idSchema.safeParse(request.params.id).success) return reply.code(400).send({ error: 'invalid_case_id' })
    try {
      const stored = await store.get(request.userSubject!, request.params.id)
      return stored ? reply.header('ETag', etag(stored.revision)).send(stored) : reply.code(404).send({ error: 'case_not_found' })
    } catch { return reply.code(500).send({ error: 'internal_error' }) }
  })

  app.put<{ Params: { id: string } }>('/v1/cases/:id', async (request, reply) => {
    if (!idSchema.safeParse(request.params.id).success) return reply.code(400).send({ error: 'invalid_case_id' })
    const parsed = caseRecordSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_case_record', fields: parsed.error.flatten().fieldErrors })
    if (parsed.data.id !== request.params.id) return reply.code(400).send({ error: 'case_id_mismatch' })
    const revision = parseIfMatch(request.headers['if-match'])
    if (revision === 'missing') return reply.code(428).send({ error: 'if_match_required' })
    if (revision === 'invalid') return reply.code(400).send({ error: 'invalid_if_match' })
    try {
      const stored = await store.replace(request.userSubject!, request.params.id, parsed.data, revision)
      return stored ? reply.header('ETag', etag(stored.revision)).send(stored) : reply.code(412).send({ error: 'revision_conflict_or_case_not_found' })
    } catch { return reply.code(500).send({ error: 'internal_error' }) }
  })

  app.delete<{ Params: { id: string } }>('/v1/cases/:id', async (request, reply) => {
    if (!idSchema.safeParse(request.params.id).success) return reply.code(400).send({ error: 'invalid_case_id' })
    const revision = parseIfMatch(request.headers['if-match'])
    if (revision === 'missing') return reply.code(428).send({ error: 'if_match_required' })
    if (revision === 'invalid') return reply.code(400).send({ error: 'invalid_if_match' })
    try {
      const deleted = await store.delete(request.userSubject!, request.params.id, revision)
      return deleted ? reply.code(204).send() : reply.code(412).send({ error: 'revision_conflict_or_case_not_found' })
    } catch { return reply.code(500).send({ error: 'internal_error' }) }
  })

  app.delete('/v1/account/data', async (request, reply) => {
    try {
      await store.deleteAccountData(request.userSubject!)
      return reply.code(204).send()
    } catch { return reply.code(500).send({ error: 'internal_error' }) }
  })

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'not_found' }))
  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error instanceof Error && 'statusCode' in error ? error.statusCode : undefined
    if (statusCode === 413) return reply.code(413).send({ error: 'request_too_large' })
    if (statusCode === 400) return reply.code(400).send({ error: 'invalid_request' })
    return reply.code(500).send({ error: 'internal_error' })
  })
  return app
}

function etag(revision: number): string { return `"${revision}"` }
function parseIfMatch(value: string | undefined): number | 'missing' | 'invalid' {
  if (value === undefined) return 'missing'
  const match = value.match(/^"([1-9]\d*)"$/u)
  if (!match) return 'invalid'
  const revision = Number(match[1])
  return Number.isSafeInteger(revision) ? revision : 'invalid'
}
function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505')
}
