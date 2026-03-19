import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const migrationNames = ['001_case_records.sql', '002_audit_retention.sql', '003_shared_rate_limits.sql', '004_hosted_case_retention.sql', '005_account_data_deletion.sql', '006_rate_limit_retention_batch.sql']

export type Migration = { name: string; checksum: string; sql: string }

export async function readMigrations(): Promise<Migration[]> {
  return Promise.all(migrationNames.map(async (name) => {
    const sql = await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8')
    const checksum = createHash('sha256').update(sql.replace(/\r\n?/gu, '\n'), 'utf8').digest('hex')
    return { name, checksum, sql }
  }))
}
