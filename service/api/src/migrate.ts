import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL_MIGRATOR
if (!databaseUrl) throw new Error('DATABASE_URL_MIGRATOR is required.')
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL !== 'true') throw new Error('DATABASE_SSL=true is required in production.')

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
  max: 1,
  connectionTimeoutMillis: 3_000,
  application_name: 'aduen-case-api-migrator',
})

try {
  for (const name of ['001_case_records.sql', '002_audit_retention.sql', '003_shared_rate_limits.sql']) {
    const migration = await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8')
    await pool.query(migration)
    console.info(`Aduen database migration ${name.slice(0, 3)} applied.`)
  }
} catch {
  console.error('Aduen case database migration failed.')
  process.exitCode = 1
} finally {
  await pool.end()
}
