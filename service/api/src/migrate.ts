import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
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

const migrationNames = ['001_case_records.sql', '002_audit_retention.sql', '003_shared_rate_limits.sql', '004_hosted_case_retention.sql']
const migrationLockId = '73651294810273'

class MigrationHistoryError extends Error {}

try {
  const client = await pool.connect()
  let locked = false
  try {
    await client.query('SELECT pg_advisory_lock($1::bigint)', [migrationLockId])
    locked = true
    await client.query(`CREATE TABLE IF NOT EXISTS aduen_schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
      applied_at timestamptz NOT NULL DEFAULT now()
    )`)

    const recorded = await client.query<{ name: string; checksum: string }>('SELECT name, checksum FROM aduen_schema_migrations')
    const expected = new Set(migrationNames)
    const unexpected = recorded.rows.find((row) => !expected.has(row.name))
    if (unexpected) throw new MigrationHistoryError('Database contains a migration newer than this service.')

    const applied = new Map(recorded.rows.map((row) => [row.name, row.checksum]))
    for (const name of migrationNames) {
      const migration = await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8')
      const checksum = createHash('sha256').update(migration.replace(/\r\n?/gu, '\n'), 'utf8').digest('hex')
      const previousChecksum = applied.get(name)
      if (previousChecksum) {
        if (previousChecksum !== checksum) throw new MigrationHistoryError(`Applied migration ${name} has changed.`)
        console.info(`Aduen database migration ${name.slice(0, 3)} already applied.`)
        continue
      }

      await client.query('BEGIN')
      try {
        await client.query(migration)
        await client.query('INSERT INTO aduen_schema_migrations (name, checksum) VALUES ($1, $2)', [name, checksum])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw error
      }
      console.info(`Aduen database migration ${name.slice(0, 3)} applied.`)
    }
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1::bigint)', [migrationLockId]).catch(() => undefined)
    client.release()
  }
} catch (error) {
  console.error(error instanceof MigrationHistoryError
    ? `Aduen case database migration failed: ${error.message}`
    : 'Aduen case database migration failed.')
  process.exitCode = 1
} finally {
  await pool.end()
}
