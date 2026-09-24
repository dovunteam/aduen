import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { Pool } from 'pg'
import { PgCaseStore } from '../dist/caseStore.js'
import { createPostgresRateLimitStore } from '../dist/postgresRateLimitStore.js'
import { pruneExpiredHostedCases } from '../dist/pruneHostedCases.js'
import { assertCurrentMigrations, assertRestrictedRuntimeRole } from '../dist/runtimeRole.js'

const databaseUrl = process.env.DATABASE_URL
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 1 }) : null
const migratorUrl = process.env.DATABASE_URL_MIGRATOR
const migratorPool = migratorUrl ? new Pool({ connectionString: migratorUrl, max: 1 }) : null
const maintenanceUrl = process.env.DATABASE_URL_MAINTENANCE
const maintenancePool = maintenanceUrl ? new Pool({ connectionString: maintenanceUrl, max: 1 }) : null
const testAdminUrl = process.env.DATABASE_URL_TEST_ADMIN
const testAdminPool = testAdminUrl ? new Pool({ connectionString: testAdminUrl, max: 1 }) : null
const backupUrl = process.env.DATABASE_URL_BACKUP
const backupPool = backupUrl ? new Pool({ connectionString: backupUrl, max: 1 }) : null

after(async () => { await Promise.all([pool?.end(), migratorPool?.end(), maintenancePool?.end(), testAdminPool?.end(), backupPool?.end()]) })

test('production runtime role is restricted and does not own policy-protected tables', { skip: !pool }, async () => {
  await assertRestrictedRuntimeRole(pool)
})

test('production runtime role can verify the exact applied migration checksums', { skip: !pool }, async () => {
  await assertCurrentMigrations(pool)
})

test('production runtime guard rejects the privileged migration role', { skip: !migratorPool }, async () => {
  await assert.rejects(assertRestrictedRuntimeRole(migratorPool), /must be restricted/u)
})

test('production runtime guard rejects TRUNCATE and public-schema CREATE grants', { skip: !pool || !migratorPool || !testAdminPool }, async () => {
  try {
    await migratorPool.query('GRANT TRUNCATE ON aduen_cases TO aduen_api')
    await assert.rejects(assertRestrictedRuntimeRole(pool), /must be restricted/u)
    await migratorPool.query('REVOKE TRUNCATE ON aduen_cases FROM aduen_api')

    await testAdminPool.query('GRANT CREATE ON SCHEMA public TO aduen_api')
    assert.equal((await pool.query("SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS allowed")).rows[0].allowed, true)
    await assert.rejects(assertRestrictedRuntimeRole(pool), /must be restricted/u)
  } finally {
    await migratorPool.query('REVOKE TRUNCATE ON aduen_cases FROM aduen_api')
    await testAdminPool.query('REVOKE CREATE ON SCHEMA public FROM aduen_api')
  }
  await assertRestrictedRuntimeRole(pool)
})

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

test('PostgreSQL backup role can read all owners while remaining read-only', { skip: !pool || !backupPool }, async () => {
  const store = new PgCaseStore(pool)
  const ownerA = `backup-owner-a-${crypto.randomUUID()}`
  const ownerB = `backup-owner-b-${crypto.randomUUID()}`
  const idA = crypto.randomUUID()
  const idB = crypto.randomUUID()
  try {
    await store.create(ownerA, makeRecord(idA))
    await store.create(ownerB, makeRecord(idB))

    const permissions = await backupPool.query(`SELECT
      has_table_privilege(current_user, 'public.aduen_cases', 'SELECT') AS can_read,
      has_table_privilege(current_user, 'public.aduen_cases', 'INSERT') AS can_insert,
      has_table_privilege(current_user, 'public.aduen_cases', 'UPDATE') AS can_update,
      has_table_privilege(current_user, 'public.aduen_cases', 'DELETE') AS can_delete,
      pg_has_role(current_user, 'pg_read_all_data', 'MEMBER') AS has_cluster_wide_read_role`)
    assert.deepEqual(permissions.rows[0], { can_read: true, can_insert: false, can_update: false, can_delete: false, has_cluster_wide_read_role: false })
    const rows = await backupPool.query('SELECT id FROM aduen_cases WHERE id = ANY($1::uuid[]) ORDER BY id', [[idA, idB]])
    assert.deepEqual(rows.rows.map((row) => row.id), [idA, idB].sort())
  } finally {
    await store.deleteAccountData(ownerA)
    await store.deleteAccountData(ownerB)
  }
})

test('PostgreSQL account deletion removes only that subject cases and audit rows', { skip: !pool || !testAdminPool }, async () => {
  const store = new PgCaseStore(pool)
  const owner = `account-delete-${crypto.randomUUID()}`
  const otherOwner = `account-retain-${crypto.randomUUID()}`
  const ownerId = crypto.randomUUID()
  const otherId = crypto.randomUUID()
  await store.create(owner, makeRecord(ownerId))
  await store.create(otherOwner, makeRecord(otherId))

  assert.deepEqual((await store.exportAll(owner)).map((item) => item.record.id), [ownerId])

  await store.deleteAccountData(owner)
  assert.equal((await store.list(owner, 50)).cases.length, 0)
  assert.equal((await store.get(otherOwner, otherId))?.record.id, otherId)
  assert.equal((await testAdminPool.query('SELECT id FROM aduen_case_audit_events WHERE owner_subject = $1', [owner])).rowCount, 0)
  assert.ok((await testAdminPool.query('SELECT id FROM aduen_case_audit_events WHERE owner_subject = $1', [otherOwner])).rowCount > 0)

  await store.deleteAccountData(otherOwner)
})

test('PostgreSQL rate-limit buckets are shared, HMAC-keyed, and pruned after expiry', { skip: !pool }, async () => {
  const hmacKey = 'integration-test-rate-limit-secret-key-32-bytes-minimum'
  const StoreA = createPostgresRateLimitStore(pool, hmacKey)
  const StoreB = createPostgresRateLimitStore(pool, hmacKey)
  const first = new StoreA({})
  const second = new StoreB({})
  const clientKey = `synthetic-ip-${crypto.randomUUID()}`
  const firstCount = await increment(first, clientKey, 1500)
  const secondCount = await increment(second, clientKey, 1500)
  assert.equal(firstCount.current, 1)
  assert.equal(secondCount.current, 2)
  assert.ok(firstCount.ttl > 0 && firstCount.ttl <= 1500)
  const expectedHash = (await import('node:crypto')).createHmac('sha256', hmacKey).update(clientKey).digest('hex')
  const row = await pool.query('SELECT key_hash, request_count FROM aduen_api_rate_limits WHERE key_hash = $1', [expectedHash])
  assert.deepEqual(row.rows[0], { key_hash: expectedHash, request_count: 2 })
  assert.equal((await pool.query('SELECT 1 FROM aduen_api_rate_limits WHERE key_hash = $1', [clientKey])).rowCount, 0)

  await new Promise((resolve) => setTimeout(resolve, 1600))
  const next = await increment(first, `synthetic-ip-${crypto.randomUUID()}`, 1500)
  assert.equal(next.current, 1)
  assert.equal((await pool.query('SELECT 1 FROM aduen_api_rate_limits WHERE key_hash = $1', [expectedHash])).rowCount, 0)
})

test('PostgreSQL retention role can delete expired rate-limit buckets only', { skip: !pool || !maintenancePool }, async () => {
  const keyHash = crypto.randomUUID().replaceAll('-', '').repeat(2)
  const expiredAt = new Date(Date.now() - 987_654_321).toISOString()
  const expiredWindowStart = new Date(Date.parse(expiredAt) - 60_000).toISOString()
  await pool.query('INSERT INTO aduen_api_rate_limits (key_hash, window_start, request_count, expires_at) VALUES ($1, now(), 1, now() + interval \'1 hour\') ON CONFLICT DO NOTHING', [keyHash])
  const client = await maintenancePool.connect()
  try {
    await assert.rejects(client.query('SELECT key_hash FROM aduen_api_rate_limits'), (error) => error.code === '42501')
    assert.equal((await client.query('SELECT expires_at FROM aduen_api_rate_limits WHERE expires_at > now()')).rowCount, 0)
    assert.equal((await client.query('DELETE FROM aduen_api_rate_limits WHERE expires_at > now()')).rowCount, 0)
    await pool.query('UPDATE aduen_api_rate_limits SET window_start = $2, expires_at = $3 WHERE key_hash = $1', [keyHash, expiredWindowStart, expiredAt])
    assert.equal((await client.query('SELECT expires_at FROM aduen_api_rate_limits WHERE expires_at = $1', [expiredAt])).rowCount, 1)
    assert.equal((await client.query('DELETE FROM aduen_api_rate_limits WHERE expires_at = $1', [expiredAt])).rowCount, 1)
    assert.equal((await client.query('SELECT expires_at FROM aduen_api_rate_limits WHERE expires_at = $1', [expiredAt])).rowCount, 0)
  } finally { client.release() }
})

test('PostgreSQL retention role can expire inactive hosted cases without reading their records', { skip: !pool || !maintenancePool }, async () => {
  const owner = `case-retention-${crypto.randomUUID()}`
  const expiredId = crypto.randomUUID()
  const currentId = crypto.randomUUID()
  const expiredAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  const currentAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const apiClient = await pool.connect()
  try {
    await apiClient.query('BEGIN')
    await setSubject(apiClient, owner)
    await insertRetentionCase(apiClient, owner, expiredId, expiredAt)
    await insertRetentionCase(apiClient, owner, currentId, currentAt)
    await apiClient.query('COMMIT')
  } catch (error) {
    await apiClient.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally { apiClient.release() }

  const maintenanceClient = await maintenancePool.connect()
  try {
    await assert.rejects(maintenanceClient.query('SELECT record FROM aduen_cases'), (error) => error.code === '42501')
    assert.equal((await maintenanceClient.query('SELECT updated_at FROM aduen_cases')).rowCount, 0)
    await maintenanceClient.query('BEGIN')
    await setSubject(maintenanceClient, owner)
    assert.equal((await maintenanceClient.query('SELECT updated_at FROM aduen_cases')).rowCount, 0)
    assert.equal((await maintenanceClient.query('DELETE FROM aduen_cases')).rowCount, 0)
    await maintenanceClient.query('ROLLBACK')
  } catch (error) {
    await maintenanceClient.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally { maintenanceClient.release() }

  const result = await pruneExpiredHostedCases(maintenancePool, 30)
  assert.equal(result.deletedCount, 1)
  const afterPruneClient = await maintenancePool.connect()
  try {
    await afterPruneClient.query('BEGIN')
    await afterPruneClient.query("SELECT set_config('aduen.case_cutoff', $1, true)", [result.cutoff])
    assert.equal((await afterPruneClient.query('SELECT updated_at FROM aduen_cases')).rowCount, 0)
    await afterPruneClient.query('COMMIT')
  } catch (error) {
    await afterPruneClient.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally { afterPruneClient.release() }

  const verifyClient = await pool.connect()
  try {
    await verifyClient.query('BEGIN')
    await setSubject(verifyClient, owner)
    assert.equal((await verifyClient.query('SELECT id FROM aduen_cases WHERE id = $1', [expiredId])).rowCount, 0)
    assert.equal((await verifyClient.query('SELECT id FROM aduen_cases WHERE id = $1', [currentId])).rowCount, 1)
    await verifyClient.query('DELETE FROM aduen_cases WHERE id = $1', [currentId])
    await verifyClient.query('COMMIT')
  } catch (error) {
    await verifyClient.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally { verifyClient.release() }
})

function increment(store, key, windowMs) {
  return new Promise((resolve, reject) => store.incr(key, (error, result) => error ? reject(error) : resolve(result), windowMs, 100))
}

test('PostgreSQL retention role can delete expired audit events without reading case data', { skip: !pool || !maintenancePool }, async () => {
  const owner = `retention-test-${crypto.randomUUID()}`
  const caseId = crypto.randomUUID()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const preExistingExpired = Number((await maintenancePool.query('SELECT count(*) FROM aduen_case_audit_events WHERE occurred_at < $1::timestamptz', [cutoff])).rows[0].count)
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
    assert.equal((await client.query('DELETE FROM aduen_cases')).rowCount, 0)

    await client.query('BEGIN')
    const unsetCutoff = await client.query("DELETE FROM aduen_case_audit_events WHERE occurred_at < now() + interval '1 day'")
    assert.equal(unsetCutoff.rowCount, 0)
    await client.query("SELECT set_config('aduen.audit_cutoff', $1, true)", [cutoff])
    const expired = await client.query('DELETE FROM aduen_case_audit_events WHERE occurred_at < $1::timestamptz', [cutoff])
    assert.equal(expired.rowCount, preExistingExpired + 1)
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

async function insertRetentionCase(client, owner, id, updatedAt) {
  const at = updatedAt.toISOString()
  const record = { ...makeRecord(id), createdAt: at, updatedAt: at }
  await client.query(
    'INSERT INTO aduen_cases (id, owner_subject, record, created_at, updated_at) VALUES ($1, $2, $3::jsonb, $4, $4)',
    [id, owner, JSON.stringify(record), updatedAt],
  )
}
