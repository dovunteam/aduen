import { describe, expect, it } from 'vitest'
import { createConsentRecord, NOTICE_VERSION } from './consent'

describe('consent record', () => {
  it('records version, purpose, time, and withdrawal path', () => {
    const record = createConsentRecord(new Date('2026-09-20T10:00:00Z'))
    expect(record).toEqual({ noticeVersion: NOTICE_VERSION, acceptedAt: '2026-09-20T10:00:00.000Z', purpose: 'case-preparation-and-local-storage', withdrawalPath: 'data-controls' })
  })
})
