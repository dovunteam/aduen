import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertRestrictedRuntimeRole } from '../dist/runtimeRole.js'

const safeRole = {
  rolsuper: false,
  rolbypassrls: false,
  rolcreatedb: false,
  rolcreaterole: false,
  rolreplication: false,
  protected_table_count: 3,
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
    { owns_protected_table: true },
    { protected_table_count: 2 },
  ]) {
    await assert.rejects(assertRestrictedRuntimeRole(fakePool({ ...safeRole, ...change })), /must be restricted/u)
  }
  await assert.rejects(assertRestrictedRuntimeRole(fakePool(null)), /must be restricted/u)
})
