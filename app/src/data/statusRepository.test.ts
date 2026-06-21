import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listAuditEvents } from './auditRepository'
import { EMPTY_SUBMISSION } from '../domain/status'
import { saveSubmission } from './statusRepository'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('submission repository', () => {
  it('audits a changed external status record but not an identical save', () => {
    const saved = saveSubmission({ ...EMPTY_SUBMISSION, channel: 'merchant email', status: 'ready' })
    expect(listAuditEvents().map((event) => event.action)).toEqual(['submission_edited'])
    saveSubmission(saved)
    expect(listAuditEvents()).toHaveLength(1)
  })
})
