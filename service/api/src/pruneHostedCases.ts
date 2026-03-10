import { Pool } from 'pg'

export const MIN_HOSTED_CASE_RETENTION_DAYS = 1
export const MAX_HOSTED_CASE_RETENTION_DAYS = 3650
const DAY_MS = 24 * 60 * 60 * 1000

export function parseHostedCaseRetentionDays(value: string | undefined): number {
  if (!value || !/^\d+$/u.test(value)) throw new Error('HOSTED_CASE_RETENTION_DAYS must be an integer.')
  const days = Number(value)
  if (!Number.isSafeInteger(days) || days < MIN_HOSTED_CASE_RETENTION_DAYS || days > MAX_HOSTED_CASE_RETENTION_DAYS) {
    throw new Error(`HOSTED_CASE_RETENTION_DAYS must be between ${MIN_HOSTED_CASE_RETENTION_DAYS} and ${MAX_HOSTED_CASE_RETENTION_DAYS}.`)
  }
  return days
}

export async function pruneExpiredHostedCases(pool: Pick<Pool, 'connect'>, retentionDays: number, now = new Date()): Promise<{ deletedCount: number; cutoff: string }> {
  if (!Number.isSafeInteger(retentionDays) || retentionDays < MIN_HOSTED_CASE_RETENTION_DAYS || retentionDays > MAX_HOSTED_CASE_RETENTION_DAYS) throw new Error('Invalid hosted case retention period.')
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid current time.')
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS).toISOString()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('aduen.case_cutoff', $1, true)", [cutoff])
    const result = await client.query('DELETE FROM aduen_cases WHERE updated_at < $1::timestamptz', [cutoff])
    await client.query('COMMIT')
    return { deletedCount: result.rowCount ?? 0, cutoff }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

async function run(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL_MAINTENANCE
  if (!databaseUrl) throw new Error('DATABASE_URL_MAINTENANCE is required.')
  const retentionDays = parseHostedCaseRetentionDays(process.env.HOSTED_CASE_RETENTION_DAYS)
  const nodeEnv = process.env.NODE_ENV ?? 'development'
  const databaseSsl = process.env.DATABASE_SSL === 'true'
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV must be development, test, or production.')
  if (process.env.DATABASE_SSL !== undefined && !['true', 'false'].includes(process.env.DATABASE_SSL)) throw new Error('DATABASE_SSL must be true or false.')
  if (nodeEnv === 'production' && !databaseSsl) throw new Error('DATABASE_SSL=true is required in production.')

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseSsl ? { rejectUnauthorized: true } : false,
    max: 1,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 5_000,
    application_name: 'aduen-hosted-case-retention',
  })
  try {
    const result = await pruneExpiredHostedCases(pool, retentionDays)
    console.info(JSON.stringify({ event: 'hosted_case_retention_applied', deletedCount: result.deletedCount, cutoff: result.cutoff }))
  } catch {
    console.error('Aduen hosted case retention job failed.')
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

if (process.argv[1]?.endsWith('pruneHostedCases.js')) await run()
