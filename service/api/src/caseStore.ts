import type { Pool, PoolClient } from 'pg'
import { z } from 'zod'
import type { CaseRecord } from './caseRecord.js'

export type StoredCase = { record: CaseRecord; revision: number }
export type CasePage = { cases: StoredCase[]; nextCursor: string | null }
export type CaseStore = {
  list(subject: string, limit: number, cursor?: string): Promise<CasePage>
  get(subject: string, id: string): Promise<StoredCase | null>
  create(subject: string, record: CaseRecord): Promise<StoredCase>
  replace(subject: string, id: string, record: CaseRecord, revision: number): Promise<StoredCase | null>
  delete(subject: string, id: string, revision: number): Promise<boolean>
  ping(): Promise<void>
}

export class PgCaseStore implements CaseStore {
  constructor(private readonly pool: Pool) {}

  async list(subject: string, limit: number, cursor?: string): Promise<CasePage> {
    return this.withSubject(subject, async (client) => {
      const cursorValue = cursor ? decodeCursor(cursor) : null
      const result = cursorValue
        ? await client.query<{ record: CaseRecord; revision: number }>(
          'SELECT record, revision FROM aduen_cases WHERE (updated_at, id) < ($1::timestamptz, $2::uuid) ORDER BY updated_at DESC, id DESC LIMIT $3',
          [cursorValue.updatedAt, cursorValue.id, limit + 1],
        )
        : await client.query<{ record: CaseRecord; revision: number }>(
          'SELECT record, revision FROM aduen_cases ORDER BY updated_at DESC, id DESC LIMIT $1', [limit + 1],
        )
      const rows = result.rows.slice(0, limit).map(toStoredCase)
      const last = rows.at(-1)
      const hasMore = result.rows.length > limit
      return { cases: rows, nextCursor: hasMore && last ? encodeCursor(last) : null }
    })
  }

  async get(subject: string, id: string): Promise<StoredCase | null> {
    return this.withSubject(subject, async (client) => {
      const result = await client.query<{ record: CaseRecord; revision: number }>(
        'SELECT record, revision FROM aduen_cases WHERE id = $1::uuid', [id],
      )
      return result.rows[0] ? toStoredCase(result.rows[0]) : null
    })
  }

  async create(subject: string, record: CaseRecord): Promise<StoredCase> {
    return this.withSubject(subject, async (client) => {
      const updatedAt = new Date().toISOString()
      const result = await client.query<{ record: CaseRecord; revision: number }>(
        `INSERT INTO aduen_cases (id, owner_subject, record, created_at, updated_at)
         VALUES ($1::uuid, $2, $3::jsonb, $4::timestamptz, $5::timestamptz)
         RETURNING record, revision`,
        [record.id, subject, JSON.stringify({ ...record, updatedAt }), record.createdAt, updatedAt],
      )
      await writeAudit(client, subject, record.id, 'case_created')
      return toStoredCase(result.rows[0]!)
    })
  }

  async replace(subject: string, id: string, record: CaseRecord, revision: number): Promise<StoredCase | null> {
    return this.withSubject(subject, async (client) => {
      const updatedAt = new Date().toISOString()
      const result = await client.query<{ record: CaseRecord; revision: number }>(
        `UPDATE aduen_cases
         SET record = $4::jsonb, updated_at = $5::timestamptz, revision = revision + 1
         WHERE id = $1::uuid AND owner_subject = $2 AND revision = $3
         RETURNING record, revision`,
        [id, subject, revision, JSON.stringify({ ...record, updatedAt }), updatedAt],
      )
      const row = result.rows[0]
      if (!row) return null
      await writeAudit(client, subject, id, 'case_updated')
      return toStoredCase(row)
    })
  }

  async delete(subject: string, id: string, revision: number): Promise<boolean> {
    return this.withSubject(subject, async (client) => {
      const result = await client.query(
        'DELETE FROM aduen_cases WHERE id = $1::uuid AND owner_subject = $2 AND revision = $3', [id, subject, revision],
      )
      if (result.rowCount !== 1) return false
      await writeAudit(client, subject, id, 'case_deleted')
      return true
    })
  }

  async ping(): Promise<void> { await this.pool.query('SELECT 1 FROM aduen_cases LIMIT 0') }

  private async withSubject<T>(subject: string, action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SELECT set_config('aduen.user_sub', $1, true)", [subject])
      const result = await action(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }
}

function toStoredCase(row: { record: CaseRecord; revision: number }): StoredCase {
  return { record: row.record, revision: Number(row.revision) }
}

function encodeCursor(item: StoredCase): string {
  return Buffer.from(`${item.record.updatedAt}\n${item.record.id}`).toString('base64url')
}

function decodeCursor(value: string): { updatedAt: string; id: string } {
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8')
    const [updatedAt, id, ...extra] = decoded.split('\n')
    if (extra.length || !updatedAt || !id || !isIsoTimestamp(updatedAt) || !z.uuid().safeParse(id).success) throw new Error()
    return { updatedAt, id }
  } catch {
    throw new Error('invalid_cursor')
  }
}

function isIsoTimestamp(value: string): boolean {
  try { return new Date(value).toISOString() === value } catch { return false }
}

async function writeAudit(client: PoolClient, subject: string, caseId: string, action: string): Promise<void> {
  await client.query(
    'INSERT INTO aduen_case_audit_events (owner_subject, case_id, action) VALUES ($1, $2::uuid, $3)', [subject, caseId, action],
  )
}
