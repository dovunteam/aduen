import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertCurrentMigrations, assertRestrictedRuntimeRole } from '../dist/runtimeRole.js'
import { readMigrations } from '../dist/migrationManifest.js'

const safeRole = {
  rolsuper: false,
  rolbypassrls: false,
  rolcreatedb: false,
  rolcreaterole: false,
  rolreplication: false,
  role_membership_count: 0,
  can_create_in_public_schema: false,
  protected_table_count: 3,
  has_unsafe_protected_table_privileges: false,
  owns_protected_table: false,
}

function fakePool(row) {
  return { query: async (sql, values) => {
    assert.match(sql, /pg_has_role/u)
    assert.deepEqual(values, [['aduen_cases', 'aduen_case_audit_events', 'aduen_api_rate_limits']])
    return { rows: row ? [row] : [] }
  } }
}

test('production runtime role accepts a restricted role with the protected schema present', async () => {
  await assert.doesNotReject(assertRestrictedRuntimeRole(fakePool(safeRole)))
})

test('production runtime role rejects elevated privileges, protected table ownership, and incomplete schema', async () => {
  for (const change of [
    { rolsuper: true },
    { rolbypassrls: true },
    { rolcreatedb: true },
    { rolcreaterole: true },
    { rolreplication: true },
    { role_membership_count: 1 },
    { can_create_in_public_schema: true },
    { has_unsafe_protected_table_privileges: true },
    { owns_protected_table: true },
    { protected_table_count: 2 },
  ]) {
    await assert.rejects(assertRestrictedRuntimeRole(fakePool({ ...safeRole, ...change })), /must be restricted/u)
  }
  await assert.rejects(assertRestrictedRuntimeRole(fakePool(null)), /must be restricted/u)
})

test('production startup rejects a missing, changed, or unknown database migration', async () => {
  const expected = await readMigrations()
  const schemaPool = (rows) => ({ query: async (sql) => {
    assert.equal(sql, 'SELECT name, checksum FROM aduen_schema_migrations')
    return { rows }
  } })

  const current = expected.map(({ name, checksum }) => ({ name, checksum }))
  await assert.doesNotReject(assertCurrentMigrations(schemaPool(current)))
  await assert.rejects(assertCurrentMigrations(schemaPool(expected.slice(0, -1))), /does not match/u)
  const changed = expected.map(({ name, checksum }, index) => ({ name, checksum: index === 0 ? '0'.repeat(64) : checksum }))
  await assert.rejects(assertCurrentMigrations(schemaPool(changed)), /does not match/u)
  await assert.rejects(assertCurrentMigrations(schemaPool([...expected.map(({ name, checksum }) => ({ name, checksum })), { name: '999_unknown.sql', checksum: '1'.repeat(64) }])), /does not match/u)
})
