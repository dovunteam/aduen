import { Pool } from 'pg'
import { createAuthenticator } from './auth.js'
import { createApp } from './app.js'
import { readConfig } from './config.js'
import { PgCaseStore } from './caseStore.js'

const config = readConfig()
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
  max: 10,
  connectionTimeoutMillis: 3_000,
  idleTimeoutMillis: 30_000,
  application_name: 'aduen-case-api',
})
const app = createApp(new PgCaseStore(pool), createAuthenticator({ issuer: config.issuer, jwksUrl: config.jwksUrl, audience: config.audience }), config.corsOrigins)

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
  await app.listen({ host: config.host, port: config.port })
  console.info(`Aduen case API listening on ${config.host}:${config.port}`)
} catch {
  await pool.end()
  console.error('Aduen case API could not start. Check the database and network configuration.')
  process.exitCode = 1
}
