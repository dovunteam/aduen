import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAX_HOSTED_CASE_RETENTION_DAYS, MIN_HOSTED_CASE_RETENTION_DAYS, parseHostedCaseRetentionDays, pruneExpiredHostedCases } from '../dist/pruneHostedCases.js'

test('hosted-case retention requires an explicit bounded whole-day period', () => {
  assert.equal(parseHostedCaseRetentionDays('365'), 365)
  assert.equal(parseHostedCaseRetentionDays('1'), 1)
  for (const value of [undefined, '', '0', '3651', '30.5', 'NaN', '-30']) assert.throws(() => parseHostedCaseRetentionDays(value))
  assert.equal(MIN_HOSTED_CASE_RETENTION_DAYS, 1)
  assert.equal(MAX_HOSTED_CASE_RETENTION_DAYS, 3650)
})

test('hosted-case pruning applies the cutoff transactionally and returns minimized counts', async () => {
  const calls = []
  const client = {
    async query(sql, params) { calls.push({ sql, params }); return { rowCount: sql.startsWith('DELETE') ? 3 : null } },
    release() { calls.push({ sql: 'RELEASE' }) },
  }
  const result = await pruneExpiredHostedCases({ connect: async () => client }, 30, new Date('2026-09-24T00:00:00.000Z'))
  assert.deepEqual(result, { deletedCount: 3, cutoff: '2026-08-25T00:00:00.000Z' })
  assert.equal(calls[0].sql, 'BEGIN')
  assert.match(calls[1].sql, /set_config\('aduen\.case_cutoff'/u)
  assert.deepEqual(calls[1].params, [result.cutoff])
  assert.match(calls[2].sql, /DELETE FROM aduen_cases WHERE updated_at < \$1/u)
  assert.deepEqual(calls[2].params, [result.cutoff])
  assert.equal(calls[3].sql, 'COMMIT')
  assert.equal(calls[4].sql, 'RELEASE')
})

test('hosted-case pruning rolls back and releases its connection after failure', async () => {
  const calls = []
  const client = {
    async query(sql) { calls.push(sql); if (sql.startsWith('DELETE')) throw new Error('synthetic database failure'); return { rowCount: null } },
    release() { calls.push('RELEASE') },
  }
  await assert.rejects(pruneExpiredHostedCases({ connect: async () => client }, 30), /synthetic database failure/u)
  assert.deepEqual(calls, ['BEGIN', "SELECT set_config('aduen.case_cutoff', $1, true)", 'DELETE FROM aduen_cases WHERE updated_at < $1::timestamptz', 'ROLLBACK', 'RELEASE'])
})
