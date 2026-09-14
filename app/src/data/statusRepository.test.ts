import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listAuditEvents } from './auditRepository'
import { EMPTY_SUBMISSION } from '../domain/status'
import { readSubmission, saveSubmission } from './statusRepository'

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

  it('falls back to an empty record when stored status data is malformed', () => {
    localStorage.setItem('buktiva.submission-record.v1', JSON.stringify({ status: 'not-a-status', outcome: 'refund' }))
    expect(readSubmission()).toEqual(EMPTY_SUBMISSION)
  })

  it('rejects impossible dates and follow-ups before the submission date', () => {
    expect(() => saveSubmission({ ...EMPTY_SUBMISSION, submissionDate: '2026-02-30' })).toThrow('Invalid submission record')
    expect(() => saveSubmission({ ...EMPTY_SUBMISSION, submissionDate: '2026-09-20', nextFollowUpDate: '2026-09-19' })).toThrow('Invalid submission record')
    expect(readSubmission()).toEqual(EMPTY_SUBMISSION)
  })

  it('ignores stored records with invalid date fields', () => {
    localStorage.setItem('buktiva.submission-record.v1', JSON.stringify({ ...EMPTY_SUBMISSION, submissionDate: '2026-02-30' }))
    expect(readSubmission()).toEqual(EMPTY_SUBMISSION)
  })

  it('rejects lifecycle statuses without the facts that make them meaningful', () => {
    expect(() => saveSubmission({ ...EMPTY_SUBMISSION, status: 'handed_off' })).toThrow('Invalid submission record')
    expect(() => saveSubmission({ ...EMPTY_SUBMISSION, status: 'resolved', channel: 'merchant email', submissionDate: '2026-09-20' })).toThrow('Invalid submission record')
    expect(() => saveSubmission({ ...EMPTY_SUBMISSION, status: 'closed', channel: 'merchant email', submissionDate: '2026-09-20', outcome: 'refund' })).toThrow('Invalid submission record')
    expect(() => saveSubmission({ ...EMPTY_SUBMISSION, status: 'resolved', channel: 'merchant email', submissionDate: '2026-09-20', outcome: 'refund' })).not.toThrow()
  })

  it('rejects status text beyond the user-facing limits', () => {
    expect(() => saveSubmission({ ...EMPTY_SUBMISSION, channel: 'x'.repeat(241) })).toThrow('Invalid submission record')
    expect(() => saveSubmission({ ...EMPTY_SUBMISSION, response: 'x'.repeat(1201) })).toThrow('Invalid submission record')
  })

  it('rejects control characters in stored status text', () => {
    expect(() => saveSubmission({ ...EMPTY_SUBMISSION, channel: 'merchant\nemail' })).toThrow('Invalid submission record')
    expect(() => saveSubmission({ ...EMPTY_SUBMISSION, referenceNumber: 'REF\t123' })).toThrow('Invalid submission record')
    expect(() => saveSubmission({ ...EMPTY_SUBMISSION, response: 'Received\u0000' })).toThrow('Invalid submission record')
  })
})
