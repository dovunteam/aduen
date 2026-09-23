import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { Pool } from 'pg'
import { PgCaseStore } from '../dist/caseStore.js'

const databaseUrl = process.env.DATABASE_URL
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 1 }) : null
const maintenanceUrl = process.env.DATABASE_URL_MAINTENANCE
const maintenancePool = maintenanceUrl ? new Pool({ connectionString: maintenanceUrl, max: 1 }) : null

after(async () => { await Promise.all([pool?.end(), maintenancePool?.end()]) })

test('PostgreSQL RLS isolates case reads, writes, and owner reassignment', { skip: !pool }, async () => {
  const id = crypto.randomUUID()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await setSubject(client, 'synthetic-owner-a')
    await client.query('INSERT INTO aduen_cases (id, owner_subject, record, created_at, updated_at) VALUES ($1, $2, $3::jsonb, now(), now())', [id, 'synthetic-owner-a', JSON.stringify({ id })])
    assert.equal((await client.query('SELECT id FROM aduen_cases WHERE id = $1', [id])).rowCount, 1)

    await setSubject(client, 'synthetic-owner-b')
    assert.equal((await client.query('SELECT id FROM aduen_cases WHERE id = $1', [id])).rowCount, 0)
    assert.equal((await client.query("UPDATE aduen_cases SET record = jsonb_build_object('id', $1) WHERE id = $1", [id])).rowCount, 0)

    await client.query('SAVEPOINT reject_cross_owner_insert')
    const foreignId = crypto.randomUUID()
    await assert.rejects(
      client.query('INSERT INTO aduen_cases (id, owner_subject, record, created_at, updated_at) VALUES ($1, $2, $3::jsonb, now(), now())', [foreignId, 'synthetic-owner-a', JSON.stringify({ id: foreignId })]),
      (error) => error.code === '42501',
    )
    await client.query('ROLLBACK TO SAVEPOINT reject_cross_owner_insert')
    await client.query('ROLLBACK')
  } finally {
    client.release()
  }
})

test('PostgreSQL store scopes CRUD and records minimized mutation events', { skip: !pool }, async () => {
  const store = new PgCaseStore(pool)
  const id = crypto.randomUUID()
  const owner = `synthetic-${crypto.randomUUID()}`
  const otherOwner = `synthetic-${crypto.randomUUID()}`
  const record = makeRecord(id)

  const created = await store.create(owner, record)
  assert.equal(created.revision, 1)
  assert.equal((await store.get(otherOwner, id)), null)
  assert.equal((await store.list(otherOwner, 50)).cases.length, 0)
  assert.equal((await store.get(owner, id)).revision, 1)

  const changed = { ...record, status: 'review' }
  const updated = await store.replace(owner, id, changed, 1)
  assert.equal(updated.revision, 2)
  assert.equal(updated.record.status, 'review')
  assert.equal(await store.replace(owner, id, record, 1), null)
  assert.equal(await store.delete(otherOwner, id, 2), false)
  assert.equal(await store.delete(owner, id, 2), true)
  assert.equal(await store.get(owner, id), null)
})

test('PostgreSQL retention role can delete expired audit events without reading case data', { skip: !pool || !maintenancePool }, async () => {
  const owner = `retention-test-${crypto.randomUUID()}`
  const caseId = crypto.randomUUID()
  const apiClient = await pool.connect()
  try {
    await apiClient.query('BEGIN')
    await setSubject(apiClient, owner)
    await apiClient.query(
      'INSERT INTO aduen_case_audit_events (owner_subject, case_id, action, occurred_at) VALUES ($1, $2, $3, now() - interval \'40 days\'), ($1, $2, $3, now())',
      [owner, caseId, 'case_updated'],
    )
    await apiClient.query('COMMIT')
  } catch (error) {
    await apiClient.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally { apiClient.release() }

  const client = await maintenancePool.connect()
  try {
    await assert.rejects(client.query('SELECT * FROM aduen_case_audit_events'), (error) => error.code === '42501')
    await assert.rejects(client.query('SELECT owner_subject FROM aduen_case_audit_events'), (error) => error.code === '42501')
    await assert.rejects(client.query('SELECT * FROM aduen_cases'), (error) => error.code === '42501')
    await assert.rejects(client.query('DELETE FROM aduen_cases'), (error) => error.code === '42501')

    await client.query('BEGIN')
    const unsetCutoff = await client.query("DELETE FROM aduen_case_audit_events WHERE occurred_at < now() + interval '1 day'")
    assert.equal(unsetCutoff.rowCount, 0)
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    await client.query("SELECT set_config('aduen.audit_cutoff', $1, true)", [cutoff])
    const expired = await client.query('DELETE FROM aduen_case_audit_events WHERE occurred_at < $1::timestamptz', [cutoff])
    assert.equal(expired.rowCount, 1)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally { client.release() }
})

async function setSubject(client, subject) {
  await client.query("SELECT set_config('aduen.user_sub', $1, true)", [subject])
}

function makeRecord(id) {
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
