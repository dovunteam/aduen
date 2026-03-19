import { Pool } from 'pg'
import { createAuthenticator } from './auth.js'
import { createApp } from './app.js'
import { readConfig } from './config.js'
import { PgCaseStore } from './caseStore.js'
import { createPostgresRateLimitStore } from './postgresRateLimitStore.js'
import { assertCurrentMigrations, assertRestrictedRuntimeRole, ProductionDatabaseGuardError } from './runtimeRole.js'

const config = readConfig()
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
  max: 10,
  connectionTimeoutMillis: 3_000,
  statement_timeout: 10_000,
  query_timeout: 12_000,
  idle_in_transaction_session_timeout: 30_000,
  idleTimeoutMillis: 30_000,
  application_name: 'aduen-case-api',
})
const authenticate = createAuthenticator({ issuer: config.issuer, jwksUrl: config.jwksUrl, audience: config.audience, maxTokenAgeSeconds: config.authMaxTokenAgeSeconds })
const app = createApp(new PgCaseStore(pool), authenticate, config.corsOrigins, undefined, {
  trustedProxies: config.trustedProxies,
  metricsBearerToken: config.metricsBearerToken,
  ...(config.nodeEnv === 'production' ? { checkAuthenticationProvider: authenticate.checkProvider } : {}),
  getDatabasePoolMetrics: () => ({ total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }),
  ...(config.rateLimitHmacKey ? { rateLimitStore: createPostgresRateLimitStore(pool, [config.rateLimitHmacKey, ...(config.rateLimitHmacPreviousKey ? [config.rateLimitHmacPreviousKey] : [])]) } : {}),
})

let closing = false
async function shutdown(signal: string): Promise<void> {
  if (closing) return
  closing = true
  console.info(`Received ${signal}; shutting down.`)
  await app.close()
  await pool.end()
}

process.once('SIGINT', () => { void shutdown('SIGINT').finally(() => { process.exitCode = 0 }) })
process.once('SIGTERM', () => { void shutdown('SIGTERM').finally(() => { process.exitCode = 0 }) })

try {
  if (config.nodeEnv === 'production') {
    await assertRestrictedRuntimeRole(pool)
    await assertCurrentMigrations(pool)
  }
  await app.listen({ host: config.host, port: config.port })
  console.info(`Aduen case API listening on ${config.host}:${config.port}`)
} catch (error) {
  await pool.end()
  console.error(error instanceof ProductionDatabaseGuardError ? error.message : 'Aduen case API could not start. Check the database and network configuration.')
  process.exitCode = 1
}
